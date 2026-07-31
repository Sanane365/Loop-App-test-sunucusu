import { Router } from "express";
import { db } from "@workspace/db";
import {
  postsTable, likesTable, repostsTable, bookmarksTable, commentsTable,
  commentLikesTable, pollVotesTable, followsTable, notificationsTable,
} from "@workspace/db";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { enrichPost, getUserWithStats } from "../lib/helpers";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const router = Router();

// Comments tablosuna pinned sütunu ekle (yoksa)
db.execute(sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`).catch(() => {});

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
    const bookmarked = req.query["bookmarked"] === "true";
    const liked = req.query["liked"] === "true";
    const reposted = req.query["reposted"] === "true";
    const saved = req.query["saved"] === "true";
    const mediaOnly = req.query["mediaOnly"] === "true";
    const postType = req.query["postType"] as string | undefined;
    const page = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    let posts;

    if ((saved || bookmarked) && viewerId) {
      const bms = await db
        .select({ postId: bookmarksTable.postId })
        .from(bookmarksTable)
        .where(eq(bookmarksTable.userId, viewerId))
        .orderBy(desc(bookmarksTable.createdAt))
        .limit(limit).offset(offset);
      const ids = bms.map((b) => b.postId);
      posts = ids.length > 0 ? await db.select().from(postsTable).where(inArray(postsTable.id, ids)) : [];
    } else if (liked && viewerId) {
      const lks = await db
        .select({ postId: likesTable.postId })
        .from(likesTable)
        .where(eq(likesTable.userId, viewerId))
        .orderBy(desc(likesTable.createdAt))
        .limit(limit).offset(offset);
      const ids = lks.map((l) => l.postId);
      posts = ids.length > 0 ? await db.select().from(postsTable).where(inArray(postsTable.id, ids)) : [];
    } else if (reposted && viewerId) {
      const rps = await db
        .select({ postId: repostsTable.postId })
        .from(repostsTable)
        .where(eq(repostsTable.userId, viewerId))
        .orderBy(desc(repostsTable.createdAt))
        .limit(limit).offset(offset);
      const ids = rps.map((r) => r.postId);
      posts = ids.length > 0 ? await db.select().from(postsTable).where(inArray(postsTable.id, ids)) : [];
    } else if (userId) {
      let q = db.select().from(postsTable).$dynamic();
      const conditions = [eq(postsTable.userId, userId)];
      if (mediaOnly) conditions.push(sql`${postsTable.mediaUrl} IS NOT NULL` as any);
      if (postType) conditions.push(eq(postsTable.postType, postType));
      q = q.where(and(...conditions));
      posts = await q.orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset);
    } else {
      let q = db.select().from(postsTable).$dynamic();
      if (postType) q = q.where(eq(postsTable.postType, postType));
      posts = await q.orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset);
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
    const { content, mediaUrl, mediaType, postType, pollOptions } = req.body;
    if (!content) { res.status(400).json({ error: "Content required" }); return; }

    const [post] = await db
      .insert(postsTable)
      .values({
        userId: req.user!.id,
        content,
        mediaUrl,
        mediaType,
        postType: postType ?? "post",
        pollOptions: pollOptions ?? null,
      })
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
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
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
    const postId = parseInt(req.params["postId"] as string);
    const viewerId = req.user?.id;
    const posts = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!posts[0]) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(await enrichPost(posts[0], viewerId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    await db.delete(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.user!.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    await db.insert(likesTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();
    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({ userId: post[0].userId, fromUserId: req.user!.id, postId, type: "like" }).onConflictDoNothing();
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/unlike", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    await db.delete(likesTable).where(and(eq(likesTable.userId, req.user!.id), eq(likesTable.postId, postId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/repost", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    await db.insert(repostsTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();
    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({ userId: post[0].userId, fromUserId: req.user!.id, postId, type: "repost" }).onConflictDoNothing();
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Repostu geri al
router.delete("/posts/:postId/repost", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    await db.delete(repostsTable).where(and(eq(repostsTable.userId, req.user!.id), eq(repostsTable.postId, postId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/bookmark", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const existing = await db.select().from(bookmarksTable)
      .where(and(eq(bookmarksTable.userId, req.user!.id), eq(bookmarksTable.postId, postId))).limit(1);
    if (existing[0]) {
      await db.delete(bookmarksTable).where(and(eq(bookmarksTable.userId, req.user!.id), eq(bookmarksTable.postId, postId)));
    } else {
      await db.insert(bookmarksTable).values({ userId: req.user!.id, postId }).onConflictDoNothing();
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Poll vote ────────────────────────────────────────────────────────────────
router.post("/posts/:postId/vote", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex === null) { res.status(400).json({ error: "optionIndex required" }); return; }
    await db.insert(pollVotesTable).values({ postId, userId: req.user!.id, optionIndex }).onConflictDoNothing();
    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    res.json(await enrichPost(post[0]!, req.user!.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comments ─────────────────────────────────────────────────────────────────
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const viewerId = req.user?.id;
    const comments = await db.select().from(commentsTable).where(eq(commentsTable.postId, postId)).orderBy(asc(commentsTable.createdAt));

    const enriched = await Promise.all(comments.map(async (c) => {
      // Like count for this comment
      const [likeCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(commentLikesTable).where(eq(commentLikesTable.commentId, c.id));
      let isLiked = false;
      if (viewerId) {
        const like = await db.select().from(commentLikesTable)
          .where(and(eq(commentLikesTable.userId, viewerId), eq(commentLikesTable.commentId, c.id))).limit(1);
        isLiked = like.length > 0;
      }
      const [pinnedRow] = await db.execute(sql`SELECT pinned FROM comments WHERE id = ${c.id}`);
      return {
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        user: await getUserWithStats(c.userId, viewerId),
        content: c.content,
        replyToId: c.replyToId,
        pinned: (pinnedRow as any)?.pinned ?? false,
        likeCount: likeCount?.count ?? 0,
        isLiked,
        createdAt: c.createdAt.toISOString(),
      };
    }));

    // Akıllı sıralama: üst düzey yorumlar skora göre, yanıtlar ebeveyniyle birlikte kalır
    const DAY_MS = 86_400_000;
    const scoreComment = (c: { likeCount: number; createdAt: string }) => {
      const ageDays = (Date.now() - new Date(c.createdAt).getTime()) / DAY_MS;
      const recencyBoost = Math.max(0, (3 - ageDays) * 25); // yeni yorum bonusu, 3 günde solar
      return c.likeCount * 10 + recencyBoost;
    };
    const topLevel = enriched.filter(c => !c.replyToId).sort((a, b) => scoreComment(b) - scoreComment(a));
    const replyList = enriched.filter(c => c.replyToId != null);
    res.json([...topLevel, ...replyList]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const { content, replyToId } = req.body;
    if (!content) { res.status(400).json({ error: "Content required" }); return; }

    const [comment] = await db.insert(commentsTable)
      .values({ postId, userId: req.user!.id, content, replyToId: replyToId ?? null })
      .returning();

    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0] && post[0].userId !== req.user!.id) {
      await db.insert(notificationsTable).values({ userId: post[0].userId, fromUserId: req.user!.id, postId, type: "comment" });
    }

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...comment, user, likeCount: 0, isLiked: false, createdAt: comment.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comment pinning (sadece gönderi sahibi) ───────────────────────────────────
router.post("/posts/:postId/comments/:commentId/pin", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const commentId = parseInt(req.params["commentId"] as string);
    const post = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post[0] || post[0].userId !== req.user!.id) { res.status(403).json({ error: "Yetkisiz" }); return; }
    // Toggle
    const [current] = await db.execute(sql`SELECT pinned FROM comments WHERE id = ${commentId} AND post_id = ${postId}`);
    const nowPinned = !(current as any)?.pinned;
    await db.execute(sql`UPDATE comments SET pinned = ${nowPinned} WHERE id = ${commentId} AND post_id = ${postId}`);
    res.json({ pinned: nowPinned });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comment likes ─────────────────────────────────────────────────────────────
router.post("/posts/:postId/comments/:commentId/like", requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params["commentId"] as string);
    await db.insert(commentLikesTable).values({ commentId, userId: req.user!.id }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/posts/:postId/comments/:commentId/like", requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params["commentId"] as string);
    await db.delete(commentLikesTable).where(and(eq(commentLikesTable.userId, req.user!.id), eq(commentLikesTable.commentId, commentId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/explore/trending", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const posts = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(20);
    const enriched = await Promise.all(posts.map((p) => enrichPost(p, viewerId)));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
