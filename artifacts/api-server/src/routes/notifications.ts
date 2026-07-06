import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, postsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats, enrichPost } from "../lib/helpers";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const enriched = await Promise.all(
      notifications.map(async (n) => {
        const fromUser = n.fromUserId ? await getUserWithStats(n.fromUserId, req.user!.id) : null;
        let post = null;
        if (n.postId) {
          const posts = await db.select().from(postsTable).where(eq(postsTable.id, n.postId)).limit(1);
          if (posts[0]) post = await enrichPost(posts[0], req.user!.id);
        }
        return {
          id: n.id,
          type: n.type,
          fromUser,
          post,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.isRead, false)));
    res.json({ count: Number(result[0]?.count ?? 0) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.user!.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
