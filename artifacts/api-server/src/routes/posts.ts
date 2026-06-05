import { Router } from "express";
import { db } from "@workspace/db";
import {
  postsTable, likesTable, repostsTable, bookmarksTable, commentsTable, followsTable, notificationsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { enrichPost, getUserWithStats } from "../lib/helpers";
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
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.get("/posts", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;
    const page = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let posts;
    if (userId) {
      posts = await db
        .select()
        .from(postsTable)
        .where(eq(postsTable.userId, userId))
        .orderBy(desc(postsTable.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      posts = await db
        .select()
        .from(postsTable)
        .orderBy(desc(postsTable.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const enriched = await Promise.all(posts.map((p) => enrichPost(p, viewerId)));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts", requireAuth, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content) {
      res.status(400).json({ error: "Content required" });
      return;
    }

    const [post] = await db
      .insert(postsTable)
      .values({ userId: req.user!.id, content, mediaUrl, mediaType })
      .returning();

    const enriched = await enrichPost(post, req.user!.id);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/upload", requireAuth, upload.single("file"), async (req, res) => {
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

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    const viewerId = req.user?.id;
    const posts = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!posts[0]) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const enriched = await enrichPost(posts[0], viewerId);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    await db
      .delete(postsTable)
      .where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.user!.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    await db.insert(likesTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();

    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: post[0].userId,
        fromUserId: req.user!.id,
        postId,
        type: "like",
      }).onConflictDoNothing();
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/unlike", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    await db
      .delete(likesTable)
      .where(and(eq(likesTable.userId, req.user!.id), eq(likesTable.postId, postId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/repost", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    await db.insert(repostsTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();

    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: post[0].userId,
        fromUserId: req.user!.id,
        postId,
        type: "repost",
      }).onConflictDoNothing();
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/bookmark", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    const existing = await db
      .select()
      .from(bookmarksTable)
      .where(and(eq(bookmarksTable.userId, req.user!.id), eq(bookmarksTable.postId, postId)))
      .limit(1);

    if (existing[0]) {
      await db
        .delete(bookmarksTable)
        .where(and(eq(bookmarksTable.userId, req.user!.id), eq(bookmarksTable.postId, postId)));
    } else {
      await db.insert(bookmarksTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    const viewerId = req.user?.id;
    const comments = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.postId, postId))
      .orderBy(desc(commentsTable.createdAt));

    const enriched = await Promise.all(
      comments.map(async (c) => ({
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        user: await getUserWithStats(c.userId, viewerId),
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      }))
    );
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"]!);
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: "Content required" });
      return;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({ postId, userId: req.user!.id, content })
      .returning();

    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({
        userId: post[0].userId,
        fromUserId: req.user!.id,
        postId,
        type: "comment",
      });
    }

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...comment, user, createdAt: comment.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/explore/trending", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const posts = await db
      .select()
      .from(postsTable)
      .orderBy(desc(postsTable.createdAt))
      .limit(20);
    const enriched = await Promise.all(posts.map((p) => enrichPost(p, viewerId)));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
