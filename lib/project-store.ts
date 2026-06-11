import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeProjectInput, Project, ProjectInput } from "./project-data";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  user_id: string;
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
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    );
  `);

  return database;
}

export function listProjects(userId: string): Project[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT p.*,
              CASE WHEN p.user_id = ? THEN 'owner' ELSE pm.role END AS access_role
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       WHERE p.user_id = ? OR pm.user_id = ?
       ORDER BY datetime(p.created_at) ASC`
    )
    .all(userId, userId, userId, userId) as (ProjectRow & { access_role: string | null })[];

  return rows.map((row) => rowToProject(row, row.access_role ?? "owner"));
}

export function getProjectById(projectId: string): Project | null {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function createProject(userId: string, input: ProjectInput): Project {
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

  getDb()
    .prepare(
      `INSERT INTO projects (id, name, description, user_id, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(project.id, project.name, project.description, project.userId, project.createdAt);

  getDb()
    .prepare(
      `INSERT INTO project_members (project_id, user_id, role, joined_at)
       VALUES (?, ?, 'owner', ?)
       ON CONFLICT(project_id, user_id) DO NOTHING`
    )
    .run(project.id, project.userId, project.createdAt);

  return { ...project, role: "owner" };
}

function rowToProject(row: ProjectRow, role?: string): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at,
    role: (role as Project["role"]) ?? undefined
  };
}

export const sqliteProjectStore = {
  createProject,
  listProjects,
  getProjectById
};
