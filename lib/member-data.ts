export type MemberRole = "owner" | "member" | "viewer";

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
};

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type ProjectInvitation = {
  id: string;
  projectId: string;
  email: string;
  invitedBy: string;
  role: MemberRole;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type TeamMemberView = {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  projectId: string;
  projectName: string;
  joinedAt: string;
};

export type PendingInvitationView = {
  id: string;
  email: string;
  role: MemberRole;
  projectId: string;
  projectName: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
};

export const INVITATION_EXPIRY_DAYS = 7;

export function normalizeInviteEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function normalizeInviteRole(role: unknown): MemberRole {
  if (role === "owner" || role === "member" || role === "viewer") {
    return role;
  }

  return "member";
}
