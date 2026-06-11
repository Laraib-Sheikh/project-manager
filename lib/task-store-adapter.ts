import { TaskInput } from "./task-data";
import { listProjects } from "./project-store-adapter";
import {
  createPostgresTask,
  deletePostgresTask,
  listPostgresTasks,
  updatePostgresTask
} from "./task-store-postgres";

function shouldUsePostgres() {
  return Boolean(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL);
}

function shouldUseSqlite() {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

function getMissingDatabaseError() {
  return new Error(
    "Database is not configured for deployment. Add POSTGRES_URL or DATABASE_URL in Vercel, then redeploy."
  );
}

async function getAllowedProjects(userId: string) {
  const projects = await listProjects(userId);
  return projects.map((project) => project.name);
}

export async function listTasks(userId: string) {
  if (shouldUsePostgres()) {
    return listPostgresTasks(userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.listTasks(userId);
}

export async function createTask(userId: string, input: Partial<TaskInput>) {
  const allowedProjects = await getAllowedProjects(userId);

  if (allowedProjects.length === 0) {
    throw new Error("Create a project before adding tasks.");
  }

  if (shouldUsePostgres()) {
    return createPostgresTask(userId, input, allowedProjects);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.createTask(userId, input, allowedProjects);
}

export async function updateTask(userId: string, id: string, input: Partial<TaskInput>) {
  const allowedProjects = await getAllowedProjects(userId);

  if (shouldUsePostgres()) {
    return updatePostgresTask(userId, id, input, allowedProjects);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.updateTask(userId, id, input, allowedProjects);
}

export async function deleteTask(userId: string, id: string) {
  if (shouldUsePostgres()) {
    return deletePostgresTask(userId, id);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.deleteTask(userId, id);
}
