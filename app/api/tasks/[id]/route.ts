import { NextResponse } from "next/server";
import { requireUserId } from "../../../../lib/api-auth";
import { deleteTask, updateTask } from "../../../../lib/task-store-adapter";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const userId = requireUserId(request);
    const task = await updateTask(userId, id, await request.json());

    if (!task) {
      return NextResponse.json({ message: "Task not found." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const userId = requireUserId(request);

    if (!(await deleteTask(userId, id))) {
      return NextResponse.json({ message: "Task not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getStatus(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save task.";
}

function getStatus(error: unknown) {
  if (error instanceof Error && error.message.includes("signed in")) {
    return 401;
  }

  return 400;
}
