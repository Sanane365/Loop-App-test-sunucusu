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
import { gameScoresTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

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

export default router;
