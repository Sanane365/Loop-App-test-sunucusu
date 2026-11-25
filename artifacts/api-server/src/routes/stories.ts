import { Router } from "express";
import { db, ensureStoryVisibilityExclusionsTable } from "@workspace/db";
import { storiesTable, storyViewsTable, followsTable, usersTable, directMessagesTable, notificationsTable } from "@workspace/db";
import { eq, and, gt, lte, inArray, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";
import { canMentionOrReplyToUser } from "../lib/userControls";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const router = Router();

await Promise.all([
  ensureStoryVisibilityExclusionsTable(),
  db.execute(sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_text TEXT`),
  db.execute(sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_text_color TEXT`),
  db.execute(sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_text_background TEXT`),
  db.execute(sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`),
]);

async function archiveExpiredStories() {
  await db.update(storiesTable)
    .set({ archived: true })
    .where(and(eq(storiesTable.archived, false), lte(storiesTable.expiresAt, new Date())));
}

await archiveExpiredStories();
const storyArchiveInterval = setInterval(() => {
  void archiveExpiredStories().catch(error => {
    console.error("Expired stories could not be archived:", error);
  });
}, 60_000);
storyArchiveInterval.unref();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/stories", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const now = new Date();

    await archiveExpiredStories();
    const activeStories = await db
      .select()
      .from(storiesTable)
      .where(and(gt(storiesTable.expiresAt, now), eq(storiesTable.archived, false)))
      .orderBy(desc(storiesTable.createdAt));

    const excludedResult = viewerId
      ? await db.execute(sql`SELECT user_id FROM story_visibility_exclusions WHERE excluded_user_id = ${viewerId}`)
      : { rows: [] };
    const excludedOwnerIds = new Set(excludedResult.rows.map((row: any) => Number(row.user_id)));
    const visibleStories = activeStories.filter((story) => !excludedOwnerIds.has(story.userId));

    const groupedByUser = new Map<number, typeof activeStories>();
    for (const story of visibleStories) {
      if (!groupedByUser.has(story.userId)) groupedByUser.set(story.userId, []);
      groupedByUser.get(story.userId)!.push(story);
    }

    const result = [];
    for (const [userId, stories] of groupedByUser.entries()) {
      const user = await getUserWithStats(userId, viewerId);
      if (!user) continue;

      let hasUnviewed = false;
      const enrichedStories = await Promise.all(
        stories.map(async (s) => {
          let isViewed = false;
          if (viewerId) {
            const view = await db
              .select()
              .from(storyViewsTable)
              .where(and(eq(storyViewsTable.storyId, s.id), eq(storyViewsTable.userId, viewerId)))
              .limit(1);
            isViewed = view.length > 0;
          }
          if (!isViewed) hasUnviewed = true;
          return {
            id: s.id,
            userId: s.userId,
            user,
            mediaUrl: s.mediaUrl,
            mediaType: s.mediaType,
            storyText: s.storyText,
            storyTextColor: s.storyTextColor,
            storyTextBackground: s.storyTextBackground,
            archived: s.archived,
            isViewed,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
          };
        })
      );

      result.push({ user, stories: enrichedStories, hasUnviewed });
    }

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stories/archive", requireAuth, async (req, res) => {
  try {
    await archiveExpiredStories();
    const archivedStories = await db
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.userId, req.user!.id), eq(storiesTable.archived, true)))
      .orderBy(desc(storiesTable.createdAt));
    res.set("Cache-Control", "no-store");
    res.json(archivedStories);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Hikaye arşivi alınamadı" });
  }
});

router.delete("/stories/:storyId/archive", requireAuth, async (req, res) => {
  try {
    const storyId = Number(req.params.storyId);
    if (!Number.isInteger(storyId) || storyId < 1) {
      res.status(400).json({ error: "Geçersiz hikaye numarası" });
      return;
    }
    const [deletedStory] = await db
      .delete(storiesTable)
      .where(and(
        eq(storiesTable.id, storyId),
        eq(storiesTable.userId, req.user!.id),
        eq(storiesTable.archived, true),
      ))
      .returning({ id: storiesTable.id });
    if (!deletedStory) {
      res.status(404).json({ error: "Arşivlenmiş hikaye bulunamadı" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Hikaye arşivden silinemedi" });
  }
});

router.get("/stories/visibility", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT excluded_user_id FROM story_visibility_exclusions WHERE user_id = ${req.user!.id}`);
    res.json({ excludedUserIds: result.rows.map((row: any) => Number(row.excluded_user_id)) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Visibility settings could not be loaded" });
  }
});

router.put("/stories/visibility", requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.excludedUserIds)
      ? [...new Set(req.body.excludedUserIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0 && id !== req.user!.id))]
      : [];
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM story_visibility_exclusions WHERE user_id = ${req.user!.id}`);
      for (const excludedUserId of ids) {
        await tx.execute(sql`INSERT INTO story_visibility_exclusions (user_id, excluded_user_id) VALUES (${req.user!.id}, ${excludedUserId}) ON CONFLICT (user_id, excluded_user_id) DO NOTHING`);
      }
    });
    res.json({ excludedUserIds: ids });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Visibility settings could not be saved" });
  }
});

router.post("/stories", requireAuth, async (req, res) => {
  try {
    const { mediaUrl, mediaType, storyText, storyTextColor, storyTextBackground } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ error: "mediaUrl required" });
      return;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [story] = await db
      .insert(storiesTable)
      .values({ userId: req.user!.id, mediaUrl, mediaType: mediaType || "image", storyText: storyText?.trim() || null, storyTextColor: storyTextColor || null, storyTextBackground: storyTextBackground || null, expiresAt })
      .returning();

    const mentions = [...new Set(
      String(storyText || "").match(/@[a-zA-Z0-9_.-]+/g)?.map((mention) => mention.slice(1).toLowerCase()) || [],
    )].filter(Boolean);
    if (mentions.length > 0) {
      const mentionedUsers = await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(sql`LOWER(${usersTable.username}) IN (${sql.join(mentions.map((mention) => sql`${mention}`), sql`, `)})`);
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id === req.user!.id) continue;
        if (!(await canMentionOrReplyToUser(req.user!.id, mentionedUser.id))) continue;
        await db.insert(notificationsTable).values({
          userId: mentionedUser.id,
          fromUserId: req.user!.id,
          type: "story_mention",
          data: { storyId: story.id, mediaUrl, mediaType: mediaType || "image", text: "Loopda sizden bahsetti" },
        });
        await db.insert(directMessagesTable).values({
          senderId: req.user!.id,
          receiverId: mentionedUser.id,
          content: `__LOOP_STORY_MENTION__:${story.id}:Loopda sizden bahsetti`,
          mediaUrl,
          mediaType: mediaType || "image",
        });
      }
    }

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({
      ...story,
      user,
      isViewed: false,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/api/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith("video") ? "video" : "image";
    res.json({ url, type });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/:storyId/view", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    await db
      .insert(storyViewsTable)
      .values({ storyId, userId: req.user!.id })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add pinned column to existing tables if missing
db.execute(sql`ALTER TABLE story_replies ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`).catch(() => {});

// POST /stories/:storyId/reply — send a reply or emoji reaction to a story
router.post("/stories/:storyId/reply", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const fromUserId = req.user!.id;
    const { content, isEmoji } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "İçerik boş olamaz" }); return; }

    // Get the story to find its owner
    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) { res.status(404).json({ error: "Hikaye bulunamadı" }); return; }

    // Don't allow replying to own stories
    if (story.userId === fromUserId) { res.status(400).json({ error: "Kendi hikayene yanıt veremezsin" }); return; }
    if (!(await canMentionOrReplyToUser(fromUserId, story.userId))) {
      res.status(403).json({ error: "Bu kullanıcı yalnızca takipçilerinden yanıt kabul ediyor veya yanıtları kapattı." });
      return;
    }

    // Save to story_replies
    await db.execute(sql`
      INSERT INTO story_replies (story_id, from_user_id, content, is_emoji)
      VALUES (${storyId}, ${fromUserId}, ${content.trim()}, ${!!isEmoji})
    `);

    // Send as DM to story owner with story reply marker
    const dmContent = isEmoji
      ? `__STORY_REACTION__:${storyId}:${content.trim()}`
      : `__STORY_REPLY__:${storyId}:${content.trim()}`;

    await db.insert(directMessagesTable).values({
      senderId: fromUserId,
      receiverId: story.userId,
      content: dmContent,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /stories/:storyId/replies/:replyId/pin — toggle pin (story owner only)
router.post("/stories/:storyId/replies/:replyId/pin", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const replyId = parseInt(req.params["replyId"]!);
    const userId = req.user!.id;

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) { res.status(404).json({ error: "Hikaye bulunamadı" }); return; }
    if (story.userId !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }

    // Toggle pinned
    const rows = await db.execute(sql`
      UPDATE story_replies SET pinned = NOT pinned WHERE id = ${replyId} AND story_id = ${storyId}
      RETURNING id, pinned
    `);
    const updated = (rows.rows as any[])[0];
    res.json({ id: updated?.id, pinned: updated?.pinned });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stories/:storyId/viewers — get all viewers (only for story owner)
router.get("/stories/:storyId/viewers", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const userId = req.user!.id;

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) { res.status(404).json({ error: "Hikaye bulunamadı" }); return; }
    if (story.userId !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }

    const rows = await db
      .select({
        id: storyViewsTable.id,
        userId: storyViewsTable.userId,
        viewedAt: storyViewsTable.viewedAt,
        displayName: usersTable.displayName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(storyViewsTable)
      .innerJoin(usersTable, eq(usersTable.id, storyViewsTable.userId))
      .where(eq(storyViewsTable.storyId, storyId))
      .orderBy(desc(storyViewsTable.viewedAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stories/:storyId/pinned-replies — herkese açık, sadece sabitlenmiş yanıtlar
router.get("/stories/:storyId/pinned-replies", async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const rows = await db.execute(sql`
      SELECT sr.id, sr.content, sr.is_emoji, sr.created_at,
             u.id as user_id, u.display_name, u.username, u.avatar_url
      FROM story_replies sr
      JOIN users u ON u.id = sr.from_user_id
      WHERE sr.story_id = ${storyId} AND sr.pinned = true
      ORDER BY sr.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /stories/:storyId/replies — get all replies (only for story owner)
router.get("/stories/:storyId/replies", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const userId = req.user!.id;

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) { res.status(404).json({ error: "Hikaye bulunamadı" }); return; }
    if (story.userId !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }

    const rows = await db.execute(sql`
      SELECT sr.id, sr.content, sr.is_emoji, sr.pinned, sr.created_at,
             u.id as user_id, u.display_name, u.username, u.avatar_url
      FROM story_replies sr
      JOIN users u ON u.id = sr.from_user_id
      WHERE sr.story_id = ${storyId}
      ORDER BY sr.created_at DESC
    `);

    res.json(rows.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
