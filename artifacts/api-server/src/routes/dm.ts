import { Router } from "express";
import { db } from "@workspace/db";
import { directMessagesTable, usersTable, dmGroupsTable, dmGroupMembersTable, dmGroupMessagesTable } from "@workspace/db";
import { eq, or, and, desc, sql, inArray } from "drizzle-orm";
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
    const ext = path.extname(file.originalname) || ".webm";
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
    voiceUrl: msg.voiceUrl,
    voiceDuration: msg.voiceDuration,
    isRead: msg.isRead,
    sender: sender ?? null,
    createdAt: msg.createdAt.toISOString(),
  };
}

// GET /dm/conversations
router.get("/dm/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const sent = await db.select().from(directMessagesTable).where(eq(directMessagesTable.senderId, userId)).orderBy(desc(directMessagesTable.createdAt));
    const received = await db.select().from(directMessagesTable).where(eq(directMessagesTable.receiverId, userId)).orderBy(desc(directMessagesTable.createdAt));

    const allMessages = [...sent, ...received].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const seen = new Set<number>();
    const conversations: { userId: number; lastMessage: typeof directMessagesTable.$inferSelect; unreadCount: number }[] = [];

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

// GET /dm/:userId
router.get("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const myId = req.user!.id;
    const otherId = parseInt(req.params["userId"] as string);

    const messages = await db.select().from(directMessagesTable)
      .where(or(
        and(eq(directMessagesTable.senderId, myId), eq(directMessagesTable.receiverId, otherId)),
        and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.receiverId, myId)),
      ))
      .orderBy(desc(directMessagesTable.createdAt)).limit(60);

    await db.update(directMessagesTable).set({ isRead: true })
      .where(and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.receiverId, myId)));

    const enriched = await Promise.all(messages.reverse().map(enrichMessage));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/:userId — text message
router.post("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"] as string);
    const { content } = req.body;

    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, content }).returning();
    res.status(201).json(await enrichMessage(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/:userId/media
router.post("/dm/:userId/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"] as string);
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }

    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, mediaUrl, mediaType }).returning();
    res.status(201).json(await enrichMessage(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/:userId/voice — voice message
router.post("/dm/:userId/voice", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"] as string);
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }

    const voiceUrl = `/api/uploads/${req.file.filename}`;
    const voiceDuration = req.body.duration ? parseInt(req.body.duration) : null;

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, voiceUrl, voiceDuration }).returning();
    res.status(201).json(await enrichMessage(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Group DM ──────────────────────────────────────────────────────────────────

// GET /dm/groups
router.get("/dm/groups", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const memberships = await db.select({ groupId: dmGroupMembersTable.groupId })
      .from(dmGroupMembersTable).where(eq(dmGroupMembersTable.userId, userId));
    const groupIds = memberships.map(m => m.groupId);
    if (groupIds.length === 0) { res.json([]); return; }

    const groups = await db.select().from(dmGroupsTable).where(inArray(dmGroupsTable.id, groupIds));
    const enriched = await Promise.all(groups.map(async g => {
      const members = await db.select({ userId: dmGroupMembersTable.userId })
        .from(dmGroupMembersTable).where(eq(dmGroupMembersTable.groupId, g.id));
      const memberUsers = await Promise.all(members.map(async m => {
        const [u] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
          .from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
        return u;
      }));
      const [lastMsg] = await db.select().from(dmGroupMessagesTable)
        .where(eq(dmGroupMessagesTable.groupId, g.id))
        .orderBy(desc(dmGroupMessagesTable.createdAt)).limit(1);
      return { ...g, members: memberUsers.filter(Boolean), lastMessage: lastMsg ?? null, createdAt: g.createdAt.toISOString() };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/groups
router.post("/dm/groups", requireAuth, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !Array.isArray(memberIds) || memberIds.length < 1) {
      res.status(400).json({ error: "name ve en az 1 üye gerekli" }); return;
    }
    const [group] = await db.insert(dmGroupsTable).values({ name, createdBy: req.user!.id }).returning();
    const allMemberIds = [...new Set([req.user!.id, ...memberIds])];
    await db.insert(dmGroupMembersTable).values(allMemberIds.map(uid => ({ groupId: group.id, userId: uid })));
    res.status(201).json(group);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dm/groups/:groupId/messages
router.get("/dm/groups/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const msgs = await db.select().from(dmGroupMessagesTable)
      .where(eq(dmGroupMessagesTable.groupId, groupId))
      .orderBy(desc(dmGroupMessagesTable.createdAt)).limit(60);

    const enriched = await Promise.all(msgs.reverse().map(async m => {
      const [sender] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, username: usersTable.username })
        .from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      return { ...m, sender: sender ?? null, createdAt: m.createdAt.toISOString() };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/groups/:groupId/messages
router.post("/dm/groups/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }
    const [msg] = await db.insert(dmGroupMessagesTable).values({ groupId, senderId: req.user!.id, content }).returning();
    const [sender] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, username: usersTable.username })
      .from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    res.status(201).json({ ...msg, sender, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
