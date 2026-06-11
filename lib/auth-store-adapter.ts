import { LoginInput, normalizeEmail, normalizeName, RegisterInput, validateEmail, validatePassword } from "./auth-data";
import { createPostgresUser, loginPostgresUser } from "./auth-store-postgres";

function shouldUsePostgres() {
  return Boolean(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL);
}

function shouldUseSqlite() {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

function getMissingDatabaseError() {
  return new Error(
    "Database is not configured for deployment. Add POSTGRES_URL or DATABASE_URL in Vercel, then redeploy."
  );
}

export async function registerUser(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!validateEmail(email)) {
    throw new Error("A valid email is required.");
  }

  if (!validatePassword(input.password)) {
    throw new Error("Password must be at least 6 characters.");
  }

  const userInput = { email, name, password: input.password };

  if (shouldUsePostgres()) {
    return createPostgresUser(userInput);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteAuthStore } = await import("./auth-store");
  return sqliteAuthStore.createUser(userInput);
}

export async function authenticateUser(input: LoginInput) {
  const email = normalizeEmail(input.email);

  if (!validateEmail(email) || !validatePassword(input.password)) {
    return null;
  }

  const userInput = { email, password: input.password };

  if (shouldUsePostgres()) {
    return loginPostgresUser(userInput);
  }

  if (!shouldUseSqlite()) {
    throw getMissingDatabaseError();
  }

  const { sqliteAuthStore } = await import("./auth-store");
  return sqliteAuthStore.loginUser(userInput);
}
