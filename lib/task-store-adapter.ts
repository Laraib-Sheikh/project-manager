import { TaskInput } from "./task-data";
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

export async function listTasks() {
  if (shouldUsePostgres()) {
    return listPostgresTasks();
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.listTasks();
}

export async function createTask(input: Partial<TaskInput>) {
  if (shouldUsePostgres()) {
    return createPostgresTask(input);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.createTask(input);
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  if (shouldUsePostgres()) {
    return updatePostgresTask(id, input);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.updateTask(id, input);
}

export async function deleteTask(id: string) {
  if (shouldUsePostgres()) {
    return deletePostgresTask(id);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.deleteTask(id);
}
