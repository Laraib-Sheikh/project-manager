import { NextResponse } from "next/server";
import { requireUserId } from "../../../../lib/api-auth";
import { getUserById } from "../../../../lib/auth-store-adapter";
import { acceptInvitation, getInvitationByToken } from "../../../../lib/member-store-adapter";
import { getProjectById } from "../../../../lib/project-store-adapter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");

    if (!token) {
      throw new Error("Invitation token is required.");
    }

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      throw new Error("Invitation not found.");
    }

    const project = await getProjectById(invitation.projectId);

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      },
      project: project ? { id: project.id, name: project.name } : null
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = (await request.json()) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      throw new Error("Invitation token is required.");
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new Error("User account not found.");
    }

    const invitation = await acceptInvitation(token, userId, user.email);
    const project = await getProjectById(invitation.projectId);

    return NextResponse.json({
      project: project ? { id: project.id, name: project.name } : null
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to accept invitation.";
}

function getStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("signed in")) {
    return 401;
  }

  return 400;
}
