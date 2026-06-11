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
  `);

  return database;
}

export function listProjects(userId: string): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY datetime(created_at) ASC")
    .all(userId) as ProjectRow[];

  return rows.map(rowToProject);
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

  return project;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at
  };
}

export const sqliteProjectStore = {
  createProject,
  listProjects
};
