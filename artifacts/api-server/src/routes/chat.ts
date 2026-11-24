import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, chatRoomsTable, voiceRoomsTable, voiceRoomParticipantsTable, usersTable } from "@workspace/db";
import { eq, desc, lt, and, gt, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";
import { getBlockedUserIds } from "../lib/userControls";
import {
  checkActiveGeneralChatMute,
  listActiveModiPolls,
  moderateModiChatMessage,
  reportChatMessage,
  voteInModiPoll,
} from "../lib/modiModeration";
import { communitySchemaReady } from "./communities";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const router = Router();
const chatRoomsSchemaReady = (async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id serial PRIMARY KEY,
      name text NOT NULL,
      created_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      last_activity_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz
    )
  `);
  await db.execute(sql`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now()`);
  await db.execute(sql`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS archived_at timestamptz`);
  await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room_id integer REFERENCES chat_rooms(id) ON DELETE CASCADE`);
})();

const CHAT_ROOM_IDLE_MINUTES = 30;
const CHAT_ROOM_ARCHIVE_DAYS = 2;

async function archiveInactiveChatRooms() {
  await chatRoomsSchemaReady;
  await db.execute(sql`
    UPDATE chat_rooms
    SET archived_at = last_activity_at + (${CHAT_ROOM_IDLE_MINUTES} * interval '1 minute')
    WHERE archived_at IS NULL
      AND last_activity_at <= now() - (${CHAT_ROOM_IDLE_MINUTES} * interval '1 minute')
  `);
  const expiredRooms = await db.execute(sql`
    SELECT id FROM chat_rooms
    WHERE archived_at <= now() - (${CHAT_ROOM_ARCHIVE_DAYS} * interval '1 day')
    ORDER BY id
    LIMIT 100
  `);
  for (const room of expiredRooms.rows) {
    const roomId = Number(room.id);
    const media = await db.execute(sql`
      SELECT type, content, voice_url AS "voiceUrl"
      FROM chat_messages
      WHERE room_id = ${roomId} AND type IN ('image', 'voice')
    `);
    for (const item of media.rows) {
      const url = String(item.type === "voice" ? item.voiceUrl ?? "" : item.content ?? "");
      const filename = path.basename(url);
      if (!url.startsWith("/api/uploads/") || !/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(filename)) continue;
      await fs.promises.rm(path.join(uploadDir, filename), { force: true });
    }
    await db.execute(sql`
      DELETE FROM chat_rooms
      WHERE id = ${roomId}
        AND archived_at <= now() - (${CHAT_ROOM_ARCHIVE_DAYS} * interval '1 day')
    `);
  }
}

async function touchActiveChatRoom(roomId: number) {
  const result = await db.execute(sql`
    UPDATE chat_rooms
    SET last_activity_at = now()
    WHERE id = ${roomId}
      AND archived_at IS NULL
      AND last_activity_at > now() - (${CHAT_ROOM_IDLE_MINUTES} * interval '1 minute')
    RETURNING id
  `);
  return result.rows.length > 0;
}

const chatRoomCleanupTimer = setInterval(() => {
  void archiveInactiveChatRooms().catch((error) => console.error("Sohbet odası arşiv temizliği başarısız:", error));
}, 60_000);
chatRoomCleanupTimer.unref();
const ensureMessageLikesTable = db.execute(sql`
  CREATE TABLE IF NOT EXISTS message_likes (
    message_type text NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji text NOT NULL DEFAULT '❤️',
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (message_type, message_id, user_id)
  )
`).then(() => db.execute(sql`
  ALTER TABLE message_likes ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '❤️'
`));

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

const bobiReady = (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_settings (id boolean PRIMARY KEY DEFAULT true, enabled boolean NOT NULL DEFAULT true, spam_window_seconds integer NOT NULL DEFAULT 30, abilities text NOT NULL DEFAULT 'Genel sohbet spamini, yasaklı kelimeleri ve moderasyon raporlarını denetle.', updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`ALTER TABLE bobi_settings ADD COLUMN IF NOT EXISTS abilities text NOT NULL DEFAULT 'Genel sohbet spamini, yasaklı kelimeleri ve moderasyon raporlarını denetle.'`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_words (id serial PRIMARY KEY, word text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_user_states (user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, warning_count integer NOT NULL DEFAULT 0, window_started_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_reports (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, source text NOT NULL, message text NOT NULL, matched_word text, confidence text NOT NULL DEFAULT 'high', status text NOT NULL DEFAULT 'open', decided_by integer REFERENCES users(id), decision text, created_at timestamp NOT NULL DEFAULT now(), decided_at timestamp)`);
  await db.execute(sql`INSERT INTO bobi_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING`);
  const bot = await db.execute(sql`SELECT id FROM users WHERE username = 'bobi' LIMIT 1`);
  if (!bot.rows.length) await db.execute(sql`INSERT INTO users (username, email, display_name, role, password_hash) VALUES ('bobi', 'bobi@loop.local', 'Bobi', 'bot', 'bobi-system-account') ON CONFLICT (username) DO NOTHING`);
})().catch((error) => { console.error("Bobi schema error:", error); });

async function bobiUserId() {
  const result = await db.execute(sql`SELECT id FROM users WHERE username = 'bobi' LIMIT 1`);
  return Number(result.rows[0]?.id ?? 0);
}

function normalizeModerationText(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[.,!?;:()[\]{}"'`*_\-]/g, " ").replace(/\s+/g, " ").trim();
}

function readBobiBehavior(instructions: string) {
  const text = normalizeModerationText(instructions);
  const warningMatch = text.match(/(\d+)\s*(kez|defa)?\s*uyar/);
  const muteMatch = text.match(/(\d+)\s*(dk|dakika|dakikalık)\s*(sustur|mute)/);
  return {
    spamEnabled: !/(spam).*(kapat|etme|denetleme)/.test(text),
    dmEnabled: !/(dm|özel mesaj).*(kapat|etme|denetleme)/.test(text),
    answersEnabled: !/(soru|yanıt|cevap).*(kapat|etme|devre dışı)/.test(text),
    notifyEnabled: !/(bildirim|admin).*(kapat|gönderme|bildirme)/.test(text),
    warningLimit: Math.min(10, Math.max(1, Number(warningMatch?.[1] ?? 3))),
    muteMinutes: Math.min(1440, Math.max(1, Number(muteMatch?.[1] ?? 5))),
  };
}

async function answerGeneralQuestion(content: string, roomId: number | null = null) {
  await bobiReady;
  const settings = await db.execute(sql`SELECT enabled, abilities FROM bobi_settings WHERE id = true`);
  if (settings.rows[0]?.enabled === false) return;
  const behavior = readBobiBehavior(String(settings.rows[0]?.abilities ?? ""));
  if (!behavior.answersEnabled) return;

  const trimmed = content.trim();
  const addressedToBobi = /(^|[\s,])bobi(?:ye|'ye)?(?=$|[\s,!?.,])/i.test(trimmed);
  const directQuestion = addressedToBobi
    || trimmed.includes("?")
    || /^(neden|nas\u0131l|ne|kim|ka\u00E7|hangi|nerede|ne zaman|yard\u0131m|soru)\b/i.test(trimmed);
  if (!directQuestion) return;

  const gameCommand = trimmed.toLocaleLowerCase("tr-TR").replace(/^[,\s]*(bobi|bobiye|bobi'ye)[,\s]*/i, "").trim();
  if (/^(selam|merhaba|günaydın|iyi akşamlar|iyi geceler)[!.\s]*$/i.test(gameCommand)) {
    await bobiMessage("Bobi: Merhaba! Sana nasıl yardımcı olabilirim?", roomId);
    return;
  }
  if (/^(zar at|zar)$/i.test(gameCommand)) {
    await bobiMessage(`Bobi: Zar attım: **${Math.floor(Math.random() * 6) + 1}** 🎲`, roomId);
    return;
  }
  if (/^(yazı tura|tura yazı|yazı|tura)$/i.test(gameCommand)) {
    await bobiMessage(`Bobi: Sonuç: **${Math.random() < 0.5 ? "Yazı" : "Tura"}** 🪙`, roomId);
    return;
  }
  if (/^(taş|tas|kağıt|kagit|makas)$/i.test(gameCommand)) {
    const choices = ["Taş", "Kağıt", "Makas"];
    const bobiChoice = choices[Math.floor(Math.random() * choices.length)];
    await bobiMessage(`Bobi: Ben **${bobiChoice}** seçtim. Senin seçimin: **${gameCommand}** 🎮`, roomId);
    return;
  }

  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
        stream: false,
        format: "json",
        options: { temperature: 0.1, top_p: 0.25, repeat_penalty: 1.15, num_predict: 120 },
        messages: [
          { role: "system", content: "Sen Bobi'sin. Loop genel sohbetinde kullanıcıların kısa sorularını Türkçe yanıtlayan yerel bir yardımcı botsun. Yalnızca mevcut soruya cevap ver; önceki soruları, kullanıcıları veya olmayan bilgileri uydurma. Loop uygulaması, sohbet, profil, ayarlar ve genel bilgi hakkında yardımcı olabilirsin. Güncel veritabanı, kullanıcı hesabı, hava durumu, haber, internet, dosya veya bilgisayar erişimin yoksa bunu açıkça söyle. Emin değilsen cevap verme. Yanıtın en fazla 2 kısa cümle ve 300 karakter olsun. Hakaret etme, kesin olmayan bilgiyi gerçek gibi yazma, moderasyon veya yönetici yetkin varmış gibi davranma. Sadece geçerli JSON döndür: {\"shouldAnswer\":true,\"answer\":\"kısa Türkçe cevap\"} veya {\"shouldAnswer\":false,\"answer\":\"\"}." },
          { role: "user", content: `Current question: ${trimmed.slice(0, 1000)}` },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`Bobi Ollama yanıtı başarısız: HTTP ${response.status}`);
      if (addressedToBobi) await bobiMessage("Bobi: Şu an yanıtımı hazırlarken bir sorun yaşadım. Biraz sonra tekrar dener misin?", roomId);
      return;
    }
    const data = await response.json() as { message?: { content?: string } };
    const rawContent = data.message?.content?.trim() ?? "";
    const jsonText = rawContent.match(/\{[\s\S]*\}/)?.[0] ?? rawContent;
    const parsed = JSON.parse(jsonText) as { shouldAnswer?: boolean; answer?: string };
    const answer = typeof parsed.answer === "string" && (parsed.shouldAnswer === true || addressedToBobi)
      ? parsed.answer.replace(/^bobi\s*:\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 300)
      : "";
    if (answer) {
      await bobiMessage(`Bobi: ${answer}`, roomId);
    } else if (addressedToBobi) {
      await bobiMessage("Bobi: Seni duydum; ancak şu an uygun bir yanıt hazırlayamadım. Biraz farklı sorabilir misin?", roomId);
    }
  } catch (error) {
    console.error("Bobi yanıtı oluşturulamadı:", error);
    if (addressedToBobi) await bobiMessage("Bobi: Şu an yanıtımı hazırlarken bir sorun yaşadım. Biraz sonra tekrar dener misin?", roomId);
  }
}

async function bobiMessage(content: string, roomId: number | null = null) {
  const botId = await bobiUserId();
  if (!botId) return;
  await db.insert(chatMessagesTable).values({ userId: botId, roomId, type: "bobi", content });
}

async function notifyPrivileged(title: string, data: unknown) {
  const recipients = await db.execute(sql`SELECT id FROM users WHERE role IN ('admin', 'moderator') OR lower(email) IN ('copoglumihammetyasin@gmail.com', 'copogluhakki@gmail.com', 'tabiiisanane@gmail.com') OR lower(username) IN ('mami', 'mami denemee')`);
  for (const recipient of recipients.rows) {
    await db.execute(sql`INSERT INTO notifications (user_id, type, data) VALUES (${Number(recipient.id)}, 'bobi_moderation', ${JSON.stringify({ title, ...((data ?? {}) as object) })}::jsonb)`).catch(() => undefined);
  }
}

async function moderateMessage(userId: number, content: string, source: "chat" | "dm", roomId: number | null = null) {
  await bobiReady;
    const settings = await db.execute(sql`SELECT enabled, spam_window_seconds AS "spamWindowSeconds", abilities FROM bobi_settings WHERE id = true`);
  if (settings.rows[0]?.enabled === false) return { blocked: false };
    const behavior = readBobiBehavior(String(settings.rows[0]?.abilities ?? ""));
    if (source === "dm" && !behavior.dmEnabled) return { blocked: false };
    const spamWindowMs = Number(settings.rows[0]?.spamWindowSeconds ?? 30) * 1000;
  const normalized = normalizeModerationText(content);
  const words = await db.execute(sql`SELECT word FROM bobi_words`);
  const matchedWord = words.rows.map((row) => String(row.word)).find((word) => normalized.includes(normalizeModerationText(word)));
  if (matchedWord) {
    const report = await db.execute(sql`INSERT INTO bobi_reports (user_id, source, message, matched_word, confidence) VALUES (${userId}, ${source}, ${content.slice(0, 1000)}, ${matchedWord}, 'high') RETURNING id`);
    const expiresAt = new Date(Date.now() + behavior.muteMinutes * 60 * 1000);
    const botId = await bobiUserId();
    await db.execute(sql`INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at) VALUES (${userId}, ${`Bobi: yasaklı kelime (${matchedWord})`}, ${source === "chat" ? "chat" : "dm"}, ${botId}, ${expiresAt})`);
    if (behavior.notifyEnabled) await notifyPrivileged("Bobi otomatik susturma", { reportId: report.rows[0]?.id, userId, source, message: content.slice(0, 1000), matchedWord, expiresAt: expiresAt.toISOString() });
    if (source === "chat") await bobiMessage(`Bobi: Bu mesaj yasaklı kelime içerdiği için kaldırıldı. Kullanıcı ${behavior.muteMinutes} dakika susturuldu.`, roomId);
    return { blocked: true, reason: `Yasaklı kelime tespit edildi. ${behavior.muteMinutes} dakika susturuldun.`, reportId: report.rows[0]?.id };
  }
  const state = await db.execute(sql`SELECT warning_count, window_started_at FROM bobi_user_states WHERE user_id = ${userId}`);
  const row = state.rows[0];
  const now = Date.now();
  const windowStarted = row ? Date.parse(String(row.window_started_at)) : now;
  const warningCount = row && now - windowStarted <= spamWindowMs ? Number(row.warning_count) : 0;
  const recent = await db.execute(sql`SELECT content FROM chat_messages WHERE user_id = ${userId} AND room_id IS NOT DISTINCT FROM ${source === "chat" ? roomId : null} AND type = 'text' ORDER BY created_at DESC LIMIT 3`);
  const isSpam = recent.rows.some((item) => normalizeModerationText(String(item.content ?? "")) === normalized) || (normalized.length > 0 && /(.)\1{7,}|https?:\/\/|www\./i.test(content));
  if (!isSpam) {
    await db.execute(sql`DELETE FROM bobi_user_states WHERE user_id = ${userId}`).catch(() => undefined);
    return { blocked: false };
  }
  if (!behavior.spamEnabled) return { blocked: false };
  const nextWarning = warningCount + 1;
  if (nextWarning > behavior.warningLimit) {
    const botId = await bobiUserId();
    const expiresAt = new Date(Date.now() + behavior.muteMinutes * 60 * 1000);
    await db.execute(sql`INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at) VALUES (${userId}, ${`Bobi: spam nedeniyle ${behavior.muteMinutes} dakika susturma`}, ${source}, ${botId}, ${expiresAt})`);
    await db.execute(sql`DELETE FROM bobi_user_states WHERE user_id = ${userId}`);
    await bobiMessage(`Bobi: Spam uyarıları tamamlandı. Kullanıcı ${behavior.muteMinutes} dakika susturuldu.`, roomId);
    if (behavior.notifyEnabled) await notifyPrivileged("Bobi spam susturması", { userId, source, message: content.slice(0, 1000), expiresAt: expiresAt.toISOString() });
    return { blocked: true, reason: `Spam nedeniyle ${behavior.muteMinutes} dakika susturuldun.` };
  }
  await db.execute(sql`INSERT INTO bobi_user_states (user_id, warning_count, window_started_at) VALUES (${userId}, ${nextWarning}, now()) ON CONFLICT (user_id) DO UPDATE SET warning_count = ${nextWarning}, window_started_at = CASE WHEN bobi_user_states.warning_count = 0 THEN now() ELSE bobi_user_states.window_started_at END`);
  await bobiMessage(`Bobi uyarısı ${nextWarning}/${behavior.warningLimit}: Lütfen spam yapma. ${behavior.warningLimit + 1 - nextWarning}. tekrarda ${behavior.muteMinutes} dakika susturulacaksın.`);
  return { blocked: true, reason: `Bobi uyarısı ${nextWarning}/3: Spam yapma.` };
}

async function ensureVoiceRoomCodeColumn() {
  await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS room_code text`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS voice_rooms_room_code_idx ON voice_rooms(room_code) WHERE room_code IS NOT NULL`);
}

function generateRoomCode() {
  const value = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `#${value.padEnd(6, "X")}`;
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomCode = generateRoomCode();
    const existing = await db
      .select({ id: voiceRoomsTable.id })
      .from(voiceRoomsTable)
      .where(eq(voiceRoomsTable.roomCode, roomCode))
      .limit(1);

    if (!existing.length) return roomCode;
  }

  throw new Error("Could not generate a unique room code");
}

async function backfillMissingVoiceRoomCodes() {
  await ensureVoiceRoomCodeColumn();
  const roomsWithoutCode = await db
    .select({ id: voiceRoomsTable.id })
    .from(voiceRoomsTable)
    .where(isNull(voiceRoomsTable.roomCode));

  for (const room of roomsWithoutCode) {
    const roomCode = await generateUniqueRoomCode();
    await db.update(voiceRoomsTable).set({ roomCode }).where(eq(voiceRoomsTable.id, room.id));
  }
}

async function canAccessCommunityVoiceRoom(roomId: number, userId?: number) {
  await communitySchemaReady;
  const result = await db.execute(sql`
    SELECT vr.is_persistent, c.id AS community_id, c.created_by, cm.status, cr.permissions
    FROM voice_rooms vr
    LEFT JOIN community_channels cc ON cc.voice_room_id = vr.id AND cc.type = 'voice'
    LEFT JOIN communities c ON c.id = cc.community_id
    LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = ${userId ?? -1}
    LEFT JOIN community_roles cr ON cr.id = cm.role_id
    WHERE vr.id = ${roomId}
    LIMIT 1
  `);
  const row = result.rows[0] as {
    is_persistent: boolean;
    community_id: number | null;
    created_by: number | null;
    status: string | null;
    permissions: Record<string, boolean> | null;
  } | undefined;
  if (!row) return false;
  if (!row.is_persistent) return true;
  if (!row.community_id || row.created_by === null) return false;
  return Boolean(
    userId &&
    (row.created_by === userId || (row.status === "active" && row.permissions?.connectVoice === true)),
  );
}

async function isVoiceRoomParticipant(roomId: number, userId: number) {
  const [participant] = await db.select({ id: voiceRoomParticipantsTable.id })
    .from(voiceRoomParticipantsTable)
    .where(and(eq(voiceRoomParticipantsTable.roomId, roomId), eq(voiceRoomParticipantsTable.userId, userId)))
    .limit(1);
  return Boolean(participant);
}

router.get("/chat/rooms", async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    const rooms = await db.execute(sql`
      SELECT id, name, created_by AS "createdBy", created_at AS "createdAt",
        last_activity_at AS "lastActivityAt"
      FROM chat_rooms
      WHERE archived_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(rooms.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sohbet odaları yüklenemedi." });
  }
});

router.post("/chat/rooms", requireAuth, async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 40) {
      res.status(400).json({ error: "Oda adı 2–40 karakter olmalı." });
      return;
    }
    const [room] = await db.insert(chatRoomsTable)
      .values({ name, createdBy: req.user!.id })
      .returning();
    res.status(201).json(room);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sohbet odası oluşturulamadı." });
  }
});

router.post("/chat/rooms/:roomId/activity", requireAuth, async (req, res) => {
  try {
    await archiveInactiveChatRooms();
    const roomId = Number(req.params.roomId);
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      res.status(400).json({ error: "Sohbet odası geçersiz." });
      return;
    }
    if (!await touchActiveChatRoom(roomId)) {
      res.status(410).json({ error: "Bu oda 30 dakika inaktif kaldığı için arşivlendi." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Sohbet odası etkinliği kaydedilemedi.");
    res.status(500).json({ error: "Oda etkinliği kaydedilemedi." });
  }
});

router.get("/chat/messages", async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    await ensureMessageLikesTable;
    const viewerId = req.user?.id;
    const before = req.query["before"] ? parseInt(req.query["before"] as string) : undefined;
    const requestedRoomId = req.query["roomId"];
    const roomId = requestedRoomId === undefined
      ? null
      : typeof requestedRoomId === "string" && /^\d+$/.test(requestedRoomId)
        ? Number(requestedRoomId)
        : NaN;
    if (roomId !== null) {
      if (!Number.isSafeInteger(roomId) || roomId <= 0) {
        res.status(400).json({ error: "Sohbet odası geçersiz." });
        return;
      }
      const [room] = await db.execute(sql`SELECT id FROM chat_rooms WHERE id = ${roomId} AND archived_at IS NULL LIMIT 1`);
      if (!room) {
        res.status(410).json({ error: "Bu sohbet odası kapatıldı veya arşivlendi." });
        return;
      }
    }

    let messages;
    const roomFilter = roomId === null ? isNull(chatMessagesTable.roomId) : eq(chatMessagesTable.roomId, roomId);
    if (before) {
      messages = await db
        .select()
        .from(chatMessagesTable)
        .where(and(roomFilter, lt(chatMessagesTable.id, before)))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(50);
    } else {
      messages = await db
        .select()
        .from(chatMessagesTable)
        .where(roomFilter)
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(50);
    }

    const blockedUserIds = viewerId ? await getBlockedUserIds(viewerId) : new Set<number>();
    const visibleMessages = messages.filter((message) => !blockedUserIds.has(message.userId));
    const enriched = await Promise.all(
      visibleMessages.reverse().map(async (m) => ({
        id: m.id,
        userId: m.userId,
        user: await getUserWithStats(m.userId, viewerId),
        type: m.type,
        content: m.content,
        gifUrl: m.gifUrl,
        voiceUrl: m.voiceUrl,
        voiceDuration: m.voiceDuration,
        createdAt: m.createdAt.toISOString(),
        likeCount: Number((await db.execute(sql`SELECT count(*)::int AS count FROM message_likes WHERE message_type = 'chat' AND message_id = ${m.id}`)).rows[0]?.count ?? 0),
        isLiked: Boolean(req.user?.id && (await db.execute(sql`SELECT 1 FROM message_likes WHERE message_type = 'chat' AND message_id = ${m.id} AND user_id = ${req.user.id}`)).rows.length),
        reactionEmoji: String((await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'chat' AND message_id = ${m.id} ORDER BY created_at DESC LIMIT 1`)).rows[0]?.emoji ?? "❤️"),
      }))
    );

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/modi/polls", requireAuth, async (req, res) => {
  try {
    await archiveInactiveChatRooms();
    const rawRoomId = req.query["roomId"];
    const roomId = rawRoomId === undefined
      ? null
      : typeof rawRoomId === "string" && /^\d+$/.test(rawRoomId)
        ? Number(rawRoomId)
        : NaN;
    if (roomId !== null && (!Number.isSafeInteger(roomId) || roomId <= 0)) {
      res.status(400).json({ error: "Sohbet odası geçersiz." });
      return;
    }
    if (roomId !== null) {
      const [room] = await db.execute(sql`SELECT id FROM chat_rooms WHERE id = ${roomId} AND archived_at IS NULL LIMIT 1`);
      if (!room) {
        res.status(410).json({ error: "Bu sohbet odası kapatıldı veya arşivlendi." });
        return;
      }
    }
    res.json(await listActiveModiPolls(req.user!.id, roomId));
  } catch (error) {
    req.log.error({ err: error }, "Modi oylamaları yüklenemedi.");
    res.status(500).json({ error: "Modi oylamaları yüklenemedi." });
  }
});

router.post("/chat/messages/:messageId/report", requireAuth, async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    const messageId = Number(req.params.messageId);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      res.status(400).json({ error: "Mesaj numarası geçersiz." });
      return;
    }
    const result = await reportChatMessage(req.user!.id, messageId);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Sohbet mesajı Modi'ye bildirilemedi.");
    res.status(500).json({ error: "Bildirim gönderilemedi." });
  }
});

router.post("/chat/modi/polls/:pollId/vote", requireAuth, async (req, res) => {
  try {
    const pollId = Number(req.params.pollId);
    if (!Number.isSafeInteger(pollId) || pollId <= 0 || typeof req.body?.voteYes !== "boolean") {
      res.status(400).json({ error: "Oylama seçimi geçersiz." });
      return;
    }
    const result = await voteInModiPoll(pollId, req.user!.id, req.body.voteYes);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Modi oylamasına oy verilemedi.");
    res.status(500).json({ error: "Oyun kaydedilemedi." });
  }
});

router.post("/chat/messages/:messageId/like", requireAuth, async (req, res) => {
  await ensureMessageLikesTable;
  const messageId = Number(req.params.messageId);
  const emoji = typeof req.body?.emoji === "string" && req.body.emoji.trim() ? req.body.emoji : "❤️";
  const existing = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'chat' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  if (existing.rows.length && existing.rows[0]?.emoji === emoji) {
    await db.execute(sql`DELETE FROM message_likes WHERE message_type = 'chat' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  } else if (existing.rows.length) {
    await db.execute(sql`UPDATE message_likes SET emoji = ${emoji}, created_at = now() WHERE message_type = 'chat' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  } else {
    await db.execute(sql`INSERT INTO message_likes (message_type, message_id, user_id, emoji) VALUES ('chat', ${messageId}, ${req.user!.id}, ${emoji}) ON CONFLICT DO NOTHING`);
  }
  const count = await db.execute(sql`SELECT count(*)::int AS count FROM message_likes WHERE message_type = 'chat' AND message_id = ${messageId}`);
  const reaction = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'chat' AND message_id = ${messageId} ORDER BY created_at DESC LIMIT 1`);
  res.json({ liked: !(existing.rows.length && existing.rows[0]?.emoji === emoji), likeCount: Number(count.rows[0]?.count ?? 0), reactionEmoji: reaction.rows[0]?.emoji ?? null });
});

router.post("/chat/messages", requireAuth, async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    const { type, content, gifUrl } = req.body;
    const roomId = req.body?.roomId === undefined || req.body?.roomId === null
      ? null
      : Number(req.body.roomId);
    if (!type) {
      res.status(400).json({ error: "Type required" });
      return;
    }
    if (type !== "text" && type !== "gif") {
      res.status(400).json({ error: "Mesaj türü geçersiz." });
      return;
    }
    if (roomId !== null) {
      if (!Number.isSafeInteger(roomId) || roomId <= 0) {
        res.status(400).json({ error: "Sohbet odası geçersiz." });
        return;
      }
      if (!await touchActiveChatRoom(roomId)) {
        await archiveInactiveChatRooms();
        res.status(410).json({ error: "Bu sohbet odası kapatıldı veya arşivlendi." });
        return;
      }
    }

    if (roomId === null) {
      const activeMute = await checkActiveGeneralChatMute(req.user!.id);
      if (activeMute) {
        res.status(403).json({
          error: "chat_banned",
          reason: activeMute.reason,
          expiresAt: activeMute.expiresAt ? new Date(activeMute.expiresAt).toISOString() : null,
        });
        return;
      }
    }
    if (type === "text" && content?.trim()) {
      const modiResult = await moderateModiChatMessage(req.user!.id, String(content), roomId);
      if (modiResult.blocked) {
        res.status(403).json({ error: "modi_warning", reason: modiResult.reason, expiresAt: modiResult.expiresAt ?? null });
        return;
      }
      if (roomId !== null) {
        const bobiResult = await moderateMessage(req.user!.id, String(content), "chat", roomId);
        if (bobiResult.blocked) {
          res.status(403).json({ error: "chat_banned", reason: bobiResult.reason });
          return;
        }
      }
    }

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ userId: req.user!.id, roomId, type, content, gifUrl })
      .returning();

    if (type === "text" && content?.trim()) {
      void answerGeneralQuestion(String(content), roomId)
        .catch((error) => req.log.error({ err: error }, "Bobi yanıtı oluşturulamadı."));
    }

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...msg, user, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/voice", requireAuth, upload.single("file"), async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const roomId = req.body?.roomId ? Number(req.body.roomId) : null;
    if (roomId !== null) {
      if (!Number.isSafeInteger(roomId) || roomId <= 0) {
        fs.rmSync(req.file.path, { force: true });
        res.status(400).json({ error: "Sohbet odası geçersiz." });
        return;
      }
      if (!await touchActiveChatRoom(roomId)) {
        fs.rmSync(req.file.path, { force: true });
        res.status(410).json({ error: "Bu sohbet odası kapatıldı veya arşivlendi." });
        return;
      }
    }
    if (roomId === null) {
      const activeMute = await checkActiveGeneralChatMute(req.user!.id);
      if (activeMute) {
        fs.rmSync(req.file.path, { force: true });
        res.status(403).json({ error: "chat_banned", reason: activeMute.reason, expiresAt: activeMute.expiresAt ? new Date(activeMute.expiresAt).toISOString() : null });
        return;
      }
    }
    const voiceUrl = `/api/uploads/${req.file.filename}`;

    const requestedDuration = Number(req.body?.duration);
    const durationSec = Number.isFinite(requestedDuration) && requestedDuration > 0
      ? Math.min(60 * 60, Math.round(requestedDuration))
      : 1;

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ userId: req.user!.id, roomId, type: "voice", voiceUrl, voiceDuration: durationSec })
      .returning();

    const user = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...msg, user, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /chat/media — image/video upload to chat
router.post("/chat/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    await chatRoomsSchemaReady;
    await archiveInactiveChatRooms();
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const roomId = req.body?.roomId ? Number(req.body.roomId) : null;
    if (roomId !== null) {
      if (!Number.isSafeInteger(roomId) || roomId <= 0) {
        fs.rmSync(req.file.path, { force: true });
        res.status(400).json({ error: "Sohbet odası geçersiz." });
        return;
      }
      if (!await touchActiveChatRoom(roomId)) {
        fs.rmSync(req.file.path, { force: true });
        res.status(410).json({ error: "Bu sohbet odası kapatıldı veya arşivlendi." });
        return;
      }
    }
    if (roomId === null) {
      const activeMute = await checkActiveGeneralChatMute(req.user!.id);
      if (activeMute) {
        fs.rmSync(req.file.path, { force: true });
        res.status(403).json({ error: "chat_banned", reason: activeMute.reason, expiresAt: activeMute.expiresAt ? new Date(activeMute.expiresAt).toISOString() : null });
        return;
      }
    }
    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ userId: req.user!.id, roomId, type: "image", content: mediaUrl })
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
    await backfillMissingVoiceRoomCodes();
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
      const uniqueParticipants = Array.from(new Map(participants.map((participant) => [participant.userId, participant])).values());

      if (!uniqueParticipants.length && !room.isPersistent) {
        signalStore.delete(room.id);
        await db.delete(voiceRoomsTable).where(eq(voiceRoomsTable.id, room.id));
        return null;
      }
      if (room.isPersistent) return null;

      const participantUsers = await Promise.all(
        uniqueParticipants.map((p) => getUserWithStats(p.userId, viewerId))
      );

      const host = await getUserWithStats(room.createdBy, viewerId);
      const isJoined = viewerId ? uniqueParticipants.some((p) => p.userId === viewerId) : false;

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        roomCode: room.roomCode,
        createdBy: room.createdBy,
        host,
        participantCount: uniqueParticipants.length,
        participants: participantUsers.filter(Boolean),
        isActive: room.isActive === "true",
        isJoined,
        createdAt: room.createdAt.toISOString(),
      };
    }));

    res.json(enriched.filter((room): room is NonNullable<typeof room> => room !== null));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/voice-rooms", requireAuth, async (req, res) => {
  try {
    await ensureVoiceRoomCodeColumn();
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name required" });
      return;
    }

    const roomCode = await generateUniqueRoomCode();

    const [room] = await db
      .insert(voiceRoomsTable)
      .values({ name, description, roomCode, createdBy: req.user!.id, isActive: "true" })
      .returning();

    await db.insert(voiceRoomParticipantsTable).values({ roomId: room.id, userId: req.user!.id });

    const host = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({
      id: room.id,
      name: room.name,
      description: room.description,
      roomCode: room.roomCode,
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

router.get("/voice-rooms/by-code/:code", async (req, res) => {
  try {
    await backfillMissingVoiceRoomCodes();
    const roomCode = String(req.params["code"] ?? "").trim().toUpperCase();
    if (!roomCode) {
      res.status(400).json({ error: "Room code required" });
      return;
    }

    const viewerId = req.user?.id;

    const rooms = await db
      .select()
      .from(voiceRoomsTable)
      .where(and(eq(voiceRoomsTable.roomCode, roomCode), eq(voiceRoomsTable.isActive, "true")))
      .limit(1);

    if (!rooms[0]) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const room = rooms[0];
    if (!await canAccessCommunityVoiceRoom(room.id, viewerId)) {
      res.status(403).json({ error: "Bu sesli odaya erişim yetkin yok." });
      return;
    }
    const participants = await db
      .select()
      .from(voiceRoomParticipantsTable)
      .where(eq(voiceRoomParticipantsTable.roomId, room.id));
    const uniqueParticipants = Array.from(new Map(participants.map((participant) => [participant.userId, participant])).values());
    const participantUsers = await Promise.all(uniqueParticipants.map((p) => getUserWithStats(p.userId, viewerId)));
    const host = await getUserWithStats(room.createdBy, viewerId);

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      roomCode: room.roomCode,
      createdBy: room.createdBy,
      host,
      participantCount: uniqueParticipants.length,
      participants: participantUsers.filter(Boolean),
      isActive: room.isActive === "true",
      isJoined: viewerId ? uniqueParticipants.some((p) => p.userId === viewerId) : false,
      createdAt: room.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/voice-rooms/:roomId", async (req, res) => {
  try {
    const roomId = Number.parseInt(String(req.params["roomId"] ?? ""), 10);
    const viewerId = req.user?.id;

    const rooms = await db.select().from(voiceRoomsTable).where(eq(voiceRoomsTable.id, roomId)).limit(1);
    if (!rooms[0]) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const room = rooms[0];
    if (!await canAccessCommunityVoiceRoom(room.id, viewerId)) {
      res.status(403).json({ error: "Bu sesli odaya erişim yetkin yok." });
      return;
    }
    const participants = await db
      .select()
      .from(voiceRoomParticipantsTable)
      .where(eq(voiceRoomParticipantsTable.roomId, roomId));
    const uniqueParticipants = Array.from(new Map(participants.map((participant) => [participant.userId, participant])).values());

    const participantUsers = await Promise.all(uniqueParticipants.map((p) => getUserWithStats(p.userId, viewerId)));
    const host = await getUserWithStats(room.createdBy, viewerId);
    const isJoined = viewerId ? uniqueParticipants.some((p) => p.userId === viewerId) : false;

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      roomCode: room.roomCode,
      createdBy: room.createdBy,
      host,
      participantCount: uniqueParticipants.length,
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
    const roomId = Number.parseInt(String(req.params["roomId"] ?? ""), 10);
    const roomRows = await db.select().from(voiceRoomsTable).where(eq(voiceRoomsTable.id, roomId)).limit(1);
    if (!roomRows[0] || roomRows[0].isActive !== "true") {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (!await canAccessCommunityVoiceRoom(roomId, req.user!.id)) {
      res.status(403).json({ error: "Bu sesli odaya katılma yetkin yok." });
      return;
    }

    const existing = await db
      .select({ id: voiceRoomParticipantsTable.id })
      .from(voiceRoomParticipantsTable)
      .where(
        and(
          eq(voiceRoomParticipantsTable.roomId, roomId),
          eq(voiceRoomParticipantsTable.userId, req.user!.id),
        ),
      )
      .limit(1);
    if (!existing.length) {
      await db.insert(voiceRoomParticipantsTable).values({ roomId, userId: req.user!.id });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/voice-rooms/:roomId/leave", requireAuth, async (req, res) => {
  try {
    const roomId = Number.parseInt(String(req.params["roomId"] ?? ""), 10);
    await db
      .delete(voiceRoomParticipantsTable)
      .where(
        and(
          eq(voiceRoomParticipantsTable.roomId, roomId),
          eq(voiceRoomParticipantsTable.userId, req.user!.id)
        )
      );

    const remaining = await db
      .select({ id: voiceRoomParticipantsTable.id })
      .from(voiceRoomParticipantsTable)
      .where(eq(voiceRoomParticipantsTable.roomId, roomId));

    const [room] = await db.select({ isPersistent: voiceRoomsTable.isPersistent })
      .from(voiceRoomsTable)
      .where(eq(voiceRoomsTable.id, roomId))
      .limit(1);
    if (!remaining.length && !room?.isPersistent) {
      signalStore.delete(roomId);
      await db.delete(voiceRoomsTable).where(eq(voiceRoomsTable.id, roomId));
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── WebRTC Signaling (in-memory) ─────────────────────────────────────────────
// roomId → targetUserId → Signal[]
const signalStore = new Map<number, Map<number, { fromUserId: number; type: string; data: unknown }[]>>();

function storeSignal(roomId: number, targetUserId: number, signal: { fromUserId: number; type: string; data: unknown }) {
  if (!signalStore.has(roomId)) signalStore.set(roomId, new Map());
  const room = signalStore.get(roomId)!;
  if (!room.has(targetUserId)) room.set(targetUserId, []);
  room.get(targetUserId)!.push(signal);
}

function drainSignals(roomId: number, targetUserId: number) {
  const room = signalStore.get(roomId);
  if (!room) return [];
  const signals = room.get(targetUserId) ?? [];
  room.delete(targetUserId);
  return signals;
}

// POST /voice-rooms/:roomId/signal — send a WebRTC signal to a specific peer
router.post("/voice-rooms/:roomId/signal", requireAuth, (req, res) => {
  void (async () => {
    const roomId = Number.parseInt(String(req.params["roomId"] ?? ""), 10);
    const { targetUserId, type, data } = req.body as { targetUserId: number; type: string; data: unknown };
    if (!Number.isSafeInteger(roomId) || roomId < 1 || !targetUserId || !type) { res.status(400).json({ error: "Geçersiz ses sinyali." }); return; }
    if (!await canAccessCommunityVoiceRoom(roomId, req.user!.id) ||
        !await isVoiceRoomParticipant(roomId, req.user!.id) ||
        !await isVoiceRoomParticipant(roomId, targetUserId)) {
      res.status(403).json({ error: "Ses odası katılımcıları arasında değilsin." });
      return;
    }
    storeSignal(roomId, targetUserId, { fromUserId: req.user!.id, type, data });
    res.json({ ok: true });
  })().catch((err) => {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
});

// GET /voice-rooms/:roomId/signals — poll and drain signals addressed to me
router.get("/voice-rooms/:roomId/signals", requireAuth, (req, res) => {
  void (async () => {
    const roomId = Number.parseInt(String(req.params["roomId"] ?? ""), 10);
    if (!Number.isSafeInteger(roomId) || roomId < 1) {
      res.status(400).json({ error: "Geçersiz ses odası." });
      return;
    }
    if (!await canAccessCommunityVoiceRoom(roomId, req.user!.id) ||
        !await isVoiceRoomParticipant(roomId, req.user!.id)) {
      res.status(403).json({ error: "Ses odası katılımcısı değilsin." });
      return;
    }
    const signals = drainSignals(roomId, req.user!.id);
    res.json(signals);
  })().catch((err) => {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
});

// GET /chat/active-users — users active in last 5 minutes
router.get("/chat/active-users", async (req, res) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await db
      .select({
        id: usersTable.id,
        lastSeenAt: usersTable.lastSeenAt,
      })
      .from(usersTable)
      .where(gt(usersTable.lastSeenAt, fiveMinAgo))
      .orderBy(desc(usersTable.lastSeenAt))
      .limit(50);
    const enrichedUsers = await Promise.all(users.map(async (activeUser) => {
      const user = await getUserWithStats(activeUser.id, req.user?.id);
      return user ? { ...user, lastSeenAt: activeUser.lastSeenAt?.toISOString() ?? null } : null;
    }));
    res.json(enrichedUsers.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// In-memory typing state: userId → { displayName, username, expiresAt }
const typingState = new Map<number, { username: string; displayName: string; expiresAt: number }>();

// POST /chat/typing — kullanıcı yazıyor sinyali gönder
router.post("/chat/typing", requireAuth, (req, res) => {
  const u = req.user!;
  typingState.set(u.id, {
    username: (u as any).username ?? "kullanıcı",
    displayName: (u as any).displayName ?? (u as any).username ?? "kullanıcı",
    expiresAt: Date.now() + 4000,
  });
  res.json({ ok: true });
});

// GET /chat/typing — başka kim yazıyor?
router.get("/chat/typing", (req, res) => {
  const now = Date.now();
  const viewerId = req.user?.id;
  const result: { username: string; displayName: string }[] = [];
  for (const [uid, state] of typingState) {
    if (state.expiresAt < now) { typingState.delete(uid); continue; }
    if (uid === viewerId) continue;
    result.push({ username: state.username, displayName: state.displayName });
  }
  res.json(result);
});

export default router;
