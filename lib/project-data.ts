export type ProjectRole = "owner" | "member" | "viewer";

export type Project = {
  id: string;
  name: string;
  description: string;
  userId: string;
  createdAt: string;
  role?: ProjectRole;
};

export type ProjectInput = {
  name?: unknown;
  description?: unknown;
};

export function normalizeProjectInput(input: ProjectInput) {
  return {
    name: typeof input.name === "string" ? input.name.trim() : "",
    description: typeof input.description === "string" ? input.description.trim() : ""
  };
}
