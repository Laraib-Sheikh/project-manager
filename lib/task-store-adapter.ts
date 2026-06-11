import { getCollaboratorLabels } from "./collaborator-labels";
import { TaskInput } from "./task-data";
import { ensureOwnerMembership, listProjectCollaborators } from "./member-store-adapter";
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

async function getAllowedAssignees(userId: string, projectName: string) {
  const projects = await listProjects(userId);
  const project = projects.find((entry) => entry.name === projectName);

  if (!project) {
    return [];
  }

  await ensureOwnerMembership(project.id, project.userId);
  const collaborators = await listProjectCollaborators(project.id);
  return getCollaboratorLabels(collaborators);
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

  const projectName = String(input.project ?? allowedProjects[0]);
  const allowedAssignees = await getAllowedAssignees(userId, projectName);

  if (shouldUsePostgres()) {
    return createPostgresTask(userId, input, allowedProjects, allowedAssignees);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.createTask(userId, input, allowedProjects, allowedAssignees);
}

export async function updateTask(userId: string, id: string, input: Partial<TaskInput>) {
  const allowedProjects = await getAllowedProjects(userId);
  let projectName = String(input.project ?? "");

  if (!projectName) {
    const tasks = await listTasks(userId);
    projectName = tasks.find((task) => task.id === id)?.project ?? "";
  }

  const allowedAssignees = projectName ? await getAllowedAssignees(userId, projectName) : [];

  if (shouldUsePostgres()) {
    return updatePostgresTask(userId, id, input, allowedProjects, allowedAssignees);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteTaskStore } = await import("./task-store");
  return sqliteTaskStore.updateTask(userId, id, input, allowedProjects, allowedAssignees);
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
