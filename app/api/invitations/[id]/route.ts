import { NextResponse } from "next/server";
import { requireUserId } from "../../../../lib/api-auth";
import { revokeInvitation } from "../../../../lib/member-store-adapter";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = requireUserId(request);
    const { id } = await context.params;

    await revokeInvitation(id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to revoke invitation.";
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
