export function getUserIdFromRequest(request: Request): string | null {
  const userId = request.headers.get("x-user-id");
  return userId?.trim() || null;
}

export function requireUserId(request: Request): string {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    throw new Error("You must be signed in to perform this action.");
  }

  return userId;
}
