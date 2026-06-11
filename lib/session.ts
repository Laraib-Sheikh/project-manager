export const sessionKey = "orbit-pm-session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export function getAuthHeaders(user: SessionUser) {
  return {
    "Content-Type": "application/json",
    "X-User-Id": user.id
  };
}
