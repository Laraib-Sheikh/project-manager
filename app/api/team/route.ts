import { NextResponse } from "next/server";
import { requireUserId } from "../../../lib/api-auth";
import { ensureOwnerMembership, listTeamForUser } from "../../../lib/member-store-adapter";
import { listProjects } from "../../../lib/project-store-adapter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const projects = await listProjects(userId);

    await Promise.all(projects.filter((p) => p.role === "owner").map((p) => ensureOwnerMembership(p.id, userId)));

    const team = await listTeamForUser(userId);

    return NextResponse.json({
      ...team,
      ownedProjects: projects.filter((project) => project.role === "owner" || project.userId === userId)
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load team.";
}

function getStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("signed in")) {
    return 401;
  }

  return 400;
}
