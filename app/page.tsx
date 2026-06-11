"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCollaboratorLabels } from "../lib/collaborator-labels";
import { priorities, Priority, statuses, Status, Task } from "../lib/task-data";
import { ProjectCollaborator } from "../lib/member-data";
import { Project } from "../lib/project-data";
import { getAuthHeaders, sessionKey, SessionUser } from "../lib/session";

type ViewMode = "board" | "list";

function createEmptyDraft(projectName = "", assignee = "") {
  return {
    title: "",
    description: "",
    assignee,
    dueDate: "",
    priority: "Normal" as Priority,
    status: "To Do" as Status,
    project: projectName,
    tags: "",
    estimate: 2
  };
}

const priorityRank: Record<Priority, number> = {
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1
};

export default function Home() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [projectCollaborators, setProjectCollaborators] = useState<ProjectCollaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [draft, setDraft] = useState(createEmptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [sortMode, setSortMode] = useState("priority");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(sessionKey);

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedSession) as SessionUser;

      if (!user.id) {
        window.localStorage.removeItem(sessionKey);
        router.replace("/login");
        return;
      }

      setCurrentUser(user);
      setIsCheckingAuth(false);
      void initializeWorkspace(user);
    } catch {
      window.localStorage.removeItem(sessionKey);
      router.replace("/login");
    }
  }, [router]);

  const projectNames = useMemo(() => userProjects.map((project) => project.name), [userProjects]);

  const draftProject = useMemo(
    () => userProjects.find((project) => project.name === draft.project),
    [draft.project, userProjects]
  );

  const projectAssignees = useMemo(() => {
    const labels = getCollaboratorLabels(projectCollaborators);

    if (draft.assignee && !labels.includes(draft.assignee)) {
      return [draft.assignee, ...labels];
    }

    return labels;
  }, [draft.assignee, projectCollaborators]);

  const assigneeFilterOptions = useMemo(() => {
    const names = new Set<string>();

    tasks.forEach((task) => {
      if (task.assignee) {
        names.add(task.assignee);
      }
    });

    getCollaboratorLabels(projectCollaborators).forEach((label) => names.add(label));

    return [...names].sort();
  }, [projectCollaborators, tasks]);

  async function loadProjectCollaborators(projectId: string | undefined, user: SessionUser) {
    if (!projectId) {
      setProjectCollaborators([]);
      return [];
    }

    setIsLoadingCollaborators(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        headers: getAuthHeaders(user)
      });

      if (!response.ok) {
        throw new Error("Unable to load project collaborators.");
      }

      const data = (await response.json()) as { collaborators: ProjectCollaborator[] };
      const collaborators = data.collaborators ?? [];
      setProjectCollaborators(collaborators);
      return collaborators;
    } catch (error) {
      setProjectCollaborators([]);
      setErrorMessage(getErrorMessage(error));
      return [];
    } finally {
      setIsLoadingCollaborators(false);
    }
  }

  useEffect(() => {
    if (!currentUser || !draftProject?.id) {
      return;
    }

    void loadProjectCollaborators(draftProject.id, currentUser);
  }, [currentUser, draftProject?.id]);

  async function initializeWorkspace(user: SessionUser) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const projectsResponse = await fetch("/api/projects", {
        headers: getAuthHeaders(user)
      });

      if (!projectsResponse.ok) {
        throw new Error("Unable to load your projects.");
      }

      const projectsData = (await projectsResponse.json()) as { projects: Project[] };

      if (projectsData.projects.length === 0) {
        router.replace("/onboard");
        return;
      }

      const firstProject = projectsData.projects[0];

      setUserProjects(projectsData.projects);

      const collaborators = await loadProjectCollaborators(firstProject?.id, user);
      const firstAssignee = getCollaboratorLabels(collaborators)[0] ?? "";

      setDraft(createEmptyDraft(firstProject?.name ?? "", firstAssignee));
      await loadTasks(user);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsLoading(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(sessionKey);
    router.replace("/login");
  }

  async function loadTasks(user = currentUser) {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/tasks", {
        headers: getAuthHeaders(user)
      });

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

    if (!draft.title.trim() || !currentUser) {
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
        headers: getAuthHeaders(currentUser),
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
      await resetDraftToFirstProject(currentUser);
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

    if (!existing || !currentUser) {
      return;
    }

    const previousTasks = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    setErrorMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: getAuthHeaders(currentUser),
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
    if (!currentUser) {
      return;
    }

    const previousTasks = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setErrorMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: getAuthHeaders(currentUser)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      if (editingId === taskId) {
        setEditingId(null);
        await resetDraftToFirstProject(currentUser);
      }
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function resetDraftToFirstProject(user: SessionUser) {
    const firstProject = userProjects[0];
    const collaborators = await loadProjectCollaborators(firstProject?.id, user);
    const firstAssignee = getCollaboratorLabels(collaborators)[0] ?? "";
    setDraft(createEmptyDraft(firstProject?.name ?? "", firstAssignee));
  }

  async function handleProjectChange(projectName: string) {
    if (!currentUser) {
      return;
    }

    const project = userProjects.find((entry) => entry.name === projectName);
    const collaborators = await loadProjectCollaborators(project?.id, currentUser);
    const labels = getCollaboratorLabels(collaborators);
    const nextAssignee = labels.includes(draft.assignee) ? draft.assignee : (labels[0] ?? "");

    setDraft({ ...draft, project: projectName, assignee: nextAssignee });
  }

  if (isCheckingAuth || !currentUser) {
    return (
      <main className="authStatus">
        <div className="notice">Checking your workspace session...</div>
      </main>
    );
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
          <Link href="/team">Team</Link>
        </nav>

        <div className="userPanel">
          <span>Signed in as</span>
          <strong>{currentUser.name}</strong>
          <button onClick={handleLogout} type="button">Log out</button>
        </div>

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
            <p className="eyebrow">Your workspace</p>
            <h1>{currentUser.name}&apos;s dashboard</h1>
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
                <button
                  className="ghostButton"
                  onClick={() => {
                    setEditingId(null);
                    if (currentUser) {
                      void resetDraftToFirstProject(currentUser);
                    }
                  }}
                  type="button"
                >
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
                Project
                <select onChange={(event) => void handleProjectChange(event.target.value)} value={draft.project}>
                  {projectNames.map((project) => (
                    <option key={project}>{project}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Assignee
                <select
                  disabled={isLoadingCollaborators || projectAssignees.length === 0}
                  onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}
                  value={draft.assignee}
                >
                  {isLoadingCollaborators ? (
                    <option value="">Loading collaborators...</option>
                  ) : projectAssignees.length === 0 ? (
                    <option value="">No collaborators on this project</option>
                  ) : (
                    projectAssignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))
                  )}
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
            {projectNames.map((project) => (
              <option key={project}>{project}</option>
            ))}
          </select>
          <select onChange={(event) => setAssigneeFilter(event.target.value)} value={assigneeFilter}>
            <option>All</option>
            {assigneeFilterOptions.map((assignee) => (
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
