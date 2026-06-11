import postgres from "postgres";
import { normalizeProjectInput, Project, ProjectInput } from "./project-data";

type PostgresProjectRow = {
  id: string;
  name: string;
  description: string;
  user_id: string;
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

  await getSql()`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await getSql()`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)
  `;

  isReady = true;
}

export async function listPostgresProjects(userId: string): Promise<Project[]> {
  await ensureReady();

  const rows = await getSql()<PostgresProjectRow[]>`
    SELECT * FROM projects WHERE user_id = ${userId} ORDER BY created_at ASC
  `;

  return rows.map(rowToProject);
}

export async function createPostgresProject(userId: string, input: ProjectInput): Promise<Project> {
  await ensureReady();

  const normalized = normalizeProjectInput(input);

  if (!normalized.name) {
    throw new Error("Project name is required.");
  }

  const project = {
    id: `project-${crypto.randomUUID()}`,
    name: normalized.name,
    description: normalized.description,
    userId,
    createdAt: new Date().toISOString()
  } satisfies Project;

  await getSql()`
    INSERT INTO projects (id, name, description, user_id, created_at)
    VALUES (${project.id}, ${project.name}, ${project.description}, ${project.userId}, ${project.createdAt})
  `;

  return project;
}

function rowToProject(row: PostgresProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}
