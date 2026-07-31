import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword, createSession, deleteSession } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";

const router = Router();

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
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    // Allow login with either username or email (case-insensitive email)
    const users = await db.select().from(usersTable)
      .where(or(
        eq(usersTable.username, username),
        eq(usersTable.email, username.toLowerCase()),
      ))
      .limit(1);
    const user = users[0];

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const sessionId = await createSession(user.id);
    res.setHeader("Set-Cookie", `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);

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
    res.setHeader("Set-Cookie", `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);

    const userData = await getUserWithStats(newUser.id, newUser.id);
    res.status(201).json({ ...userData, sessionId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    if (req.sessionId) {
      await deleteSession(req.sessionId);
    }
    res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; Max-Age=0");
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
