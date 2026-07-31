import { Router } from "express";
import { db } from "@workspace/db";
import { storiesTable, storyViewsTable, followsTable, usersTable, directMessagesTable } from "@workspace/db";
import { eq, and, gt, inArray, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const router = Router();

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

    const activeStories = await db
      .select()
      .from(storiesTable)
      .where(gt(storiesTable.expiresAt, now))
      .orderBy(desc(storiesTable.createdAt));

    const groupedByUser = new Map<number, typeof activeStories>();
    for (const story of activeStories) {
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

router.post("/stories", requireAuth, async (req, res) => {
  try {
    const { mediaUrl, mediaType } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ error: "mediaUrl required" });
      return;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [story] = await db
      .insert(storiesTable)
      .values({ userId: req.user!.id, mediaUrl, mediaType: mediaType || "image", expiresAt })
      .returning();

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

// Ensure story_replies table exists
db.execute(sql`
  CREATE TABLE IF NOT EXISTS story_replies (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_emoji BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )
`).catch(() => {});

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

// GET /stories/:storyId/replies — get all replies (only for story owner)
router.get("/stories/:storyId/replies", requireAuth, async (req, res) => {
  try {
    const storyId = parseInt(req.params["storyId"]!);
    const userId = req.user!.id;

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) { res.status(404).json({ error: "Hikaye bulunamadı" }); return; }
    if (story.userId !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }

    const rows = await db.execute(sql`
      SELECT sr.id, sr.content, sr.is_emoji, sr.created_at,
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
