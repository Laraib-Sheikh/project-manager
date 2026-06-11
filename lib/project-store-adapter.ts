import { ProjectInput } from "./project-data";
import { createPostgresProject, listPostgresProjects } from "./project-store-postgres";

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

export async function listProjects(userId: string) {
  if (shouldUsePostgres()) {
    return listPostgresProjects(userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteProjectStore } = await import("./project-store");
  return sqliteProjectStore.listProjects(userId);
}

export async function createProject(userId: string, input: ProjectInput) {
  if (shouldUsePostgres()) {
    return createPostgresProject(userId, input);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteProjectStore } = await import("./project-store");
  return sqliteProjectStore.createProject(userId, input);
}

export async function getProjectById(projectId: string) {
  if (shouldUsePostgres()) {
    const { getPostgresProjectById } = await import("./project-store-postgres");
    return getPostgresProjectById(projectId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteProjectStore } = await import("./project-store");
  return sqliteProjectStore.getProjectById(projectId);
}
