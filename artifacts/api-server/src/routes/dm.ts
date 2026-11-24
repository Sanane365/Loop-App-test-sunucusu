import { Router } from "express";
import { db } from "@workspace/db";
import { directMessagesTable, usersTable, dmGroupsTable, dmGroupMembersTable, dmGroupMessagesTable } from "@workspace/db";
import { eq, or, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { getUserWithStats } from "../lib/helpers";
import { getBlockStatus, getInteractionRestrictionStatus, getUserPrivacySettings } from "../lib/userControls";

const router = Router();
const dmRequestsReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS dm_message_requests (
    id serial PRIMARY KEY,
    sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (status IN ('pending', 'accepted', 'rejected')),
    CHECK (sender_id <> receiver_id)
  )
`).then(() => db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS dm_message_requests_pending_pair_idx
  ON dm_message_requests (sender_id, receiver_id) WHERE status = 'pending'
`));
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

const ensureDmContactNamesTable = Promise.resolve();
const ensureDmStickersTable = Promise.all([
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS dm_stickers (
      id serial PRIMARY KEY,
      creator_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      media_url text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `),
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS dm_sticker_favorites (
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sticker_id integer NOT NULL REFERENCES dm_stickers(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, sticker_id)
    )
  `),
]);

async function messageLikeData(type: "dm" | "group", messageId: number, userId: number) {
  await ensureMessageLikesTable;
  const [count, liked, reaction] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS count FROM message_likes WHERE message_type = ${type} AND message_id = ${messageId}`),
    db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = ${type} AND message_id = ${messageId} AND user_id = ${userId}`),
    db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = ${type} AND message_id = ${messageId} ORDER BY created_at DESC LIMIT 1`),
  ]);
  return {
    likeCount: Number(count.rows[0]?.count ?? 0),
    isLiked: liked.rows.length > 0,
    likedEmoji: liked.rows[0]?.emoji ?? null,
    reactionEmoji: reaction.rows[0]?.emoji ?? "❤️",
  };
}

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
const stickerUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Sticker yalnızca PNG, JPG, WebP veya GIF olabilir"));
  },
});
const instantShareUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }
    callback(new Error("Anlık paylaşım yalnızca görsel olabilir"));
  },
});

let dmInstantSharesSchemaReady: Promise<void> | null = null;
function ensureDmInstantSharesSchema() {
  if (!dmInstantSharesSchemaReady) {
    dmInstantSharesSchemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS dm_instant_shares (
          id serial PRIMARY KEY,
          sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_url text NOT NULL,
          media_type text NOT NULL DEFAULT 'image',
          archived boolean NOT NULL DEFAULT false,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`ALTER TABLE dm_instant_shares ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS dm_instant_share_views (
          share_id integer NOT NULL REFERENCES dm_instant_shares(id) ON DELETE CASCADE,
          viewer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY (share_id, viewer_id)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS dm_instant_share_reactions (
          share_id integer NOT NULL REFERENCES dm_instant_shares(id) ON DELETE CASCADE,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          emoji text NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY (share_id, user_id)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS dm_instant_share_replies (
          id serial PRIMARY KEY,
          share_id integer NOT NULL REFERENCES dm_instant_shares(id) ON DELETE CASCADE,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content text NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
    })().catch((error) => {
      dmInstantSharesSchemaReady = null;
      throw error;
    });
  }
  return dmInstantSharesSchemaReady;
}

const parseInstantShareUpload: import("express").RequestHandler = (req, res, next) => {
  instantShareUpload.single("file")(req, res, (error) => {
    if (error) {
      req.log.warn({ error }, "DM instant share upload rejected");
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? "Görsel en fazla 20 MB olabilir" : error.message,
      });
      return;
    }
    next();
  });
};

async function moderateDmMessage(userId: number, content: string) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_settings (id boolean PRIMARY KEY DEFAULT true, enabled boolean NOT NULL DEFAULT true, spam_window_seconds integer NOT NULL DEFAULT 30, abilities text NOT NULL DEFAULT '')`);
  const settings = await db.execute(sql`SELECT enabled, abilities FROM bobi_settings WHERE id = true`);
  if (settings.rows[0]?.enabled === false) return null;
  const behaviorText = String(settings.rows[0]?.abilities ?? "").toLocaleLowerCase("tr-TR");
  if (/(dm|özel mesaj).*(kapat|etme|denetleme)/.test(behaviorText)) return null;
  const muteMatch = behaviorText.match(/(\d+)\s*(dk|dakika|dakikalık)\s*(sustur|mute)/);
  const muteMinutes = Math.min(1440, Math.max(1, Number(muteMatch?.[1] ?? 5)));
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_words (id serial PRIMARY KEY, word text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_reports (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, source text NOT NULL, message text NOT NULL, matched_word text, confidence text NOT NULL DEFAULT 'high', status text NOT NULL DEFAULT 'open', decided_by integer REFERENCES users(id), decision text, created_at timestamp NOT NULL DEFAULT now(), decided_at timestamp)`);
  const words = await db.execute(sql`SELECT word FROM bobi_words`);
  const normalize = (value: string) => value.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ");
  const matched = words.rows.map((row) => String(row.word)).find((word) => normalize(content).includes(normalize(word)));
  if (!matched) return null;
  const report = await db.execute(sql`INSERT INTO bobi_reports (user_id, source, message, matched_word, confidence) VALUES (${userId}, 'dm', ${content.slice(0, 1000)}, ${matched}, 'high') RETURNING id`);
  const bot = await db.execute(sql`SELECT id FROM users WHERE username = 'bobi' LIMIT 1`);
  if (bot.rows[0]?.id) {
    await db.execute(sql`INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at) VALUES (${userId}, ${`Bobi: DM yasaklı kelime (${matched})`}, 'dm', ${Number(bot.rows[0].id)}, ${new Date(Date.now() + muteMinutes * 60 * 1000)})`);
    await db.insert(directMessagesTable).values({ senderId: Number(bot.rows[0].id), receiverId: userId, content: `Bobi: Bu DM yasaklı kelime içerdiği için gönderilmedi. ${muteMinutes} dakika DM susturması uygulandı.` }).catch(() => undefined);
  }
  const privileged = await db.execute(sql`SELECT id FROM users WHERE role IN ('admin', 'moderator') OR lower(email) IN ('copoglumihammetyasin@gmail.com', 'copogluhakki@gmail.com', 'tabiiisanane@gmail.com') OR lower(username) IN ('mami', 'mami denemee')`);
  for (const recipient of privileged.rows) await db.execute(sql`INSERT INTO notifications (user_id, type, data) VALUES (${Number(recipient.id)}, 'bobi_moderation', ${JSON.stringify({ reportId: report.rows[0]?.id, userId, source: "dm", message: content.slice(0, 1000), matchedWord: matched })}::jsonb)`).catch(() => undefined);
  return { reason: `Bobi: yasaklı kelime nedeniyle DM erişimin ${muteMinutes} dakika kısıtlandı.` };
}

async function enrichMessage(msg: typeof directMessagesTable.$inferSelect, viewerId: number) {
  const sender = await getUserWithStats(msg.senderId, viewerId);
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
    ...(await messageLikeData("dm", msg.id, viewerId)),
  };
}

async function getDmAccessError(senderId: number, receiverId: number) {
  const [interaction, blockStatus, privacy] = await Promise.all([
    getInteractionRestrictionStatus(senderId, receiverId),
    getBlockStatus(senderId, receiverId),
    getUserPrivacySettings(receiverId),
  ]);
  if (blockStatus.blockedByMe || blockStatus.blockedByThem) {
    return { status: 403, error: "Bu kullanıcıyla mesajlaşamazsın." };
  }
  if (interaction.restrictedByReceiver) {
    return { status: 403, error: "Bu kullanıcı DM erişimini kısıtladı." };
  }
  if (privacy.allowMessages === "nobody") {
    return { status: 403, error: "Mesaj isteği gönderilemiyor." };
  }
  if (privacy.allowMessages === "followers") {
    const followsReceiver = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = ${senderId} AND following_id = ${receiverId}
      ) AS following
    `);
    if (!Boolean(followsReceiver.rows[0]?.following)) {
      return { status: 403, error: "Bu kişi yalnızca takipçilerinden mesaj alıyor." };
    }
  }
  if (privacy.allowMessages === "mutuals") {
    const followsSender = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = ${receiverId} AND following_id = ${senderId}
      ) AS following
    `);
    if (!Boolean(followsSender.rows[0]?.following)) {
      return { status: 403, error: "Bu kişiye mesaj yazabilmeniz için sizi takip etmesi gerekiyor." };
    }
  }
  if (privacy.allowMessages === "requests") {
    await dmRequestsReady;
    const approvedRequest = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM dm_message_requests
        WHERE sender_id = ${senderId} AND receiver_id = ${receiverId} AND status = 'accepted'
      ) OR EXISTS (
        SELECT 1 FROM direct_messages
        WHERE (sender_id = ${senderId} AND receiver_id = ${receiverId})
           OR (sender_id = ${receiverId} AND receiver_id = ${senderId})
      ) AS allowed
    `);
    if (!Boolean(approvedRequest.rows[0]?.allowed)) {
      return { status: 403, error: "message_request_required" };
    }
  }
  return null;
}

async function createDmRequest(senderId: number, receiverId: number, content: string) {
  await dmRequestsReady;
  const requestResult = await db.execute(sql`
    INSERT INTO dm_message_requests (sender_id, receiver_id, content)
    VALUES (${senderId}, ${receiverId}, ${content})
    ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
    RETURNING id
  `);
  if (!requestResult.rows.length) return false;
  const requestId = Number(requestResult.rows[0]!.id);
  await db.execute(sql`
    INSERT INTO notifications (user_id, from_user_id, type, data)
    VALUES (${receiverId}, ${senderId}, 'message_request',
      jsonb_build_object('status', 'pending', 'requestId', ${requestId}, 'preview', ${content.slice(0, 180)}))
  `);
  return true;
}

async function isDmGroupMember(groupId: number, userId: number) {
  const [membership] = await db.select({ userId: dmGroupMembersTable.userId })
    .from(dmGroupMembersTable)
    .where(and(eq(dmGroupMembersTable.groupId, groupId), eq(dmGroupMembersTable.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

function getStreakDate(date: Date | string) {
  const parsed = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftStreakDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

router.get("/dm/:userId/streak", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = Number(req.params["userId"]);
    if (!Number.isInteger(otherUserId) || otherUserId <= 0 || otherUserId === currentUserId) {
      res.status(400).json({ error: "Geçersiz kullanıcı" });
      return;
    }
    const accessError = await getDmAccessError(currentUserId, otherUserId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }

    const friendshipResult = await db.execute(sql`
      SELECT id, content, created_at AS "createdAt"
      FROM direct_messages
      WHERE ((sender_id = ${currentUserId} AND receiver_id = ${otherUserId})
          OR (sender_id = ${otherUserId} AND receiver_id = ${currentUserId}))
        AND (content = '__LOOP_FRIENDSHIP__'
          OR content LIKE '__LOOP_FRIENDSHIP_RESPONSE__:%:accepted')
      ORDER BY created_at ASC
    `);
    const friendshipRows = friendshipResult.rows as Array<{
      id: number;
      content: string;
      createdAt: Date | string;
    }>;
    const friendshipRequests = new Set(
      friendshipRows.filter(row => row.content === "__LOOP_FRIENDSHIP__").map(row => Number(row.id)),
    );
    let acceptedAt: Date | string | null = null;
    for (const row of friendshipRows) {
      const acceptedRequestId = row.content.match(/^__LOOP_FRIENDSHIP_RESPONSE__:(\d+):accepted$/)?.[1];
      if (acceptedRequestId && friendshipRequests.has(Number(acceptedRequestId))) {
        acceptedAt ??= row.createdAt;
      }
    }
    if (!acceptedAt) {
      res.json({
        isCompanion: false,
        days: 0,
        currentDayComplete: false,
        startDate: null,
        lastActiveDate: null,
        messageCount: 0,
        voiceSeconds: 0,
      });
      return;
    }

    const result = await db.execute(sql`
      SELECT sender_id AS "senderId", content, media_url AS "mediaUrl",
             voice_url AS "voiceUrl", voice_duration AS "voiceDuration",
             created_at AS "createdAt"
      FROM direct_messages
      WHERE ((sender_id = ${currentUserId} AND receiver_id = ${otherUserId})
          OR (sender_id = ${otherUserId} AND receiver_id = ${currentUserId}))
        AND created_at >= now() - interval '400 days'
      ORDER BY created_at ASC
    `);
    const daily = new Map<string, {
      senders: Set<number>;
      messageCount: number;
      voiceSeconds: number;
    }>();

    for (const row of result.rows as Array<{
      senderId: number;
      content: string | null;
      mediaUrl: string | null;
      voiceUrl: string | null;
      voiceDuration: number | null;
      createdAt: Date | string;
    }>) {
      if (new Date(row.createdAt).getTime() < new Date(acceptedAt).getTime()) continue;
      const isInternalEvent = row.content?.startsWith("__LOOP_")
        && !row.content.startsWith("__LOOP_REPLY__")
        && !row.content.startsWith("__LOOP_GIF__");
      if (isInternalEvent) continue;
      if (!row.content?.trim() && !row.mediaUrl && !row.voiceUrl) continue;
      const day = getStreakDate(row.createdAt);
      let activity = daily.get(day);
      if (!activity) {
        activity = { senders: new Set<number>(), messageCount: 0, voiceSeconds: 0 };
        daily.set(day, activity);
      }
      activity.senders.add(Number(row.senderId));
      activity.messageCount += 1;
      activity.voiceSeconds += Math.max(0, Number(row.voiceDuration ?? 0));
    }

    const today = getStreakDate(new Date());
    const yesterday = shiftStreakDate(today, -1);
    const isMutualActivity = (day: string) => {
      const senders = daily.get(day)?.senders;
      return !!senders?.has(currentUserId) && !!senders.has(otherUserId);
    };
    const currentDayComplete = isMutualActivity(today);
    let day = currentDayComplete ? today : isMutualActivity(yesterday) ? yesterday : null;
    const activeDates = [...daily.keys()].filter(isMutualActivity).sort();
    const lastActiveDate = activeDates.length ? activeDates[activeDates.length - 1]! : null;
    let startDate: string | null = null;
    let days = 0;
    let messageCount = 0;
    let voiceSeconds = 0;

    while (day && isMutualActivity(day)) {
      startDate = day;
      days += 1;
      const activity = daily.get(day)!;
      messageCount += activity.messageCount;
      voiceSeconds += activity.voiceSeconds;
      day = shiftStreakDate(day, -1);
    }

    res.json({
      isCompanion: true,
      days,
      currentDayComplete,
      startDate,
      lastActiveDate,
      messageCount,
      voiceSeconds,
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Günlük seri bilgisi alınamadı" });
  }
});

router.post("/dm/messages/:messageId/like", requireAuth, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const [message] = await db.select({
    senderId: directMessagesTable.senderId,
    receiverId: directMessagesTable.receiverId,
  }).from(directMessagesTable).where(eq(directMessagesTable.id, messageId)).limit(1);
  if (!message) { res.status(404).json({ error: "Mesaj bulunamadı" }); return; }
  const viewerId = req.user!.id;
  if (message.senderId !== viewerId && message.receiverId !== viewerId) {
    res.status(403).json({ error: "Yetkisiz" });
    return;
  }
  const accessError = await getDmAccessError(
    viewerId,
    message.senderId === viewerId ? message.receiverId : message.senderId,
  );
  if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }
  await ensureMessageLikesTable;
  const emoji = typeof req.body?.emoji === "string" && req.body.emoji.trim() ? req.body.emoji : "❤️";
  const existing = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'dm' AND message_id = ${messageId} AND user_id = ${viewerId}`);
  if (existing.rows.length && existing.rows[0]?.emoji === emoji) {
    await db.execute(sql`DELETE FROM message_likes WHERE message_type = 'dm' AND message_id = ${messageId} AND user_id = ${viewerId}`);
  } else if (existing.rows.length) {
    await db.execute(sql`UPDATE message_likes SET emoji = ${emoji}, created_at = now() WHERE message_type = 'dm' AND message_id = ${messageId} AND user_id = ${viewerId}`);
  } else {
    await db.execute(sql`INSERT INTO message_likes (message_type, message_id, user_id, emoji) VALUES ('dm', ${messageId}, ${viewerId}, ${emoji}) ON CONFLICT DO NOTHING`);
  }
  const count = await db.execute(sql`SELECT count(*)::int AS count FROM message_likes WHERE message_type = 'dm' AND message_id = ${messageId}`);
  const reaction = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'dm' AND message_id = ${messageId} ORDER BY created_at DESC LIMIT 1`);
  res.json({ liked: !(existing.rows.length && existing.rows[0]?.emoji === emoji), likeCount: Number(count.rows[0]?.count ?? 0), reactionEmoji: reaction.rows[0]?.emoji ?? null });
});

router.get("/dm/:userId/names", requireAuth, async (req, res) => {
  try {
    await ensureDmContactNamesTable;
    const contactId = Number(req.params["userId"]);
    if (!Number.isInteger(contactId) || contactId <= 0) { res.status(400).json({ error: "Geçersiz kullanıcı" }); return; }
    const accessError = await getDmAccessError(req.user!.id, contactId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }
    const rows = await db.execute(sql`
      SELECT owner_id AS "ownerId", contact_id AS "contactId", name
      FROM dm_contact_names
      WHERE (owner_id = ${req.user!.id} AND contact_id = ${contactId})
         OR (owner_id = ${contactId} AND contact_id = ${req.user!.id})
    `);
    const mine = rows.rows.find(row => Number(row.ownerId) === contactId);
    const theirs = rows.rows.find(row => Number(row.ownerId) === req.user!.id);
    res.json({ mine: mine?.name ?? "", theirs: theirs?.name ?? "" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/dm/:userId/names", requireAuth, async (req, res) => {
  try {
    await ensureDmContactNamesTable;
    const contactId = Number(req.params["userId"]);
    const mine = typeof req.body?.mine === "string" ? req.body.mine.trim().slice(0, 60) : "";
    const theirs = typeof req.body?.theirs === "string" ? req.body.theirs.trim().slice(0, 60) : "";
    if (!Number.isInteger(contactId) || contactId <= 0 || contactId === req.user!.id) { res.status(400).json({ error: "Geçersiz kullanıcı" }); return; }
    const accessError = await getDmAccessError(req.user!.id, contactId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }
    const [contact] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, contactId)).limit(1);
    if (!contact) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }

    for (const [ownerId, name] of [[contactId, mine], [req.user!.id, theirs]] as const) {
      if (name) {
        await db.execute(sql`
          INSERT INTO dm_contact_names (owner_id, contact_id, name)
          VALUES (${ownerId}, ${ownerId === req.user!.id ? contactId : req.user!.id}, ${name})
          ON CONFLICT (owner_id, contact_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
        `);
      } else {
        await db.execute(sql`
          DELETE FROM dm_contact_names
          WHERE owner_id = ${ownerId} AND contact_id = ${ownerId === req.user!.id ? contactId : req.user!.id}
        `);
      }
    }

    const [systemMessage] = await db.insert(directMessagesTable).values({
      senderId: req.user!.id,
      receiverId: contactId,
      content: `__LOOP_DM_NAMES__:${JSON.stringify({ mine, theirs })}`,
    }).returning();
    res.json({ mine, theirs, message: await enrichMessage(systemMessage, req.user!.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dm/instant-shares", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const result = await db.execute(sql`
      SELECT share.id, share.media_url AS "mediaUrl", share.media_type AS "mediaType",
        share.created_at AS "createdAt", share.archived,
        (view.share_id IS NOT NULL) AS viewed,
        json_build_object(
          'id', sender.id,
          'displayName', sender.display_name,
          'avatarUrl', sender.avatar_url,
          'username', sender.username
        ) AS sender
      FROM dm_instant_shares share
      JOIN users sender ON sender.id = share.sender_id
      LEFT JOIN dm_instant_share_views view
        ON view.share_id = share.id AND view.viewer_id = ${req.user!.id}
      WHERE share.created_at > now() - interval '24 hours'
      ORDER BY share.created_at DESC
      LIMIT 200
    `);
    res.set("Cache-Control", "no-store");
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Anlık paylaşımlar alınamadı" });
  }
});

router.get("/dm/instant-shares/archive", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const result = await db.execute(sql`
      SELECT id, media_url AS "mediaUrl", media_type AS "mediaType",
        created_at AS "createdAt", archived
      FROM dm_instant_shares
      WHERE sender_id = ${req.user!.id} AND archived = true
      ORDER BY created_at DESC
      LIMIT 500
    `);
    res.set("Cache-Control", "no-store");
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "DM anlık paylaşım arşivi alınamadı" });
  }
});

router.patch("/dm/instant-shares/:shareId/archive", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    if (!Number.isInteger(shareId) || shareId <= 0 || typeof req.body?.archived !== "boolean") {
      res.status(400).json({ error: "Geçersiz arşiv isteği" });
      return;
    }
    const result = await db.execute(sql`
      UPDATE dm_instant_shares
      SET archived = ${req.body.archived}
      WHERE id = ${shareId} AND sender_id = ${req.user!.id}
      RETURNING id, archived
    `);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Anlık paylaşım bulunamadı" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "DM anlık paylaşım arşivi güncellenemedi" });
  }
});

router.delete("/dm/instant-shares/:shareId/archive", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    if (!Number.isInteger(shareId) || shareId <= 0) {
      res.status(400).json({ error: "Geçersiz anlık paylaşım numarası" });
      return;
    }
    const result = await db.execute(sql`
      DELETE FROM dm_instant_shares
      WHERE id = ${shareId} AND sender_id = ${req.user!.id} AND archived = true
      RETURNING id
    `);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Arşivlenmiş anlık paylaşım bulunamadı" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Anlık paylaşım arşivden silinemedi" });
  }
});

router.post("/dm/instant-shares", requireAuth, parseInstantShareUpload, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Paylaşılacak bir görsel seç" });
      return;
    }
    await ensureDmInstantSharesSchema();
    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const result = await db.execute(sql`
      INSERT INTO dm_instant_shares (sender_id, media_url, media_type)
      VALUES (${req.user!.id}, ${mediaUrl}, 'image')
      RETURNING id, media_url AS "mediaUrl", media_type AS "mediaType", created_at AS "createdAt", archived
    `);
    const sender = await getUserWithStats(req.user!.id, req.user!.id);
    res.status(201).json({ ...result.rows[0], viewed: false, sender });
  } catch (err) {
    if (req.file) await fs.promises.rm(req.file.path, { force: true });
    req.log.error(err);
    res.status(500).json({ error: "Anlık paylaşım gönderilemedi" });
  }
});

router.get("/dm/instant-shares/:shareId", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    if (!Number.isInteger(shareId) || shareId <= 0) {
      res.status(400).json({ error: "Anlık paylaşım numarası geçersiz" });
      return;
    }
    const shares = await db.execute(sql`
      SELECT id, sender_id AS "senderId", media_url AS "mediaUrl", media_type AS "mediaType",
        created_at AS "createdAt"
      FROM dm_instant_shares WHERE id = ${shareId} AND created_at > now() - interval '24 hours'
      LIMIT 1
    `);
    const share = shares.rows[0] as { id: number; senderId: number; mediaUrl: string; mediaType: string; createdAt: Date } | undefined;
    if (!share) {
      res.status(404).json({ error: "Anlık paylaşım bulunamadı veya süresi doldu" });
      return;
    }
    const [sender, reactions, replies] = await Promise.all([
      getUserWithStats(share.senderId, req.user!.id),
      db.execute(sql`
        SELECT reaction.emoji,
          json_build_object('id', account.id, 'displayName', account.display_name, 'avatarUrl', account.avatar_url) AS "user"
        FROM dm_instant_share_reactions reaction
        JOIN users account ON account.id = reaction.user_id
        WHERE reaction.share_id = ${shareId}
        ORDER BY reaction.created_at ASC
      `),
      db.execute(sql`
        SELECT reply.content, reply.created_at AS "createdAt",
          json_build_object('id', account.id, 'displayName', account.display_name, 'avatarUrl', account.avatar_url) AS "user"
        FROM dm_instant_share_replies reply
        JOIN users account ON account.id = reply.user_id
        WHERE reply.share_id = ${shareId}
        ORDER BY reply.created_at ASC
      `),
    ]);
    res.json({ ...share, sender, reactions: reactions.rows, replies: replies.rows });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Anlık paylaşım açılamadı" });
  }
});

router.post("/dm/instant-shares/:shareId/view", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    if (!Number.isInteger(shareId) || shareId <= 0) {
      res.status(400).json({ error: "Anlık paylaşım numarası geçersiz" });
      return;
    }
    const result = await db.execute(sql`
      INSERT INTO dm_instant_share_views (share_id, viewer_id)
      SELECT id, ${req.user!.id} FROM dm_instant_shares
      WHERE id = ${shareId} AND created_at > now() - interval '24 hours'
      ON CONFLICT (share_id, viewer_id) DO NOTHING
      RETURNING share_id
    `);
    const exists = result.rows.length > 0 || (await db.execute(sql`
      SELECT 1 FROM dm_instant_shares
      WHERE id = ${shareId} AND created_at > now() - interval '24 hours'
    `)).rows.length > 0;
    if (!exists) {
      res.status(404).json({ error: "Anlık paylaşım bulunamadı veya süresi doldu" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Anlık paylaşım görüntülenemedi" });
  }
});

router.post("/dm/instant-shares/:shareId/react", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
    if (!Number.isInteger(shareId) || shareId <= 0 || !emoji || emoji.length > 16) {
      res.status(400).json({ error: "Tepki veya paylaşım geçersiz" });
      return;
    }
    const result = await db.execute(sql`
      INSERT INTO dm_instant_share_reactions (share_id, user_id, emoji)
      SELECT id, ${req.user!.id}, ${emoji} FROM dm_instant_shares
      WHERE id = ${shareId} AND created_at > now() - interval '24 hours'
      ON CONFLICT (share_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji
      RETURNING share_id
    `);
    if (!result.rows.length) {
      res.status(404).json({ error: "Anlık paylaşım bulunamadı veya süresi doldu" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Tepki gönderilemedi" });
  }
});

router.post("/dm/instant-shares/:shareId/reply", requireAuth, async (req, res) => {
  try {
    await ensureDmInstantSharesSchema();
    const shareId = Number(req.params["shareId"]);
    const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 1000) : "";
    if (!Number.isInteger(shareId) || shareId <= 0 || !content) {
      res.status(400).json({ error: "Yanıt veya paylaşım geçersiz" });
      return;
    }
    const result = await db.execute(sql`
      INSERT INTO dm_instant_share_replies (share_id, user_id, content)
      SELECT id, ${req.user!.id}, ${content} FROM dm_instant_shares
      WHERE id = ${shareId} AND created_at > now() - interval '24 hours'
      RETURNING id
    `);
    if (!result.rows.length) {
      res.status(404).json({ error: "Anlık paylaşım bulunamadı veya süresi doldu" });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Yanıt gönderilemedi" });
  }
});

router.get("/dm/stickers", requireAuth, async (req, res) => {
  try {
    await ensureDmStickersTable;
    const result = await db.execute(sql`
      SELECT sticker.id, sticker.creator_id AS "creatorId", sticker.name, sticker.media_url AS "mediaUrl",
        sticker.created_at AS "createdAt", (favorite.user_id IS NOT NULL) AS "isFavorite"
      FROM dm_stickers sticker
      LEFT JOIN dm_sticker_favorites favorite
        ON favorite.sticker_id = sticker.id AND favorite.user_id = ${req.user!.id}
      ORDER BY (favorite.user_id IS NOT NULL) DESC, sticker.created_at DESC, sticker.id DESC
      LIMIT 200
    `);
    res.set("Cache-Control", "no-store");
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Stickerlar alınamadı" });
  }
});

router.post("/dm/stickers", requireAuth, stickerUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "Sticker görseli gerekli" }); return; }
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 60) : "";
    if (!name) {
      await fs.promises.rm(req.file.path, { force: true });
      res.status(400).json({ error: "Sticker için bir ad gerekli" });
      return;
    }
    await ensureDmStickersTable;
    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const result = await db.execute(sql`
      INSERT INTO dm_stickers (creator_id, name, media_url)
      VALUES (${req.user!.id}, ${name}, ${mediaUrl})
      RETURNING id, creator_id AS "creatorId", name, media_url AS "mediaUrl", created_at AS "createdAt"
    `);
    res.status(201).json({ ...result.rows[0], isFavorite: false });
  } catch (err) {
    if (req.file) await fs.promises.rm(req.file.path, { force: true });
    req.log.error(err);
    res.status(500).json({ error: "Sticker kaydedilemedi" });
  }
});

router.post("/dm/stickers/:stickerId/favorite", requireAuth, async (req, res) => {
  try {
    await ensureDmStickersTable;
    const stickerId = Number(req.params["stickerId"]);
    if (!Number.isInteger(stickerId) || stickerId <= 0) { res.status(400).json({ error: "Sticker numarası geçersiz" }); return; }
    const result = await db.execute(sql`
      INSERT INTO dm_sticker_favorites (user_id, sticker_id)
      SELECT ${req.user!.id}, id FROM dm_stickers WHERE id = ${stickerId}
      ON CONFLICT (user_id, sticker_id) DO NOTHING
      RETURNING sticker_id
    `);
    const exists = result.rows.length > 0 || (await db.execute(sql`
      SELECT 1 FROM dm_sticker_favorites WHERE user_id = ${req.user!.id} AND sticker_id = ${stickerId}
    `)).rows.length > 0;
    if (!exists) { res.status(404).json({ error: "Sticker bulunamadı" }); return; }
    res.json({ stickerId, isFavorite: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sticker favorilere eklenemedi" });
  }
});

router.delete("/dm/stickers/:stickerId/favorite", requireAuth, async (req, res) => {
  try {
    await ensureDmStickersTable;
    const stickerId = Number(req.params["stickerId"]);
    if (!Number.isInteger(stickerId) || stickerId <= 0) { res.status(400).json({ error: "Sticker numarası geçersiz" }); return; }
    await db.execute(sql`
      DELETE FROM dm_sticker_favorites WHERE user_id = ${req.user!.id} AND sticker_id = ${stickerId}
    `);
    res.json({ stickerId, isFavorite: false });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sticker favorilerden çıkarılamadı" });
  }
});

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

    const unblockedConversations = await Promise.all(conversations.map(async (conversation) => ({
      conversation,
      blockStatus: await getBlockStatus(userId, conversation.userId),
    })));
    const enriched = await Promise.all(unblockedConversations
      .filter(({ blockStatus }) => !blockStatus.blockedByMe && !blockStatus.blockedByThem)
      .map(async ({ conversation: c }) => {
      const user = await getUserWithStats(c.userId, userId);
      return {
        user: user ?? null,
        lastMessage: await enrichMessage(c.lastMessage, userId),
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

// ── Group DM routes — MUST come before /dm/:userId wildcard ──────────────────

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
    const userId = req.user!.id;
    if (!await isDmGroupMember(groupId, userId)) { res.status(403).json({ error: "Yetkisiz" }); return; }
    const msgs = await db.select().from(dmGroupMessagesTable)
      .where(eq(dmGroupMessagesTable.groupId, groupId))
      .orderBy(desc(dmGroupMessagesTable.createdAt));

    const enriched = await Promise.all(msgs.reverse().map(async m => {
      const sender = await getUserWithStats(m.senderId, userId);
      return { ...m, sender: sender ?? null, createdAt: m.createdAt.toISOString(), ...(await messageLikeData("group", m.id, userId)) };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/dm/groups/:groupId/messages/:messageId/like", requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!await isDmGroupMember(groupId, req.user!.id)) { res.status(403).json({ error: "Yetkisiz" }); return; }
  const messageId = Number(req.params.messageId);
  const [message] = await db.select({ id: dmGroupMessagesTable.id })
    .from(dmGroupMessagesTable)
    .where(and(eq(dmGroupMessagesTable.id, messageId), eq(dmGroupMessagesTable.groupId, groupId)))
    .limit(1);
  if (!message) { res.status(404).json({ error: "Mesaj bulunamadı" }); return; }
  await ensureMessageLikesTable;
  const emoji = typeof req.body?.emoji === "string" && req.body.emoji.trim() ? req.body.emoji : "❤️";
  const existing = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'group' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  if (existing.rows.length && existing.rows[0]?.emoji === emoji) {
    await db.execute(sql`DELETE FROM message_likes WHERE message_type = 'group' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  } else if (existing.rows.length) {
    await db.execute(sql`UPDATE message_likes SET emoji = ${emoji}, created_at = now() WHERE message_type = 'group' AND message_id = ${messageId} AND user_id = ${req.user!.id}`);
  } else {
    await db.execute(sql`INSERT INTO message_likes (message_type, message_id, user_id, emoji) VALUES ('group', ${messageId}, ${req.user!.id}, ${emoji}) ON CONFLICT DO NOTHING`);
  }
  const count = await db.execute(sql`SELECT count(*)::int AS count FROM message_likes WHERE message_type = 'group' AND message_id = ${messageId}`);
  const reaction = await db.execute(sql`SELECT emoji FROM message_likes WHERE message_type = 'group' AND message_id = ${messageId} ORDER BY created_at DESC LIMIT 1`);
  res.json({ liked: !(existing.rows.length && existing.rows[0]?.emoji === emoji), likeCount: Number(count.rows[0]?.count ?? 0), reactionEmoji: reaction.rows[0]?.emoji ?? null });
});

// POST /dm/groups/:groupId/messages
router.post("/dm/groups/:groupId/messages", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    if (!await isDmGroupMember(groupId, req.user!.id)) { res.status(403).json({ error: "Yetkisiz" }); return; }
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

// POST /dm/groups/:groupId/media
router.post("/dm/groups/:groupId/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    if (!await isDmGroupMember(groupId, req.user!.id)) { res.status(403).json({ error: "Yetkisiz" }); return; }
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }

    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    const [msg] = await db.insert(dmGroupMessagesTable).values({ groupId, senderId: req.user!.id, mediaUrl, mediaType }).returning();
    const [sender] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, username: usersTable.username })
      .from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    res.status(201).json({ ...msg, sender, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /dm/groups/:groupId — grup adı veya fotoğrafını güncelle
router.patch("/dm/groups/:groupId", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const userId = req.user!.id;
    const [group] = await db.select().from(dmGroupsTable).where(eq(dmGroupsTable.id, groupId)).limit(1);
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    if (group.createdBy !== userId) { res.status(403).json({ error: "Sadece grup kurucusu güncelleyebilir" }); return; }
    const { name, avatarUrl } = req.body;
    const updates: Partial<typeof group> = {};
    if (name?.trim()) updates.name = name.trim();
    if (avatarUrl !== undefined) (updates as any).avatarUrl = avatarUrl;
    const [updated] = await db.update(dmGroupsTable).set(updates).where(eq(dmGroupsTable.id, groupId)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/groups/:groupId/photo — grup fotoğrafı yükle
router.post("/dm/groups/:groupId/photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const userId = req.user!.id;
    const [group] = await db.select().from(dmGroupsTable).where(eq(dmGroupsTable.id, groupId)).limit(1);
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    if (group.createdBy !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }
    if (!req.file) { res.status(400).json({ error: "Dosya gerekli" }); return; }
    const avatarUrl = `/api/uploads/${req.file.filename}`;
    const [updated] = await db.update(dmGroupsTable).set({ avatarUrl }).where(eq(dmGroupsTable.id, groupId)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/groups/:groupId/members — üye ekle
router.post("/dm/groups/:groupId/members", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const userId = req.user!.id;
    const [group] = await db.select().from(dmGroupsTable).where(eq(dmGroupsTable.id, groupId)).limit(1);
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    if (group.createdBy !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }
    const { userId: newUserId } = req.body;
    if (!newUserId) { res.status(400).json({ error: "userId gerekli" }); return; }
    // Zaten üye mi kontrol et
    const existing = await db.select().from(dmGroupMembersTable)
      .where(and(eq(dmGroupMembersTable.groupId, groupId), eq(dmGroupMembersTable.userId, newUserId))).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Kullanıcı zaten üye" }); return; }
    await db.insert(dmGroupMembersTable).values({ groupId, userId: newUserId });
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /dm/groups/:groupId/members/:memberId — üye çıkar
router.delete("/dm/groups/:groupId/members/:memberId", requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    const memberId = parseInt(req.params["memberId"] as string);
    const userId = req.user!.id;
    const [group] = await db.select().from(dmGroupsTable).where(eq(dmGroupsTable.id, groupId)).limit(1);
    if (!group) { res.status(404).json({ error: "Grup bulunamadı" }); return; }
    // Kurucuysa veya kendini çıkarıyorsa izin ver
    if (group.createdBy !== userId && memberId !== userId) { res.status(403).json({ error: "Yetkisiz" }); return; }
    await db.delete(dmGroupMembersTable).where(
      and(eq(dmGroupMembersTable.groupId, groupId), eq(dmGroupMembersTable.userId, memberId))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/dm/:userId/request", requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = Number(req.params["userId"]);
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!Number.isInteger(receiverId) || receiverId <= 0 || receiverId === senderId || !content || content.length > 2000) {
      res.status(400).json({ error: "Mesaj isteği için geçerli bir mesaj yaz." });
      return;
    }
    const privacy = await getUserPrivacySettings(receiverId);
    if (privacy.allowMessages !== "requests") {
      res.status(403).json({ error: "Bu kullanıcı mesaj isteği kabul etmiyor." });
      return;
    }
    const [blockStatus, interaction] = await Promise.all([
      getBlockStatus(senderId, receiverId),
      getInteractionRestrictionStatus(senderId, receiverId),
    ]);
    if (blockStatus.blockedByMe || blockStatus.blockedByThem || interaction.restrictedByReceiver) {
      res.status(403).json({ error: "Bu kullanıcıya mesaj isteği gönderemezsin." });
      return;
    }
    const moderation = await moderateDmMessage(senderId, content);
    if (moderation) {
      res.status(403).json({ error: "dm_banned", reason: moderation.reason });
      return;
    }
    const created = await createDmRequest(senderId, receiverId, content);
    if (!created) {
      res.status(409).json({ error: "Bu kişiye zaten bekleyen bir mesaj isteğin var." });
      return;
    }
    res.status(202).json({ ok: true, requestPending: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Mesaj isteği gönderilemedi" });
  }
});

router.get("/dm/:userId/request-status", requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = Number(req.params["userId"]);
    await dmRequestsReady;
    const result = await db.execute(sql`
      SELECT status FROM dm_message_requests
      WHERE sender_id = ${senderId} AND receiver_id = ${receiverId}
      ORDER BY created_at DESC LIMIT 1
    `);
    res.json({
      pending: result.rows[0]?.status === "pending",
      accepted: result.rows[0]?.status === "accepted",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Mesaj isteği durumu yüklenemedi" });
  }
});

router.get("/dm/requests/inbox", requireAuth, async (req, res) => {
  try {
    await dmRequestsReady;
    const result = await db.execute(sql`
      SELECT
        r.id,
        r.sender_id AS "senderId",
        r.content,
        r.created_at AS "createdAt",
        u.username,
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl"
      FROM dm_message_requests r
      JOIN users u ON u.id = r.sender_id
      WHERE r.receiver_id = ${req.user!.id} AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Mesaj istekleri yüklenemedi" });
  }
});

router.post("/dm/requests/:requestId/respond", requireAuth, async (req, res) => {
  try {
    const requestId = Number(req.params["requestId"]);
    const action = req.body?.action;
    if (!Number.isInteger(requestId) || requestId <= 0 || !["accepted", "rejected"].includes(action)) {
      res.status(400).json({ error: "Geçersiz mesaj isteği yanıtı" });
      return;
    }
    await dmRequestsReady;
    const result = await db.execute(sql`
      UPDATE dm_message_requests
      SET status = ${action}, updated_at = now()
      WHERE id = ${requestId} AND receiver_id = ${req.user!.id} AND status = 'pending'
      RETURNING sender_id AS "senderId", receiver_id AS "receiverId", content
    `);
    const request = result.rows[0] as { senderId: number; receiverId: number; content: string } | undefined;
    if (!request) {
      res.status(404).json({ error: "Bekleyen mesaj isteği bulunamadı" });
      return;
    }
    if (action === "accepted") {
      const [message] = await db.insert(directMessagesTable).values({
        senderId: request.senderId,
        receiverId: request.receiverId,
        content: request.content,
      }).returning();
      await db.execute(sql`
        UPDATE notifications SET is_read = true,
          data = jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', to_jsonb('accepted'::text))
        WHERE user_id = ${request.receiverId} AND from_user_id = ${request.senderId}
          AND type = 'message_request'
          AND data->>'requestId' = ${String(requestId)}
      `);
      res.json({ ok: true, accepted: true, senderId: request.senderId, message: await enrichMessage(message, req.user!.id) });
      return;
    }
    await db.execute(sql`
      UPDATE notifications SET is_read = true,
        data = jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', to_jsonb('rejected'::text))
      WHERE user_id = ${request.receiverId} AND from_user_id = ${request.senderId}
        AND type = 'message_request'
        AND data->>'requestId' = ${String(requestId)}
    `);
    res.json({ ok: true, accepted: false });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Mesaj isteği yanıtlanamadı" });
  }
});

// ── Direct message wildcard routes — MUST come after all named /dm/* routes ──

// GET /dm/:userId
router.get("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const myId = req.user!.id;
    const otherId = parseInt(req.params["userId"] as string);
    const accessError = await getDmAccessError(myId, otherId);
    if (accessError?.error === "message_request_required") {
      res.json([]);
      return;
    }
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }

    const messages = await db.select().from(directMessagesTable)
      .where(or(
        and(eq(directMessagesTable.senderId, myId), eq(directMessagesTable.receiverId, otherId)),
        and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.receiverId, myId)),
      ))
      .orderBy(desc(directMessagesTable.createdAt));

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
    const accessError = await getDmAccessError(senderId, receiverId);
    if (accessError?.error === "message_request_required" && !String(content).startsWith("__LOOP_")) {
      const privacy = await getUserPrivacySettings(receiverId);
      if (privacy.allowMessages === "requests") {
        const requestCreated = await createDmRequest(senderId, receiverId, String(content).trim());
        if (!requestCreated) {
          res.status(409).json({ error: "Bu kişiye zaten bekleyen bir mesaj isteğin var." });
          return;
        }
        res.status(202).json({ ok: true, requestPending: true });
        return;
      }
    }
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }

    const moderation = await moderateDmMessage(senderId, String(content));
    if (moderation) { res.status(403).json({ error: "dm_banned", reason: moderation.reason }); return; }

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, content }).returning();
    res.status(201).json(await enrichMessage(msg, req.user!.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/dm/:userId/stickers", requireAuth, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = Number(req.params["userId"]);
    const stickerId = Number(req.body?.stickerId);
    if (!Number.isInteger(receiverId) || receiverId <= 0 || receiverId === senderId
      || !Number.isInteger(stickerId) || stickerId <= 0) {
      res.status(400).json({ error: "Sticker veya alıcı geçersiz" });
      return;
    }
    const accessError = await getDmAccessError(senderId, receiverId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }
    await ensureDmStickersTable;
    const stickerRows = await db.execute(sql`
      SELECT id, name, media_url AS "mediaUrl" FROM dm_stickers WHERE id = ${stickerId} LIMIT 1
    `);
    const sticker = stickerRows.rows[0] as { id: number; name: string; mediaUrl: string } | undefined;
    if (!sticker) { res.status(404).json({ error: "Sticker bulunamadı" }); return; }
    const [message] = await db.insert(directMessagesTable).values({
      senderId,
      receiverId,
      content: `__LOOP_STICKER__:${sticker.name}`,
      mediaUrl: sticker.mediaUrl,
      mediaType: "sticker",
    }).returning();
    res.status(201).json(await enrichMessage(message, senderId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sticker gönderilemedi" });
  }
});

// POST /dm/:userId/media
router.post("/dm/:userId/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const senderId = req.user!.id;
    const receiverId = parseInt(req.params["userId"] as string);
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const accessError = await getDmAccessError(senderId, receiverId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }

    const mediaUrl = `/api/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, mediaUrl, mediaType }).returning();
    res.status(201).json(await enrichMessage(msg, req.user!.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dm/groups/:groupId/voice — group voice message
router.post("/dm/groups/:groupId/voice", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const groupId = parseInt(req.params["groupId"] as string);
    if (!await isDmGroupMember(groupId, req.user!.id)) { res.status(403).json({ error: "Yetkisiz" }); return; }
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const voiceUrl = `/api/uploads/${req.file.filename}`;
    const voiceDuration = req.body.duration ? parseInt(req.body.duration) : null;
    const [msg] = await db.insert(dmGroupMessagesTable).values({
      groupId, senderId: req.user!.id, voiceUrl, voiceDuration,
    }).returning();
    res.status(201).json(msg);
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
    const accessError = await getDmAccessError(senderId, receiverId);
    if (accessError) { res.status(accessError.status).json({ error: accessError.error }); return; }

    const voiceUrl = `/api/uploads/${req.file.filename}`;
    const voiceDuration = req.body.duration ? parseInt(req.body.duration) : null;

    const [msg] = await db.insert(directMessagesTable).values({ senderId, receiverId, voiceUrl, voiceDuration }).returning();
    res.status(201).json(await enrichMessage(msg, req.user!.id));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
