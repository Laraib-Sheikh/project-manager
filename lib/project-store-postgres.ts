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

  await getSql()`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `;

  isReady = true;
}

export async function listPostgresProjects(userId: string): Promise<Project[]> {
  await ensureReady();

  const rows = await getSql()<(PostgresProjectRow & { access_role: string | null })[]>`
    SELECT DISTINCT p.*,
           CASE WHEN p.user_id = ${userId} THEN 'owner' ELSE pm.role END AS access_role
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId}
    WHERE p.user_id = ${userId} OR pm.user_id = ${userId}
    ORDER BY p.created_at ASC
  `;

  return rows.map((row) => rowToProject(row, row.access_role ?? "owner"));
}

export async function getPostgresProjectById(projectId: string): Promise<Project | null> {
  await ensureReady();

  const rows = await getSql()<PostgresProjectRow[]>`
    SELECT * FROM projects WHERE id = ${projectId} LIMIT 1
  `;

  return rows[0] ? rowToProject(rows[0]) : null;
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

  await getSql()`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (${project.id}, ${project.userId}, 'owner', ${project.createdAt})
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  return { ...project, role: "owner" };
}

function rowToProject(row: PostgresProjectRow, role?: string): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    role: (role as Project["role"]) ?? undefined
  };
}
