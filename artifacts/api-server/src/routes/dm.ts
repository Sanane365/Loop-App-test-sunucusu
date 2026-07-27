import { Router } from "express";
import { db } from "@workspace/db";
import { directMessagesTable, usersTable } from "@workspace/db";
import { eq, or, and, desc, sql } from "drizzle-orm";
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
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function enrichMessage(msg: typeof directMessagesTable.$inferSelect) {
  const [sender] = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
  return {
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    isRead: msg.isRead,
    sender: sender ?? null,
    createdAt: msg.createdAt.toISOString(),
  };
}

// GET /dm/conversations — list all DM conversation partners
router.get("/dm/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get latest message per conversation partner
    const sent = await db.select()
      .from(directMessagesTable)
      .where(eq(directMessagesTable.senderId, userId))
      .orderBy(desc(directMessagesTable.createdAt));

    const received = await db.select()
      .from(directMessagesTable)
      .where(eq(directMessagesTable.receiverId, userId))
      .orderBy(desc(directMessagesTable.createdAt));

    const allMessages = [...sent, ...received].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Group by other user
    const seen = new Set<number>();
    const conversations: {
      userId: number;
      lastMessage: typeof directMessagesTable.$inferSelect;
      unreadCount: number;
    }[] = [];

    for (const msg of allMessages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        const unreadCount = received.filter(m => m.senderId === otherId && !m.isRead).length;
        conversations.push({ userId: otherId, lastMessage: msg, unreadCount });
      }
    }

    const enriched = await Promise.all(conversations.map(async c => {
      const [user] = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, thought: usersTable.thought })
        .from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
      return {
        user: user ?? null,
        lastMessage: await enrichMessage(c.lastMessage),
        unreadCount: c.unreadCount,
      };
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dm/:userId — get messages with a user
router.get("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const myId = req.user!.id;
    const otherId = parseInt(req.params["userId"]!);

    const messages = await db.select()
      .from(directMessagesTable)
      .where(or(
        and(eq(directMessagesTable.senderId, myId), eq(directMessagesTable.receiverId, otherId)),
        and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.receiverId, myId)),
      ))
      .orderBy(desc(directMessagesTable.createdAt))
      .limit(60);

    // Mark received messages as read
    await db.update(directMessagesTable)
      .set({ isRead: true })
      .where(and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.receiverId, myId)));

    const enriched = await Promise.all(messages.reverse().map(enrichMessage));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/:userId — send a text message
router.post("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"]!);
    const { content } = req.body;

    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

    const [msg] = await db.insert(directMessagesTable)
      .values({ senderId, receiverId, content })
      .returning();

    res.status(201).json(await enrichMessage(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/:userId/media — send a media message
router.post("/dm/:userId/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"]!);

    if (!req.file) { res.status(400).json({ error: "No file" }); return; }

    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    const [msg] = await db.insert(directMessagesTable)
      .values({ senderId, receiverId, mediaUrl, mediaType })
      .returning();

    res.status(201).json(await enrichMessage(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
