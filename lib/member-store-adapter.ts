import { MemberRole } from "./member-data";
import {
  acceptPostgresInvitation,
  createPostgresInvitation,
  ensurePostgresOwnerMembership,
  getPostgresInvitationByToken,
  isPostgresProjectOwner,
  listPostgresMemberProjectIds,
  listPostgresProjectCollaborators,
  listPostgresTeamForUser,
  revokePostgresInvitation
} from "./member-store-postgres";

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

export async function ensureOwnerMembership(projectId: string, ownerId: string) {
  if (shouldUsePostgres()) {
    return ensurePostgresOwnerMembership(projectId, ownerId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.ensureOwnerMembership(projectId, ownerId);
}

export async function isProjectOwner(projectId: string, userId: string) {
  if (shouldUsePostgres()) {
    return isPostgresProjectOwner(projectId, userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.isProjectOwner(projectId, userId);
}

export async function listMemberProjectIds(userId: string) {
  if (shouldUsePostgres()) {
    return listPostgresMemberProjectIds(userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.listMemberProjectIds(userId);
}

export async function createInvitation(input: {
  projectId: string;
  email: string;
  invitedBy: string;
  role: MemberRole;
}) {
  if (shouldUsePostgres()) {
    return createPostgresInvitation(input);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.createInvitation(input);
}

export async function getInvitationByToken(token: string) {
  if (shouldUsePostgres()) {
    return getPostgresInvitationByToken(token);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.getInvitationByToken(token);
}

export async function acceptInvitation(token: string, userId: string, userEmail: string) {
  if (shouldUsePostgres()) {
    return acceptPostgresInvitation(token, userId, userEmail);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.acceptInvitation(token, userId, userEmail);
}

export async function revokeInvitation(id: string, userId: string) {
  if (shouldUsePostgres()) {
    return revokePostgresInvitation(id, userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.revokeInvitation(id, userId);
}

export async function listTeamForUser(userId: string) {
  if (shouldUsePostgres()) {
    return listPostgresTeamForUser(userId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.listTeamForUser(userId);
}

export async function listProjectCollaborators(projectId: string) {
  if (shouldUsePostgres()) {
    return listPostgresProjectCollaborators(projectId);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteMemberStore } = await import("./member-store");
  return sqliteMemberStore.listProjectCollaborators(projectId);
}
