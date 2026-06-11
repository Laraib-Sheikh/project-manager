import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type RegisterInput = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

export type LoginInput = {
  email?: unknown;
  password?: unknown;
};

const passwordKeyLength = 64;

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function normalizeName(name: unknown) {
  return typeof name === "string" ? name.trim() : "";
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 6;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, passwordKeyLength).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const storedBuffer = toArrayBufferView(Buffer.from(storedHash, "hex"));
  const suppliedBuffer = toArrayBufferView(scryptSync(password, salt, storedBuffer.byteLength));

  return storedBuffer.byteLength === suppliedBuffer.byteLength && timingSafeEqual(storedBuffer, suppliedBuffer);
}

function toArrayBufferView(buffer: Buffer) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
