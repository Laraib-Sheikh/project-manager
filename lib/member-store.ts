import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  INVITATION_EXPIRY_DAYS,
  MemberRole,
  PendingInvitationView,
  ProjectCollaborator,
  ProjectInvitation,
  ProjectMember,
  TeamMemberView
} from "./member-data";

type MemberRow = {
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

type InvitationRow = {
  id: string;
  project_id: string;
  email: string;
  invited_by: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
};

type ProjectRow = {
  id: string;
  name: string;
  user_id: string;
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
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

    CREATE TABLE IF NOT EXISTS project_invitations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
    CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
  `);

  return database;
}

export function ensureOwnerMembership(projectId: string, ownerId: string) {
  const existing = getDb()
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, ownerId);

  if (!existing) {
    getDb()
      .prepare(
        `INSERT INTO project_members (project_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', ?)`
      )
      .run(projectId, ownerId, new Date().toISOString());
  }
}

export function addProjectMember(projectId: string, userId: string, role: MemberRole) {
  getDb()
    .prepare(
      `INSERT INTO project_members (project_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`
    )
    .run(projectId, userId, role, new Date().toISOString());
}

export function isProjectMember(projectId: string, userId: string) {
  const row = getDb()
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);

  return Boolean(row);
}

export function isProjectOwner(projectId: string, userId: string) {
  const row = getDb()
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'")
    .get(projectId, userId);

  if (row) {
    return true;
  }

  const project = getDb().prepare("SELECT user_id FROM projects WHERE id = ?").get(projectId) as
    | { user_id: string }
    | undefined;

  return project?.user_id === userId;
}

export function listMemberProjectIds(userId: string) {
  const rows = getDb()
    .prepare("SELECT project_id FROM project_members WHERE user_id = ?")
    .all(userId) as { project_id: string }[];

  return rows.map((row) => row.project_id);
}

export function createInvitation(input: {
  projectId: string;
  email: string;
  invitedBy: string;
  role: MemberRole;
}): ProjectInvitation {
  const existingMember = getDb()
    .prepare(
      `SELECT u.id FROM app_users u
       INNER JOIN project_members pm ON pm.user_id = u.id
       WHERE pm.project_id = ? AND u.email = ?`
    )
    .get(input.projectId, input.email) as { id: string } | undefined;

  if (existingMember) {
    throw new Error("This user is already a member of the project.");
  }

  const pending = getDb()
    .prepare(
      `SELECT id FROM project_invitations
       WHERE project_id = ? AND email = ? AND status = 'pending' AND expires_at > ?`
    )
    .get(input.projectId, input.email, new Date().toISOString()) as { id: string } | undefined;

  if (pending) {
    throw new Error("A pending invitation already exists for this email.");
  }

  const invitation = {
    id: `invite-${crypto.randomUUID()}`,
    projectId: input.projectId,
    email: input.email,
    invitedBy: input.invitedBy,
    role: input.role,
    token: crypto.randomUUID(),
    status: "pending" as const,
    expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  getDb()
    .prepare(
      `INSERT INTO project_invitations
       (id, project_id, email, invited_by, role, token, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      invitation.id,
      invitation.projectId,
      invitation.email,
      invitation.invitedBy,
      invitation.role,
      invitation.token,
      invitation.status,
      invitation.expiresAt,
      invitation.createdAt
    );

  return invitation;
}

export function getInvitationByToken(token: string): ProjectInvitation | null {
  const row = getDb().prepare("SELECT * FROM project_invitations WHERE token = ?").get(token) as
    | InvitationRow
    | undefined;

  return row ? rowToInvitation(row) : null;
}

export function getInvitationById(id: string): ProjectInvitation | null {
  const row = getDb().prepare("SELECT * FROM project_invitations WHERE id = ?").get(id) as InvitationRow | undefined;
  return row ? rowToInvitation(row) : null;
}

export function acceptInvitation(token: string, userId: string, userEmail: string): ProjectInvitation {
  const invitation = getInvitationByToken(token);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid.");
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    getDb().prepare("UPDATE project_invitations SET status = 'expired' WHERE id = ?").run(invitation.id);
    throw new Error("This invitation has expired.");
  }

  if (invitation.email !== userEmail.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address.");
  }

  addProjectMember(invitation.projectId, userId, invitation.role);
  getDb().prepare("UPDATE project_invitations SET status = 'accepted' WHERE id = ?").run(invitation.id);

  return { ...invitation, status: "accepted" };
}

export function revokeInvitation(id: string, userId: string) {
  const invitation = getInvitationById(id);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (!isProjectOwner(invitation.projectId, userId)) {
    throw new Error("Only the project owner can revoke invitations.");
  }

  getDb().prepare("UPDATE project_invitations SET status = 'revoked' WHERE id = ?").run(id);
}

export function listProjectCollaborators(projectId: string): ProjectCollaborator[] {
  const rows = getDb()
    .prepare(
      `SELECT pm.user_id, u.name, u.email, pm.role
       FROM project_members pm
       INNER JOIN app_users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.joined_at ASC`
    )
    .all(projectId) as { user_id: string; name: string; email: string; role: string }[];

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role as MemberRole
  }));
}

export function listTeamForUser(userId: string): { members: TeamMemberView[]; pending: PendingInvitationView[] } {
  const ownedOrMemberProjectIds = listMemberProjectIds(userId);
  const ownedProjects = getDb()
    .prepare("SELECT id FROM projects WHERE user_id = ?")
    .all(userId) as { id: string }[];

  const projectIds = [...new Set([...ownedOrMemberProjectIds, ...ownedProjects.map((p) => p.id)])];

  if (projectIds.length === 0) {
    return { members: [], pending: [] };
  }

  const placeholders = projectIds.map(() => "?").join(", ");

  const memberRows = getDb()
    .prepare(
      `SELECT pm.project_id, pm.user_id, pm.role, pm.joined_at,
              u.name, u.email, p.name AS project_name
       FROM project_members pm
       INNER JOIN app_users u ON u.id = pm.user_id
       INNER JOIN projects p ON p.id = pm.project_id
       WHERE pm.project_id IN (${placeholders})
       ORDER BY pm.joined_at ASC`
    )
    .all(...projectIds) as (MemberRow & { name: string; email: string; project_name: string })[];

  const members: TeamMemberView[] = memberRows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role as MemberRole,
    projectId: row.project_id,
    projectName: row.project_name,
    joinedAt: row.joined_at
  }));

  const pendingRows = getDb()
    .prepare(
      `SELECT i.id, i.email, i.role, i.project_id, i.expires_at, i.created_at,
              p.name AS project_name, u.name AS invited_by_name
       FROM project_invitations i
       INNER JOIN projects p ON p.id = i.project_id
       INNER JOIN app_users u ON u.id = i.invited_by
       WHERE i.project_id IN (${placeholders}) AND i.status = 'pending' AND i.expires_at > ?
       ORDER BY i.created_at DESC`
    )
    .all(...projectIds, new Date().toISOString()) as {
    id: string;
    email: string;
    role: string;
    project_id: string;
    project_name: string;
    invited_by_name: string;
    expires_at: string;
    created_at: string;
  }[];

  const pending: PendingInvitationView[] = pendingRows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as MemberRole,
    projectId: row.project_id,
    projectName: row.project_name,
    invitedByName: row.invited_by_name,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  }));

  return { members, pending };
}

function rowToInvitation(row: InvitationRow): ProjectInvitation {
  return {
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    invitedBy: row.invited_by,
    role: row.role as MemberRole,
    token: row.token,
    status: row.status as ProjectInvitation["status"],
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

export const sqliteMemberStore = {
  ensureOwnerMembership,
  addProjectMember,
  isProjectMember,
  isProjectOwner,
  listMemberProjectIds,
  listProjectCollaborators,
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  revokeInvitation,
  listTeamForUser
};
