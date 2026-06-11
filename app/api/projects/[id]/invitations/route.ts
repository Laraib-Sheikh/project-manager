import { NextResponse } from "next/server";
import { requireUserId } from "../../../../../lib/api-auth";
import { getUserById } from "../../../../../lib/auth-store-adapter";
import { validateEmail, normalizeEmail } from "../../../../../lib/auth-data";
import { sendEmail } from "../../../../../lib/email";
import { buildInvitationEmail } from "../../../../../lib/invitation-email";
import { normalizeInviteEmail, normalizeInviteRole } from "../../../../../lib/member-data";
import { createInvitation, ensureOwnerMembership, isProjectOwner } from "../../../../../lib/member-store-adapter";
import { getProjectById } from "../../../../../lib/project-store-adapter";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = requireUserId(request);
    const { id: projectId } = await context.params;
    const body = (await request.json()) as { email?: unknown; role?: unknown };

    const email = normalizeInviteEmail(body.email);

    if (!validateEmail(email)) {
      throw new Error("A valid email address is required.");
    }

    const project = await getProjectById(projectId);

    if (!project) {
      throw new Error("Project not found.");
    }

    await ensureOwnerMembership(projectId, project.userId);

    if (!(await isProjectOwner(projectId, userId))) {
      throw new Error("Only the project owner can send invitations.");
    }

    const inviter = await getUserById(userId);

    if (!inviter) {
      throw new Error("Inviter account not found.");
    }

    if (normalizeEmail(inviter.email) === email) {
      throw new Error("You cannot invite yourself.");
    }

    const invitation = await createInvitation({
      projectId,
      email,
      invitedBy: userId,
      role: normalizeInviteRole(body.role)
    });

    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const acceptUrl = `${appUrl}/invite/accept?token=${invitation.token}`;
    const emailContent = buildInvitationEmail({
      inviteeEmail: email,
      projectName: project.name,
      inviterName: inviter.name,
      acceptUrl,
      expiresAt: invitation.expiresAt
    });

    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          status: invitation.status
        },
        emailSent: emailResult.sent,
        emailLogged: emailResult.logged,
        emailAuthFailed: emailResult.authFailed ?? false,
        emailWarning: emailResult.errorMessage,
        acceptUrl: emailResult.logged || emailResult.authFailed ? acceptUrl : undefined
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to send invitation.";
}

function getStatus(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("signed in")) {
      return 401;
    }

    if (error.message.includes("owner")) {
      return 403;
    }
  }

  return 400;
}
