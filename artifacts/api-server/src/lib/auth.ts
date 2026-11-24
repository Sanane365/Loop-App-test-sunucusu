import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const DEVELOPMENT_ADMIN_EMAILS = new Set([
  "copoglumihammetyasin@gmail.com",
  "copogluhakki@gmail.com",
  "tabiiisanane@gmail.com",
]);
const DEVELOPMENT_ADMIN_USERNAMES = new Set(["mami", "mami denemee"]);

export function isPrivilegedUser(user: { role?: string | null; email?: string | null; username?: string | null }): boolean {
  if (user.role === "admin" || user.role === "moderator") return true;
  if (process.env.NODE_ENV === "production") return false;
  return DEVELOPMENT_ADMIN_EMAILS.has(user.email?.toLowerCase() ?? "") ||
    DEVELOPMENT_ADMIN_USERNAMES.has(user.username?.toLowerCase() ?? "");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number): Promise<string> {
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ id, userId, expiresAt });
  return id;
}

export async function getSessionUser(sessionId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!rows[0] || rows[0].expiresAt < now) return null;

  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, rows[0].userId))
    .limit(1);

  return userRows[0] ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
