import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "../../../../lib/task-store-adapter";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const task = await updateTask(id, await request.json());

    if (!task) {
      return NextResponse.json({ message: "Task not found." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!(await deleteTask(id))) {
    return NextResponse.json({ message: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save task.";
}
