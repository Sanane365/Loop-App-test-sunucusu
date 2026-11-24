import { Router } from "express";
import { db } from "@workspace/db";
import {
  loopPhotosTable, loopPhotoViewsTable,
  loopPhotoReactionsTable, loopPhotoRepliesTable,
  thoughtLikesTable, usersTable,
} from "@workspace/db";
import { eq, and, inArray, sql, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { canMentionOrReplyToUser } from "../lib/userControls";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "crypto";
import fs from "fs";
import { getUserWithStats } from "../lib/helpers";

const router = Router();
const loopRepostsFile = path.resolve(import.meta.dirname, "..", "data", "loop-reposts.json");

const uploadDir = path.resolve(import.meta.dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024, files: 10 } });

function getMediaType(mediaUrl: string) {
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp|mpeg|mpg|ogv|ts|mts|m2ts)(?:\?|$)/i.test(mediaUrl) ? "video" : "image";
}

function getPublicMediaUrl(mediaUrl: string) {
  return mediaUrl.startsWith("/uploads/") ? `/api${mediaUrl}` : mediaUrl;
}

function getLoopMediaUrls(mediaUrl: string, mediaItems?: string | null) {
  try {
    const parsed = JSON.parse(mediaItems || "[]");
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((url) => typeof url === "string" && url.length > 0)) {
      return parsed;
    }
  } catch {
    // Older rows and malformed legacy values fall back to the primary media URL.
  }
  return [mediaUrl];
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function readLoopReposts(): Record<string, number[]> {
  try {
    if (!fs.existsSync(loopRepostsFile)) return {};
    return JSON.parse(fs.readFileSync(loopRepostsFile, "utf8")) as Record<string, number[]>;
  } catch { return {}; }
}

function writeLoopReposts(reposts: Record<string, number[]>) {
  fs.mkdirSync(path.dirname(loopRepostsFile), { recursive: true });
  fs.writeFileSync(loopRepostsFile, JSON.stringify(reposts, null, 2), "utf8");
}

export const loopMetadataMigration = Promise.all([
  db.execute(sql`ALTER TABLE loop_photos ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Yeni Loop'`),
  db.execute(sql`ALTER TABLE loop_photos ADD COLUMN IF NOT EXISTS caption text NOT NULL DEFAULT ''`),
  db.execute(sql`ALTER TABLE loop_photos ADD COLUMN IF NOT EXISTS tags text NOT NULL DEFAULT ''`),
  db.execute(sql`ALTER TABLE loop_photos ADD COLUMN IF NOT EXISTS audio text NOT NULL DEFAULT 'Orijinal ses'`),
  db.execute(sql`ALTER TABLE loop_photos ADD COLUMN IF NOT EXISTS media_items text NOT NULL DEFAULT '[]'`),
  db.execute(sql`ALTER TABLE loop_photo_views DROP CONSTRAINT IF EXISTS loop_photo_views_photo_id_viewer_id_unique`),
]);

// ── Fotoğraf yükle ────────────────────────────────────────────────────
// POST /api/loop/photos
router.post("/loop/photos", requireAuth, upload.fields([
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: 10 },
]), async (req, res) => {
  const fileFields = req.files as Record<string, Express.Multer.File[]> | undefined;
  const uploadedFiles = [...(fileFields?.files ?? []), ...(fileFields?.file ?? [])];
  try {
    if (uploadedFiles.length === 0) return res.status(400).json({ error: "En az bir fotoğraf veya video gerekli" });
    if (uploadedFiles.some((file) => !file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/"))) {
      uploadedFiles.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
      return res.status(400).json({ error: "Yalnızca fotoğraf veya video yükleyebilirsin" });
    }
    const userId = req.user!.id;
    const mediaItems = uploadedFiles.map((file) => `/api/uploads/${file.filename}`);
    const mediaUrl = mediaItems[0]!;
    const title = String(req.body.title || "Yeni Loop").trim().slice(0, 120);
    const caption = String(req.body.caption || "").trim().slice(0, 1000);
    const tags = String(req.body.tags || "").trim().slice(0, 300);
    const audio = String(req.body.audio || "Orijinal ses").trim().slice(0, 160);
    const [photo] = await db.insert(loopPhotosTable).values({
      senderId: userId,
      mediaUrl,
      mediaItems: JSON.stringify(mediaItems),
      title: title || "Yeni Loop",
      caption,
      tags,
      audio: audio || "Orijinal ses",
    }).returning();
    res.json({ ok: true, photo: { ...photo, mediaItems } });
  } catch (err) {
    uploadedFiles.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.delete("/loop/photos/:id", requireAuth, async (req, res) => {
  try {
    const photoId = Number(req.params["id"]);
    if (!Number.isInteger(photoId)) return res.status(400).json({ error: "Geçersiz Loop" });
    const [photo] = await db.select().from(loopPhotosTable).where(eq(loopPhotosTable.id, photoId)).limit(1);
    if (!photo) return res.status(404).json({ error: "Loop bulunamadı" });
    if (photo.senderId !== req.user!.id) return res.status(403).json({ error: "Bu Loop sana ait değil" });
    await db.delete(loopPhotosTable).where(eq(loopPhotosTable.id, photoId));
    getLoopMediaUrls(photo.mediaUrl, photo.mediaItems).forEach((mediaUrl) => {
      const publicMediaUrl = getPublicMediaUrl(mediaUrl);
      if (publicMediaUrl.startsWith("/api/uploads/")) {
        fs.rm(path.join(uploadDir, path.basename(publicMediaUrl)), { force: true }, () => {});
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Loop silinemedi" });
  }
});

// GET /api/loop/tags?q=gameplay
router.get("/loop/tags", requireAuth, async (req, res) => {
  try {
    const query = String(req.query.q || "").trim().toLowerCase().replace(/^#/, "");
    const photos = await db
      .select({ tags: loopPhotosTable.tags, caption: loopPhotosTable.caption })
      .from(loopPhotosTable);
    const counts = new Map<string, number>();
    for (const photo of photos) {
      const uniqueTags = new Set(
        `${String(photo.tags || "")} ${String(photo.caption || "")}`
          .match(/#[^\s#]+/g)
          ?.map((tag) => tag.slice(1).toLowerCase()) || [],
      );
      uniqueTags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    }
    const suggestions = [...counts.entries()]
      .filter(([tag]) => !query || tag.includes(query))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag, posts]) => ({ tag: `#${tag}`, posts }));
    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Etiketler yüklenemedi" });
  }
});

// ── Tüm Loop videolarını getir ────────────────────────────────────────
// GET /api/loop/photos
router.get("/loop/photos", async (req, res) => {
  try {
    // Loop videoları tüm giriş yapmış kullanıcılara görünür.
    const photos = await db.select().from(loopPhotosTable);

    if (photos.length === 0) return res.json([]);

    // Ben hangi fotoğrafları gördüm
    const viewedRows = req.user
      ? await db
          .select({ photoId: loopPhotoViewsTable.photoId })
          .from(loopPhotoViewsTable)
          .where(eq(loopPhotoViewsTable.viewerId, req.user.id))
      : [];
    const viewedSet = new Set(viewedRows.map(r => r.photoId));
    const viewRows = await db
      .select({ photoId: loopPhotoViewsTable.photoId, views: count() })
      .from(loopPhotoViewsTable)
      .groupBy(loopPhotoViewsTable.photoId);
    const viewCounts = new Map(viewRows.map(row => [row.photoId, Number(row.views)]));
    const reposts = readLoopReposts();
    const reactionRows = await db
      .select({ photoId: loopPhotoReactionsTable.photoId, userId: loopPhotoReactionsTable.userId })
      .from(loopPhotoReactionsTable);
    const replyRows = await db
      .select({ photoId: loopPhotoRepliesTable.photoId })
      .from(loopPhotoRepliesTable);
    const reactionCounts = new Map<number, number>();
    const likedByViewer = new Set<number>();
    const replyCounts = new Map<number, number>();
    reactionRows.forEach((reaction) => {
      reactionCounts.set(reaction.photoId, (reactionCounts.get(reaction.photoId) ?? 0) + 1);
      if (req.user?.id === reaction.userId) likedByViewer.add(reaction.photoId);
    });
    replyRows.forEach((reply) => replyCounts.set(reply.photoId, (replyCounts.get(reply.photoId) ?? 0) + 1));

    // Gönderen kullanıcı bilgileri
    const senderIds = [...new Set(photos.map(p => p.senderId))];
    const senders = await Promise.all(senderIds.map(senderId => getUserWithStats(senderId, req.user?.id)));
    const senderMap = new Map(senders.filter(Boolean).map(sender => [sender!.id, sender]));

    const result = photos.map(p => ({
      id: p.id,
      mediaUrl: getPublicMediaUrl(p.mediaUrl),
      mediaItems: getLoopMediaUrls(p.mediaUrl, p.mediaItems).map((url) => ({
        url: getPublicMediaUrl(url),
        mediaType: getMediaType(url),
      })),
      mediaType: getMediaType(p.mediaUrl),
      title: p.title,
      caption: p.caption,
      tags: p.tags,
      audio: p.audio,
      createdAt: p.createdAt.toISOString(),
      sender: senderMap.get(p.senderId) ?? null,
      views: viewCounts.get(p.id) ?? 0,
      viewed: viewedSet.has(p.id),
      reposted: req.user ? (reposts[String(p.id)] ?? []).includes(req.user.id) : false,
      repostCount: (reposts[String(p.id)] ?? []).length,
      likeCount: reactionCounts.get(p.id) ?? 0,
      liked: likedByViewer.has(p.id),
      commentCount: replyCounts.get(p.id) ?? 0,
    }));

    // TikTok-style discovery: unseen videos get priority, but every tier is
    // freshly shuffled so the feed never follows database insertion order.
    const unseen = shuffle(result.filter((loop) => !loop.viewed));
    const seen = shuffle(result.filter((loop) => loop.viewed));
    const randomizedResult = [...unseen, ...seen];

    res.setHeader("Cache-Control", "no-store");
    res.json(randomizedResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/loop/photos/:id/repost", requireAuth, async (req, res) => {
  const photoId = Number(req.params["id"]);
  if (!Number.isInteger(photoId)) return res.status(400).json({ error: "Geçersiz Loop" });
  const reposts = readLoopReposts();
  const users = new Set(reposts[String(photoId)] ?? []);
  users.add(req.user!.id);
  reposts[String(photoId)] = [...users];
  writeLoopReposts(reposts);
  res.json({ ok: true, reposted: true, repostCount: reposts[String(photoId)].length });
});

router.delete("/loop/photos/:id/repost", requireAuth, async (req, res) => {
  const photoId = Number(req.params["id"]);
  if (!Number.isInteger(photoId)) return res.status(400).json({ error: "Geçersiz Loop" });
  const reposts = readLoopReposts();
  reposts[String(photoId)] = (reposts[String(photoId)] ?? []).filter(id => id !== req.user!.id);
  writeLoopReposts(reposts);
  res.json({ ok: true, reposted: false, repostCount: reposts[String(photoId)].length });
});

// ── Tek fotoğraf + tepkiler + yanıtlar ───────────────────────────────
// GET /api/loop/photos/:id
router.get("/loop/photos/:id", requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params["id"]!);
    const [photo] = await db.select().from(loopPhotosTable).where(eq(loopPhotosTable.id, photoId));
    if (!photo) return res.status(404).json({ error: "Bulunamadı" });
    const photoMetadata = photo as typeof photo & {
      title?: string | null;
      caption?: string | null;
      audio?: string | null;
    };
    const sender = await getUserWithStats(photo.senderId, req.user?.id);

    const reactions = await db
      .select({ id: loopPhotoReactionsTable.id, emoji: loopPhotoReactionsTable.emoji, userId: loopPhotoReactionsTable.userId })
      .from(loopPhotoReactionsTable)
      .where(eq(loopPhotoReactionsTable.photoId, photoId));

    const replies = await db
      .select()
      .from(loopPhotoRepliesTable)
      .where(eq(loopPhotoRepliesTable.photoId, photoId));

    // Kullanıcı bilgileri
    const userIds = [...new Set([...reactions.map(r => r.userId), ...replies.map(r => r.userId)])];
    const users = userIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    res.json({
      id: photo.id,
      mediaUrl: getPublicMediaUrl(photo.mediaUrl),
      mediaType: getMediaType(photo.mediaUrl),
      title: photoMetadata.title ?? "Loop",
      caption: photoMetadata.caption ?? "",
      audio: photoMetadata.audio ?? "Orijinal ses",
      createdAt: photo.createdAt.toISOString(),
      sender: sender ?? null,
      reactions: reactions.map(r => ({ emoji: r.emoji, user: userMap.get(r.userId) ?? null })),
      replies: replies.map(r => ({ content: r.content, user: userMap.get(r.userId) ?? null, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Fotoğrafı görüldü işaretle ────────────────────────────────────────
// POST /api/loop/photos/:id/view
router.post("/loop/photos/:id/view", requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params["id"]!);
    const userId  = req.user!.id;
    await db.insert(loopPhotoViewsTable).values({ photoId, viewerId: userId });
    const [{ views }] = await db
      .select({ views: count() })
      .from(loopPhotoViewsTable)
      .where(eq(loopPhotoViewsTable.photoId, photoId));
    res.json({ ok: true, views: Number(views ?? 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Tepki ekle / değiştir ─────────────────────────────────────────────
// POST /api/loop/photos/:id/react   body: { emoji }
router.post("/loop/photos/:id/react", requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params["id"]!);
    const userId  = req.user!.id;
    const { emoji } = req.body as { emoji: string };
    if (!emoji) return res.status(400).json({ error: "Emoji gerekli" });

    const existing = await db.select().from(loopPhotoReactionsTable)
      .where(and(eq(loopPhotoReactionsTable.photoId, photoId), eq(loopPhotoReactionsTable.userId, userId)))
      .limit(1);

    if (existing.length > 0 && existing[0]!.emoji === emoji) {
      // Aynı emoji → kaldır
      await db.delete(loopPhotoReactionsTable)
        .where(and(eq(loopPhotoReactionsTable.photoId, photoId), eq(loopPhotoReactionsTable.userId, userId)));
    } else {
      await db.insert(loopPhotoReactionsTable)
        .values({ photoId, userId, emoji })
        .onConflictDoUpdate({
          target: [loopPhotoReactionsTable.photoId, loopPhotoReactionsTable.userId],
          set: { emoji },
        });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Yanıt yaz ─────────────────────────────────────────────────────────
// POST /api/loop/photos/:id/reply   body: { content }
router.post("/loop/photos/:id/reply", requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params["id"]!);
    const userId  = req.user!.id;
    const { content } = req.body as { content: string };
    if (!content?.trim()) return res.status(400).json({ error: "İçerik gerekli" });
    const [photo] = await db.select({ senderId: loopPhotosTable.senderId })
      .from(loopPhotosTable).where(eq(loopPhotosTable.id, photoId)).limit(1);
    if (!photo) return res.status(404).json({ error: "Loop bulunamadı" });
    if (!(await canMentionOrReplyToUser(userId, photo.senderId))) {
      return res.status(403).json({ error: "Bu kullanıcı yalnızca takipçilerinden yanıt kabul ediyor veya yanıtları kapattı." });
    }
    await db.insert(loopPhotoRepliesTable).values({ photoId, userId, content: content.trim() });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Düşünce beğen / beğeniyi geri al ─────────────────────────────────
// POST /api/thoughts/:userId/like
router.post("/thoughts/:userId/like", requireAuth, async (req, res) => {
  try {
    const thoughtOwnerId = parseInt(req.params["userId"]!);
    const likerId = req.user!.id;
    if (thoughtOwnerId === likerId) return res.status(400).json({ error: "Kendi düşünceni beğenemezsin" });

    const existing = await db.select().from(thoughtLikesTable)
      .where(and(eq(thoughtLikesTable.thoughtOwnerId, thoughtOwnerId), eq(thoughtLikesTable.likerId, likerId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(thoughtLikesTable)
        .where(and(eq(thoughtLikesTable.thoughtOwnerId, thoughtOwnerId), eq(thoughtLikesTable.likerId, likerId)));
      return res.json({ liked: false });
    } else {
      await db.insert(thoughtLikesTable).values({ thoughtOwnerId, likerId });
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Düşünce beğenenler ────────────────────────────────────────────────
// GET /api/thoughts/:userId/likes
router.get("/thoughts/:userId/likes", requireAuth, async (req, res) => {
  try {
    const thoughtOwnerId = parseInt(req.params["userId"]!);
    const likes = await db
      .select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
      .from(thoughtLikesTable)
      .innerJoin(usersTable, eq(thoughtLikesTable.likerId, usersTable.id))
      .where(eq(thoughtLikesTable.thoughtOwnerId, thoughtOwnerId));
    res.json(likes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
