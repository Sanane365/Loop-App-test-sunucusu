import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { usersTable, bansTable } from "@workspace/db";
import { and, eq, or, isNull, gt, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, createSession, deleteSession, isPrivilegedUser } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";

const router = Router();
const secureCookieAttribute = process.env.NODE_ENV === "production" ? "; Secure" : "";

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const loginIdentifier = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!loginIdentifier || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    // Allow login with either username or email, ignoring surrounding spaces and case.
    const users = await db.select().from(usersTable)
      .where(or(
        sql`LOWER(${usersTable.username}) = ${loginIdentifier.toLowerCase()}`,
        sql`LOWER(${usersTable.email}) = ${loginIdentifier.toLowerCase()}`,
      ))
      .limit(1);
    const user = users[0];

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!isPrivilegedUser(user)) {
      const activeGlobalBan = await db.select({ banType: bansTable.banType, reason: bansTable.reason, expiresAt: bansTable.expiresAt })
        .from(bansTable)
        .where(and(
          eq(bansTable.userId, user.id),
          sql`${bansTable.banType} NOT IN ('dm', 'chat')`,
          or(isNull(bansTable.expiresAt), gt(bansTable.expiresAt, new Date())),
        ))
        .limit(1);
      const ban = activeGlobalBan[0];
      if (user.isBanned || ban) {
        res.status(403).json({ error: "account_suspended", message: "Hesabınız askıya alınmıştır.", reason: ban?.reason ?? user.banReason, expiresAt: ban?.expiresAt?.toISOString() ?? null });
        return;
      }
    }

    const sessionId = await createSession(user.id);
    res.setHeader("Set-Cookie", `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${secureCookieAttribute}`);

    const userData = await getUserWithStats(user.id, user.id);
    res.json({ ...userData, sessionId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password || !displayName) {
      res.status(400).json({ error: "All fields required" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
      .limit(1);

    if (existing[0]) {
      res.status(400).json({ error: "Username or email already taken" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(usersTable)
      .values({ username, email, displayName, passwordHash })
      .returning();

    const sessionId = await createSession(newUser.id);
    res.setHeader("Set-Cookie", `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${secureCookieAttribute}`);

    const userData = await getUserWithStats(newUser.id, newUser.id);
    res.status(201).json({ ...userData, sessionId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/bootstrap-admin", requireAuth, async (req, res) => {
  try {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    const suppliedToken = req.header("x-admin-bootstrap-token");
    if (!expectedToken) {
      res.status(404).json({ error: "Admin bootstrap is not enabled" });
      return;
    }
    if (!suppliedToken) {
      res.status(403).json({ error: "Invalid bootstrap token" });
      return;
    }
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      res.status(403).json({ error: "Invalid bootstrap token" });
      return;
    }

    const claimed = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(918240, 1)`);
      const admins = await tx.select({ id: usersTable.id }).from(usersTable)
        .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "moderator")))
        .limit(1);
      if (admins.length > 0) return false;

      await tx.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, req.user!.id));
      return true;
    });
    if (!claimed) {
      res.status(409).json({ error: "An administrator already exists" });
      return;
    }
    res.json({ success: true, message: "Administrator role assigned" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Administrator setup failed" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    if (req.sessionId) {
      await deleteSession(req.sessionId);
    }
    res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; Max-Age=0${secureCookieAttribute}`);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Mevcut ve yeni şifre gerekli" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Yeni şifre en az 6 karakter olmalı" });
      return;
    }

    const users = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);
    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Mevcut şifre hatalı" });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
