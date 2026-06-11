import { NextResponse } from "next/server";
import { requireUserId } from "../../../lib/api-auth";
import { createProject, listProjects } from "../../../lib/project-store-adapter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    return NextResponse.json({ projects: await listProjects(userId) });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const project = await createProject(userId, await request.json());
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save project.";
}

function getStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("signed in")) {
    return 401;
  }

  return 400;
}
