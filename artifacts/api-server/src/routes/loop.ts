import { Router } from "express";
import { db } from "@workspace/db";
import {
  loopPhotosTable, loopPhotoViewsTable,
  loopPhotoReactionsTable, loopPhotoRepliesTable,
  thoughtLikesTable, usersTable, followsTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
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
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Fotoğraf yükle ────────────────────────────────────────────────────
// POST /api/loop/photos
router.post("/loop/photos", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Dosya gerekli" });
    const userId = req.user!.id;
    const mediaUrl = `/uploads/${req.file.filename}`;
    const [photo] = await db.insert(loopPhotosTable).values({
      senderId: userId,
      mediaUrl,
    }).returning();
    res.json({ ok: true, photo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Arkadaşların anlık fotoğraflarını getir ───────────────────────────
// GET /api/loop/photos
router.get("/loop/photos", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Ben kimleri takip ediyorum
    const followingRows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    const friendIds = followingRows.map(r => r.followingId);
    if (friendIds.length === 0) return res.json([]);

    // Son 24 saatin fotoğrafları
    const photos = await db
      .select()
      .from(loopPhotosTable)
      .where(
        and(
          inArray(loopPhotosTable.senderId, friendIds),
          sql`${loopPhotosTable.createdAt} > NOW() - INTERVAL '24 hours'`
        )
      );

    if (photos.length === 0) return res.json([]);

    // Ben hangi fotoğrafları gördüm
    const viewedRows = await db
      .select({ photoId: loopPhotoViewsTable.photoId })
      .from(loopPhotoViewsTable)
      .where(eq(loopPhotoViewsTable.viewerId, userId));
    const viewedSet = new Set(viewedRows.map(r => r.photoId));

    // Gönderen kullanıcı bilgileri
    const senderIds = [...new Set(photos.map(p => p.senderId))];
    const senders = await db
      .select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, username: usersTable.username })
      .from(usersTable)
      .where(inArray(usersTable.id, senderIds));
    const senderMap = new Map(senders.map(s => [s.id, s]));

    const result = photos.map(p => ({
      id: p.id,
      mediaUrl: p.mediaUrl,
      createdAt: p.createdAt.toISOString(),
      sender: senderMap.get(p.senderId) ?? null,
      viewed: viewedSet.has(p.id),
    }));

    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Tek fotoğraf + tepkiler + yanıtlar ───────────────────────────────
// GET /api/loop/photos/:id
router.get("/loop/photos/:id", requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params["id"]!);
    const [photo] = await db.select().from(loopPhotosTable).where(eq(loopPhotosTable.id, photoId));
    if (!photo) return res.status(404).json({ error: "Bulunamadı" });

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
      ? await db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    res.json({
      id: photo.id,
      mediaUrl: photo.mediaUrl,
      createdAt: photo.createdAt.toISOString(),
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
    await db.insert(loopPhotoViewsTable).values({ photoId, viewerId: userId }).onConflictDoNothing();
    res.json({ ok: true });
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
