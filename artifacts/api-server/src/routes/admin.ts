import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bansTable, sessionsTable } from "@workspace/db";
import { eq, desc, ilike, or, and, isNull, gt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request, Response, NextFunction } from "express";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "admin" && req.user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  next();
}

function requireAdminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ error: "Forbidden — admin only" }); return; }
  next();
}

// GET /admin/users — list all users with stats
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = req.query["q"] as string | undefined;
    const role = req.query["role"] as string | undefined;
    const banned = req.query["banned"] as string | undefined;

    let query = db.select().from(usersTable).$dynamic();

    const conditions = [];
    if (q) conditions.push(or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)));
    if (role) conditions.push(eq(usersTable.role, role));
    if (banned === "true") conditions.push(eq(usersTable.isBanned, true));
    if (banned === "false") conditions.push(eq(usersTable.isBanned, false));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const users = await query.orderBy(desc(usersTable.createdAt)).limit(100);

    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      isBanned: u.isBanned,
      banReason: u.banReason,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/users/:userId/ban
router.post("/admin/users/:userId/ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const { reason, ipAddress, expiresAt } = req.body;

    if (userId === req.user!.id) { res.status(400).json({ error: "Cannot ban yourself" }); return; }

    const target = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target[0]) { res.status(404).json({ error: "User not found" }); return; }
    if (target[0].role === "admin" && req.user!.role !== "admin") {
      res.status(403).json({ error: "Cannot ban an admin" }); return;
    }

    await db.update(usersTable)
      .set({ isBanned: true, banReason: reason ?? null, bannedAt: new Date() })
      .where(eq(usersTable.id, userId));

    await db.insert(bansTable).values({
      userId,
      ipAddress: ipAddress ?? null,
      reason: reason ?? null,
      bannedBy: req.user!.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Invalidate all sessions for banned user
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/users/:userId/unban
router.post("/admin/users/:userId/unban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    await db.update(usersTable)
      .set({ isBanned: false, banReason: null, bannedAt: null })
      .where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/users/:userId/role
router.post("/admin/users/:userId/role", requireAuth, requireAdminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const { role } = req.body;
    if (!["user", "moderator", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" }); return;
    }
    if (userId === req.user!.id) { res.status(400).json({ error: "Cannot change your own role" }); return; }

    await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/ip-ban
router.post("/admin/ip-ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, reason, expiresAt } = req.body;
    if (!ipAddress) { res.status(400).json({ error: "IP address required" }); return; }

    await db.insert(bansTable).values({
      userId: null,
      ipAddress,
      reason: reason ?? null,
      bannedBy: req.user!.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/bans — list all bans
router.get("/admin/bans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const bans = await db
      .select()
      .from(bansTable)
      .orderBy(desc(bansTable.createdAt))
      .limit(100);

    const enriched = await Promise.all(bans.map(async b => {
      let user = null;
      if (b.userId) {
        const rows = await db.select().from(usersTable).where(eq(usersTable.id, b.userId)).limit(1);
        if (rows[0]) user = { id: rows[0].id, username: rows[0].username, displayName: rows[0].displayName };
      }
      let bannedByUser = null;
      const adminRows = await db.select().from(usersTable).where(eq(usersTable.id, b.bannedBy)).limit(1);
      if (adminRows[0]) bannedByUser = { id: adminRows[0].id, username: adminRows[0].username };

      return {
        id: b.id,
        user,
        ipAddress: b.ipAddress,
        reason: b.reason,
        bannedBy: bannedByUser,
        expiresAt: b.expiresAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /admin/bans/:banId
router.delete("/admin/bans/:banId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const banId = parseInt(req.params["banId"]!);
    await db.delete(bansTable).where(eq(bansTable.id, banId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [totalUsers] = await db.select({ count: db.$count(usersTable) }).from(usersTable);
    const [bannedUsers] = await db.select({ count: db.$count(usersTable) }).from(usersTable).where(eq(usersTable.isBanned, true));
    const [admins] = await db.select({ count: db.$count(usersTable) }).from(usersTable).where(eq(usersTable.role, "admin"));
    const [mods] = await db.select({ count: db.$count(usersTable) }).from(usersTable).where(eq(usersTable.role, "moderator"));

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [activeUsers] = await db.select({ count: db.$count(usersTable) }).from(usersTable).where(gt(usersTable.lastSeenAt, fiveMinAgo));

    res.json({
      totalUsers: Number(totalUsers?.count ?? 0),
      bannedUsers: Number(bannedUsers?.count ?? 0),
      admins: Number(admins?.count ?? 0),
      moderators: Number(mods?.count ?? 0),
      activeNow: Number(activeUsers?.count ?? 0),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
