import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { moderationSchemaReady } from "./moderation";

export type ModiSettings = {
  enabled: boolean;
  reportThreshold: number;
  pollMinVotes: number;
  pollDurationSeconds: number;
  muteMinutes: number;
  warningLimit: number;
  spamWindowSeconds: number;
};

const defaultSettings: ModiSettings = {
  enabled: true,
  reportThreshold: 5,
  pollMinVotes: 5,
  pollDurationSeconds: 120,
  muteMinutes: 10,
  warningLimit: 3,
  spamWindowSeconds: 30,
};

export const modiSchemaReady = (async () => {
  await moderationSchemaReady;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modi_settings (
      id boolean PRIMARY KEY DEFAULT true,
      enabled boolean NOT NULL DEFAULT true,
      report_threshold integer NOT NULL DEFAULT 5,
      poll_min_votes integer NOT NULL DEFAULT 5,
      poll_duration_seconds integer NOT NULL DEFAULT 120,
      mute_minutes integer NOT NULL DEFAULT 10,
      warning_limit integer NOT NULL DEFAULT 3,
      spam_window_seconds integer NOT NULL DEFAULT 30,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE modi_settings ADD COLUMN IF NOT EXISTS spam_window_seconds integer NOT NULL DEFAULT 30`);
  await db.execute(sql`INSERT INTO modi_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS modi_words (id serial PRIMARY KEY, word text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modi_chat_reports (
      id serial PRIMARY KEY,
      reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id integer NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      room_id integer,
      message text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (reporter_id, target_user_id, message_id)
    )
  `);
  await db.execute(sql`ALTER TABLE modi_chat_reports ADD COLUMN IF NOT EXISTS room_id integer`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modi_chat_polls (
      id serial PRIMARY KEY,
      target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_message_id integer NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      room_id integer,
      status text NOT NULL DEFAULT 'open',
      required_votes integer NOT NULL DEFAULT 5,
      mute_minutes integer NOT NULL DEFAULT 10,
      is_test boolean NOT NULL DEFAULT false,
      ends_at timestamptz NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      closed_at timestamp
    )
  `);
  await db.execute(sql`ALTER TABLE modi_chat_polls ADD COLUMN IF NOT EXISTS room_id integer`);
  await db.execute(sql`ALTER TABLE modi_chat_polls ADD COLUMN IF NOT EXISTS required_votes integer NOT NULL DEFAULT 5`);
  await db.execute(sql`ALTER TABLE modi_chat_polls ADD COLUMN IF NOT EXISTS mute_minutes integer NOT NULL DEFAULT 10`);
  await db.execute(sql`ALTER TABLE modi_chat_polls ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false`);
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'modi_chat_polls'
          AND column_name = 'ends_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE modi_chat_polls
        ALTER COLUMN ends_at TYPE timestamptz USING ends_at AT TIME ZONE 'UTC';
      END IF;
    END
    $$
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS modi_chat_polls_one_open_target_idx
    ON modi_chat_polls (target_user_id)
    WHERE status = 'open'
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modi_chat_votes (
      id serial PRIMARY KEY,
      poll_id integer NOT NULL REFERENCES modi_chat_polls(id) ON DELETE CASCADE,
      voter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_yes boolean NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (poll_id, voter_id)
    )
  `);
  await db.execute(sql`ALTER TABLE bans ADD COLUMN IF NOT EXISTS ban_type text NOT NULL DEFAULT 'user'`);
  await db.execute(sql`ALTER TABLE bans ADD COLUMN IF NOT EXISTS expires_at timestamp`);
  const bot = await db.execute(sql`SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1`);
  if (!bot.rows.length) {
    await db.execute(sql`
      INSERT INTO users (username, email, display_name, role, password_hash)
      VALUES ('modi', 'modi@loop.local', 'Modi', 'bot', 'modi-system-account')
      ON CONFLICT (username) DO NOTHING
    `);
  }
})().catch((error) => {
  console.error("Modi moderation schema initialization failed:", error);
  throw error;
});

export async function getModiSettings(): Promise<ModiSettings> {
  await modiSchemaReady;
  const result = await db.execute(sql`
    SELECT enabled, report_threshold AS "reportThreshold",
      poll_min_votes AS "pollMinVotes",
      poll_duration_seconds AS "pollDurationSeconds",
      mute_minutes AS "muteMinutes",
      warning_limit AS "warningLimit",
      spam_window_seconds AS "spamWindowSeconds"
    FROM modi_settings WHERE id = true
  `);
  const row = result.rows[0] as Partial<ModiSettings> | undefined;
  return row ? {
    enabled: row.enabled !== false,
    reportThreshold: Number(row.reportThreshold ?? defaultSettings.reportThreshold),
    pollMinVotes: Number(row.pollMinVotes ?? defaultSettings.pollMinVotes),
    pollDurationSeconds: Number(row.pollDurationSeconds ?? defaultSettings.pollDurationSeconds),
    muteMinutes: Number(row.muteMinutes ?? defaultSettings.muteMinutes),
    warningLimit: Number(row.warningLimit ?? defaultSettings.warningLimit),
    spamWindowSeconds: Number(row.spamWindowSeconds ?? defaultSettings.spamWindowSeconds),
  } : defaultSettings;
}

export async function updateModiSettings(input: Partial<ModiSettings>) {
  await modiSchemaReady;
  const current = await getModiSettings();
  const next: ModiSettings = {
    enabled: input.enabled ?? current.enabled,
    reportThreshold: clampSetting(input.reportThreshold ?? current.reportThreshold, 5, 20),
    pollMinVotes: clampSetting(input.pollMinVotes ?? current.pollMinVotes, 5, 100),
    pollDurationSeconds: clampSetting(input.pollDurationSeconds ?? current.pollDurationSeconds, 30, 600),
    muteMinutes: clampSetting(input.muteMinutes ?? current.muteMinutes, 1, 60),
    warningLimit: clampSetting(input.warningLimit ?? current.warningLimit, 1, 10),
    spamWindowSeconds: clampSetting(input.spamWindowSeconds ?? current.spamWindowSeconds, 10, 300),
  };
  await db.execute(sql`
    UPDATE modi_settings
    SET enabled = ${next.enabled},
        report_threshold = ${next.reportThreshold},
        poll_min_votes = ${next.pollMinVotes},
        poll_duration_seconds = ${next.pollDurationSeconds},
        mute_minutes = ${next.muteMinutes},
        warning_limit = ${next.warningLimit},
        spam_window_seconds = ${next.spamWindowSeconds},
        updated_at = now()
    WHERE id = true
  `);
  return next;
}

function clampSetting(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum)));
}

function normalizeModerationText(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:()[\]{}"'`*_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function moderateModiChatMessage(userId: number, content: string, roomId: number | null = null) {
  await modiSchemaReady;
  const settings = await getModiSettings();
  if (!settings.enabled) return { blocked: false as const };

  const normalized = normalizeModerationText(content);
  if (!normalized) return { blocked: false as const };
  const words = await db.execute(sql`SELECT word FROM modi_words ORDER BY length(word) DESC`);
  const matchedWord = words.rows
    .map((row) => normalizeModerationText(String(row.word)))
    .find((word) => word && ` ${normalized} `.includes(` ${word} `));
  const recent = await db.execute(sql`
    SELECT content FROM chat_messages
    WHERE user_id = ${userId} AND room_id IS NOT DISTINCT FROM ${roomId} AND type = 'text'
      AND created_at >= now() - (${settings.spamWindowSeconds} * interval '1 second')
    ORDER BY created_at DESC LIMIT 3
  `);
  const recentTexts = recent.rows.map((row) => String(row.content ?? ""));
  const repeatedMessage = recentTexts.some((previous) => normalizeModerationText(previous) === normalized);
  const repeatedCharacters = /(.)\1{7,}/u.test(content);
  const currentLinks = content.match(/(?:https?:\/\/|www\.)\S+/gi) ?? [];
  const repeatedLink = currentLinks.some((link) =>
    recentTexts.some((previous) => previous.toLocaleLowerCase("tr-TR").includes(link.toLocaleLowerCase("tr-TR"))),
  );
  const isSpam = repeatedMessage || repeatedCharacters || repeatedLink;
  if (!matchedWord && !isSpam) return { blocked: false as const };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(918239, ${userId})`);
    const activeMute = await tx.execute(sql`
      SELECT reason, expires_at AS "expiresAt"
      FROM bans
      WHERE user_id = ${userId} AND ban_type = 'chat'
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC LIMIT 1
    `);
    if (activeMute.rows[0]) {
      const mute = activeMute.rows[0] as { reason: string; expiresAt: Date | string | null };
      return {
        blocked: true as const,
        reason: String(mute.reason),
        expiresAt: mute.expiresAt ? new Date(mute.expiresAt).toISOString() : null,
      };
    }

    await tx.execute(sql`
      INSERT INTO moderation_warnings (user_id, issued_by, reason, severity, source)
      VALUES (
        ${userId}, NULL,
        ${matchedWord ? `Modi: yasaklı kelime kullanımı (${matchedWord})` : "Modi: sohbet odasında spam"},
        'low',
        ${matchedWord ? "modi_word" : "modi_spam"}
      )
    `);
    const warningCountResult = await tx.execute(sql`
      SELECT count(*)::integer AS count
      FROM moderation_warnings
      WHERE user_id = ${userId}
        AND source IN ('modi_word', 'modi_spam')
        AND created_at >= now() - interval '24 hours'
    `);
    const warningCount = Number(warningCountResult.rows[0]?.count ?? 0);
    if (warningCount >= settings.warningLimit) {
      const bot = await tx.execute(sql`SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1`);
      const botId = Number(bot.rows[0]?.id ?? 0);
      if (!botId) throw new Error("Modi system user is unavailable");
      const expiresAt = new Date(Date.now() + settings.muteMinutes * 60_000);
      await tx.execute(sql`
        INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at)
        VALUES (${userId}, ${`Modi: tekrar eden ihlaller nedeniyle ${settings.muteMinutes} dakika genel sohbet susturması`}, 'chat', ${botId}, ${expiresAt})
      `);
      await tx.execute(sql`
        INSERT INTO chat_messages (user_id, type, content, room_id)
        VALUES (${botId}, 'modi', ${`Modi: Tekrarlanan kural ihlali nedeniyle kullanıcı ${settings.muteMinutes} dakika sohbetten susturuldu.`}, ${roomId})
      `);
      return {
        blocked: true as const,
        reason: `Modi uyarı sınırına ulaşıldı. ${settings.muteMinutes} dakika genel sohbette mesaj gönderemezsin.`,
        expiresAt: expiresAt.toISOString(),
        warningCount,
      };
    }
    return {
      blocked: true as const,
      reason: matchedWord
        ? `Modi uyarısı ${warningCount}/${settings.warningLimit}: mesaj yasaklı kelime içeriyor ve gönderilmedi.`
        : `Modi uyarısı ${warningCount}/${settings.warningLimit}: tekrarlı/spam mesaj gönderilmedi.`,
      warningCount,
    };
  });
}

export async function reportChatMessage(reporterId: number, messageId: number) {
  await modiSchemaReady;
  await finalizeExpiredModiPolls();
  const settings = await getModiSettings();
  if (!settings.enabled) return { error: "Modi bildirim sistemi şu anda kapalı." as const };

  const messageResult = await db.execute(sql`
    SELECT cm.id, cm.user_id AS "targetUserId", cm.room_id AS "roomId",
      CASE
        WHEN cm.type = 'text' THEN cm.content
        WHEN cm.type = 'gif' THEN 'GIF'
        WHEN cm.type = 'voice' THEN 'Sesli mesaj'
        WHEN cm.type = 'image' THEN 'Görsel/video'
        ELSE NULL
      END AS content,
      target.username
    FROM chat_messages cm
    JOIN users target ON target.id = cm.user_id
    WHERE cm.id = ${messageId} AND cm.type IN ('text', 'gif', 'voice', 'image')
    LIMIT 1
  `);
  const message = messageResult.rows[0] as { id: number; targetUserId: number; roomId: number | null; content: string | null; username: string } | undefined;
  if (!message || !message.content) return { error: "Bildirilecek sohbet mesajı bulunamadı." as const };
  const reportedContent = message.content;
  const targetUserId = Number(message.targetUserId);
  const roomId = message.roomId === null ? null : Number(message.roomId);
  if (targetUserId === reporterId) return { error: "Kendi mesajını bildiremezsin." as const };

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(918237, ${targetUserId})`);
    const priorReport = await tx.execute(sql`
      SELECT id FROM modi_chat_reports
      WHERE reporter_id = ${reporterId}
        AND target_user_id = ${targetUserId}
        AND room_id IS NOT DISTINCT FROM ${roomId}
        AND created_at >= now() - interval '24 hours'
      LIMIT 1
    `);
    if (priorReport.rows.length) {
      const active = await tx.execute(sql`SELECT id FROM modi_chat_polls WHERE target_user_id = ${targetUserId} AND status = 'open' LIMIT 1`);
      return { duplicate: true, pollStarted: false, reportsReceived: 0, pollId: active.rows[0]?.id ?? null };
    }
    await tx.execute(sql`
      INSERT INTO modi_chat_reports (reporter_id, target_user_id, message_id, room_id, message)
      VALUES (${reporterId}, ${targetUserId}, ${messageId}, ${roomId}, ${reportedContent.slice(0, 1000)})
      ON CONFLICT (reporter_id, target_user_id, message_id) DO NOTHING
    `);
    const countResult = await tx.execute(sql`
      SELECT count(DISTINCT reporter_id)::integer AS count
      FROM modi_chat_reports
      WHERE target_user_id = ${targetUserId}
        AND room_id IS NOT DISTINCT FROM ${roomId}
        AND created_at >= now() - interval '24 hours'
        AND created_at >= COALESCE(
          (SELECT max(created_at) FROM modi_chat_polls WHERE target_user_id = ${targetUserId} AND room_id IS NOT DISTINCT FROM ${roomId}),
          'epoch'::timestamp
        )
    `);
    const reportsReceived = Number(countResult.rows[0]?.count ?? 0);
    const activePoll = await tx.execute(sql`SELECT id FROM modi_chat_polls WHERE target_user_id = ${targetUserId} AND status = 'open' LIMIT 1`);
    if (reportsReceived < settings.reportThreshold || activePoll.rows.length) {
      return { duplicate: false, pollStarted: false, reportsReceived, pollId: activePoll.rows[0]?.id ?? null };
    }

    const poll = await tx.execute(sql`
      INSERT INTO modi_chat_polls (target_user_id, source_message_id, room_id, required_votes, mute_minutes, ends_at)
      VALUES (${targetUserId}, ${messageId}, ${roomId}, ${settings.pollMinVotes}, ${settings.muteMinutes}, now() + (${settings.pollDurationSeconds} * interval '1 second'))
      RETURNING id, ends_at AS "endsAt", room_id AS "roomId"
    `);
    await tx.execute(sql`
      INSERT INTO chat_messages (user_id, type, content, room_id)
      VALUES (
        (SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1),
        'modi',
        ${`Modi: @${message.username} için ${roomId === null ? "genel sohbette" : "bu sohbet odasında"} ${settings.muteMinutes} dakika susturma oylaması başladı. Oylama ${Math.ceil(settings.pollDurationSeconds / 60)} dakika açık kalacak.`},
        ${roomId}
      )
    `);
    return { duplicate: false, pollStarted: true, reportsReceived, pollId: poll.rows[0]?.id ?? null, endsAt: poll.rows[0]?.endsAt ?? null, roomId };
  });
}

export async function listActiveModiPolls(userId: number, roomId: number | null = null) {
  await modiSchemaReady;
  await finalizeExpiredModiPolls();
  const result = await db.execute(sql`
    SELECT p.id, p.target_user_id AS "targetUserId", p.room_id AS "roomId", u.username AS "targetUsername",
      u.display_name AS "targetDisplayName", p.ends_at AS "endsAt",
      p.mute_minutes AS "muteMinutes",
      p.is_test AS "isTest",
      p.target_user_id <> ${userId} AS "canVote",
      count(v.id)::integer AS "voteCount",
      count(v.id) FILTER (WHERE v.vote_yes)::integer AS "yesCount",
      count(v.id) FILTER (WHERE NOT v.vote_yes)::integer AS "noCount",
      bool_or(v.voter_id = ${userId}) AS "hasVoted",
      bool_or(v.voter_id = ${userId} AND v.vote_yes) AS "myVoteYes",
      p.required_votes AS "pollMinVotes"
    FROM modi_chat_polls p
    JOIN users u ON u.id = p.target_user_id
    LEFT JOIN modi_chat_votes v ON v.poll_id = p.id
    WHERE p.status = 'open' AND p.ends_at > now()
      AND p.room_id IS NOT DISTINCT FROM ${roomId}
      AND (p.target_user_id <> ${userId} OR p.is_test)
    GROUP BY p.id, u.username, u.display_name
    ORDER BY p.created_at
    LIMIT 20
  `);
  return result.rows;
}

export async function startModiTestPoll(username: string) {
  await modiSchemaReady;
  const settings = await getModiSettings();
  if (!settings.enabled) return { error: "Modi oylama sistemi şu anda kapalı." as const };

  return db.transaction(async (tx) => {
    const targetResult = await tx.execute(sql`
      SELECT id, username FROM users WHERE lower(username) = lower(${username}) LIMIT 1
    `);
    const target = targetResult.rows[0] as { id: number; username: string } | undefined;
    if (!target) return { error: "Bu kullanıcı adıyla hesap bulunamadı." as const };

    const targetId = Number(target.id);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(918237, ${targetId})`);
    const activePoll = await tx.execute(sql`
      SELECT id FROM modi_chat_polls
      WHERE target_user_id = ${targetId} AND status = 'open' AND ends_at > now()
      LIMIT 1
    `);
    if (activePoll.rows.length) return { error: "Bu kullanıcı için zaten açık bir oylama var." as const };

    const sourceMessage = await tx.execute(sql`
      SELECT id FROM chat_messages
      WHERE user_id = ${targetId} AND room_id IS NULL AND type IN ('text', 'gif', 'voice', 'image')
      ORDER BY created_at DESC LIMIT 1
    `);
    const sourceMessageId = sourceMessage.rows[0]?.id;
    if (!sourceMessageId) return { error: "Kullanıcının genel sohbette bildirilebilir bir mesajı bulunamadı." as const };

    const poll = await tx.execute(sql`
      INSERT INTO modi_chat_polls (target_user_id, source_message_id, required_votes, mute_minutes, is_test, ends_at)
      VALUES (${targetId}, ${sourceMessageId}, ${settings.pollMinVotes}, ${settings.muteMinutes}, true,
        now() + (${settings.pollDurationSeconds} * interval '1 second'))
      RETURNING id, ends_at AS "endsAt"
    `);
    await tx.execute(sql`
      INSERT INTO chat_messages (user_id, type, content)
      VALUES (
        (SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1),
        'modi',
        ${`Modi: @${target.username} için test oylaması başladı. Bu oylamanın sonucu herhangi bir yaptırım uygulamayacak.`}
      )
    `);
    return {
      pollStarted: true as const,
      pollId: poll.rows[0]?.id ?? null,
      endsAt: poll.rows[0]?.endsAt ?? null,
      targetUsername: target.username,
    };
  });
}

export async function voteInModiPoll(pollId: number, voterId: number, voteYes: boolean) {
  await modiSchemaReady;
  await finalizeExpiredModiPolls();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(918238, ${pollId})`);
    const pollResult = await tx.execute(sql`
      SELECT target_user_id AS "targetUserId", status, ends_at AS "endsAt"
      FROM modi_chat_polls WHERE id = ${pollId} LIMIT 1
    `);
    const poll = pollResult.rows[0] as { targetUserId: number; status: string; endsAt: Date | string } | undefined;
    if (!poll || poll.status !== "open" || new Date(poll.endsAt).getTime() <= Date.now()) return { error: "Bu oylama artık açık değil." as const };
    if (Number(poll.targetUserId) === voterId) return { error: "Oylanan kullanıcı kendi oylamasına katılamaz." as const };
    await tx.execute(sql`
      INSERT INTO modi_chat_votes (poll_id, voter_id, vote_yes)
      VALUES (${pollId}, ${voterId}, ${voteYes})
      ON CONFLICT (poll_id, voter_id) DO UPDATE SET vote_yes = EXCLUDED.vote_yes, created_at = now()
    `);
    return { success: true as const };
  });
}

export async function finalizeExpiredModiPolls() {
  await modiSchemaReady;
  const expired = await db.execute(sql`SELECT id FROM modi_chat_polls WHERE status = 'open' AND ends_at <= now() ORDER BY id LIMIT 100`);
  for (const item of expired.rows) {
    const pollId = Number(item.id);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(918238, ${pollId})`);
      const current = await tx.execute(sql`
        SELECT p.target_user_id AS "targetUserId", p.room_id AS "roomId", u.username, u.display_name AS "displayName",
          p.required_votes AS "pollMinVotes", p.mute_minutes AS "muteMinutes",
          p.is_test AS "isTest",
          count(v.id)::integer AS "voteCount",
          count(v.id) FILTER (WHERE v.vote_yes)::integer AS "yesCount",
          count(v.id) FILTER (WHERE NOT v.vote_yes)::integer AS "noCount"
        FROM modi_chat_polls p
        JOIN users u ON u.id = p.target_user_id
        LEFT JOIN modi_chat_votes v ON v.poll_id = p.id
        WHERE p.id = ${pollId} AND p.status = 'open' AND p.ends_at <= now()
        GROUP BY p.id, u.username, u.display_name
        LIMIT 1
      `);
      const row = current.rows[0] as {
        targetUserId: number; roomId: number | null; username: string; displayName: string;
        pollMinVotes: number; muteMinutes: number; isTest: boolean;
        voteCount: number; yesCount: number; noCount: number;
      } | undefined;
      if (!row) return;
      const voteCount = Number(row.voteCount);
      const yesCount = Number(row.yesCount);
      const noCount = Number(row.noCount);
      const approved = voteCount >= Number(row.pollMinVotes) && yesCount > noCount;
      const status = row.isTest
        ? approved ? "test_approved" : voteCount < Number(row.pollMinVotes) ? "test_insufficient_votes" : "test_rejected"
        : approved ? "approved" : voteCount < Number(row.pollMinVotes) ? "insufficient_votes" : "rejected";
      await tx.execute(sql`UPDATE modi_chat_polls SET status = ${status}, closed_at = now() WHERE id = ${pollId} AND status = 'open'`);
      if (row.isTest) {
        await tx.execute(sql`
          INSERT INTO chat_messages (user_id, type, content, room_id)
          VALUES (
            (SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1),
            'modi',
            ${`Modi: @${row.username} için test oylaması tamamlandı (${yesCount} evet, ${noCount} hayır). Test oylamasında yaptırım uygulanmadı.`},
            ${row.roomId}
          )
        `);
      } else if (approved) {
        const bot = await tx.execute(sql`SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1`);
        const botId = Number(bot.rows[0]?.id ?? 0);
        const expiresAt = new Date(Date.now() + Number(row.muteMinutes) * 60_000);
        await tx.execute(sql`
          INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at)
          VALUES (${Number(row.targetUserId)}, ${`Modi oylaması: ${Number(row.muteMinutes)} dakika sohbet susturması`}, 'chat', ${botId}, ${expiresAt})
        `);
        await tx.execute(sql`
          INSERT INTO chat_messages (user_id, type, content, room_id)
          VALUES (${botId}, 'modi', ${`Modi: @${row.username} için oylama tamamlandı (${yesCount} evet, ${noCount} hayır). Kullanıcı ${Number(row.muteMinutes)} dakika sohbetten susturuldu.`}, ${row.roomId})
        `);
      } else {
        const result = status === "insufficient_votes" ? "yeterli oy alamadığı için" : "çoğunluk sağlanamadığı için";
        await tx.execute(sql`
          INSERT INTO chat_messages (user_id, type, content, room_id)
          VALUES (
            (SELECT id FROM users WHERE lower(username) = 'modi' LIMIT 1),
            'modi',
            ${`Modi: @${row.username} oylaması ${result} sonuçlandırılmadı; herhangi bir işlem uygulanmadı.`},
            ${row.roomId}
          )
        `);
      }
    });
  }
}

export async function checkActiveGeneralChatMute(userId: number) {
  await modiSchemaReady;
  const result = await db.execute(sql`
    SELECT reason, expires_at AS "expiresAt"
    FROM bans
    WHERE user_id = ${userId} AND ban_type = 'chat'
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return result.rows[0] as { reason: string; expiresAt: Date | string | null } | undefined;
}
