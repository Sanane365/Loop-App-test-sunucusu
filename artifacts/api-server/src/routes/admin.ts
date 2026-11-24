import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, bansTable, chatMessagesTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { requireAuth, isPrivilegedUser } from "../lib/auth";
import { createModerationReport, moderationSchemaReady } from "../lib/moderation";
import { getModiSettings, modiSchemaReady, startModiTestPoll, updateModiSettings } from "../lib/modiModeration";
import fs   from "fs";
import path from "path";
import multer from "multer";

const WORDS_FILE = path.join(__dirname, "../data/wordle-words.json");
function readAdminWords(): string[] {
  try { return JSON.parse(fs.readFileSync(WORDS_FILE, "utf8")); }
  catch { return []; }
}
function writeAdminWords(words: string[]) {
  fs.mkdirSync(path.dirname(WORDS_FILE), { recursive: true });
  fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2), "utf8");
}

const router = Router();

const banSchemaReady = Promise.all([
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip_address TEXT`),
  db.execute(sql`ALTER TABLE bans ADD COLUMN IF NOT EXISTS ban_type TEXT NOT NULL DEFAULT 'user'`),
]).catch(error => {
  console.error("Ban şeması hazırlanamadı:", error);
  throw error;
});

const modiCommandSchemaReady = (async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modi_admin_commands (
      id serial PRIMARY KEY,
      issued_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      reason text NOT NULL,
      duration_minutes integer,
      ban_type text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE modi_admin_commands ADD COLUMN IF NOT EXISTS ban_type text`);
})().catch(error => {
  console.error("Modi komut geçmişi şeması hazırlanamadı:", error);
  throw error;
});

const bobiSchemaReady = (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_settings (id boolean PRIMARY KEY DEFAULT true, enabled boolean NOT NULL DEFAULT true, spam_window_seconds integer NOT NULL DEFAULT 30, abilities text NOT NULL DEFAULT 'Genel sohbet spamini, yasaklı kelimeleri ve moderasyon raporlarını denetle.', updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`ALTER TABLE bobi_settings ADD COLUMN IF NOT EXISTS abilities text NOT NULL DEFAULT 'Genel sohbet spamini, yasaklı kelimeleri ve moderasyon raporlarını denetle.'`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_words (id serial PRIMARY KEY, word text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_reports (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, source text NOT NULL, message text NOT NULL, matched_word text, confidence text NOT NULL DEFAULT 'high', status text NOT NULL DEFAULT 'open', decided_by integer REFERENCES users(id), decision text, created_at timestamp NOT NULL DEFAULT now(), decided_at timestamp)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS bobi_commands (id serial PRIMARY KEY, issued_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, command text NOT NULL, result text NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
})().catch(error => { console.error("Bobi şeması hazırlanamadı:", error); });

void db.execute(sql`CREATE TABLE IF NOT EXISTS game_settings (game_slug TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'published', updated_at TIMESTAMP NOT NULL DEFAULT NOW())`).catch(() => {});

const decorationDir = path.resolve(import.meta.dirname, "..", "uploads", "decorations");
fs.mkdirSync(decorationDir, { recursive: true });
const decorationUpload = multer({
  dest: decorationDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

const decorationSchemaReady = Promise.all([
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_asset_id INTEGER`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_visible BOOLEAN NOT NULL DEFAULT TRUE`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame_asset_id INTEGER`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame_visible BOOLEAN NOT NULL DEFAULT TRUE`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS emblem_asset_id INTEGER`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS emblem_visible BOOLEAN NOT NULL DEFAULT TRUE`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge text`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_label text`),
  db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame text`),
]);

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || !isPrivilegedUser(req.user)) {
    return res.status(403).json({ error: "Yetersiz yetki" });
  }
  next();
}

type BobiAction = { action: "greet" | "announce"; message?: string };

async function interpretBobiCommand(command: string): Promise<BobiAction | null> {
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: "Sen Bobi'sin. Komutu sadece güvenli eyleme çevir. JSON döndür: greet için {\"action\":\"greet\"}; topluluğa mesaj için {\"action\":\"announce\",\"message\":\"...\"}; diğer tüm istekler için {\"action\":\"none\"}. Mesaj en fazla 1000 karakter olsun. Dosya, veritabanı, işletim sistemi, para, yetki veya kullanıcı banlama işlemlerini yapma." },
          { role: "user", content: command },
        ],
      }),
    });
    if (response.ok) {
      const data = await response.json() as { message?: { content?: string } };
      const parsed = JSON.parse(data.message?.content ?? "null") as Partial<BobiAction> | null;
      if (parsed?.action === "greet") return { action: "greet" };
      if (parsed?.action === "announce" && typeof parsed.message === "string" && parsed.message.trim()) {
        return { action: "announce", message: parsed.message.trim().slice(0, 1000) };
      }
    }
  } catch {
    // Ollama is optional; the deterministic commands below remain available.
  }

  const normalized = command
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/^[,\s]*(bobi|bobiye|bobi'ye)[,\s]*/i, "")
    .trim();

  if (/^(selam|merhaba|merhaba bobi|selam ver|bize selam ver)[!.\s]*$/i.test(normalized)) {
    return { action: "greet" };
  }

  const announceMatch = normalized.match(/^(?:sohbete yaz|genel sohbete yaz|duyuru yap|topluluğa yaz|topluluğa duyur)\s+(.+)/i);
  if (announceMatch?.[1]?.trim()) {
    return { action: "announce", message: announceMatch[1].trim().slice(0, 1000) };
  }

  return null;
}

router.post("/reports", requireAuth, async (req, res) => {
  try {
    await moderationSchemaReady;
    const reportedUserId = Number(req.body?.reportedUserId);
    const reason = String(req.body?.reason || "").trim().slice(0, 120);
    const targetType = String(req.body?.targetType || "user").trim().slice(0, 40);
    const rawTargetId = req.body?.targetId;
    const targetId = rawTargetId === undefined || rawTargetId === null || rawTargetId === ""
      ? null
      : Number(rawTargetId);
    if (!reason || !Number.isSafeInteger(reportedUserId) || reportedUserId <= 0 ||
      reportedUserId === req.user!.id ||
      (targetId !== null && (!Number.isSafeInteger(targetId) || targetId <= 0))) {
      return res.status(400).json({ error: "Şikayet nedeni ve kullanıcı gerekli" });
    }
    const report = await createModerationReport({
      reporterId: req.user!.id,
      reportedUserId,
      targetType: targetType || "user",
      targetId,
      reason,
      details: String(req.body?.details || "").trim().slice(0, 1000) || null,
    });
    return res.status(report.duplicate ? 200 : 201).json({ success: true, ...report });
  } catch (error) {
    console.error("Report create error:", error);
    return res.status(500).json({ error: "Şikayet kaydedilemedi" });
  }
});

router.get("/reports", requireAuth, requireAdmin, async (_req, res) => {
  await moderationSchemaReady;
  const result = await db.execute(sql`SELECT r.id, r.target_type AS "targetType", r.target_id AS "targetId", r.reason, r.details, r.status, r.resolution, r.created_at AS "createdAt", reporter.id AS "reporterId", reporter.username AS "reporterUsername", reporter.display_name AS "reporterDisplayName", reported.id AS "reportedUserId", reported.username AS "reportedUsername", reported.display_name AS "reportedDisplayName", assignee.username AS "assignedUsername" FROM moderation_reports r LEFT JOIN users reporter ON reporter.id = r.reporter_id LEFT JOIN users reported ON reported.id = r.reported_user_id LEFT JOIN users assignee ON assignee.id = r.assigned_to ORDER BY r.created_at DESC LIMIT 200`);
  res.json(result.rows);
});

router.patch("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  await moderationSchemaReady;
  const status = String(req.body?.status || "open");
  if (!["open", "reviewing", "resolved", "dismissed"].includes(status)) return res.status(400).json({ error: "Geçersiz rapor durumu" });
  const result = await db.execute(sql`UPDATE moderation_reports SET status = ${status}, resolution = ${String(req.body?.resolution || "").slice(0, 1000) || null}, assigned_to = ${req.user!.id}, resolved_at = ${["resolved", "dismissed"].includes(status) ? new Date() : null} WHERE id = ${Number(req.params.id)} RETURNING id, status`);
  if (!result.rows.length) return res.status(404).json({ error: "Rapor bulunamadı" });
  return res.json({ success: true, report: result.rows[0] });
});

router.post("/users/:id/warnings", requireAuth, requireAdmin, async (req, res) => {
  await moderationSchemaReady;
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  const severity = String(req.body?.severity || "low");
  if (!reason || !["low", "medium", "high"].includes(severity)) return res.status(400).json({ error: "Uyarı nedeni ve geçerli önem seviyesi gerekli" });
  const result = await db.execute(sql`INSERT INTO moderation_warnings (user_id, issued_by, reason, severity) VALUES (${Number(req.params.id)}, ${req.user!.id}, ${reason}, ${severity}) RETURNING id, created_at AS "createdAt"`);
  return res.status(201).json({ success: true, warning: result.rows[0] });
});

router.get("/warnings", requireAuth, requireAdmin, async (_req, res) => {
  await moderationSchemaReady;
  const parsedDays = Number(_req.query["days"] ?? 0);
  const allowedDays = [0, 1, 3, 7, 30, 90];
  if (!Number.isInteger(parsedDays) || !allowedDays.includes(parsedDays)) {
    return res.status(400).json({ error: "Gün aralığı 1, 3, 7, 30, 90 veya 0 (tümü) olmalı." });
  }
  const result = await db.execute(sql`
    SELECT w.id, w.reason, w.severity, w.source,
      w.created_at AS "createdAt", w.expires_at AS "expiresAt",
      target.id AS "userId", target.username AS "username",
      target.display_name AS "displayName",
      COALESCE(issuer.username, 'Loop sistemi') AS "issuedBy"
    FROM moderation_warnings w
    JOIN users target ON target.id = w.user_id
    LEFT JOIN users issuer ON issuer.id = w.issued_by
    WHERE (${parsedDays} = 0 OR w.created_at >= now() - (${parsedDays} * interval '1 day'))
    ORDER BY w.created_at DESC
    LIMIT 5000
  `);
  return res.json(result.rows);
});

router.get("/modi/commands", requireAuth, requireAdmin, async (_req, res) => {
  await modiCommandSchemaReady;
  const result = await db.execute(sql`
    SELECT c.id, c.action, c.reason, c.duration_minutes AS "durationMinutes",
      c.ban_type AS "banType",
      c.created_at AS "createdAt", target.id AS "userId", target.username,
      target.display_name AS "displayName", issuer.username AS "issuedBy"
    FROM modi_admin_commands c
    LEFT JOIN users target ON target.id = c.target_user_id
    JOIN users issuer ON issuer.id = c.issued_by
    ORDER BY c.created_at DESC
    LIMIT 100
  `);
  return res.json(result.rows);
});

router.post("/modi/commands", requireAuth, requireAdmin, async (req, res) => {
  await Promise.all([modiCommandSchemaReady, moderationSchemaReady, banSchemaReady]);
  const username = typeof req.body?.username === "string"
    ? req.body.username.trim().replace(/^@/, "").slice(0, 100)
    : "";
  const action = String(req.body?.action ?? "");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  const allowedActions = ["warn", "mute_chat", "block_dm", "block_account", "unmute_chat", "unblock_dm", "unblock_account"];
  const allowedBanTypes = ["user", "user_ip", "app", "dm", "chat", "spam", "abuse", "content"];
  const requestedBanType = String(req.body?.banType ?? "user");
  const commandBanType = action === "warn" ? null
    : action === "mute_chat" || action === "unmute_chat" ? "chat"
    : action === "block_dm" || action === "unblock_dm" ? "dm"
    : requestedBanType;
  if (!allowedBanTypes.includes(requestedBanType)) {
    return res.status(400).json({ error: "Geçersiz yaptırım türü." });
  }
  if (!username || !allowedActions.includes(action)) {
    return res.status(400).json({ error: "Kullanıcı adı ve geçerli Modi komutu gerekli." });
  }
  if (["warn", "mute_chat", "block_dm", "block_account"].includes(action) && !reason) {
    return res.status(400).json({ error: "Yaptırım için gerekçe yazılmalı." });
  }

  const [target] = await db.select().from(usersTable)
    .where(sql`lower(${usersTable.username}) = ${username.toLocaleLowerCase("tr-TR")}`)
    .limit(1);
  if (!target) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  if (isPrivilegedUser(target)) return res.status(403).json({ error: "Moderatör veya yönetici üzerinde işlem yapılamaz." });
  if (action === "block_account" && requestedBanType === "user_ip" && !target.lastIpAddress) {
    return res.status(400).json({ error: "Kullanıcının kayıtlı son IP adresi bulunamadığı için IP yaptırımı uygulanamadı." });
  }

  const durationMinutes = Number(req.body?.durationMinutes ?? 0);
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 525600) {
    return res.status(400).json({ error: "Süre 0 ile 525600 dakika arasında olmalı." });
  }
  if (action === "mute_chat" && (durationMinutes < 1 || durationMinutes > 43200)) {
    return res.status(400).json({ error: "Sohbet susturma süresi 1 ile 43200 dakika arasında olmalı." });
  }
  if (["block_dm", "block_account"].includes(action) && durationMinutes === 0 && req.body?.permanent !== true) {
    return res.status(400).json({ error: "Süresiz yaptırım için kalıcı işlem onayı gerekli." });
  }
  const severity = ["low", "medium", "high"].includes(req.body?.severity) ? req.body.severity : "medium";
  const expiresAt = durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60_000) : null;

  try {
    await db.transaction(async (tx) => {
      if (action === "warn") {
        await tx.execute(sql`
          INSERT INTO moderation_warnings (user_id, issued_by, reason, severity, source)
          VALUES (${target.id}, ${req.user!.id}, ${reason}, ${severity}, 'admin_modi')
        `);
        await tx.execute(sql`
          INSERT INTO notifications (user_id, type, data)
          VALUES (
            ${target.id},
            'system_warning',
            ${JSON.stringify({
              title: "Moderatör uyarısı",
              message: reason,
              severity,
            })}::jsonb
          )
        `);
      } else if (action === "mute_chat" || action === "block_dm" || action === "block_account") {
        const banType = action === "mute_chat" ? "chat" : action === "block_dm" ? "dm" : requestedBanType;
        const isGlobalBan = !["chat", "dm"].includes(banType);
        if (action === "block_account" && isGlobalBan) {
          const isPermanent = expiresAt === null;
          if (isPermanent) {
            await tx.update(usersTable).set({
              isBanned: true,
              banReason: reason,
              bannedAt: new Date(),
            }).where(eq(usersTable.id, target.id));
          }
        }
        await tx.insert(bansTable).values({
          userId: target.id,
          reason,
          banType,
          ipAddress: banType === "user_ip" ? (target.lastIpAddress || null) : null,
          expiresAt,
          bannedBy: req.user!.id,
        });
      } else {
        const banType = action === "unmute_chat" ? "chat" : action === "unblock_dm" ? "dm" : requestedBanType;
        await tx.delete(bansTable).where(and(eq(bansTable.userId, target.id), eq(bansTable.banType, banType)));
        if (action === "unblock_account" && !["chat", "dm"].includes(banType)) {
          const remaining = await tx.execute(sql`
            SELECT id FROM bans
            WHERE user_id = ${target.id}
              AND ban_type NOT IN ('chat', 'dm')
              AND (expires_at IS NULL OR expires_at > now())
            LIMIT 1
          `);
          if (!remaining.rows.length) {
            await tx.update(usersTable).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(usersTable.id, target.id));
          }
        }
      }

      await tx.execute(sql`
        INSERT INTO modi_admin_commands (issued_by, target_user_id, action, reason, duration_minutes, ban_type)
        VALUES (${req.user!.id}, ${target.id}, ${action}, ${reason || "Yaptırım kaldırıldı."}, ${durationMinutes || null}, ${commandBanType})
      `);
    });
    return res.status(201).json({ success: true, username: target.username, action });
  } catch (error) {
    req.log.error({ err: error, targetUserId: target.id, action }, "Modi moderasyon komutu başarısız oldu.");
    return res.status(500).json({ error: "Modi komutu uygulanamadı." });
  }
});

router.get("/warned-users", requireAuth, requireAdmin, async (_req, res) => {
  await moderationSchemaReady;
  const result = await db.execute(sql`
    SELECT
      target.id AS "userId",
      target.username,
      target.display_name AS "displayName",
      count(w.id)::integer AS "warningCount",
      max(w.created_at) AS "lastWarningAt",
      (array_agg(w.reason ORDER BY w.created_at DESC))[1] AS "latestReason",
      (array_agg(w.severity ORDER BY w.created_at DESC))[1] AS "latestSeverity",
      (array_agg(w.source ORDER BY w.created_at DESC))[1] AS "latestSource"
    FROM moderation_warnings w
    JOIN users target ON target.id = w.user_id
    GROUP BY target.id, target.username, target.display_name
    ORDER BY max(w.created_at) DESC
    LIMIT 200
  `);
  return res.json(result.rows);
});

router.get("/bobi", requireAuth, requireAdmin, async (_req, res) => {
  await bobiSchemaReady;
  const [settings, words, reports] = await Promise.all([
    db.execute(sql`SELECT enabled, spam_window_seconds AS "spamWindowSeconds", abilities FROM bobi_settings WHERE id = true`),
    db.execute(sql`SELECT id, word, created_at AS "createdAt" FROM bobi_words ORDER BY word`),
    db.execute(sql`SELECT r.id, r.source, r.message, r.matched_word AS "matchedWord", r.confidence, r.status, r.decision, r.created_at AS "createdAt", u.id AS "userId", u.username, u.display_name AS "displayName" FROM bobi_reports r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 200`),
  ]);
  res.json({ settings: settings.rows[0] ?? { enabled: true, spamWindowSeconds: 30 }, words: words.rows, reports: reports.rows });
});

router.get("/modi", requireAuth, requireAdmin, async (_req, res) => {
  await modiSchemaReady;
  const [settings, words, polls] = await Promise.all([
    getModiSettings(),
    db.execute(sql`SELECT id, word, created_at AS "createdAt" FROM modi_words ORDER BY word`),
    db.execute(sql`
      SELECT p.id, u.username AS "targetUsername", p.ends_at AS "endsAt",
        p.required_votes AS "pollMinVotes",
        p.mute_minutes AS "muteMinutes",
        p.is_test AS "isTest",
        count(v.id)::integer AS "voteCount",
        count(v.id) FILTER (WHERE v.vote_yes)::integer AS "yesCount",
        count(v.id) FILTER (WHERE NOT v.vote_yes)::integer AS "noCount"
      FROM modi_chat_polls p
      JOIN users u ON u.id = p.target_user_id
      LEFT JOIN modi_chat_votes v ON v.poll_id = p.id
      WHERE p.status = 'open' AND p.ends_at > now()
      GROUP BY p.id, u.username
      ORDER BY p.created_at
    `),
  ]);
  res.json({ settings, words: words.rows, polls: polls.rows });
});

router.post("/modi/polls/test", requireAuth, requireAdmin, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().slice(0, 100) : "";
  if (!username) {
    res.status(400).json({ error: "Test oylaması için kullanıcı adı gerekli." });
    return;
  }

  try {
    await modiSchemaReady;
    const result = await startModiTestPoll(username);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    req.log.error({ err: error }, "Modi test oylaması başlatılamadı.");
    res.status(500).json({ error: "Test oylaması başlatılamadı." });
  }
});

router.patch("/modi/settings", requireAuth, requireAdmin, async (req, res) => {
  const numericSettings = ["reportThreshold", "pollMinVotes", "pollDurationSeconds", "muteMinutes", "warningLimit", "spamWindowSeconds"] as const;
  for (const key of numericSettings) {
    if (req.body?.[key] !== undefined && !Number.isFinite(Number(req.body[key]))) {
      res.status(400).json({ error: `${key} değeri sayısal olmalı.` });
      return;
    }
  }
  if (req.body?.enabled !== undefined && typeof req.body.enabled !== "boolean") {
    res.status(400).json({ error: "Modi etkinlik değeri geçersiz." });
    return;
  }
  const settings = await updateModiSettings({
    ...(typeof req.body?.enabled === "boolean" ? { enabled: req.body.enabled } : {}),
    ...(req.body?.reportThreshold !== undefined ? { reportThreshold: Number(req.body.reportThreshold) } : {}),
    ...(req.body?.pollMinVotes !== undefined ? { pollMinVotes: Number(req.body.pollMinVotes) } : {}),
    ...(req.body?.pollDurationSeconds !== undefined ? { pollDurationSeconds: Number(req.body.pollDurationSeconds) } : {}),
    ...(req.body?.muteMinutes !== undefined ? { muteMinutes: Number(req.body.muteMinutes) } : {}),
    ...(req.body?.warningLimit !== undefined ? { warningLimit: Number(req.body.warningLimit) } : {}),
    ...(req.body?.spamWindowSeconds !== undefined ? { spamWindowSeconds: Number(req.body.spamWindowSeconds) } : {}),
  });
  res.json(settings);
});

router.post("/modi/words", requireAuth, requireAdmin, async (req, res) => {
  await modiSchemaReady;
  const word = typeof req.body?.word === "string"
    ? req.body.word.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").slice(0, 80)
    : "";
  if (!word) {
    res.status(400).json({ error: "Yasaklı kelime gerekli." });
    return;
  }
  await db.execute(sql`INSERT INTO modi_words (word) VALUES (${word}) ON CONFLICT (word) DO NOTHING`);
  res.status(201).json({ word });
});

router.delete("/modi/words/:id", requireAuth, requireAdmin, async (req, res) => {
  await modiSchemaReady;
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Kelime numarası geçersiz." });
    return;
  }
  await db.execute(sql`DELETE FROM modi_words WHERE id = ${id}`);
  res.json({ success: true });
});

router.patch("/bobi/settings", requireAuth, requireAdmin, async (req, res) => {
  await bobiSchemaReady;
  const enabled = req.body?.enabled !== false;
  const spamWindowSeconds = Math.min(300, Math.max(10, Number(req.body?.spamWindowSeconds ?? 30)));
  const abilities = String(req.body?.abilities ?? "").trim().slice(0, 2000);
  await db.execute(sql`INSERT INTO bobi_settings (id, enabled, spam_window_seconds, abilities) VALUES (true, ${enabled}, ${spamWindowSeconds}, ${abilities}) ON CONFLICT (id) DO UPDATE SET enabled = ${enabled}, spam_window_seconds = ${spamWindowSeconds}, abilities = ${abilities}, updated_at = now()`);
  res.json({ enabled, spamWindowSeconds, abilities });
});

router.post("/bobi/commands", requireAuth, async (req, res) => {
  await bobiSchemaReady;
  const isBobiAdmin = req.user!.role === "admin" || ["copoglumihammetyasin@gmail.com", "copogluhakki@gmail.com", "tabiiisanane@gmail.com"].includes(req.user!.email.toLowerCase()) || ["mami", "mami denemee"].includes(req.user!.username.toLowerCase());
  if (!isBobiAdmin) return res.status(403).json({ error: "Bobi görevlerini yalnızca admin çalıştırabilir" });
  const command = String(req.body?.command ?? "").trim().slice(0, 500);
  if (!command) return res.status(400).json({ error: "Bobi komutu gerekli" });
  const action = await interpretBobiCommand(command);
  let message = "";
  if (action?.action === "greet") {
    message = "Selam! Ben Bobi. Genel sohbette moderasyona yardımcı olmak için buradayım.";
  } else if (action?.action === "announce") {
    message = action.message!;
  } else {
    return res.status(400).json({ error: "Bu görev henüz öğretilmedi. Örnek: Bobi selam ver; Bobi sohbete yaz Merhaba; Bobi duyuru yap Kurallar güncellendi." });
  }
  const bot = await db.execute(sql`SELECT id FROM users WHERE username = 'bobi' LIMIT 1`);
  if (!bot.rows[0]?.id) return res.status(500).json({ error: "Bobi kullanıcısı hazır değil" });
  await db.insert(chatMessagesTable).values({ userId: Number(bot.rows[0].id), type: "bobi", content: message });
  await db.execute(sql`INSERT INTO bobi_commands (issued_by, command, result) VALUES (${req.user!.id}, ${command}, ${message})`);
  res.status(201).json({ success: true, message });
});

router.post("/bobi/words", requireAuth, requireAdmin, async (req, res) => {
  await bobiSchemaReady;
  const word = String(req.body?.word ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 80);
  if (!word) return res.status(400).json({ error: "Kelime gerekli" });
  await db.execute(sql`INSERT INTO bobi_words (word) VALUES (${word}) ON CONFLICT (word) DO NOTHING`);
  res.status(201).json({ word });
});

router.post("/bobi/reports", requireAuth, requireAdmin, async (req, res) => {
  await bobiSchemaReady;
  const userId = Number(req.body?.userId);
  const message = String(req.body?.message ?? "").trim().slice(0, 1000);
  const source = req.body?.source === "dm" ? "dm" : "chat";
  if (!Number.isInteger(userId) || userId <= 0 || !message) return res.status(400).json({ error: "Kullanıcı ve mesaj gerekli" });
  const result = await db.execute(sql`INSERT INTO bobi_reports (user_id, source, message, confidence, status) VALUES (${userId}, ${source}, ${message}, 'low', 'open') RETURNING id`);
  res.status(201).json({ success: true, reportId: result.rows[0]?.id });
});

router.delete("/bobi/words/:id", requireAuth, requireAdmin, async (req, res) => {
  await bobiSchemaReady;
  await db.execute(sql`DELETE FROM bobi_words WHERE id = ${Number(req.params.id)}`);
  res.json({ success: true });
});

router.patch("/bobi/reports/:id", requireAuth, async (req, res) => {
  await bobiSchemaReady;
  const isBobiAdmin = req.user!.role === "admin" || ["copoglumihammetyasin@gmail.com", "copogluhakki@gmail.com", "tabiiisanane@gmail.com"].includes(req.user!.email.toLowerCase()) || ["mami", "mami denemee"].includes(req.user!.username.toLowerCase());
  if (!isBobiAdmin) return res.status(403).json({ error: "Bobi raporlarında nihai kararı yalnızca admin verebilir" });
  const decision = String(req.body?.decision ?? "");
  if (!["mute", "dismiss"].includes(decision)) return res.status(400).json({ error: "Geçersiz karar" });
  const report = await db.execute(sql`SELECT user_id AS "userId", source, message FROM bobi_reports WHERE id = ${Number(req.params.id)} AND status = 'open' LIMIT 1`);
  const item = report.rows[0];
  if (!item) return res.status(404).json({ error: "Açık rapor bulunamadı" });
  if (decision === "mute") {
    await db.execute(sql`INSERT INTO bans (user_id, reason, ban_type, banned_by, expires_at) VALUES (${Number(item.userId)}, 'Bobi raporu: admin kararı', ${String(item.source) === "dm" ? "dm" : "chat"}, ${req.user!.id}, ${new Date(Date.now() + 5 * 60 * 1000)})`);
  }
  await db.execute(sql`UPDATE bobi_reports SET status = 'resolved', decision = ${decision}, decided_by = ${req.user!.id}, decided_at = now() WHERE id = ${Number(req.params.id)}`);
  res.json({ success: true, decision });
});

router.get("/games/xox", requireAuth, requireAdmin, async (_req, res) => {
  const result = await db.execute(sql`SELECT status FROM game_settings WHERE game_slug = 'xox' LIMIT 1`);
  res.json({ status: String(result.rows[0]?.status ?? "published") });
});

router.patch("/games/xox", requireAuth, requireAdmin, async (req, res) => {
  const allowed = ["published", "coming_soon", "draft", "closed"];
  const status = String(req.body?.status ?? "");
  if (!allowed.includes(status)) return res.status(400).json({ error: "Geçersiz XOX durumu" });
  const result = await db.execute(sql`INSERT INTO game_settings (game_slug, status) VALUES ('xox', ${status}) ON CONFLICT (game_slug) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW() RETURNING status`);
  res.json({ status: result.rows[0]?.status });
});

// GET /admin/users
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    await decorationSchemaReady;
    const q = req.query["q"] as string | undefined;
    const role = req.query["role"] as string | undefined;
    const banned = req.query["banned"];

    let query = db.select().from(usersTable).$dynamic();

    if (q) {
      query = query.where(ilike(usersTable.username, `%${q}%`));
    }
    if (role && role !== "all") {
      query = query.where(eq(usersTable.role, role));
    }
    if (banned === "true") {
      query = query.where(eq(usersTable.isBanned, true));
    } else if (banned === "false") {
      query = query.where(eq(usersTable.isBanned, false));
    }

    const users = await query.limit(100);
    // Get ban info for banned users
    const enriched = await Promise.all(users.map(async (u) => {
      const [ban] = await db.select().from(bansTable).where(eq(bansTable.userId, u.id)).limit(1);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        isBanned: u.isBanned,
        banReason: ban?.reason ?? null,
        banExpiresAt: ban?.expiresAt?.toISOString() ?? null,
        bannedAt: u.bannedAt?.toISOString() ?? null,
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
        avatarUrl: u.avatarUrl,
        badge: u.badge,
        badgeLabel: u.badgeLabel,
        avatarFrame: u.avatarFrame,
        badgeAssetId: u.badgeAssetId,
        emblemAssetId: u.emblemAssetId,
        avatarFrameAssetId: u.avatarFrameAssetId,
        lastIpAddress: u.lastIpAddress,
        createdAt: u.createdAt.toISOString(),
      };
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.patch("/users/:id/decorations", requireAuth, requireAdmin, async (req, res) => {
  try {
    await decorationSchemaReady;
    const badge = typeof req.body?.badge === "string" && ["verified", "official", "writer", "star", "none"].includes(req.body.badge) ? req.body.badge : null;
    const badgeLabel = typeof req.body?.badgeLabel === "string" ? req.body.badgeLabel.trim().slice(0, 40) || null : null;
    const avatarFrame = typeof req.body?.avatarFrame === "string" && ["violet", "gold", "cyan", "rose", "none"].includes(req.body.avatarFrame) ? req.body.avatarFrame : null;
    const [updated] = await db.update(usersTable).set({ badge: badge === "none" ? null : badge, badgeLabel, avatarFrame: avatarFrame === "none" ? null : avatarFrame, badgeAssetId: req.body?.badgeAssetId ? Number(req.body.badgeAssetId) : null, emblemAssetId: req.body?.emblemAssetId ? Number(req.body.emblemAssetId) : null, avatarFrameAssetId: req.body?.avatarFrameAssetId ? Number(req.body.avatarFrameAssetId) : null, badgeVisible: true, emblemVisible: true, avatarFrameVisible: true }).where(eq(usersTable.id, parseInt(req.params["id"] as string))).returning();
    if (!updated) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    res.json({ badge: updated.badge, badgeLabel: updated.badgeLabel, avatarFrame: updated.avatarFrame });
  } catch (error) {
    console.error("Admin decoration error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/decoration-assets", requireAuth, requireAdmin, async (_req, res) => {
  await decorationSchemaReady;
  const [badges, frames, emblems] = await Promise.all([
    db.execute(sql`SELECT id, name, image_url AS "imageUrl", published FROM badge_assets ORDER BY id DESC`),
    db.execute(sql`SELECT id, name, image_url AS "imageUrl", published FROM frame_assets ORDER BY id DESC`),
    db.execute(sql`SELECT id, name, image_url AS "imageUrl", published FROM emblem_assets ORDER BY id DESC`),
  ]);
  res.json({ badges: badges.rows, frames: frames.rows, emblems: emblems.rows });
});

router.post("/decoration-assets", requireAuth, requireAdmin, decorationUpload.single("image"), async (req, res) => {
  if (!req.file || !["badge", "frame", "emblem"].includes(String(req.body?.kind))) return res.status(400).json({ error: "Görsel ve tür gerekli" });
  const kind = String(req.body.kind);
  const imageUrl = `/api/uploads/decorations/${path.basename(req.file.path)}`;
  const table = kind === "badge" ? "badge_assets" : kind === "frame" ? "frame_assets" : "emblem_assets";
  const name = String(req.body.name || "Yeni varlık").slice(0, 60);
  const result = await db.execute(sql`INSERT INTO ${sql.raw(table)} (name, image_url) VALUES (${name}, ${imageUrl}) RETURNING id, name, image_url AS "imageUrl", published`);
  res.status(201).json(result.rows[0]);
});

router.post("/users/:id/avatar", requireAuth, requireAdmin, decorationUpload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Profil görseli gerekli" });
  const avatarUrl = `/api/uploads/decorations/${path.basename(req.file.path)}`;
  const [updated] = await db.update(usersTable)
    .set({ avatarUrl })
    .where(eq(usersTable.id, Number(req.params.id)))
    .returning({ id: usersTable.id, avatarUrl: usersTable.avatarUrl });
  if (!updated) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  res.json(updated);
});

router.patch("/decoration-assets/:kind/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  const table = req.params.kind === "badge" ? "badge_assets" : req.params.kind === "frame" ? "frame_assets" : req.params.kind === "emblem" ? "emblem_assets" : null;
  if (!table) return res.status(400).json({ error: "Geçersiz tür" });
  const id = Number(req.params.id);
  const result = await db.execute(sql`UPDATE ${sql.raw(table)} SET published = NOT published WHERE id = ${id} RETURNING id, name, image_url AS "imageUrl", published`);
  if (!result.rows.length) return res.status(404).json({ error: "Varlık bulunamadı" });
  res.json(result.rows[0]);
});

router.delete("/decoration-assets/:kind/:id", requireAuth, requireAdmin, async (req, res) => {
  const table = req.params.kind === "badge" ? "badge_assets" : req.params.kind === "frame" ? "frame_assets" : req.params.kind === "emblem" ? "emblem_assets" : null;
  if (!table) return res.status(400).json({ error: "Geçersiz tür" });
  const column = req.params.kind === "badge" ? "badge_asset_id" : req.params.kind === "emblem" ? "emblem_asset_id" : "avatar_frame_asset_id";
  const id = Number(req.params.id);
  await db.execute(sql`UPDATE users SET ${sql.raw(column)} = NULL WHERE ${sql.raw(column)} = ${id}`);
  const result = await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE id = ${id} RETURNING image_url`);
  if (!result.rows.length) return res.status(404).json({ error: "Varlık bulunamadı" });
  const imageUrl = String(result.rows[0].image_url ?? "");
  if (imageUrl.startsWith("/api/uploads/decorations/")) {
    fs.rm(path.join(decorationDir, path.basename(imageUrl)), { force: true }, () => {});
  }
  res.json({ ok: true });
});

// PATCH /admin/users/:id/role
router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    const { role } = req.body;
    if (!["user", "moderator", "admin", "brand"].includes(role)) {
      res.status(400).json({ error: "Geçersiz rol" }); return;
    }
    // Privileged usernames/emails are allowed to manage admin roles as well.
    if (role === "admin" && !isPrivilegedUser(req.user!)) {
      res.status(403).json({ error: "Sadece yetkili yöneticiler admin rolü atayabilir" }); return;
    }
    const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, targetId)).returning();
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Admin role change error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/users/:id/ban
router.post("/users/:id/ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    await banSchemaReady;
    const targetId = parseInt(req.params["id"] as string);
    const { reason, ipAddress } = req.body;
    const allowedBanTypes = ["user", "user_ip", "app", "dm", "chat", "spam", "abuse", "content"];
    const banType = String(req.body?.banType || (ipAddress ? "user_ip" : "user"));
    if (!allowedBanTypes.includes(banType)) { res.status(400).json({ error: "Geçersiz yasak türü" }); return; }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
    if (isPrivilegedUser(target)) { res.status(403).json({ error: "Admin veya moderatör yasaklanamaz" }); return; }

    const durationDays = Number(req.body?.durationDays);
    const expiresAt = Number.isFinite(durationDays) && durationDays > 0
      ? new Date(Date.now() + durationDays * 86400000)
      : null;
    const blocksApp = ["user", "user_ip", "app"].includes(banType);
    await db.update(usersTable).set({ isBanned: blocksApp, banReason: reason, bannedAt: blocksApp ? new Date() : null }).where(eq(usersTable.id, targetId));
    await db.insert(bansTable).values({ userId: targetId, reason, ipAddress: ipAddress || null, banType, expiresAt, bannedBy: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Admin ban error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/users/:id/unban
router.post("/users/:id/unban", requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params["id"] as string);
    await db.update(usersTable).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(usersTable.id, targetId));
    await db.delete(bansTable).where(eq(bansTable.userId, targetId));
    res.json({ success: true });
  } catch (error) {
    console.error("Admin unban error:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /admin/bans
router.get("/bans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const bans = await db.select().from(bansTable).limit(100);
    const enriched = await Promise.all(bans.map(async (b) => {
      const [user] = b.userId ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, b.userId)).limit(1) : [null];
      const [banner] = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, b.bannedBy)).limit(1);
      return {
        id: b.id,
        user: user ?? null,
        ipAddress: b.ipAddress,
        banType: b.banType,
        reason: b.reason,
        bannedBy: banner ?? null,
        expiresAt: b.expiresAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// DELETE /admin/bans/:id
router.delete("/bans/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const banId = parseInt(req.params["id"] as string);
    const [ban] = await db.select().from(bansTable).where(eq(bansTable.id, banId)).limit(1);
    await db.delete(bansTable).where(eq(bansTable.id, banId));
    if (ban?.userId) {
      const remainingGlobalBan = await db.select({ id: bansTable.id }).from(bansTable).where(and(
        eq(bansTable.userId, ban.userId),
        sql`${bansTable.banType} NOT IN ('dm', 'chat')`,
        or(isNull(bansTable.expiresAt), gt(bansTable.expiresAt, new Date())),
      )).limit(1);
      if (remainingGlobalBan.length === 0) {
        await db.update(usersTable).set({ isBanned: false, banReason: null, bannedAt: null }).where(eq(usersTable.id, ban.userId));
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /admin/ip-ban
router.post("/ip-ban", requireAuth, requireAdmin, async (req, res) => {
  try {
    await banSchemaReady;
    const { ipAddress, reason } = req.body;
    if (!ipAddress) { res.status(400).json({ error: "IP adresi gerekli" }); return; }
    const allowedBanTypes = ["ip", "dm", "chat", "spam", "abuse"];
    const banType = String(req.body?.banType || "ip");
    if (!allowedBanTypes.includes(banType)) { res.status(400).json({ error: "Geçersiz IP yasak türü" }); return; }
    const durationDays = Number(req.body?.durationDays);
    const expiresAt = Number.isFinite(durationDays) && durationDays > 0
      ? new Date(Date.now() + durationDays * 86400000)
      : null;
    await db.insert(bansTable).values({ ipAddress, reason, banType, expiresAt, bannedBy: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* ── GET /admin/wordle-words ─────────────────────────────────────────── */
router.get("/wordle-words", requireAuth, requireAdmin, (_req, res) => {
  res.json(readAdminWords());
});

/* ── POST /admin/wordle-words ────────────────────────────────────────── */
router.post("/wordle-words", requireAuth, requireAdmin, (req, res) => {
  const { word } = req.body as { word?: string };
  if (!word || word.trim().length !== 5) {
    res.status(400).json({ error: "Kelime tam 5 harf olmalı" }); return;
  }
  const upper = word.trim().toUpperCase();
  const words = readAdminWords();
  if (words.includes(upper)) {
    res.status(409).json({ error: "Bu kelime zaten listede" }); return;
  }
  words.push(upper);
  writeAdminWords(words);
  res.json({ success: true, word: upper, total: words.length });
});

/* ── DELETE /admin/wordle-words/:word ────────────────────────────────── */
router.delete("/wordle-words/:word", requireAuth, requireAdmin, (req, res) => {
  const upper = req.params["word"].toUpperCase();
  const words = readAdminWords();
  const next  = words.filter((w: string) => w !== upper);
  if (next.length === words.length) {
    res.status(404).json({ error: "Kelime bulunamadı" }); return;
  }
  writeAdminWords(next);
  res.json({ success: true });
});

export default router;
