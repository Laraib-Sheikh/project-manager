import { NextResponse } from "next/server";
import { registerUser } from "../../../../lib/auth-store-adapter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await registerUser(await request.json());
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = isDuplicateEmailError(error) ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}

function getErrorMessage(error: unknown) {
  if (isDuplicateEmailError(error)) {
    return "An account already exists for that email.";
  }

  return error instanceof Error ? error.message : "Unable to create account.";
}

function isDuplicateEmailError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /unique|duplicate/i.test(error.message);
}
