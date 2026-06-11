import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AuthUser, hashPassword, verifyPassword } from "./auth-data";

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "orbit-pm.sqlite");

let database: DatabaseSync | null = null;

function getDb() {
  if (database) {
    return database;
  }

  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return database;
}

export function createUser(input: { email: string; name: string; password: string }): AuthUser {
  const user = {
    id: `user-${crypto.randomUUID()}`,
    email: input.email,
    name: input.name,
    createdAt: new Date().toISOString()
  } satisfies AuthUser;

  getDb()
    .prepare(
      `INSERT INTO app_users (id, email, name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(user.id, user.email, user.name, hashPassword(input.password), user.createdAt);

  return user;
}

export function loginUser(input: { email: string; password: string }): AuthUser | null {
  const row = getDb().prepare("SELECT * FROM app_users WHERE email = ?").get(input.email) as UserRow | undefined;

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    return null;
  }

  return rowToUser(row);
}

export function getUserById(userId: string): AuthUser | null {
  const row = getDb().prepare("SELECT id, email, name, created_at FROM app_users WHERE id = ?").get(userId) as
    | Omit<UserRow, "password_hash">
    | undefined;

  return row ? rowToUser(row as UserRow) : null;
}

export function getUserByEmail(email: string): AuthUser | null {
  const row = getDb().prepare("SELECT id, email, name, created_at FROM app_users WHERE email = ?").get(email) as
    | Omit<UserRow, "password_hash">
    | undefined;

  return row ? rowToUser(row as UserRow) : null;
}

function rowToUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at
  };
}

export const sqliteAuthStore = {
  createUser,
  loginUser,
  getUserById,
  getUserByEmail
};
