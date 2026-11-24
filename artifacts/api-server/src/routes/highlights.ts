import { Router } from "express";
import { db } from "@workspace/db";
import { highlightsTable, highlightViewsTable, usersTable, directMessagesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();
const getMediaItems = (mediaUrl: string, mediaType: string) => {
  try {
    const parsed = JSON.parse(mediaUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [{ mediaUrl, mediaType }];
};
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlights (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_url text NOT NULL, media_type text NOT NULL DEFAULT 'image', label text NOT NULL, caption text NOT NULL DEFAULT '', created_at timestamp NOT NULL DEFAULT now())`).catch(() => {});
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlight_views (id serial PRIMARY KEY, highlight_id integer NOT NULL REFERENCES profile_highlights(id) ON DELETE CASCADE, viewer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, viewed_at timestamp NOT NULL DEFAULT now(), UNIQUE(highlight_id, viewer_id))`).catch(() => {});
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlight_likes (id serial PRIMARY KEY, highlight_id integer NOT NULL REFERENCES profile_highlights(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), UNIQUE(highlight_id, user_id))`).catch(() => {});
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlight_replies (id serial PRIMARY KEY, highlight_id integer NOT NULL REFERENCES profile_highlights(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, content text NOT NULL, media_item_index integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now())`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlight_replies ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlight_replies ADD COLUMN IF NOT EXISTS media_item_index integer NOT NULL DEFAULT 0`).catch(() => {});
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlight_likes (id serial PRIMARY KEY, highlight_id integer NOT NULL REFERENCES profile_highlights(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_item_index integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now(), UNIQUE(highlight_id, user_id, media_item_index))`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlight_likes ADD COLUMN IF NOT EXISTS media_item_index integer NOT NULL DEFAULT 0`).catch(() => {});
void db.execute(sql`CREATE TABLE IF NOT EXISTS profile_highlight_views (id serial PRIMARY KEY, highlight_id integer NOT NULL REFERENCES profile_highlights(id) ON DELETE CASCADE, viewer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_item_index integer NOT NULL DEFAULT 0, viewed_at timestamp NOT NULL DEFAULT now(), UNIQUE(highlight_id, viewer_id, media_item_index))`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlight_views ADD COLUMN IF NOT EXISTS media_item_index integer NOT NULL DEFAULT 0`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlights ADD COLUMN IF NOT EXISTS cover_media_url text`).catch(() => {});
void db.execute(sql`ALTER TABLE profile_highlights ADD COLUMN IF NOT EXISTS cover_media_type text`).catch(() => {});

router.get("/users/:userId/highlights", async (req, res) => {
  const userId = Number(req.params.userId);
  const rows = await db.select().from(highlightsTable).where(eq(highlightsTable.userId, userId)).orderBy(desc(highlightsTable.createdAt));
  res.json(rows.map(row => {
    const mediaItems = getMediaItems(row.mediaUrl, row.mediaType);
    return { ...row, mediaUrl: row.coverMediaUrl ?? mediaItems[0]?.mediaUrl ?? row.mediaUrl, mediaType: row.coverMediaType ?? mediaItems[0]?.mediaType ?? row.mediaType, mediaItems };
  }));
});

router.post("/highlights", requireAuth, async (req, res) => {
  const { mediaUrl, mediaType, label, caption } = req.body ?? {};
  if (!mediaUrl || !String(label ?? "").trim()) return res.status(400).json({ error: "Medya ve başlık gerekli" });
  const [highlight] = await db.insert(highlightsTable).values({ userId: req.user!.id, mediaUrl: String(mediaUrl), mediaType: mediaType === "video" ? "video" : "image", label: String(label).trim().slice(0, 40), caption: String(caption ?? "").trim().slice(0, 500) }).returning();
  res.status(201).json(highlight);
});

router.delete("/highlights/:id", requireAuth, async (req, res) => {
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, Number(req.params.id))).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  if (highlight.userId !== req.user!.id) return res.status(403).json({ error: "Yetkisiz" });
  await db.delete(highlightsTable).where(eq(highlightsTable.id, highlight.id));
  res.status(204).end();
});

router.post("/highlights/:id/items", requireAuth, async (req, res) => {
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, Number(req.params.id))).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  if (highlight.userId !== req.user!.id) return res.status(403).json({ error: "Yetkisiz" });
  const { mediaUrl, mediaType } = req.body ?? {};
  if (!mediaUrl) return res.status(400).json({ error: "Medya gerekli" });
  const mediaItems = [...getMediaItems(highlight.mediaUrl, highlight.mediaType), { mediaUrl: String(mediaUrl), mediaType: mediaType === "video" ? "video" : "image" }];
  const [updated] = await db.update(highlightsTable).set({ mediaUrl: JSON.stringify(mediaItems) }).where(eq(highlightsTable.id, highlight.id)).returning();
  res.json({ ...updated, mediaUrl: mediaItems[0]?.mediaUrl, mediaItems });
});

router.post("/highlights/:id/cover", requireAuth, async (req, res) => {
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, Number(req.params.id))).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  if (highlight.userId !== req.user!.id) return res.status(403).json({ error: "Yetkisiz" });
  const { mediaUrl, mediaType } = req.body ?? {};
  if (!mediaUrl) return res.status(400).json({ error: "Kapak medyası gerekli" });
  const mediaItems = getMediaItems(highlight.mediaUrl, highlight.mediaType);
  const selectedMediaType = mediaType === "video" ? "video" : "image";
  const [updated] = await db.update(highlightsTable).set({ coverMediaUrl: String(mediaUrl), coverMediaType: selectedMediaType }).where(eq(highlightsTable.id, highlight.id)).returning();
  res.json({ ...updated, mediaUrl: String(mediaUrl), mediaType: selectedMediaType, mediaItems });
});

router.post("/highlights/:id/view", requireAuth, async (req, res) => {
  const mediaItemIndex = Number(req.body?.mediaItemIndex ?? req.query?.mediaItemIndex ?? 0);
  await db.insert(highlightViewsTable).values({ highlightId: Number(req.params.id), viewerId: req.user!.id, mediaItemIndex }).onConflictDoUpdate({ target: [highlightViewsTable.highlightId, highlightViewsTable.viewerId, highlightViewsTable.mediaItemIndex], set: { viewedAt: sql`now()` } });
  res.json({ ok: true });
});

router.get("/highlights/:id/viewers", requireAuth, async (req, res) => {
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, Number(req.params.id))).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  if (highlight.userId !== req.user!.id) return res.status(403).json({ error: "Yetkisiz" });
  const mediaItemIndex = Number(req.query?.mediaItemIndex ?? 0);
  const rows = await db.select({ id: highlightViewsTable.id, viewedAt: highlightViewsTable.viewedAt, userId: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl }).from(highlightViewsTable).innerJoin(usersTable, eq(usersTable.id, highlightViewsTable.viewerId)).where(and(eq(highlightViewsTable.highlightId, highlight.id), eq(highlightViewsTable.mediaItemIndex, mediaItemIndex))).orderBy(desc(highlightViewsTable.viewedAt));
  res.json(rows);
});

router.get("/highlights/:id/stats", async (req, res) => {
  const highlightId = Number(req.params.id);
  const mediaItemIndex = Number(req.query?.mediaItemIndex ?? 0);
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, highlightId)).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM profile_highlight_likes WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex}) AS "likeCount",
      (SELECT count(*)::int FROM profile_highlight_views WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex}) AS "viewerCount",
      (SELECT count(*)::int FROM profile_highlight_replies WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex}) AS "replyCount",
      EXISTS(SELECT 1 FROM profile_highlight_likes WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex} AND user_id = ${req.user?.id ?? 0}) AS "likedByMe"
  `);
  res.json(result.rows[0] ?? { likeCount: 0, viewerCount: 0, replyCount: 0, likedByMe: false });
});

router.post("/highlights/:id/like", requireAuth, async (req, res) => {
  const highlightId = Number(req.params.id);
  const mediaItemIndex = Number(req.body?.mediaItemIndex ?? req.query?.mediaItemIndex ?? 0);
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, highlightId)).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  const existing = await db.execute(sql`SELECT id FROM profile_highlight_likes WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex} AND user_id = ${req.user!.id} LIMIT 1`);
  if (existing.rows.length > 0) {
    await db.execute(sql`DELETE FROM profile_highlight_likes WHERE highlight_id = ${highlightId} AND media_item_index = ${mediaItemIndex} AND user_id = ${req.user!.id}`);
    return res.json({ liked: false });
  }
  await db.execute(sql`INSERT INTO profile_highlight_likes (highlight_id, user_id, media_item_index) VALUES (${highlightId}, ${req.user!.id}, ${mediaItemIndex}) ON CONFLICT DO NOTHING`);
  res.json({ liked: true });
});

router.get("/highlights/:id/replies", async (req, res) => {
  const mediaItemIndex = Number(req.query?.mediaItemIndex ?? 0);
  const rows = await db.execute(sql`
    SELECT r.id, r.content, r.pinned, r.media_item_index AS "mediaItemIndex", r.created_at AS "createdAt", u.id AS "userId", u.display_name AS "displayName", u.username, u.avatar_url AS "avatarUrl"
    FROM profile_highlight_replies r INNER JOIN users u ON u.id = r.user_id
    WHERE r.highlight_id = ${Number(req.params.id)} AND r.media_item_index = ${mediaItemIndex} ORDER BY r.created_at DESC
  `);
  res.json(rows.rows);
});

router.post("/highlights/:id/replies", requireAuth, async (req, res) => {
  const highlightId = Number(req.params.id);
  const mediaItemIndex = Number(req.body?.mediaItemIndex ?? 0);
  const content = String(req.body?.content ?? "").trim();
  if (!content) return res.status(400).json({ error: "Yanıt boş olamaz" });
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, highlightId)).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  await db.execute(sql`INSERT INTO profile_highlight_replies (highlight_id, user_id, content, media_item_index) VALUES (${highlightId}, ${req.user!.id}, ${content.slice(0, 500)}, ${mediaItemIndex})`);
  if (highlight.userId !== req.user!.id) {
    await db.insert(directMessagesTable).values({
      senderId: req.user!.id,
      receiverId: highlight.userId,
      content: `__LOOP_HIGHLIGHT_REPLY__:${highlightId}:${mediaItemIndex}:${content.slice(0, 500)}`,
    });
  }
  res.status(201).json({ ok: true });
});

router.post("/highlights/:id/replies/:replyId/pin", requireAuth, async (req, res) => {
  const highlightId = Number(req.params.id);
  const replyId = Number(req.params.replyId);
  const [highlight] = await db.select().from(highlightsTable).where(eq(highlightsTable.id, highlightId)).limit(1);
  if (!highlight) return res.status(404).json({ error: "Öne çıkan bulunamadı" });
  if (highlight.userId !== req.user!.id) return res.status(403).json({ error: "Yetkisiz" });
  const current = await db.execute(sql`SELECT pinned FROM profile_highlight_replies WHERE id = ${replyId} AND highlight_id = ${highlightId} LIMIT 1`);
  if (!current.rows.length) return res.status(404).json({ error: "Yanıt bulunamadı" });
  const pinned = !(current.rows[0] as any).pinned;
  await db.execute(sql`UPDATE profile_highlight_replies SET pinned = ${pinned} WHERE id = ${replyId} AND highlight_id = ${highlightId}`);
  res.json({ pinned });
});

router.get("/highlights/:id/pinned-replies", async (req, res) => {
  const mediaItemIndex = Number(req.query?.mediaItemIndex ?? 0);
  const rows = await db.execute(sql`
    SELECT r.id, r.content, r.pinned, r.media_item_index AS "mediaItemIndex", r.created_at AS "createdAt", u.id AS "userId", u.display_name AS "displayName", u.username, u.avatar_url AS "avatarUrl"
    FROM profile_highlight_replies r INNER JOIN users u ON u.id = r.user_id
    WHERE r.highlight_id = ${Number(req.params.id)} AND r.media_item_index = ${mediaItemIndex} AND r.pinned = true ORDER BY r.created_at DESC LIMIT 3
  `);
  res.json(rows.rows);
});

export default router;