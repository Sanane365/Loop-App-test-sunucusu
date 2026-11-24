import { Router } from "express";
import { db } from "@workspace/db";
import {
  postsTable, postViewsTable, likesTable, repostsTable, bookmarksTable, commentsTable,
  commentLikesTable, pollVotesTable, followsTable, notificationsTable,
} from "@workspace/db";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { enrichPost, getUserWithStats } from "../lib/helpers";
import { canMentionOrReplyToUser, canViewUserContent, getBlockStatus, getHiddenProfileUserIds, getProfileControls } from "../lib/userControls";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const router = Router();

// Comments tablosuna gerekli sütunları ekle (yoksa)
db.execute(sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_url TEXT`).catch(() => {});
db.execute(sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_type TEXT`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_like_count BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_repost_count BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hide_bookmark_count BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_profile BOOLEAN NOT NULL DEFAULT false`).catch(() => {});
db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS background_url TEXT`).catch(() => {});
db.execute(sql`CREATE TABLE IF NOT EXISTS post_views (
  id serial PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (post_id, viewer_id)
)`).catch(() => {});
db.execute(sql`ALTER TABLE post_views DROP CONSTRAINT IF EXISTS post_views_post_id_viewer_id_unique`).catch(() => {});

const uploadDir = path.resolve(import.meta.dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

type RecommendationMode = "for-you" | "trending";

function recommendationVariation(seed: string, postId: number) {
  let value = 2166136261;
  const input = `${seed}:${postId}`;
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  value += value << 13;
  value ^= value >>> 7;
  value += value << 3;
  value ^= value >>> 17;
  value += value << 5;
  return (value >>> 0) / 4294967296;
}

const recommendationStopWords = new Set([
  "acaba", "ama", "artık", "bana", "bazen", "belki", "beni", "benim", "bile", "bir", "biraz", "biz", "bizi",
  "böyle", "bu", "buna", "bunu", "çok", "daha", "diye", "en", "gibi", "hem", "her", "hiç", "için", "ile",
  "insan", "ise", "kadar", "ki", "kim", "mı", "mi", "mu", "mü", "nasıl", "ne", "neden", "nerede", "olan",
  "olarak", "oldu", "onlar", "onu", "sonra", "şey", "şu", "tüm", "ve", "veya", "ya", "yani", "your", "the",
  "and", "for", "with", "this", "that", "you", "are", "was", "have", "from", "not", "but", "what", "when",
]);

function getRecommendationTopics(content: string) {
  const normalized = content.toLocaleLowerCase("tr-TR");
  const hashtags = normalized.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const words = normalized.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  return {
    hashtags: [...new Set(hashtags.map(tag => tag.slice(1)))],
    words: [...new Set(words.filter(word => !recommendationStopWords.has(word)))],
  };
}

async function buildRecommendationFeed(viewerId: number | undefined, mode: RecommendationMode, page = 1, seed = "") {
  const personalizationUserId = mode === "for-you" ? viewerId : undefined;
  const candidates = await db.select().from(postsTable)
    .where(eq(postsTable.archived, false))
    .orderBy(desc(postsTable.createdAt));
  if (candidates.length === 0) return [];

  const [likeCounts, repostCounts, commentCounts, viewCounts, userSignals, followedUsers] = await Promise.all([
    db.select({ postId: likesTable.postId, count: sql<number>`cast(count(*) as int)` }).from(likesTable).groupBy(likesTable.postId),
    db.select({ postId: repostsTable.postId, count: sql<number>`cast(count(*) as int)` }).from(repostsTable).groupBy(repostsTable.postId),
    db.select({ postId: commentsTable.postId, count: sql<number>`cast(count(*) as int)` }).from(commentsTable).groupBy(commentsTable.postId),
    db.select({ postId: postViewsTable.postId, count: sql<number>`cast(count(*) as int)` }).from(postViewsTable).groupBy(postViewsTable.postId),
    personalizationUserId ? db.execute(sql`
      SELECT p.content, p.post_type AS "postType", p.user_id AS "userId", signals.post_id AS "postId", signals.weight, signals.created_at AS "createdAt"
      FROM (
        SELECT post_id, 3.0 AS weight, created_at FROM likes WHERE user_id = ${personalizationUserId} AND created_at >= NOW() - INTERVAL '90 days'
        UNION ALL
        SELECT post_id, 4.0 AS weight, created_at FROM reposts WHERE user_id = ${personalizationUserId} AND created_at >= NOW() - INTERVAL '90 days'
        UNION ALL
        SELECT post_id, 5.0 AS weight, created_at FROM bookmarks WHERE user_id = ${personalizationUserId} AND created_at >= NOW() - INTERVAL '90 days'
        UNION ALL
        SELECT post_id, 2.5 AS weight, created_at FROM comments WHERE user_id = ${personalizationUserId} AND created_at >= NOW() - INTERVAL '90 days'
        UNION ALL
        SELECT post_id, 0.5 AS weight, created_at FROM post_views WHERE viewer_id = ${personalizationUserId} AND created_at >= NOW() - INTERVAL '90 days'
      ) signals
      INNER JOIN posts p ON p.id = signals.post_id
      ORDER BY signals.created_at DESC
      LIMIT 500
    `) : Promise.resolve({ rows: [] }),
    personalizationUserId ? db.select({ followingId: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, personalizationUserId)) : Promise.resolve([]),
  ]);

  const metricMap = new Map<number, { likes: number; reposts: number; comments: number; views: number }>();
  for (const [rows, key] of [[likeCounts, "likes"], [repostCounts, "reposts"], [commentCounts, "comments"], [viewCounts, "views"]] as const) {
    for (const row of rows) {
      const metrics = metricMap.get(row.postId) ?? { likes: 0, reposts: 0, comments: 0, views: 0 };
      metrics[key] = row.count;
      metricMap.set(row.postId, metrics);
    }
  }

  const topicWeights = new Map<string, number>();
  const authorWeights = new Map<number, number>();
  const typeWeights = new Map<string, number>();
  const seenPostIds = new Set<number>();
  const signalRows = (userSignals as { rows?: Array<{ content: string; postType: string; userId: number; postId: number; weight: number; createdAt: Date | string }> }).rows ?? [];
  for (const signal of signalRows) {
    const ageDays = Math.max(0, (Date.now() - new Date(signal.createdAt).getTime()) / 86_400_000);
    const signalWeight = Number(signal.weight) * Math.exp(-ageDays / 30);
    const topics = getRecommendationTopics(signal.content);
    for (const topic of topics.hashtags) topicWeights.set(`#${topic}`, (topicWeights.get(`#${topic}`) ?? 0) + signalWeight * 2);
    for (const word of topics.words) topicWeights.set(word, (topicWeights.get(word) ?? 0) + signalWeight * 0.2);
    authorWeights.set(signal.userId, (authorWeights.get(signal.userId) ?? 0) + signalWeight);
    typeWeights.set(signal.postType, (typeWeights.get(signal.postType) ?? 0) + signalWeight * 0.25);
    seenPostIds.add(Number(signal.postId));
  }
  const followedIds = new Set(followedUsers.map(user => user.followingId));
  const now = Date.now();
  const baseScores = candidates.map(post => {
    const metrics = metricMap.get(post.id) ?? { likes: 0, reposts: 0, comments: 0, views: 0 };
    const ageHours = Math.max(0, (now - post.createdAt.getTime()) / 3_600_000);
    const freshness = Math.exp(-ageHours / (mode === "trending" ? 32 : 60));
    const engagement = metrics.likes * 1.2 + metrics.reposts * 2.8 + metrics.comments * 2 + metrics.views * 0.08;
    const topics = getRecommendationTopics(post.content);
    const topicMatch = topics.hashtags.reduce((sum, tag) => sum + (topicWeights.get(`#${tag}`) ?? 0), 0)
      + topics.words.reduce((sum, word) => sum + (topicWeights.get(word) ?? 0), 0);
    const affinity = (authorWeights.get(post.userId) ?? 0) + (followedIds.has(post.userId) ? 4 : 0)
      + (typeWeights.get(post.postType) ?? 0);
    const seenPenalty = seenPostIds.has(post.id) ? 0.45 : 1;
    const personalBoost = personalizationUserId ? Math.log1p(topicMatch + affinity) * 2.2 : 0;
    const score = (Math.log1p(engagement) * 2 + freshness * 3 + personalBoost) * seenPenalty;
    return { post, score };
  });
  const minimumScore = baseScores.reduce((minimum, item) => Math.min(minimum, item.score), Infinity);
  const maximumScore = baseScores.reduce((maximum, item) => Math.max(maximum, item.score), -Infinity);
  const scoreRange = maximumScore - minimumScore;
  const scored = baseScores.map(({ post, score }) => ({
    post,
    score: seed
      ? ((score - minimumScore) / (scoreRange || 1)) * 0.45 + recommendationVariation(seed, post.id) * 0.55
      : score,
  })).sort((a, b) => b.score - a.score);

  const hiddenUserIds = viewerId ? await getHiddenProfileUserIds(viewerId) : new Set<number>();
  const privacyAccess = new Map<string, Promise<boolean>>();
  for (const { post } of scored) {
    const accessKey = `${post.userId}:${post.postType}`;
    if (!privacyAccess.has(accessKey)) privacyAccess.set(accessKey, canViewUserContent(viewerId, post.userId, post.postType));
  }
  const accessible = new Set<string>();
  await Promise.all(Array.from(privacyAccess, async ([key, access]) => {
    if (await access) accessible.add(key);
  }));

  const selected = [];
  for (const { post } of scored) {
    if (hiddenUserIds.has(post.userId) || !accessible.has(`${post.userId}:${post.postType}`)) continue;
    selected.push(post);
  }
  const pageSize = 10;
  const offset = Math.max(0, page - 1) * pageSize;
  return Promise.all(selected.slice(offset, offset + pageSize).map(post => enrichPost(post, viewerId)));
}

router.get("/posts", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;
    const following = req.query["following"] === "true";
    const bookmarked = req.query["bookmarked"] === "true";
    const liked = req.query["liked"] === "true";
    const reposted = req.query["reposted"] === "true";
    const saved = req.query["saved"] === "true";
    const mediaOnly = req.query["mediaOnly"] === "true";
    const postType = req.query["postType"] as string | undefined;
    const postTypes = postType?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    const page = req.query["page"] ? parseInt(req.query["page"] as string) : 1;
    const limit = req.query["page"] ? 20 : 10000;
    const offset = (page - 1) * limit;

    let posts: (typeof postsTable.$inferSelect)[];

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
    } else if (following) {
      if (!viewerId) {
        posts = [];
      } else {
        const followedUsers = await db
          .select({ followingId: followsTable.followingId })
          .from(followsTable)
          .where(eq(followsTable.followerId, viewerId));
        const followedIds = followedUsers.map((follow) => follow.followingId);
        let q = db.select().from(postsTable).$dynamic();
        const conditions = [inArray(postsTable.userId, followedIds.length ? followedIds : [-1])];
        if (postTypes.length === 1) conditions.push(eq(postsTable.postType, postTypes[0]));
        if (postTypes.length > 1) conditions.push(inArray(postsTable.postType, postTypes));
        q = q.where(and(...conditions));
        posts = followedIds.length ? await q.orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset) : [];
      }
    } else if (userId) {
      let q = db.select().from(postsTable).$dynamic();
      const conditions = [eq(postsTable.userId, userId)];
      if (mediaOnly) conditions.push(sql`${postsTable.mediaUrl} IS NOT NULL` as any);
      if (postTypes.length === 1) conditions.push(eq(postsTable.postType, postTypes[0]));
      if (postTypes.length > 1) conditions.push(inArray(postsTable.postType, postTypes));
      q = q.where(and(...conditions));
      posts = await q.orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset);
    } else {
      let q = db.select().from(postsTable).$dynamic();
      if (postTypes.length === 1) q = q.where(eq(postsTable.postType, postTypes[0]));
      if (postTypes.length > 1) q = q.where(inArray(postsTable.postType, postTypes));
      posts = await q.orderBy(desc(postsTable.createdAt)).limit(limit).offset(offset);
    }

    const hiddenUserIds = viewerId ? await getHiddenProfileUserIds(viewerId) : new Set<number>();
    const privacyAccess = new Map<string, Promise<boolean>>();
    for (const post of posts) {
      const accessKey = `${post.userId}:${post.postType}`;
      if (!privacyAccess.has(accessKey)) {
        privacyAccess.set(accessKey, canViewUserContent(viewerId, post.userId, post.postType));
      }
    }
    const accessiblePosts = new Set<string>();
    await Promise.all(Array.from(privacyAccess, async ([accessKey, access]) => {
      if (await access) accessiblePosts.add(accessKey);
    }));
    const visiblePosts = posts.filter((post) =>
      !hiddenUserIds.has(post.userId) && accessiblePosts.has(`${post.userId}:${post.postType}`),
    );
    const enriched = await Promise.all(visiblePosts.map((p) => enrichPost(p, viewerId)));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts", requireAuth, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType, backgroundUrl, postType, pollOptions } = req.body;
    if (!content) { res.status(400).json({ error: "Content required" }); return; }

    const [post] = await db
      .insert(postsTable)
      .values({
        userId: req.user!.id,
        content,
        mediaUrl,
        mediaType,
        backgroundUrl,
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

router.get("/posts/recommendations", async (req, res) => {
  try {
    const mode = req.query["mode"] === "trending" ? "trending" : "for-you";
    const requestedPage = Number.parseInt(String(req.query["page"] ?? "1"), 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const seed = typeof req.query["seed"] === "string" ? req.query["seed"].slice(0, 100) : "";
    res.json(await buildRecommendationFeed(req.user?.id, mode, page, seed));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Kişiselleştirilmiş akış yüklenemedi" });
  }
});

router.get("/posts/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const viewerId = req.user?.id;
    const posts = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!posts[0]) { res.status(404).json({ error: "Post not found" }); return; }
    if (viewerId) {
      const hiddenUserIds = await getHiddenProfileUserIds(viewerId);
      if (hiddenUserIds.has(posts[0].userId)) { res.status(404).json({ error: "Post not found" }); return; }
    }
    res.json(await enrichPost(posts[0], viewerId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts/:postId/view", requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    if (!Number.isInteger(postId)) { res.status(400).json({ error: "Geçersiz gönderi" }); return; }
    await db.insert(postViewsTable).values({ postId, viewerId: req.user!.id });
    const [result] = await db
      .select({ views: sql<number>`cast(count(*) as int)` })
      .from(postViewsTable)
      .where(eq(postViewsTable.postId, postId));
    res.json({ ok: true, viewCount: result?.views ?? 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Görüntülenme kaydedilemedi" });
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

router.patch("/posts/:postId/manage", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params["postId"] as string);
    const post = await db.select().from(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.user!.id))).limit(1);
    if (!post[0]) { res.status(404).json({ error: "Post not found" }); return; }
    const { action, content } = req.body as { action?: string; content?: string };
    if (action === "stats") {
      const [likes, reposts, comments] = await Promise.all([
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(likesTable).where(eq(likesTable.postId, postId)),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(repostsTable).where(eq(repostsTable.postId, postId)),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(commentsTable).where(eq(commentsTable.postId, postId)),
      ]);
      res.json({ likes: likes[0]?.count ?? 0, reposts: reposts[0]?.count ?? 0, comments: comments[0]?.count ?? 0 });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (action === "archive") updates.archived = !post[0].archived;
    else if (action === "hideLikes") updates.hideLikeCount = !post[0].hideLikeCount;
    else if (action === "hideReposts") updates.hideRepostCount = !post[0].hideRepostCount;
    else if (action === "hideBookmarks") updates.hideBookmarkCount = !post[0].hideBookmarkCount;
    else if (action === "closeComments") updates.commentsDisabled = !post[0].commentsDisabled;
    else if (action === "pinProfile") updates.pinnedProfile = !post[0].pinnedProfile;
    else if (action === "edit") {
      if (typeof content !== "string" || !content.trim()) { res.status(400).json({ error: "Content required" }); return; }
      updates.content = content.trim().slice(0, 2000);
    } else { res.status(400).json({ error: "Unknown action" }); return; }
    const [updated] = await db.update(postsTable).set(updates as any).where(eq(postsTable.id, postId)).returning();
    res.json(await enrichPost(updated, req.user!.id));
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
    const post = await db.select({ commentsDisabled: postsTable.commentsDisabled, userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post[0]?.commentsDisabled) { res.json([]); return; }
    const viewerId = req.user?.id;
    if (viewerId && post[0] && viewerId !== post[0].userId) {
      const [blockStatus, ownerControls] = await Promise.all([
        getBlockStatus(viewerId, post[0].userId),
        getProfileControls(post[0].userId, viewerId),
      ]);
      if (blockStatus.blockedByMe || blockStatus.blockedByThem) {
        res.status(403).json({ error: "Bu içerik için erişimin engellendi" });
        return;
      }
      if (ownerControls?.restricted) {
        res.status(403).json({ error: "Bu kullanıcının içeriklerine erişimin kısıtlandı" });
        return;
      }
    }
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
      const extraResult = await db.execute(sql`SELECT pinned, media_url, media_type FROM comments WHERE id = ${c.id}`);
      const extraRow = (extraResult as any).rows?.[0] ?? null;
      return {
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        user: await getUserWithStats(c.userId, viewerId),
        content: c.content,
        replyToId: c.replyToId,
        pinned: (extraRow as any)?.pinned ?? false,
        mediaUrl: (extraRow as any)?.media_url ?? null,
        mediaType: (extraRow as any)?.media_type ?? null,
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
    const postState = await db.select({ commentsDisabled: postsTable.commentsDisabled, userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (postState[0]?.commentsDisabled) { res.status(403).json({ error: "Comments are disabled" }); return; }
    if (postState[0] && postState[0].userId !== req.user!.id) {
      const [blockStatus, ownerControls] = await Promise.all([
        getBlockStatus(req.user!.id, postState[0].userId),
        getProfileControls(postState[0].userId, req.user!.id),
      ]);
      if (blockStatus.blockedByMe || blockStatus.blockedByThem) {
        res.status(403).json({ error: "Bu kullanıcıyla etkileşim kuramazsın" });
        return;
      }
      if (ownerControls?.restricted) {
        res.status(403).json({ error: "Bu kullanıcı gönderilerine yorum yapmanı kısıtladı" });
        return;
      }
      if (!(await canMentionOrReplyToUser(req.user!.id, postState[0].userId))) {
        res.status(403).json({ error: "Bu kullanıcı yalnızca takipçilerinden yanıt kabul ediyor veya yanıtları kapattı." });
        return;
      }
    }
    const { content, replyToId, mediaUrl, mediaType } = req.body;
    if (!content && !mediaUrl) { res.status(400).json({ error: "Content or media required" }); return; }

    const [comment] = await db.insert(commentsTable)
      .values({ postId, userId: req.user!.id, content: content || "", replyToId: replyToId ?? null })
      .returning();

    if (mediaUrl) {
      await db.execute(sql`UPDATE comments SET media_url = ${mediaUrl}, media_type = ${mediaType ?? "image"} WHERE id = ${comment.id}`);
    }

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
    const currentResult = await db.execute(sql`SELECT pinned FROM comments WHERE id = ${commentId} AND post_id = ${postId}`);
    const current = (currentResult as any).rows?.[0] ?? null;
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
    const requestedPage = Number.parseInt(String(req.query["page"] ?? "1"), 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const seed = typeof req.query["seed"] === "string" ? req.query["seed"].slice(0, 100) : "";
    res.json(await buildRecommendationFeed(viewerId, viewerId ? "for-you" : "trending", page, seed));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
