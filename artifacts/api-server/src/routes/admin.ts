import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bansTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import fs   from "fs";
import path from "path";

const WORDS_FILE = path.join(__dirname, "../data/wordle-words.json");
function readAdminWords(): string[] {
  try { return JSON.parse(fs.readFileSync(WORDS_FILE, "utf8")); }
  catch { return []; }
}
function writeAdminWords(words: string[]) {
  fs.mkdirSync(path.dirname(WORDS_FILE), { recursive: true });
  fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2), "utf8");
}

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "moderator")) {
    return res.status(403).json({ error: "Yetersiz yetki" });
  }
  next();
}

// GET /admin/users
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = req.query["q"] as string | undefined;
    const role = req.query["role"] as string | undefined;
    const banned = req.query["banned"];

    let query = db.select().from(usersTable).$dynamic();

    if (q) {
      query = query.where(ilike(usersTable.username, `%${q}%`));
    }
    if (role && role !== "all") {
      query = query.where(eq(usersTable.role, role));
    }
    if (banned === "true") {
      query = query.where(eq(usersTable.isBanned, true));
    } else if (banned === "false") {
      query = query.where(eq(usersTable.isBanned, false));
    }

    const users = await query.limit(100);
    // Get ban info for banned users
    const enriched = await Promise.all(users.map(async (u) => {
      const [ban] = await db.select().from(bansTable).where(eq(bansTable.userId, u.id)).limit(1);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        isBanned: u.isBanned,
        banReason: ban?.reason ?? null,
        bannedAt: u.bannedAt?.toISOString() ?? null,
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.toISOString(),
      };
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PATCH /admin/users/:id/role
router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    const { role } = req.body;
    if (!["user", "moderator", "admin"].includes(role)) {
      res.status(400).json({ error: "Geçersiz rol" }); return;
    }
    // Only admins can change to/from admin role
    if (role === "admin" && req.user!.role !== "admin") {
      res.status(403).json({ error: "Sadece adminler admin rolü atayabilir" }); return;
    }
    const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, targetId)).returning();
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Admin role change error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/users/:id/ban
router.post("/users/:id/ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    const { reason, ipAddress } = req.body;

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
    if (target.role === "admin") { res.status(403).json({ error: "Admin yasaklanamaz" }); return; }

    await db.update(usersTable).set({ isBanned: true, banReason: reason, bannedAt: new Date() }).where(eq(usersTable.id, targetId));
    await db.insert(bansTable).values({ userId: targetId, reason, ipAddress: ipAddress || null, bannedBy: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Admin ban error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/users/:id/unban
router.post("/users/:id/unban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    await db.update(usersTable).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(usersTable.id, targetId));
    res.json({ success: true });
  } catch (error) {
    console.error("Admin unban error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /admin/bans
router.get("/bans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const bans = await db.select().from(bansTable).limit(100);
    const enriched = await Promise.all(bans.map(async (b) => {
      const [user] = b.userId ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1) : [null];
      const [banner] = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, b.bannedBy)).limit(1);
      return {
        id: b.id,
        user: user ?? null,
        ipAddress: b.ipAddress,
        reason: b.reason,
        bannedBy: banner ?? null,
        expiresAt: b.expiresAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// DELETE /admin/bans/:id
router.delete("/bans/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const banId = parseInt(req.params["id"] as string);
    const [ban] = await db.select().from(bansTable).where(eq(bansTable.id, banId)).limit(1);
    if (ban?.userId) {
      await db.update(usersTable).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(usersTable.id, ban.userId));
    }
    await db.delete(bansTable).where(eq(bansTable.id, banId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/ip-ban
router.post("/ip-ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, reason } = req.body;
    if (!ipAddress) { res.status(400).json({ error: "IP adresi gerekli" }); return; }
    await db.insert(bansTable).values({ ipAddress, reason, bannedBy: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/users/:id/reset-password
router.post("/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      res.status(400).json({ error: "En az 4 karakter gerekli" }); return;
    }
    const { hashPassword } = await import("../lib/auth");
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, targetId));
    res.json({ success: true });
  } catch (error) {
    console.error("Admin reset-password error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* ── GET /admin/wordle-words ─────────────────────────────────────────── */
router.get("/wordle-words", requireAuth, requireAdmin, (_req, res) => {
  res.json(readAdminWords());
});

/* ── POST /admin/wordle-words ────────────────────────────────────────── */
router.post("/wordle-words", requireAuth, requireAdmin, (req, res) => {
  const { word } = req.body as { word?: string };
  if (!word || word.trim().length !== 5) {
    res.status(400).json({ error: "Kelime tam 5 harf olmalı" }); return;
  }
  const upper = word.trim().toUpperCase();
  const words = readAdminWords();
  if (words.includes(upper)) {
    res.status(409).json({ error: "Bu kelime zaten listede" }); return;
  }
  words.push(upper);
  writeAdminWords(words);
  res.json({ success: true, word: upper, total: words.length });
});

/* ── DELETE /admin/wordle-words/:word ────────────────────────────────── */
router.delete("/wordle-words/:word", requireAuth, requireAdmin, (req, res) => {
  const upper = req.params["word"].toUpperCase();
  const words = readAdminWords();
  const next  = words.filter((w: string) => w !== upper);
  if (next.length === words.length) {
    res.status(404).json({ error: "Kelime bulunamadı" }); return;
  }
  writeAdminWords(next);
  res.json({ success: true });
});

export default router;
