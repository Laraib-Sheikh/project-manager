"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { assignees, priorities, Priority, projects, statuses, Status, Task } from "../lib/task-data";

type ViewMode = "board" | "list";

const emptyDraft = {
  title: "",
  description: "",
  assignee: assignees[0],
  dueDate: "",
  priority: "Normal" as Priority,
  status: "To Do" as Status,
  project: projects[0],
  tags: "",
  estimate: 2
};

const priorityRank: Record<Priority, number> = {
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [sortMode, setSortMode] = useState("priority");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/tasks");

      if (!response.ok) {
        throw new Error("Unable to load tasks from the database.");
      }

      const data = (await response.json()) as { tasks: Task[] };
      setTasks(data.tasks);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesQuery =
          !normalizedQuery ||
          [task.title, task.description, task.assignee, task.project, task.priority, task.status, ...task.tags]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesProject = projectFilter === "All" || task.project === projectFilter;
        const matchesAssignee = assigneeFilter === "All" || task.assignee === assigneeFilter;
        return matchesQuery && matchesProject && matchesAssignee;
      })
      .sort((a, b) => {
        if (sortMode === "dueDate") {
          return new Date(a.dueDate || "2999-01-01").getTime() - new Date(b.dueDate || "2999-01-01").getTime();
        }

        if (sortMode === "estimate") {
          return b.estimate - a.estimate;
        }

        return priorityRank[b.priority] - priorityRank[a.priority];
      });
  }, [assigneeFilter, projectFilter, query, sortMode, tasks]);

  const metrics = useMemo(() => {
    const done = tasks.filter((task) => task.status === "Done").length;
    const urgent = tasks.filter((task) => task.priority === "Urgent").length;
    const overdue = tasks.filter((task) => task.dueDate && task.status !== "Done" && new Date(task.dueDate) < startOfToday()).length;
    const hours = tasks.reduce((total, task) => total + task.estimate, 0);

    return { done, urgent, overdue, hours };
  }, [tasks]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.title.trim()) {
      return;
    }

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      assignee: draft.assignee,
      dueDate: draft.dueDate,
      priority: draft.priority,
      status: draft.status,
      project: draft.project,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      estimate: Number(draft.estimate) || 1
    };

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch(editingId ? `/api/tasks/${editingId}` : "/api/tasks", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { task: Task };
      setTasks((current) => {
        if (editingId) {
          return current.map((task) => (task.id === editingId ? data.task : task));
        }

        return [data.task, ...current];
      });
      setDraft(emptyDraft);
      setEditingId(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setDraft({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      project: task.project,
      tags: task.tags.join(", "),
      estimate: task.estimate
    });
  }

  async function updateStatus(taskId: string, status: Status) {
    const existing = tasks.find((task) => task.id === taskId);

    if (!existing) {
      return;
    }

    const previousTasks = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    setErrorMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...existing, status })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { task: Task };
      setTasks((current) => current.map((task) => (task.id === taskId ? data.task : task)));
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function deleteTask(taskId: string) {
    const previousTasks = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setErrorMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      if (editingId === taskId) {
        setEditingId(null);
        setDraft(emptyDraft);
      }
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brandMark">O</span>
          <div>
            <strong>Orbit PM</strong>
            <span>Project command center</span>
          </div>
        </div>

        <nav className="navList">
          <a className="active" href="#tasks">Tasks</a>
          <a href="#board">Board</a>
          <a href="#insights">Insights</a>
          <a href="#team">Team</a>
        </nav>

        <div className="sidebarPanel">
          <span>Workspace health</span>
          <strong>{Math.round((metrics.done / Math.max(tasks.length, 1)) * 100)}%</strong>
          <div className="progressTrack">
            <div style={{ width: `${(metrics.done / Math.max(tasks.length, 1)) * 100}%` }} />
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Team workspace</p>
            <h1>Project management dashboard</h1>
          </div>
          <div className="actions">
            <button className={viewMode === "board" ? "activeButton" : ""} onClick={() => setViewMode("board")} type="button">
              Board
            </button>
            <button className={viewMode === "list" ? "activeButton" : ""} onClick={() => setViewMode("list")} type="button">
              List
            </button>
          </div>
        </header>

        <section className="metrics" id="insights">
          <Metric label="Total tasks" value={tasks.length.toString()} />
          <Metric label="Completed" value={metrics.done.toString()} />
          <Metric label="Urgent" value={metrics.urgent.toString()} />
          <Metric label="Overdue" value={metrics.overdue.toString()} tone={metrics.overdue ? "danger" : "default"} />
          <Metric label="Est. hours" value={metrics.hours.toString()} />
        </section>

        <section className="composer" id="tasks">
          <form onSubmit={handleSubmit}>
            <div className="formHeader">
              <div>
                <p className="eyebrow">{editingId ? "Edit task" : "New task"}</p>
                <h2>{editingId ? "Update task details" : "Add work to the plan"}</h2>
              </div>
              {editingId && (
                <button className="ghostButton" onClick={() => { setEditingId(null); setDraft(emptyDraft); }} type="button">
                  Cancel
                </button>
              )}
            </div>

            <div className="formGrid">
              <label className="field wide">
                Task name
                <input
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Create pricing page wireframes"
                  value={draft.title}
                />
              </label>
              <label className="field wide">
                Description
                <textarea
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Add goals, acceptance notes, or blockers"
                  value={draft.description}
                />
              </label>
              <label className="field">
                Assignee
                <select onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} value={draft.assignee}>
                  {assignees.map((assignee) => (
                    <option key={assignee}>{assignee}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Due date
                <input onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} type="date" value={draft.dueDate} />
              </label>
              <label className="field">
                Priority
                <select onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })} value={draft.priority}>
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Status
                <select onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })} value={draft.status}>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Project
                <select onChange={(event) => setDraft({ ...draft, project: event.target.value })} value={draft.project}>
                  {projects.map((project) => (
                    <option key={project}>{project}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Estimate hours
                <input
                  min="1"
                  onChange={(event) => setDraft({ ...draft, estimate: Number(event.target.value) })}
                  type="number"
                  value={draft.estimate}
                />
              </label>
              <label className="field wide">
                Tags
                <input
                  onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                  placeholder="Design, Sprint, Client"
                  value={draft.tags}
                />
              </label>
            </div>
            <button className="primaryButton" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : editingId ? "Save changes" : "Add task"}
            </button>
          </form>
        </section>

        {errorMessage && (
          <div className="notice errorNotice" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="toolbar" aria-label="Task filters">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, tags..." value={query} />
          <select onChange={(event) => setProjectFilter(event.target.value)} value={projectFilter}>
            <option>All</option>
            {projects.map((project) => (
              <option key={project}>{project}</option>
            ))}
          </select>
          <select onChange={(event) => setAssigneeFilter(event.target.value)} value={assigneeFilter}>
            <option>All</option>
            {assignees.map((assignee) => (
              <option key={assignee}>{assignee}</option>
            ))}
          </select>
          <select onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
            <option value="priority">Priority</option>
            <option value="dueDate">Due date</option>
            <option value="estimate">Estimate</option>
          </select>
        </section>

        {isLoading ? (
          <div className="notice">Loading tasks from database...</div>
        ) : viewMode === "board" ? (
          <section className="board" id="board">
            {statuses.map((status) => {
              const columnTasks = filteredTasks.filter((task) => task.status === status);
              return (
                <div className="column" key={status}>
                  <div className="columnHeader">
                    <strong>{status}</strong>
                    <span>{columnTasks.length}</span>
                  </div>
                  <div className="taskStack">
                    {columnTasks.map((task) => (
                      <TaskCard
                        deleteTask={deleteTask}
                        key={task.id}
                        startEditing={startEditing}
                        task={task}
                        updateStatus={updateStatus}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="listView">
            <div className="listHeader">
              <span>Task</span>
              <span>Owner</span>
              <span>Date</span>
              <span>Priority</span>
              <span>Status</span>
            </div>
            {filteredTasks.map((task) => (
              <button className="listRow" key={task.id} onClick={() => startEditing(task)} type="button">
                <span>{task.title}</span>
                <span>{task.assignee}</span>
                <span>{formatDate(task.dueDate)}</span>
                <span className={`pill priority${task.priority}`}>{task.priority}</span>
                <span>{task.status}</span>
              </button>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}

async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function TaskCard({
  deleteTask,
  startEditing,
  task,
  updateStatus
}: {
  deleteTask: (taskId: string) => void;
  startEditing: (task: Task) => void;
  task: Task;
  updateStatus: (taskId: string, status: Status) => void;
}) {
  return (
    <article className="taskCard">
      <div className="taskTopline">
        <span className={`pill priority${task.priority}`}>{task.priority}</span>
        <span>{task.estimate}h</span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description || "No description added."}</p>
      <div className="tagRow">
        {task.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="taskMeta">
        <span>{task.assignee}</span>
        <span>{formatDate(task.dueDate)}</span>
      </div>
      <div className="cardControls">
        <select onChange={(event) => updateStatus(task.id, event.target.value as Status)} value={task.status}>
          {statuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <button onClick={() => startEditing(task)} type="button">Edit</button>
        <button className="dangerButton" onClick={() => deleteTask(task.id)} type="button">Delete</button>
      </div>
    </article>
  );
}

function Metric({ label, tone = "default", value }: { label: string; tone?: "default" | "danger"; value: string }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(date: string) {
  if (!date) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
