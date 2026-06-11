import { NextResponse } from "next/server";
import { requireUserId } from "../../../../../lib/api-auth";
import { ensureOwnerMembership, listProjectCollaborators } from "../../../../../lib/member-store-adapter";
import { getProjectById, listProjects } from "../../../../../lib/project-store-adapter";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = requireUserId(request);
    const { id: projectId } = await context.params;

    const project = await getProjectById(projectId);

    if (!project) {
      throw new Error("Project not found.");
    }

    const accessibleProjects = await listProjects(userId);

    if (!accessibleProjects.some((entry) => entry.id === projectId)) {
      throw new Error("You do not have access to this project.");
    }

    await ensureOwnerMembership(projectId, project.userId);

    const collaborators = await listProjectCollaborators(projectId);

    return NextResponse.json({ collaborators });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load project collaborators.";
}

function getStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("signed in")) {
    return 401;
  }

  if (error instanceof Error && error.message.includes("not found")) {
    return 404;
  }

  if (error instanceof Error && error.message.includes("access")) {
    return 403;
  }

  return 400;
}
