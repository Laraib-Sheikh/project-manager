import postgres from "postgres";
import { normalizeTaskInput, starterTasks, Task, TaskInput } from "./task-data";

type PostgresTaskRow = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  due_date: string;
  priority: Task["priority"];
  status: Task["status"];
  project: string;
  tags: string[] | string;
  estimate: number;
  created_at: string | Date;
};

let client: ReturnType<typeof postgres> | null = null;
let isReady = false;

function getSql() {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error("PostgreSQL is not configured. Add POSTGRES_URL or DATABASE_URL in your Vercel environment variables.");
  }

  if (!client) {
    client = postgres(connectionString, {
      max: 1,
      ssl: "require"
    });
  }

  return client;
}

async function ensureReady() {
  if (isReady) {
    return;
  }

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      project TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      estimate INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  const rows = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM tasks`;

  if (Number(rows[0]?.count ?? 0) === 0) {
    for (const task of starterTasks) {
      await sql`
        INSERT INTO tasks (id, title, description, assignee, due_date, priority, status, project, tags, estimate, created_at)
        VALUES (
          ${task.id},
          ${task.title},
          ${task.description},
          ${task.assignee},
          ${task.dueDate},
          ${task.priority},
          ${task.status},
          ${task.project},
          ${sql.json(task.tags)},
          ${task.estimate},
          ${task.createdAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  isReady = true;
}

export async function listPostgresTasks(): Promise<Task[]> {
  await ensureReady();

  const rows = await getSql()<PostgresTaskRow[]>`
    SELECT * FROM tasks ORDER BY created_at DESC
  `;

  return rows.map(rowToTask);
}

export async function createPostgresTask(input: Partial<TaskInput>): Promise<Task> {
  await ensureReady();

  const task = {
    ...normalizeTaskInput(input),
    id: `task-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString()
  } satisfies Task;

  if (!task.title) {
    throw new Error("Task title is required.");
  }

  await getSql()`
    INSERT INTO tasks (id, title, description, assignee, due_date, priority, status, project, tags, estimate, created_at)
    VALUES (
      ${task.id},
      ${task.title},
      ${task.description},
      ${task.assignee},
      ${task.dueDate},
      ${task.priority},
      ${task.status},
      ${task.project},
      ${getSql().json(task.tags)},
      ${task.estimate},
      ${task.createdAt}
    )
  `;

  return task;
}

export async function updatePostgresTask(id: string, input: Partial<TaskInput>): Promise<Task | null> {
  await ensureReady();

  const existingRows = await getSql()<PostgresTaskRow[]>`
    SELECT * FROM tasks WHERE id = ${id} LIMIT 1
  `;
  const existing = existingRows[0] ? rowToTask(existingRows[0]) : null;

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

  await getSql()`
    UPDATE tasks
    SET
      title = ${task.title},
      description = ${task.description},
      assignee = ${task.assignee},
      due_date = ${task.dueDate},
      priority = ${task.priority},
      status = ${task.status},
      project = ${task.project},
      tags = ${getSql().json(task.tags)},
      estimate = ${task.estimate}
    WHERE id = ${id}
  `;

  return task;
}

export async function deletePostgresTask(id: string): Promise<boolean> {
  await ensureReady();

  const rows = await getSql()<PostgresTaskRow[]>`
    DELETE FROM tasks WHERE id = ${id} RETURNING *
  `;

  return rows.length > 0;
}

function rowToTask(row: PostgresTaskRow): Task {
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
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}

function parseTags(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  try {
    const tags = JSON.parse(value) as unknown;
    return Array.isArray(tags) ? tags.map(String) : [];
  } catch {
    return [];
  }
}
