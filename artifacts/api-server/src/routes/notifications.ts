import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, postsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats, enrichPost } from "../lib/helpers";

const router = Router();

router.get("/notifications/system-warnings/unread", requireAuth, async (req, res) => {
  try {
    const notifications = await db
      .select({
        id: notificationsTable.id,
        data: notificationsTable.data,
        createdAt: notificationsTable.createdAt,
      })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, req.user!.id),
        eq(notificationsTable.type, "system_warning"),
        eq(notificationsTable.isRead, false),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(20);

    return res.json(notifications.map((notification) => {
      const data = notification.data as { title?: string; message?: string; testPreview?: boolean } | null;
      return {
        id: notification.id,
        title: data?.title || "Sistem uyarısı",
        message: data?.message || "Hesabınızla ilgili bir sistem uyarısı var.",
        testPreview: data?.testPreview === true,
        createdAt: notification.createdAt.toISOString(),
      };
    }));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "System warnings could not be loaded" });
  }
});

router.post("/notifications/system-warnings/:id/read", requireAuth, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ error: "Invalid system warning id" });
    }
    const result = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, req.user!.id),
        eq(notificationsTable.type, "system_warning"),
      ))
      .returning({ id: notificationsTable.id });
    if (!result.length) return res.status(404).json({ error: "System warning not found" });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "System warning could not be acknowledged" });
  }
});

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, req.user!.id),
        sql`${notificationsTable.type} NOT IN ('game_invite', 'game_invite_accepted', 'game_invite_rejected', 'system_warning')`,
      ))
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
          data: (n as typeof n & { data: unknown }).data,
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
      .where(and(
        eq(notificationsTable.userId, req.user!.id),
        eq(notificationsTable.isRead, false),
        sql`${notificationsTable.type} NOT IN ('game_invite', 'game_invite_accepted', 'game_invite_rejected', 'system_warning')`,
      ));
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
      .where(and(
        eq(notificationsTable.userId, req.user!.id),
        sql`${notificationsTable.type} <> 'system_warning'`,
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/read-category", requireAuth, async (req, res) => {
  try {
    const category = String(req.body?.category ?? "");
    const categoryCondition = category === "social"
      ? sql`${notificationsTable.type} IN ('follow', 'follow_request', 'message_request')`
      : category === "books"
        ? sql`(${notificationsTable.type} IN ('book', 'book_comment') OR ${notificationsTable.postId} IN (SELECT id FROM posts WHERE post_type = 'book'))`
        : category === "bulletins"
          ? sql`(${notificationsTable.type} IN ('bulletin', 'bulletin_comment') OR ${notificationsTable.postId} IN (SELECT id FROM posts WHERE post_type = 'bulletin'))`
          : category === "activity"
            ? sql`${notificationsTable.type} NOT IN ('follow', 'follow_request', 'message_request', 'book', 'book_comment', 'bulletin', 'bulletin_comment', 'system_warning') AND (${notificationsTable.postId} IS NULL OR ${notificationsTable.postId} NOT IN (SELECT id FROM posts WHERE post_type IN ('book', 'bulletin')))`
            : null;
    if (!categoryCondition) return res.status(400).json({ error: "Invalid notification category" });
    await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.isRead, false), categoryCondition));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
