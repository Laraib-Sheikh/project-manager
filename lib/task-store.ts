import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeTaskInput, Task, TaskInput } from "./task-data";

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
  user_id: string | null;
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
      created_at TEXT NOT NULL,
      user_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `);
  migrateTasksTable(database);

  return database;
}

function migrateTasksTable(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const hasUserId = columns.some((column) => column.name === "user_id");

  if (!hasUserId) {
    db.exec("ALTER TABLE tasks ADD COLUMN user_id TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)");
  }
}

export function listTasks(userId: string): Task[] {
  const rows = getDb()
    .prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY datetime(created_at) DESC")
    .all(userId) as TaskRow[];

  return rows.map(rowToTask);
}

export function createTask(userId: string, input: Partial<TaskInput>, allowedProjects: string[]): Task {
  const task = {
    ...normalizeTaskInput(input, allowedProjects),
    id: `task-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString()
  } satisfies Task;

  if (!task.title) {
    throw new Error("Task title is required.");
  }

  getDb()
    .prepare(
      `INSERT INTO tasks (id, title, description, assignee, due_date, priority, status, project, tags, estimate, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      task.createdAt,
      userId
    );

  return task;
}

export function updateTask(userId: string, id: string, input: Partial<TaskInput>, allowedProjects: string[]): Task | null {
  const existing = getTaskForUser(userId, id);

  if (!existing) {
    return null;
  }

  const task = {
    ...existing,
    ...normalizeTaskInput({ ...existing, ...input }, allowedProjects),
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
       WHERE id = ? AND user_id = ?`
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
      id,
      userId
    );

  return task;
}

export function deleteTask(userId: string, id: string): boolean {
  const result = getDb().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, userId);
  return result.changes > 0;
}

function getTaskForUser(userId: string, id: string): Task | null {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(id, userId) as TaskRow | undefined;
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
