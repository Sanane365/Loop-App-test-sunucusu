/**
 * Oyun skoru API'si
 *
 * GET  /api/games/records?gameSlug=wordle&otherUserId=123
 *      → { my: ScoreRow | null, other: ScoreRow | null }
 *
 * POST /api/games/records
 *      body: { gameSlug, won, attempts }
 *      → güncel skor satırı
 */

import { Router } from "express";
import { db }     from "@workspace/db";
import { gameScoresTable, notificationsTable, directMessagesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import fs   from "fs";
import path from "path";

/* ── Wordle kelime listesi (disk ↔ memory) ───────────────────────────── */
const WORDS_FILE = path.join(__dirname, "../data/wordle-words.json");

function readAdminWords(): string[] {
  try { return JSON.parse(fs.readFileSync(WORDS_FILE, "utf8")); }
  catch { return []; }
}
function writeAdminWords(words: string[]) {
  fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2), "utf8");
}

const router = Router();

/* ── Tablo yoksa oluştur ─────────────────────────────────────────────── */
export async function ensureGameScoresTable(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_slug       TEXT NOT NULL,
        wins            INTEGER NOT NULL DEFAULT 0,
        losses          INTEGER NOT NULL DEFAULT 0,
        games_played    INTEGER NOT NULL DEFAULT 0,
        current_streak  INTEGER NOT NULL DEFAULT 0,
        best_streak     INTEGER NOT NULL DEFAULT 0,
        last_played_date TEXT,
        last_result      TEXT,
        last_attempts    INTEGER,
        created_at      TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[games] game_scores tablosu hazır.");
  } catch (err) {
    console.error("[games] Tablo oluşturma hatası:", err);
  }
}

async function ensureXoxGamesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS xox_games (
        id            SERIAL PRIMARY KEY,
        player_x_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player_o_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board         JSONB NOT NULL DEFAULT '["","","","","","","","",""]'::jsonb,
        current_turn  TEXT NOT NULL DEFAULT 'X',
        status        TEXT NOT NULL DEFAULT 'playing',
        winner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at    TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[games] xox_games tablosu hazır.");
  } catch (err) {
    console.error("[games] XOX tablo hatası:", err);
  }
}

const ensureGameSettingsTable = db.execute(sql`CREATE TABLE IF NOT EXISTS game_settings (game_slug TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'published', updated_at TIMESTAMP NOT NULL DEFAULT NOW())`).catch(() => undefined);

async function getXoxStatus(): Promise<string> {
  await ensureGameSettingsTable;
  const result = await db.execute(sql`SELECT status FROM game_settings WHERE game_slug = 'xox' LIMIT 1`);
  return String(result.rows[0]?.status ?? "published");
}

async function requireXoxEnabled(res: any): Promise<boolean> {
  const status = await getXoxStatus();
  if (status === "closed") {
    res.status(403).json({ error: "XOX şu anda kapalı" });
    return false;
  }
  return true;
}

ensureXoxGamesTable();

type XoxGame = {
  id: number;
  player_x_id: number;
  player_o_id: number;
  board: string[];
  current_turn: "X" | "O";
  status: "playing" | "won" | "draw";
  winner_id: number | null;
};

function getXoxWinner(board: string[]): "X" | "O" | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  return null;
}

function canJoinXoxGame(game: XoxGame, userId: number): boolean {
  return game.player_x_id === userId || game.player_o_id === userId;
}

/* ── XOX ──────────────────────────────────────────────────────────────── */
router.get("/games/xox/status", async (_req, res) => {
  res.json({ status: await getXoxStatus() });
});

router.post("/games/xox/invites", requireAuth, async (req, res) => {
  if (!(await requireXoxEnabled(res))) return;
  const userId = req.user!.id;
  const opponentId = Number(req.body?.opponentId);
  if (!Number.isInteger(opponentId) || opponentId <= 0 || opponentId === userId) {
    res.status(400).json({ error: "Geçerli bir rakip gerekli" });
    return;
  }
  const pending = await db.execute(sql`
    SELECT id FROM notifications
    WHERE user_id = ${opponentId} AND from_user_id = ${userId}
      AND type = 'game_invite' AND data->>'game' = 'xox' AND data->>'status' = 'pending'
    ORDER BY id DESC LIMIT 1
  `);
  if (pending.rows[0]?.id) {
    const inviteId = Number(pending.rows[0].id);
    const existingMessage = await db.execute(sql`
      SELECT id FROM direct_messages
      WHERE sender_id = ${userId} AND receiver_id = ${opponentId}
        AND content = ${`__LOOP_GAME_INVITE__:xox:${inviteId}`}
      LIMIT 1
    `);
    if (!existingMessage.rows.length) {
      await db.insert(directMessagesTable).values({
        senderId: userId,
        receiverId: opponentId,
        content: `__LOOP_GAME_INVITE__:xox:${inviteId}`,
      });
    }
    res.json({ inviteId });
    return;
  }
  const [invite] = await db.insert(notificationsTable as any).values({
    userId: opponentId,
    fromUserId: userId,
    type: "game_invite",
    data: { game: "xox", status: "pending" },
  }).returning();
  await db.insert(directMessagesTable).values({
    senderId: userId,
    receiverId: opponentId,
    content: `__LOOP_GAME_INVITE__:xox:${invite.id}`,
  });
  res.json({ inviteId: invite.id });
});

router.get("/games/xox/invites/:inviteId", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const inviteId = Number(req.params.inviteId);
  const [invite] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, inviteId)).limit(1);
  const data = ((invite as any)?.data ?? {}) as { game?: string; status?: string; gameId?: number };
  if (!invite || invite.fromUserId !== userId || data.game !== "xox") {
    res.status(404).json({ error: "Davet bulunamadı" });
    return;
  }
  res.json({ status: data.status, gameId: data.gameId ?? null });
});

router.post("/games/xox/invites/:inviteId/respond", requireAuth, async (req, res) => {
  if (!(await requireXoxEnabled(res))) return;
  const userId = req.user!.id;
  const inviteId = Number(req.params.inviteId);
  const response = req.body?.response === "accepted" ? "accepted" : req.body?.response === "rejected" ? "rejected" : null;
  if (!response) {
    res.status(400).json({ error: "Geçersiz davet yanıtı" });
    return;
  }
  const [invite] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, inviteId)).limit(1);
  const data = ((invite as any)?.data ?? {}) as { game?: string; status?: string; gameId?: number };
  if (!invite || invite.userId !== userId || invite.type !== "game_invite" || data.game !== "xox") {
    res.status(404).json({ error: "Davet bulunamadı" });
    return;
  }
  if (data.status !== "pending") {
    res.status(409).json({ error: "Bu davet daha önce yanıtlandı" });
    return;
  }

  let gameId: number | null = null;
  if (response === "accepted") {
    const [game] = (await db.execute(sql`
      INSERT INTO xox_games (player_x_id, player_o_id)
      VALUES (${userId}, ${invite.fromUserId})
      RETURNING id
    `)).rows as Array<{ id: number }>;
    gameId = game.id;
  }
  await db.update(notificationsTable as any).set({
    data: { game: "xox", status: response, gameId },
    isRead: true,
  }).where(eq(notificationsTable.id, inviteId));
  if (invite.fromUserId) {
    await db.insert(notificationsTable as any).values({
      userId: invite.fromUserId,
      fromUserId: userId,
      type: response === "accepted" ? "game_invite_accepted" : "game_invite_rejected",
      data: { game: "xox", status: response, gameId },
    });
  }
  res.json({ status: response, gameId });
});

router.post("/games/xox", requireAuth, async (req, res) => {
  if (!(await requireXoxEnabled(res))) return;
  const userId = req.user!.id;
  const opponentId = Number(req.body?.opponentId);
  if (!Number.isInteger(opponentId) || opponentId <= 0 || opponentId === userId) {
    res.status(400).json({ error: "Geçerli bir rakip gerekli" });
    return;
  }

  const existing = await db.execute(sql`
    SELECT * FROM xox_games
    WHERE status = 'playing'
      AND ((player_x_id = ${userId} AND player_o_id = ${opponentId})
        OR (player_x_id = ${opponentId} AND player_o_id = ${userId}))
    ORDER BY id DESC
    LIMIT 1
  `);
  const game = (existing.rows[0] as XoxGame | undefined) ?? (await db.execute(sql`
    INSERT INTO xox_games (player_x_id, player_o_id)
    VALUES (${userId}, ${opponentId})
    RETURNING *
  `)).rows[0] as XoxGame;
  res.json({ game });
});

router.get("/games/xox/:gameId", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const gameId = Number(req.params.gameId);
  const result = await db.execute(sql`SELECT * FROM xox_games WHERE id = ${gameId} LIMIT 1`);
  const game = result.rows[0] as XoxGame | undefined;
  if (!game || !canJoinXoxGame(game, userId)) {
    res.status(404).json({ error: "Oyun bulunamadı" });
    return;
  }
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ game });
});

router.post("/games/xox/:gameId/cancel", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const gameId = Number(req.params.gameId);
  const result = await db.execute(sql`SELECT * FROM xox_games WHERE id = ${gameId} LIMIT 1`);
  const game = result.rows[0] as XoxGame | undefined;
  if (!game || !canJoinXoxGame(game, userId)) {
    res.status(404).json({ error: "Oyun bulunamadı" });
    return;
  }
  if (game.status !== "playing") {
    res.json({ game });
    return;
  }
  const updated = await db.execute(sql`
    UPDATE xox_games SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${gameId} AND status = 'playing'
    RETURNING *
  `);
  res.json({ game: updated.rows[0] ?? game });
});

router.post("/games/xox/:gameId/move", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const gameId = Number(req.params.gameId);
  const position = Number(req.body?.position);
  const result = await db.execute(sql`SELECT * FROM xox_games WHERE id = ${gameId} LIMIT 1`);
  const game = result.rows[0] as XoxGame | undefined;
  if (!game || !canJoinXoxGame(game, userId)) {
    res.status(404).json({ error: "Oyun bulunamadı" });
    return;
  }
  const mark = game.player_x_id === userId ? "X" : "O";
  if (game.status !== "playing") {
    res.status(409).json({ error: "Oyun sona erdi", game });
    return;
  }
  if (game.current_turn !== mark || !Number.isInteger(position) || position < 0 || position > 8 || game.board[position]) {
    res.status(409).json({ error: "Bu hamle şu anda yapılamaz", game });
    return;
  }

  const board = [...game.board];
  board[position] = mark;
  const winner = getXoxWinner(board);
  const status = winner ? "won" : board.every(Boolean) ? "draw" : "playing";
  const winnerId = winner ? (winner === "X" ? game.player_x_id : game.player_o_id) : null;
  const updated = await db.execute(sql`
    UPDATE xox_games
    SET board = ${JSON.stringify(board)}::jsonb,
        current_turn = ${mark === "X" ? "O" : "X"},
        status = ${status},
        winner_id = ${winnerId},
        updated_at = NOW()
    WHERE id = ${gameId}
      AND status = 'playing'
      AND current_turn = ${mark}
      AND board->>${String(position)} = ''
    RETURNING *
  `);
  if (!updated.rows.length) {
    res.status(409).json({ error: "Hamle güncelliğini kaybetti, tahtayı yenile", game });
    return;
  }
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ game: updated.rows[0] });
});

/* ── GET /api/games/records ──────────────────────────────────────────── */
router.get("/games/records", requireAuth, async (req, res) => {
  const myId        = (req as any).session?.userId as number;
  const gameSlug    = (req.query.gameSlug as string) || "wordle";
  const otherUserId = req.query.otherUserId ? parseInt(req.query.otherUserId as string, 10) : null;

  const fetchScore = async (uid: number) => {
    const [row] = await db
      .select()
      .from(gameScoresTable)
      .where(and(eq(gameScoresTable.userId, uid), eq(gameScoresTable.gameSlug, gameSlug)))
      .limit(1);
    return row ?? null;
  };

  const [my, other] = await Promise.all([
    fetchScore(myId),
    otherUserId ? fetchScore(otherUserId) : Promise.resolve(null),
  ]);

  res.json({ my, other });
});

/* ── POST /api/games/records ─────────────────────────────────────────── */
router.post("/games/records", requireAuth, async (req, res) => {
  const myId     = (req as any).session?.userId as number;
  const { gameSlug = "wordle", won, attempts } = req.body as {
    gameSlug?: string; won: boolean; attempts: number;
  };

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // Mevcut satırı çek
  const [existing] = await db
    .select()
    .from(gameScoresTable)
    .where(and(eq(gameScoresTable.userId, myId), eq(gameScoresTable.gameSlug, gameSlug)))
    .limit(1);

  // Aynı gün zaten kayıt varsa güncelleme
  if (existing?.lastPlayedDate === today) {
    res.json(existing);
    return;
  }

  const newWins          = (existing?.wins          ?? 0) + (won ? 1 : 0);
  const newLosses        = (existing?.losses        ?? 0) + (won ? 0 : 1);
  const newPlayed        = (existing?.gamesPlayed   ?? 0) + 1;
  const newStreak        = won ? (existing?.currentStreak ?? 0) + 1 : 0;
  const newBest          = Math.max(existing?.bestStreak ?? 0, newStreak);

  let row;
  if (!existing) {
    [row] = await db.insert(gameScoresTable).values({
      userId: myId, gameSlug,
      wins: newWins, losses: newLosses, gamesPlayed: newPlayed,
      currentStreak: newStreak, bestStreak: newBest,
      lastPlayedDate: today, lastResult: won ? "won" : "lost", lastAttempts: attempts,
    }).returning();
  } else {
    [row] = await db.update(gameScoresTable)
      .set({
        wins: newWins, losses: newLosses, gamesPlayed: newPlayed,
        currentStreak: newStreak, bestStreak: newBest,
        lastPlayedDate: today, lastResult: won ? "won" : "lost", lastAttempts: attempts,
      })
      .where(eq(gameScoresTable.id, existing.id))
      .returning();
  }

  res.json(row);
});

/* ── GET /api/games/wordle-words — tüm kelimeler (base + admin) ──────── */
router.get("/games/wordle-words", async (_req, res) => {
  const BASE_WORDS = [
    "ARABA","ASLAN","ALARM","ALTIN","ARMUT","BADEM","BAHÇE","BAHAR","BALIK","BANKA",
    "BEYAZ","BÖREK","BRONZ","BÜYÜK","CADDE","CEKET","CEVİZ","ÇADIR","ÇANTA","ÇARŞI",
    "ÇAYIR","ÇİZME","ÇORBA","DEVAM","DOLMA","DOMUZ","DUVAR","DÜNYA","EKMEK","ELMAS",
    "FIRIN","FULAR","GİTAR","GÖLET","GÜMÜŞ","GÜNEŞ","GÜNEY","HABER","HAVUÇ","HAYAT",
    "HAYAL","HEKİM","HİNDİ","HOROZ","İNCİR","KABAK","KABLO","KAHVE","KALEM","KARGA",
    "KASAP","KAVUN","KAYIK","KAZAK","KEBAP","KEMAN","KİRAZ","KİTAP","KÖFTE","KÖPEK",
    "KÖPRÜ","KOŞMA","KOYUN","KORKU","KURUM","KUZEY","KÜÇÜK","KİRPİ","KIRAZ","LİMAN",
    "MARKA","MEYVE","MISIR","MÜZİK","MUTLU","NEHİR","OKUMA","ORMAN","PAZAR","PEMBE",
    "PERDE","PİLAV","POLİS","PILOT","RADYO","SAHİL","SALON","SANAT","SARMA","SEBZE",
    "SERÇE","SEVGİ","SİYAH","SICAK","SOKAK","SOĞUK","ŞEKER","ŞOFÖR","TABLO","TAHTA",
    "TAKIM","TARLA","TATLI","TAVAN","TAVUK","TEKNE","TENİS","TÜNEL","TULUM","ÜZGÜN",
    "VİDEO","VİŞNE","YAZAR","YATAK","YAYLA","YAZMA","YEŞİL","YOKUŞ","YÜZME","ZAMAN",
    "ZEMİN","ASKER","BORSA","SERIN",
  ];
  const adminWords = readAdminWords();
  const all = [...new Set([...BASE_WORDS, ...adminWords.map((w: string) => w.toUpperCase())])];
  res.json(all);
});

export default router;
