import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db";
import { eq, and, ilike, ne, or, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getActiveGooglePlayProductIds } from "../lib/googlePlayBilling";
import { avatarFrameTransformSchemaReady, storyPreviewSchemaReady, getUserWithStats, enrichPost } from "../lib/helpers";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { postsTable, notificationsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { canViewUserContent, canViewUserList, followRequestsReady, getBlockStatus, getHiddenProfileUserIds, getProfileControls, getUserPrivacySettings, hasPendingFollowRequest, type UserPrivacySettings } from "../lib/userControls";

const router = Router();

void db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS thought_updated_at TIMESTAMP`).catch(() => {});
export const profileIntroVideoSchemaMigration = db.execute(sql`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_intro_video_url TEXT
`).then(async () => {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_intro_video_transparency_mode TEXT NOT NULL DEFAULT 'auto'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_intro_video_edge_fade BOOLEAN NOT NULL DEFAULT TRUE`);
});
void profileIntroVideoSchemaMigration.catch(error => {
  console.error("Profile intro video schema migration failed:", error);
});

db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS author_bio TEXT`).catch(() => {});
db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_city TEXT`).catch(() => {});
db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_country TEXT`).catch(() => {});
db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS thought_spotify_track_id TEXT`).catch(() => {});

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });
const storyCoverExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const storyCoverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${storyCoverExtensions[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!storyCoverExtensions[file.mimetype]) {
      callback(new Error("Hikaye kapağı JPG, PNG, WebP veya GIF olmalı"));
      return;
    }
    callback(null, true);
  },
});

function removeStoryCoverFile(url: string | null | undefined, logError: (error: Error) => void) {
  const filename = url?.startsWith("/api/uploads/") ? path.basename(url) : "";
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/i.test(filename)) return;
  const filePath = path.resolve(uploadDir, filename);
  if (path.dirname(filePath) !== path.resolve(uploadDir)) return;
  fs.unlink(filePath, error => {
    if (error && (error as NodeJS.ErrnoException).code !== "ENOENT") logError(error);
  });
}
const profileIntroVideoUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const supportedVideo = file.mimetype === "video/mp4" && extension === ".mp4"
      || file.mimetype === "video/webm" && extension === ".webm";
    if (!supportedVideo) {
      callback(new Error("Profil giriş videosu MP4 veya WebM olmalı"));
      return;
    }
    callback(null, true);
  },
});

async function requireBrandIntroVideo(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  try {
    await profileIntroVideoSchemaMigration;
    const [user] = await db.select({ role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.id, req.user!.id)).limit(1);
    const activeProducts = await getActiveGooglePlayProductIds(req.user!.id);
    if (user?.role !== "brand" && !activeProducts.includes("loop_gold_full")) {
      res.status(403).json({ error: "Profil giriş videosu yalnızca Marka rolüne açıktır" });
      return;
    }
    next();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Marka rolü doğrulanamadı" });
  }
}

function uploadProfileIntroVideo(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  profileIntroVideoUpload.single("file")(req, res, error => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Profil giriş videosu en fazla 20 MB olabilir"
        : error instanceof Error ? error.message : "Video yüklenemedi";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

router.get("/users", async (req, res) => {
  try {
    const q = req.query["q"] as string | undefined;
    const viewerId = req.user?.id;

    let users;
    if (q) {
      users = await db
        .select()
        .from(usersTable)
        .where(
          or(
            ilike(usersTable.username, `%${q}%`),
            ilike(usersTable.displayName, `%${q}%`),
          ),
        )
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

router.get("/users/me/privacy", requireAuth, async (req, res) => {
  try {
    res.json(await getUserPrivacySettings(req.user!.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Gizlilik ayarları yüklenemedi" });
  }
});

router.patch("/users/me/privacy", requireAuth, async (req, res) => {
  let current: UserPrivacySettings;
  try {
    current = await getUserPrivacySettings(req.user!.id);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Gizlilik ayarları yüklenemedi" });
    return;
  }
  const input = req.body as Partial<UserPrivacySettings>;
  const next: UserPrivacySettings = { ...current, ...input };
  const valid = typeof next.privateAccount === "boolean"
    && ["everyone", "followers", "following", "mutuals", "requests", "nobody"].includes(next.allowMessages)
    && ["everyone", "followers", "only_me"].includes(next.followerListVisibility)
    && ["everyone", "followers", "only_me"].includes(next.followingListVisibility)
    && ["everyone", "followers"].includes(next.bulletinAudience)
    && ["everyone", "followers", "nobody"].includes(next.mentionReplyAudience);
  if (!valid) {
    res.status(400).json({ error: "Geçersiz gizlilik tercihi" });
    return;
  }
  try {
    const result = await db.execute(sql`
      INSERT INTO user_privacy_settings (
        user_id, private_account, allow_messages, follower_list_visibility,
        following_list_visibility, bulletin_audience, mention_reply_audience, updated_at
      ) VALUES (
        ${req.user!.id}, ${next.privateAccount}, ${next.allowMessages},
        ${next.followerListVisibility}, ${next.followingListVisibility},
        ${next.bulletinAudience}, ${next.mentionReplyAudience}, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        private_account = EXCLUDED.private_account,
        allow_messages = EXCLUDED.allow_messages,
        follower_list_visibility = EXCLUDED.follower_list_visibility,
        following_list_visibility = EXCLUDED.following_list_visibility,
        bulletin_audience = EXCLUDED.bulletin_audience,
        mention_reply_audience = EXCLUDED.mention_reply_audience,
        updated_at = now()
      RETURNING
        private_account AS "privateAccount",
        allow_messages AS "allowMessages",
        follower_list_visibility AS "followerListVisibility",
        following_list_visibility AS "followingListVisibility",
        bulletin_audience AS "bulletinAudience",
        mention_reply_audience AS "mentionReplyAudience"
    `);
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Gizlilik ayarları kaydedilemedi" });
  }
});

router.patch("/users/me/profile", requireAuth, async (req, res) => {
  try {
    const { displayName, bio, locationCity, locationCountry, authorBio, spotifyTrackId, thoughtSpotifyTrackId, thought, username } = req.body;
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (locationCity !== undefined) updateData.locationCity = locationCity ? String(locationCity).trim().slice(0, 80) : null;
    if (locationCountry !== undefined) updateData.locationCountry = locationCountry ? String(locationCountry).trim().slice(0, 80) : null;
    if (authorBio !== undefined) updateData.authorBio = authorBio;
    if (spotifyTrackId !== undefined) updateData.spotifyTrackId = spotifyTrackId;
    if (thoughtSpotifyTrackId !== undefined) updateData.thoughtSpotifyTrackId = thoughtSpotifyTrackId;
    if (thought !== undefined) {
      updateData.thought = thought;
      updateData.thoughtUpdatedAt = thought ? new Date() : null;
    }
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

router.patch("/users/me/decorations", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(usersTable).set({
      badgeVisible: req.body?.badgeVisible !== false,
      emblemVisible: req.body?.emblemVisible !== false,
      avatarFrameVisible: req.body?.avatarFrameVisible !== false,
    }).where(eq(usersTable.id, req.user!.id)).returning();
    res.json({ badgeVisible: updated.badgeVisible, emblemVisible: updated.emblemVisible, avatarFrameVisible: updated.avatarFrameVisible });
  } catch (error) {
    console.error("Decoration visibility error:", error);
    res.status(500).json({ error: "Dekorasyon ayarları kaydedilemedi" });
  }
});

router.patch("/users/me/avatar-frame-transform", requireAuth, async (req, res) => {
  try {
    await avatarFrameTransformSchemaReady;
    const { x, y, scale } = req.body ?? {};
    if (
      typeof x !== "number" || !Number.isFinite(x) || x < -42 || x > 42
      || typeof y !== "number" || !Number.isFinite(y) || y < -42 || y > 42
      || typeof scale !== "number" || !Number.isFinite(scale) || scale < 0.8 || scale > 1.3
    ) {
      res.status(400).json({ error: "Çerçeve konumu geçersiz." });
      return;
    }
    const avatarFrameTransform = { x, y, scale };
    await db.update(usersTable)
      .set({ avatarFrameTransform })
      .where(eq(usersTable.id, req.user!.id));
    res.json({ avatarFrameTransform });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Çerçeve konumu kaydedilemedi." });
  }
});

// ── Pano (Community Board) ────────────────────────────────────────────────────
// Schema is managed through the Drizzle DB push step; do not re-create tables at import time.

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

router.post("/users/me/story-cover", requireAuth, (req, res, next) => {
  storyCoverUpload.single("file")(req, res, error => {
    if (error) {
      req.log.error(error);
      res.status(400).json({
        error: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Hikaye kapağı en fazla 10 MB olabilir"
          : error.message,
      });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    await storyPreviewSchemaReady;
    if (!req.file) {
      res.status(400).json({ error: "Galeriden bir hikaye kapak görseli seçmelisin" });
      return;
    }
    const url = `/api/uploads/${req.file.filename}`;
    const [previousUser] = await db.select({ storyPreviewUrl: usersTable.storyPreviewUrl })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);
    if (!previousUser) {
      removeStoryCoverFile(url, error => req.log.error(error));
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }
    const [updatedUser] = await db.update(usersTable)
      .set({ storyPreviewUrl: url })
      .where(eq(usersTable.id, req.user!.id))
      .returning({ storyPreviewUrl: usersTable.storyPreviewUrl });
    if (!updatedUser) {
      removeStoryCoverFile(url, error => req.log.error(error));
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }
    removeStoryCoverFile(previousUser.storyPreviewUrl, error => req.log.error(error));
    res.json({ storyPreviewUrl: updatedUser.storyPreviewUrl });
  } catch (error) {
    if (req.file) removeStoryCoverFile(`/api/uploads/${req.file.filename}`, cleanupError => req.log.error(cleanupError));
    req.log.error(error);
    res.status(500).json({ error: "Hikaye kapağı kaydedilemedi" });
  }
});

router.delete("/users/me/story-cover", requireAuth, async (req, res) => {
  try {
    await storyPreviewSchemaReady;
    const [updatedUser] = await db.update(usersTable)
      .set({ storyPreviewUrl: null })
      .where(eq(usersTable.id, req.user!.id))
      .returning({ storyPreviewUrl: usersTable.storyPreviewUrl });
    if (!updatedUser) {
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
      return;
    }
    res.json({ success: true });
    removeStoryCoverFile(updatedUser.storyPreviewUrl, error => req.log.error(error));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Hikaye kapağı kaldırılamadı" });
  }
});

router.post("/users/me/profile-intro-video", requireAuth, requireBrandIntroVideo, uploadProfileIntroVideo, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "MP4 veya WebM video seçmelisin" });
      return;
    }

    const profileIntroVideoUrl = `/api/uploads/${req.file.filename}`;
    await db.update(usersTable).set({ profileIntroVideoUrl })
      .where(eq(usersTable.id, req.user!.id));
    res.json({ profileIntroVideoUrl });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Profil giriş videosu kaydedilemedi" });
  }
});

router.delete("/users/me/profile-intro-video", requireAuth, async (req, res) => {
  try {
    await profileIntroVideoSchemaMigration;
    const [user] = await db.select({ role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.id, req.user!.id)).limit(1);
    const activeProducts = await getActiveGooglePlayProductIds(req.user!.id);
    if (user?.role !== "brand" && !activeProducts.includes("loop_gold_full")) {
      res.status(403).json({ error: "Profil giriş videosu yalnızca Marka rolüne açıktır" });
      return;
    }
    await db.update(usersTable).set({ profileIntroVideoUrl: null })
      .where(eq(usersTable.id, req.user!.id));
    res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Profil giriş videosu kaldırılamadı" });
  }
});

router.patch("/users/me/profile-intro-video/settings", requireAuth, requireBrandIntroVideo, async (req, res) => {
  try {
    const { transparencyMode, edgeFade } = req.body ?? {};
    const allowedModes = ["auto", "none", "green", "white"];
    if (!allowedModes.includes(transparencyMode) || typeof edgeFade !== "boolean") {
      res.status(400).json({ error: "Geçersiz şeffaflaştırma ayarları" });
      return;
    }
    await db.update(usersTable).set({
      profileIntroVideoTransparencyMode: transparencyMode,
      profileIntroVideoEdgeFade: edgeFade,
    }).where(eq(usersTable.id, req.user!.id));
    res.json({ transparencyMode, edgeFade });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Profil giriş animasyonu ayarları kaydedilemedi" });
  }
});

router.get("/users/me/blocked", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        u.id,
        u.username,
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl"
      FROM user_profile_controls control
      JOIN users u ON u.id = control.target_user_id
      WHERE control.user_id = ${req.user!.id} AND control.blocked = true
      ORDER BY lower(u.username)
    `);
    res.json(result.rows);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Engellenen kullanıcılar yüklenemedi" });
  }
});

router.get("/users/:userId/controls", requireAuth, async (req, res) => {
  try {
    const targetUserId = Number(req.params["userId"]);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Geçersiz kullanıcı" });
    }

    const controls = targetUserId === req.user!.id
      ? undefined
      : await getProfileControls(req.user!.id, targetUserId);
    const blockStatus = targetUserId === req.user!.id
      ? { blockedByMe: false, blockedByThem: false }
      : await getBlockStatus(req.user!.id, targetUserId);

    return res.json({
      blocked: controls?.blocked ?? false,
      restricted: controls?.restricted ?? false,
      postsHidden: controls?.postsHidden ?? false,
      blockedByMe: blockStatus.blockedByMe,
      blockedByThem: blockStatus.blockedByThem,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Profil tercihleri yüklenemedi" });
  }
});

router.patch("/users/:userId/controls", requireAuth, async (req, res) => {
  try {
    const targetUserId = Number(req.params["userId"]);
    const control = req.body?.control;
    const enabled = req.body?.enabled;
    const columnByControl = {
      blocked: "blocked",
      restricted: "restricted",
      postsHidden: "posts_hidden",
    } as const;

    if (
      !Number.isInteger(targetUserId) ||
      targetUserId <= 0 ||
      targetUserId === req.user!.id ||
      typeof control !== "string" ||
      !Object.prototype.hasOwnProperty.call(columnByControl, control) ||
      typeof enabled !== "boolean"
    ) {
      return res.status(400).json({ error: "Geçersiz profil tercihi" });
    }

    const target = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.id, targetUserId)).limit(1);
    if (!target[0]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const column = columnByControl[control as keyof typeof columnByControl];
    const result = await db.execute(sql`
      INSERT INTO user_profile_controls (user_id, target_user_id, blocked, restricted, posts_hidden)
      VALUES (${req.user!.id}, ${targetUserId}, ${control === "blocked" && enabled}, ${control === "restricted" && enabled}, ${control === "postsHidden" && enabled})
      ON CONFLICT (user_id, target_user_id)
      DO UPDATE SET ${sql.raw(column)} = ${enabled}, updated_at = now()
      RETURNING blocked, restricted, posts_hidden AS "postsHidden"
    `);
    return res.json(result.rows[0]);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Profil tercihi kaydedilemedi" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const viewerId = req.user?.id;

    if (viewerId && viewerId !== userId) {
      const blockStatus = await getBlockStatus(viewerId, userId);
      if (blockStatus.blockedByThem) {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

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

    const hiddenUserIds = viewerId ? await getHiddenProfileUserIds(viewerId) : new Set<number>();
    const canViewPosts = await canViewUserContent(viewerId, userId);
    const visiblePosts = hiddenUserIds.has(userId) || !canViewPosts ? [] : posts;
    const enrichedPosts = await Promise.all(visiblePosts.map((p) => enrichPost(p, viewerId)));
    const privacy = await getUserPrivacySettings(userId);

    const isFollowRequestPending = viewerId !== undefined && viewerId !== userId
      ? await hasPendingFollowRequest(viewerId, userId)
      : false;
    res.json({
      ...user,
      posts: enrichedPosts,
      isPrivateAccount: privacy.privateAccount,
      canViewPrivateContent: canViewPosts,
      isFollowRequestPending,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId/followers", async (req, res) => {
  try {
    const userId = parseInt(req.params["userId"]!);
    const viewerId = req.user?.id;
    if (!(await canViewUserList(viewerId, userId, "followers"))) {
      res.status(403).json({ error: "Bu kullanıcının takipçi listesi gizli" });
      return;
    }
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
    if (!(await canViewUserList(viewerId, userId, "following"))) {
      res.status(403).json({ error: "Bu kullanıcının takip edilenler listesi gizli" });
      return;
    }
    const rows = await db.select().from(followsTable).where(eq(followsTable.followerId, userId));
    const users = await Promise.all(rows.map(r => getUserWithStats(r.followingId, viewerId)));
    res.json(users.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/questions", requireAuth, async (req, res) => {
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

// PB sayısını getir (notifications tablosundaki profile_like kayıtları)
router.get("/users/:userId/profile-like-count", async (req, res) => {
  try {
    const targetId = parseInt(req.params["userId"]!);
    const result = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ${targetId} AND type = 'profile_like'`
    );
    const row = (result as any).rows?.[0] ?? result[0] ?? {};
    const cnt = Number(row?.cnt ?? row?.count ?? 0);
    res.json({ count: cnt });
  } catch (err) {
    req.log.error(err);
    res.json({ count: 0 });
  }
});

// Mevcut kullanıcı PB basıp basmadığını sorgula
router.get("/users/:userId/pb-status", requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params["userId"]!);
    const result = await db.execute(
      sql`SELECT 1 FROM notifications WHERE user_id = ${targetId} AND from_user_id = ${req.user!.id} AND type = 'profile_like' LIMIT 1`
    );
    const pressed = ((result as any).rows?.length ?? 0) > 0;
    res.json({ pressed });
  } catch (err) {
    req.log.error(err);
    res.json({ pressed: false });
  }
});

// PB bas → bildirim gönder (1 kişi 1 kez)
router.post("/users/:userId/like-profile", requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params["userId"]!);
    if (targetId === req.user!.id) { res.status(400).json({ error: "Kendinize PB yapamazsınız" }); return; }
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

    const privacy = await getUserPrivacySettings(followingId);
    if (privacy.privateAccount) {
      await followRequestsReady;
      await db.execute(sql`
        INSERT INTO follow_requests (requester_id, target_user_id)
        VALUES (${followerId}, ${followingId})
        ON CONFLICT (requester_id, target_user_id) DO NOTHING
      `);
      await db.execute(sql`
        INSERT INTO notifications (user_id, from_user_id, type, data)
        SELECT ${followingId}, ${followerId}, 'follow_request',
          jsonb_build_object('status', 'pending')
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE user_id = ${followingId} AND from_user_id = ${followerId}
            AND type = 'follow_request'
        )
      `);
      res.json({ ok: true, requested: true });
      return;
    }
    await db.insert(followsTable).values({ followerId, followingId }).onConflictDoNothing();
    res.json({ ok: true, requested: false });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId/follow-request", requireAuth, async (req, res) => {
  try {
    const targetUserId = Number(req.params["userId"]);
    await followRequestsReady;
    await db.execute(sql`
      DELETE FROM follow_requests
      WHERE requester_id = ${req.user!.id} AND target_user_id = ${targetUserId}
    `);
    await db.execute(sql`
      DELETE FROM notifications
      WHERE user_id = ${targetUserId} AND from_user_id = ${req.user!.id}
        AND type = 'follow_request'
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Takip isteği iptal edilemedi" });
  }
});

router.post("/users/:userId/follow-request/respond", requireAuth, async (req, res) => {
  try {
    const requesterId = Number(req.params["userId"]);
    const targetUserId = req.user!.id;
    const action = req.body?.action;
    if (!Number.isInteger(requesterId) || requesterId <= 0 || !["accepted", "rejected"].includes(action)) {
      res.status(400).json({ error: "Geçersiz takip isteği yanıtı" });
      return;
    }
    await followRequestsReady;
    const request = await db.execute(sql`
      SELECT 1 FROM follow_requests
      WHERE requester_id = ${requesterId} AND target_user_id = ${targetUserId}
    `);
    if (!request.rows.length) {
      res.status(404).json({ error: "Bekleyen takip isteği bulunamadı" });
      return;
    }
    if (action === "accepted") {
      await db.insert(followsTable).values({ followerId: requesterId, followingId: targetUserId }).onConflictDoNothing();
    }
    await db.execute(sql`
      DELETE FROM follow_requests
      WHERE requester_id = ${requesterId} AND target_user_id = ${targetUserId}
    `);
    await db.execute(sql`
      UPDATE notifications
      SET is_read = true,
          data = jsonb_build_object('status', ${action})
      WHERE user_id = ${targetUserId} AND from_user_id = ${requesterId}
        AND type = 'follow_request'
    `);
    res.json({ ok: true, accepted: action === "accepted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Takip isteği yanıtlanamadı" });
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
