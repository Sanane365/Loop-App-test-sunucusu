import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bansTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

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

export default router;
