import { NextResponse } from "next/server";
import { authenticateUser } from "../../../../lib/auth-store-adapter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await authenticateUser(await request.json());

    if (!user) {
      return NextResponse.json({ message: "Email or password is incorrect." }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to log in.";
}
