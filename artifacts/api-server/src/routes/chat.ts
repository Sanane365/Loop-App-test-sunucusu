import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, voiceRoomsTable, voiceRoomParticipantsTable, usersTable } from "@workspace/db";
import { eq, desc, lt, and, gt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";
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
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/chat/messages", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const before = req.query["before"] ? parseInt(req.query["before"] as string) : undefined;

    let messages;
    if (before) {
      messages = await db
        .select()
        .from(chatMessagesTable)
        .where(lt(chatMessagesTable.id, before))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(50);
    } else {
      messages = await db
        .select()
        .from(chatMessagesTable)
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(50);
    }

    const enriched = await Promise.all(
      messages.reverse().map(async (m) => ({
        id: m.id,
        userId: m.userId,
        user: await getUserWithStats(m.userId, viewerId),
        type: m.type,
        content: m.content,
        gifUrl: m.gifUrl,
        voiceUrl: m.voiceUrl,
        voiceDuration: m.voiceDuration,
        createdAt: m.createdAt.toISOString(),
      }))
    );

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/messages", requireAuth, async (req, res) => {
  try {
    const { type, content, gifUrl } = req.body;
    if (!type) {
      res.status(400).json({ error: "Type required" });
      return;
    }

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ userId: req.user!.id, type, content, gifUrl })
      .returning();

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...msg, user, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/voice", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const voiceUrl = `/api/uploads/${req.file.filename}`;
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ userId: req.user!.id, type: "voice", voiceUrl })
      .returning();

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...msg, user, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/voice-rooms", async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const rooms = await db
      .select()
      .from(voiceRoomsTable)
      .where(eq(voiceRoomsTable.isActive, "true"))
      .orderBy(desc(voiceRoomsTable.createdAt));

    const enriched = await Promise.all(rooms.map(async (room) => {
      const participants = await db
        .select()
        .from(voiceRoomParticipantsTable)
        .where(eq(voiceRoomParticipantsTable.roomId, room.id));

      const participantUsers = await Promise.all(
        participants.map((p) => getUserWithStats(p.userId, viewerId))
      );

      const host = await getUserWithStats(room.createdBy, viewerId);
      const isJoined = viewerId ? participants.some((p) => p.userId === viewerId) : false;

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        createdBy: room.createdBy,
        host,
        participantCount: participants.length,
        participants: participantUsers.filter(Boolean),
        isActive: room.isActive === "true",
        isJoined,
        createdAt: room.createdAt.toISOString(),
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/voice-rooms", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name required" });
      return;
    }

    const [room] = await db
      .insert(voiceRoomsTable)
      .values({ name, description, createdBy: req.user!.id })
      .returning();

    await db.insert(voiceRoomParticipantsTable).values({ roomId: room.id, userId: req.user!.id });

    const host = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({
      id: room.id,
      name: room.name,
      description: room.description,
      createdBy: room.createdBy,
      host,
      participantCount: 1,
      participants: [host],
      isActive: true,
      isJoined: true,
      createdAt: room.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/voice-rooms/:roomId", async (req, res) => {
  try {
    const roomId = parseInt(req.params["roomId"]!);
    const viewerId = req.user?.id;

    const rooms = await db.select().from(voiceRoomsTable).where(eq(voiceRoomsTable.id, roomId)).limit(1);
    if (!rooms[0]) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const room = rooms[0];
    const participants = await db
      .select()
      .from(voiceRoomParticipantsTable)
      .where(eq(voiceRoomParticipantsTable.roomId, roomId));

    const participantUsers = await Promise.all(participants.map((p) => getUserWithStats(p.userId, viewerId)));
    const host = await getUserWithStats(room.createdBy, viewerId);
    const isJoined = viewerId ? participants.some((p) => p.userId === viewerId) : false;

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      createdBy: room.createdBy,
      host,
      participantCount: participants.length,
      participants: participantUsers.filter(Boolean),
      isActive: room.isActive === "true",
      isJoined,
      createdAt: room.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/voice-rooms/:roomId/join", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params["roomId"]!);
    await db
      .insert(voiceRoomParticipantsTable)
      .values({ roomId, userId: req.user!.id })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/voice-rooms/:roomId/leave", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params["roomId"]!);
    await db
      .delete(voiceRoomParticipantsTable)
      .where(
        and(
          eq(voiceRoomParticipantsTable.roomId, roomId),
          eq(voiceRoomParticipantsTable.userId, req.user!.id)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /chat/active-users — users active in last 5 minutes
router.get("/chat/active-users", async (req, res) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        lastSeenAt: usersTable.lastSeenAt,
      })
      .from(usersTable)
      .where(gt(usersTable.lastSeenAt, fiveMinAgo))
      .orderBy(desc(usersTable.lastSeenAt))
      .limit(50);
    res.json(users);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
