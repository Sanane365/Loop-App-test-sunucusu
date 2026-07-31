import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db";
import { eq, and, ilike, ne, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats, enrichPost } from "../lib/helpers";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { postsTable, notificationsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

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

router.get("/users", async (req, res) => {
  try {
    const q = req.query["q"] as string | undefined;
    const viewerId = req.user?.id;

    let users;
    if (q) {
      users = await db
        .select()
        .from(usersTable)
        .where(ilike(usersTable.username, `%${q}%`))
        .limit(20);
    } else {
      users = await db.select().from(usersTable).limit(20);
    }

    const enriched = await Promise.all(users.map((u) => getUserWithStats(u.id, viewerId)));
    res.json(enriched.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/me/profile", requireAuth, async (req, res) => {
  try {
    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/me/profile", requireAuth, async (req, res) => {
  try {
    const { displayName, bio, spotifyTrackId, thought, username } = req.body;
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (spotifyTrackId !== undefined) updateData.spotifyTrackId = spotifyTrackId;
    if (thought !== undefined) updateData.thought = thought;
    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (!trimmed || trimmed.length < 3) {
        res.status(400).json({ error: "Kullanıcı adı en az 3 karakter olmalı" });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        res.status(400).json({ error: "Kullanıcı adı sadece harf, rakam ve _ içerebilir" });
        return;
      }
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.username, trimmed)).limit(1);
      if (existing[0] && existing[0].id !== req.user!.id) {
        res.status(400).json({ error: "Bu kullanıcı adı zaten alınmış" });
        return;
      }
      updateData.username = trimmed;
    }

    if (Object.keys(updateData).length === 0) {
      const user = await getUserWithStats(req.user!.id, req.user!.id);
      res.json(user);
      return;
    }

    await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, req.user!.id));

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Pano (Community Board) ────────────────────────────────────────────────────
// Runtime migration for pano board
db.execute(sql`CREATE TABLE IF NOT EXISTS pano_messages (
  id SERIAL PRIMARY KEY,
  profile_user_id INTEGER NOT NULL,
  from_user_id INTEGER,
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});
db.execute(sql`CREATE TABLE IF NOT EXISTS pano_message_likes (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
)`).catch(() => {});
db.execute(sql`CREATE TABLE IF NOT EXISTS pano_message_replies (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});

// Helper to extract rows from Drizzle/pg execute result (supports both QueryResult.rows and plain array)
const execRows = async (q: ReturnType<typeof db.execute>): Promise<any[]> => {
  const r = await q as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
};

router.get("/users/:userId/pano", async (req, res) => {
  try {
    const profileUserId = parseInt(req.params["userId"]!);
    const viewerId = (req as any).user?.id;
    const rows = await execRows(db.execute(sql`
      SELECT pm.*, u.username, u.display_name, u.avatar_url
      FROM pano_messages pm
      LEFT JOIN users u ON u.id = pm.from_user_id
      WHERE pm.profile_user_id = ${profileUserId}
      ORDER BY pm.created_at DESC LIMIT 30
    `));
    const messages = await Promise.all(rows.map(async (r) => {
      const [rc] = await execRows(db.execute(sql`SELECT COUNT(*)::int as c FROM pano_message_replies WHERE message_id = ${r.id}`));
      let isLiked = false;
      if (viewerId) {
        const [lk] = await execRows(db.execute(sql`SELECT 1 FROM pano_message_likes WHERE message_id = ${r.id} AND user_id = ${viewerId}`));
        isLiked = !!lk;
      }
      return {
        id: r.id,
        content: r.content,
        likeCount: Number(r.like_count ?? 0),
        replyCount: Number(rc?.c ?? 0),
        isLiked,
        createdAt: r.created_at,
        user: r.from_user_id ? { id: r.from_user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url } : null,
      };
    }));
    res.json(messages);
  } catch (err) { req.log?.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/users/:userId/pano", requireAuth, async (req, res) => {
  try {
    const profileUserId = parseInt(req.params["userId"]!);
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }
    const rows = await execRows(db.execute(sql`
      INSERT INTO pano_messages (profile_user_id, from_user_id, content)
      VALUES (${profileUserId}, ${(req as any).user!.id}, ${content.trim()})
      RETURNING *
    `));
    const row = rows[0];
    res.json({ id: row.id, content: row.content, likeCount: 0, replyCount: 0, isLiked: false, createdAt: row.created_at, user: { id: (req as any).user!.id } });
  } catch (err) { req.log?.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/pano/:messageId/like", requireAuth, async (req, res) => {
  try {
    const msgId = parseInt(req.params["messageId"]!);
    const uid = (req as any).user!.id;
    const [existing] = await execRows(db.execute(sql`SELECT 1 FROM pano_message_likes WHERE message_id = ${msgId} AND user_id = ${uid}`));
    if (existing) {
      await db.execute(sql`DELETE FROM pano_message_likes WHERE message_id = ${msgId} AND user_id = ${uid}`);
      await db.execute(sql`UPDATE pano_messages SET like_count = GREATEST(0, like_count - 1) WHERE id = ${msgId}`);
      res.json({ liked: false });
    } else {
      await db.execute(sql`INSERT INTO pano_message_likes (message_id, user_id) VALUES (${msgId}, ${uid}) ON CONFLICT DO NOTHING`);
      await db.execute(sql`UPDATE pano_messages SET like_count = like_count + 1 WHERE id = ${msgId}`);
      res.json({ liked: true });
    }
  } catch (err) { req.log?.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/pano/:messageId/reply", requireAuth, async (req, res) => {
  try {
    const msgId = parseInt(req.params["messageId"]!);
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }
    const rows = await execRows(db.execute(sql`
      INSERT INTO pano_message_replies (message_id, from_user_id, content)
      VALUES (${msgId}, ${(req as any).user!.id}, ${content.trim()})
      RETURNING *
    `));
    res.json(rows[0]);
  } catch (err) { req.log?.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/pano/:messageId/replies", async (req, res) => {
  try {
    const msgId = parseInt(req.params["messageId"]!);
    const rows = await execRows(db.execute(sql`
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM pano_message_replies r
      LEFT JOIN users u ON u.id = r.from_user_id
      WHERE r.message_id = ${msgId}
      ORDER BY r.created_at ASC
    `));
    res.json(rows.map(r => ({
      id: r.id, content: r.content, createdAt: r.created_at,
      user: { id: r.from_user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
    })));
  } catch (err) { req.log?.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Genel dosya yükleme — yorum görselleri vb. için
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const url = `/api/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
    res.json({ url, mediaType });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/me/avatar", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/api/uploads/${req.file.filename}`;
    await db.update(usersTable).set({ avatarUrl: url }).where(eq(usersTable.id, req.user!.id));
    res.json({ url, type: "image" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/me/banner", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/api/uploads/${req.file.filename}`;
    await db.update(usersTable).set({ bannerUrl: url }).where(eq(usersTable.id, req.user!.id));
    res.json({ url, type: "image" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const viewerId = req.user?.id;

    const user = await getUserWithStats(userId, viewerId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const posts = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.userId, userId))
      .orderBy(desc(postsTable.createdAt))
      .limit(20);

    const enrichedPosts = await Promise.all(posts.map((p) => enrichPost(p, viewerId)));

    res.json({ ...user, posts: enrichedPosts });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId/followers", async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const viewerId = req.user?.id;
    const rows = await db.select().from(followsTable).where(eq(followsTable.followingId, userId));
    const users = await Promise.all(rows.map(r => getUserWithStats(r.followerId, viewerId)));
    res.json(users.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId/following", async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const viewerId = req.user?.id;
    const rows = await db.select().from(followsTable).where(eq(followsTable.followerId, userId));
    const users = await Promise.all(rows.map(r => getUserWithStats(r.followingId, viewerId)));
    res.json(users.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/questions", async (req, res) => {
  try {
    const toUserId = parseInt(req.params["userId"]!);
    const { question } = req.body;
    if (!question?.trim()) {
      res.status(400).json({ error: "Soru boş olamaz" });
      return;
    }
    await db.execute(sql`INSERT INTO questions (to_user_id, question_text) VALUES (${toUserId}, ${question.trim()})`);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/me/questions", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT q.*, u.display_name, u.username, u.avatar_url
      FROM questions q
      JOIN users u ON u.id = q.to_user_id
      WHERE q.to_user_id = ${req.user!.id}
      ORDER BY q.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /questions/public — yanıtlanmış sorular herkese açık feed
router.get("/questions/public", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT q.id, q.question_text, q.answer_text, q.answered_at, q.created_at,
             u.id as to_user_id, u.display_name, u.username, u.avatar_url
      FROM questions q
      JOIN users u ON u.id = q.to_user_id
      WHERE q.answer_text IS NOT NULL
      ORDER BY q.answered_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /questions/:id/answer — soruyu yanıtla (sadece alıcı)
router.post("/questions/:id/answer", requireAuth, async (req, res) => {
  try {
    const questionId = parseInt(req.params["id"]!);
    const { answer } = req.body;
    if (!answer?.trim()) { res.status(400).json({ error: "Yanıt boş olamaz" }); return; }
    const check = await db.execute(sql`SELECT to_user_id FROM questions WHERE id = ${questionId}`);
    if (!check.rows[0] || (check.rows[0] as any).to_user_id !== req.user!.id) {
      res.status(403).json({ error: "Bu soruyu yanıtlama yetkiniz yok" }); return;
    }
    await db.execute(sql`UPDATE questions SET answer_text = ${answer.trim()}, answered_at = NOW() WHERE id = ${questionId}`);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /questions/:id/comments
router.get("/questions/:id/comments", async (req, res) => {
  try {
    const questionId = parseInt(req.params["id"]!);
    const result = await db.execute(sql`
      SELECT qc.id, qc.content, qc.created_at, u.id as user_id, u.display_name, u.username, u.avatar_url
      FROM question_comments qc
      JOIN users u ON u.id = qc.user_id
      WHERE qc.question_id = ${questionId}
      ORDER BY qc.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /questions/:id/comments
router.post("/questions/:id/comments", requireAuth, async (req, res) => {
  try {
    const questionId = parseInt(req.params["id"]!);
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "Yorum boş olamaz" }); return; }
    const result = await db.execute(sql`
      INSERT INTO question_comments (question_id, user_id, content)
      VALUES (${questionId}, ${req.user!.id}, ${content.trim()})
      RETURNING *
    `);
    const comment = result.rows[0] as any;
    const userRow = await db.execute(sql`SELECT display_name, username, avatar_url FROM users WHERE id = ${req.user!.id}`);
    const u = userRow.rows[0] as any;
    res.status(201).json({ ...comment, display_name: u?.display_name, username: u?.username, avatar_url: u?.avatar_url });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Profili beğen → bildirim gönder
router.post("/users/:userId/like-profile", requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params["userId"]!);
    if (targetId === req.user!.id) { res.status(400).json({ error: "Kendinizi beğenemezsiniz" }); return; }
    await db.insert(notificationsTable).values({
      userId: targetId,
      fromUserId: req.user!.id,
      type: "profile_like",
    }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove a follower (kendi takipçini kaldır)
router.post("/users/:userId/remove-follower", requireAuth, async (req, res) => {
  try {
    const followerId = parseInt(req.params["userId"]!);
    const followingId = req.user!.id;
    await db
      .delete(followsTable)
      .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, followingId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/follow", requireAuth, async (req, res) => {
  try {
    const followingId = parseInt(req.params["userId"]!);
    const followerId = req.user!.id;

    if (followerId === followingId) {
      res.status(400).json({ error: "Cannot follow yourself" });
      return;
    }

    await db.insert(followsTable).values({ followerId, followingId }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/unfollow", requireAuth, async (req, res) => {
  try {
    const followingId = parseInt(req.params["userId"]!);
    const followerId = req.user!.id;

    await db
      .delete(followsTable)
      .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, followingId)));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
