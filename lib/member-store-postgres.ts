import postgres from "postgres";
import {
  INVITATION_EXPIRY_DAYS,
  MemberRole,
  PendingInvitationView,
  ProjectInvitation,
  TeamMemberView
} from "./member-data";

type PostgresInvitationRow = {
  id: string;
  project_id: string;
  email: string;
  invited_by: string;
  role: string;
  token: string;
  status: string;
  expires_at: string | Date;
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
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `;

  await getSql()`
    CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)
  `;

  await getSql()`
    CREATE TABLE IF NOT EXISTS project_invitations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await getSql()`
    CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email)
  `;

  await getSql()`
    CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id)
  `;

  isReady = true;
}

export async function ensurePostgresOwnerMembership(projectId: string, ownerId: string) {
  await ensureReady();

  const existing = await getSql()`
    SELECT 1 FROM project_members WHERE project_id = ${projectId} AND user_id = ${ownerId} LIMIT 1
  `;

  if (existing.length === 0) {
    await getSql()`
      INSERT INTO project_members (project_id, user_id, role, joined_at)
      VALUES (${projectId}, ${ownerId}, 'owner', ${new Date().toISOString()})
    `;
  }
}

export async function addPostgresProjectMember(projectId: string, userId: string, role: MemberRole) {
  await ensureReady();

  await getSql()`
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (${projectId}, ${userId}, ${role}, ${new Date().toISOString()})
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function isPostgresProjectOwner(projectId: string, userId: string) {
  await ensureReady();

  const rows = await getSql()`
    SELECT 1 FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${userId} AND role = 'owner'
    LIMIT 1
  `;

  if (rows.length > 0) {
    return true;
  }

  const projects = await getSql()<{ user_id: string }[]>`
    SELECT user_id FROM projects WHERE id = ${projectId} LIMIT 1
  `;

  return projects[0]?.user_id === userId;
}

export async function listPostgresMemberProjectIds(userId: string) {
  await ensureReady();

  const rows = await getSql()<{ project_id: string }[]>`
    SELECT project_id FROM project_members WHERE user_id = ${userId}
  `;

  return rows.map((row) => row.project_id);
}

export async function createPostgresInvitation(input: {
  projectId: string;
  email: string;
  invitedBy: string;
  role: MemberRole;
}): Promise<ProjectInvitation> {
  await ensureReady();

  const existingMember = await getSql()<{ id: string }[]>`
    SELECT u.id FROM app_users u
    INNER JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ${input.projectId} AND u.email = ${input.email}
    LIMIT 1
  `;

  if (existingMember.length > 0) {
    throw new Error("This user is already a member of the project.");
  }

  const now = new Date().toISOString();
  const pending = await getSql()<{ id: string }[]>`
    SELECT id FROM project_invitations
    WHERE project_id = ${input.projectId} AND email = ${input.email}
      AND status = 'pending' AND expires_at > ${now}
    LIMIT 1
  `;

  if (pending.length > 0) {
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

  await getSql()`
    INSERT INTO project_invitations
      (id, project_id, email, invited_by, role, token, status, expires_at, created_at)
    VALUES (
      ${invitation.id}, ${invitation.projectId}, ${invitation.email}, ${invitation.invitedBy},
      ${invitation.role}, ${invitation.token}, ${invitation.status},
      ${invitation.expiresAt}, ${invitation.createdAt}
    )
  `;

  return invitation;
}

export async function getPostgresInvitationByToken(token: string): Promise<ProjectInvitation | null> {
  await ensureReady();

  const rows = await getSql()<PostgresInvitationRow[]>`
    SELECT * FROM project_invitations WHERE token = ${token} LIMIT 1
  `;

  return rows[0] ? rowToInvitation(rows[0]) : null;
}

export async function getPostgresInvitationById(id: string): Promise<ProjectInvitation | null> {
  await ensureReady();

  const rows = await getSql()<PostgresInvitationRow[]>`
    SELECT * FROM project_invitations WHERE id = ${id} LIMIT 1
  `;

  return rows[0] ? rowToInvitation(rows[0]) : null;
}

export async function acceptPostgresInvitation(token: string, userId: string, userEmail: string) {
  const invitation = await getPostgresInvitationByToken(token);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid.");
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await getSql()`UPDATE project_invitations SET status = 'expired' WHERE id = ${invitation.id}`;
    throw new Error("This invitation has expired.");
  }

  if (invitation.email !== userEmail.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address.");
  }

  await addPostgresProjectMember(invitation.projectId, userId, invitation.role);
  await getSql()`UPDATE project_invitations SET status = 'accepted' WHERE id = ${invitation.id}`;

  return { ...invitation, status: "accepted" as const };
}

export async function revokePostgresInvitation(id: string, userId: string) {
  const invitation = await getPostgresInvitationById(id);

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  if (!(await isPostgresProjectOwner(invitation.projectId, userId))) {
    throw new Error("Only the project owner can revoke invitations.");
  }

  await getSql()`UPDATE project_invitations SET status = 'revoked' WHERE id = ${id}`;
}

export async function listPostgresTeamForUser(userId: string) {
  await ensureReady();

  const memberProjectIds = await listPostgresMemberProjectIds(userId);
  const ownedProjects = await getSql()<{ id: string }[]>`
    SELECT id FROM projects WHERE user_id = ${userId}
  `;

  const projectIds = [...new Set([...memberProjectIds, ...ownedProjects.map((p) => p.id)])];

  if (projectIds.length === 0) {
    return { members: [] as TeamMemberView[], pending: [] as PendingInvitationView[] };
  }

  const memberRows = await getSql()<
    {
      project_id: string;
      user_id: string;
      role: string;
      joined_at: string | Date;
      name: string;
      email: string;
      project_name: string;
    }[]
  >`
    SELECT pm.project_id, pm.user_id, pm.role, pm.joined_at,
           u.name, u.email, p.name AS project_name
    FROM project_members pm
    INNER JOIN app_users u ON u.id = pm.user_id
    INNER JOIN projects p ON p.id = pm.project_id
    WHERE pm.project_id = ANY(${projectIds})
    ORDER BY pm.joined_at ASC
  `;

  const members: TeamMemberView[] = memberRows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role as MemberRole,
    projectId: row.project_id,
    projectName: row.project_name,
    joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at)
  }));

  const now = new Date().toISOString();
  const pendingRows = await getSql()<
    {
      id: string;
      email: string;
      role: string;
      project_id: string;
      project_name: string;
      invited_by_name: string;
      expires_at: string | Date;
      created_at: string | Date;
    }[]
  >`
    SELECT i.id, i.email, i.role, i.project_id, i.expires_at, i.created_at,
           p.name AS project_name, u.name AS invited_by_name
    FROM project_invitations i
    INNER JOIN projects p ON p.id = i.project_id
    INNER JOIN app_users u ON u.id = i.invited_by
    WHERE i.project_id = ANY(${projectIds}) AND i.status = 'pending' AND i.expires_at > ${now}
    ORDER BY i.created_at DESC
  `;

  const pending: PendingInvitationView[] = pendingRows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as MemberRole,
    projectId: row.project_id,
    projectName: row.project_name,
    invitedByName: row.invited_by_name,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  }));

  return { members, pending };
}

function rowToInvitation(row: PostgresInvitationRow): ProjectInvitation {
  return {
    id: row.id,
    projectId: row.project_id,
    email: row.email,
    invitedBy: row.invited_by,
    role: row.role as MemberRole,
    token: row.token,
    status: row.status as ProjectInvitation["status"],
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}
