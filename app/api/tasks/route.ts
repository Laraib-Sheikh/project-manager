import { NextResponse } from "next/server";
import { createTask, listTasks } from "../../../lib/task-store-adapter";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const task = await createTask(await request.json());
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save task.";
}
