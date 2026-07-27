import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db";
import { eq, and, ilike, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats, enrichPost } from "../lib/helpers";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { postsTable } from "@workspace/db";
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
    const { displayName, bio, spotifyTrackId, thought } = req.body;
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (spotifyTrackId !== undefined) updateData.spotifyTrackId = spotifyTrackId;
    if (thought !== undefined) updateData.thought = thought;
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
