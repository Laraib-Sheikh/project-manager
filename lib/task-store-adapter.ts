import { TaskInput } from "./task-data";
import {
  createPostgresTask,
  deletePostgresTask,
  listPostgresTasks,
  updatePostgresTask
} from "./task-store-postgres";

function shouldUsePostgres() {
  return Boolean(process.env.POSTGRES_URL);
}

export async function listTasks() {
  if (shouldUsePostgres()) {
    return listPostgresTasks();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.listTasks();
}

export async function createTask(input: Partial<TaskInput>) {
  if (shouldUsePostgres()) {
    return createPostgresTask(input);
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.createTask(input);
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  if (shouldUsePostgres()) {
    return updatePostgresTask(id, input);
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.updateTask(id, input);
}

export async function deleteTask(id: string) {
  if (shouldUsePostgres()) {
    return deletePostgresTask(id);
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.deleteTask(id);
}
