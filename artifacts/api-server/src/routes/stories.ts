import { Router } from "express";
import { db } from "@workspace/db";
import { storiesTable, storyViewsTable, followsTable, usersTable } from "@workspace/db";
import { eq, and, gt, inArray, desc } from "drizzle-orm";
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

export default router;
