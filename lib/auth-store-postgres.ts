import postgres from "postgres";
import { AuthUser, hashPassword, verifyPassword } from "./auth-data";

type PostgresUserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string | Date;
};

let client: ReturnType<typeof postgres> | null = null;
let isReady = false;

function getSql() {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error("PostgreSQL is not configured. Add POSTGRES_URL or DATABASE_URL in your Vercel environment variables.");
  }

  if (!client) {
    client = postgres(connectionString, {
      max: 1,
      ssl: "require"
    });
  }

  return client;
}

async function ensureReady() {
  if (isReady) {
    return;
  }

  await getSql()`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  isReady = true;
}

export async function createPostgresUser(input: { email: string; name: string; password: string }): Promise<AuthUser> {
  await ensureReady();

  const user = {
    id: `user-${crypto.randomUUID()}`,
    email: input.email,
    name: input.name,
    createdAt: new Date().toISOString()
  } satisfies AuthUser;

  await getSql()`
    INSERT INTO app_users (id, email, name, password_hash, created_at)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${hashPassword(input.password)}, ${user.createdAt})
  `;

  return user;
}

export async function loginPostgresUser(input: { email: string; password: string }): Promise<AuthUser | null> {
  await ensureReady();

  const rows = await getSql()<PostgresUserRow[]>`
    SELECT * FROM app_users WHERE email = ${input.email} LIMIT 1
  `;
  const row = rows[0];

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    return null;
  }

  return rowToUser(row);
}

function rowToUser(row: PostgresUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}
