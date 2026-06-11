import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeTaskInput, starterTasks, Task, TaskInput } from "./task-data";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  due_date: string;
  priority: Task["priority"];
  status: Task["status"];
  project: string;
  tags: string;
  estimate: number;
  created_at: string;
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "orbit-pm.sqlite");

let database: DatabaseSync | null = null;

function getDb() {
  if (database) {
    return database;
  }

  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      project TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      estimate INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);
  seedTasks(database);

  return database;
}

function seedTasks(db: DatabaseSync) {
  const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };

  if (count.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO tasks (id, title, description, assignee, due_date, priority, status, project, tags, estimate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const task of starterTasks) {
    insert.run(
      task.id,
      task.title,
      task.description,
      task.assignee,
      task.dueDate,
      task.priority,
      task.status,
      task.project,
      JSON.stringify(task.tags),
      task.estimate,
      task.createdAt
    );
  }
}

export function listTasks(): Task[] {
  const rows = getDb()
    .prepare("SELECT * FROM tasks ORDER BY datetime(created_at) DESC")
    .all() as TaskRow[];

  return rows.map(rowToTask);
}

export function createTask(input: Partial<TaskInput>): Task {
  const task = {
    ...normalizeTaskInput(input),
    id: `task-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString()
  } satisfies Task;

  if (!task.title) {
    throw new Error("Task title is required.");
  }

  getDb()
    .prepare(
      `INSERT INTO tasks (id, title, description, assignee, due_date, priority, status, project, tags, estimate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      task.id,
      task.title,
      task.description,
      task.assignee,
      task.dueDate,
      task.priority,
      task.status,
      task.project,
      JSON.stringify(task.tags),
      task.estimate,
      task.createdAt
    );

  return task;
}

export function updateTask(id: string, input: Partial<TaskInput>): Task | null {
  const existing = getTask(id);

  if (!existing) {
    return null;
  }

  const task = {
    ...existing,
    ...normalizeTaskInput({ ...existing, ...input }),
    id,
    createdAt: existing.createdAt
  } satisfies Task;

  if (!task.title) {
    throw new Error("Task title is required.");
  }

  getDb()
    .prepare(
      `UPDATE tasks
       SET title = ?, description = ?, assignee = ?, due_date = ?, priority = ?, status = ?, project = ?, tags = ?, estimate = ?
       WHERE id = ?`
    )
    .run(
      task.title,
      task.description,
      task.assignee,
      task.dueDate,
      task.priority,
      task.status,
      task.project,
      JSON.stringify(task.tags),
      task.estimate,
      id
    );

  return task;
}

export function deleteTask(id: string): boolean {
  const result = getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return result.changes > 0;
}

function getTask(id: string): Task | null {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignee: row.assignee,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    project: row.project,
    tags: parseTags(row.tags),
    estimate: row.estimate,
    createdAt: row.created_at
  };
}

function parseTags(value: string): string[] {
  try {
    const tags = JSON.parse(value) as unknown;
    return Array.isArray(tags) ? tags.map(String) : [];
  } catch {
    return [];
  }
}

export const sqliteTaskStore = {
  createTask,
  deleteTask,
  listTasks,
  updateTask
};
