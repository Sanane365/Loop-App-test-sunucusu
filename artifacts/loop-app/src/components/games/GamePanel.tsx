/**
 * GamePanel — Tam ekran oyun paneli
 *
 * Görünümler:
 *   "select" → oyun seçici grid
 *   "wordle" → Wordle oyunu
 *
 * Boyutlandırma: height: 100dvh + fixed flex layout → asla büyüyüp küçülmez.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Trophy, Flame, ArrowLeft } from "lucide-react";
import WordleGame from "./WordleGame";
import { getDailyWord, todayStr } from "./words";

interface Player {
  id:          number;
  displayName: string;
  avatarUrl:   string | null;
}

interface ScoreRow {
  wins:           number;
  losses:         number;
  gamesPlayed:    number;
  currentStreak:  number;
  bestStreak:     number;
  lastPlayedDate: string | null;
  lastResult:     "won" | "lost" | null;
  lastAttempts:   number | null;
}

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  me:      Player;
  other:   Player | null;
}

const EMPTY_SCORE: ScoreRow = {
  wins: 0, losses: 0, gamesPlayed: 0,
  currentStreak: 0, bestStreak: 0,
  lastPlayedDate: null, lastResult: null, lastAttempts: null,
};

/* ── Oyun kartları tanımı ─────────────────────────────────────────────── */
const GAME_CARDS = [
  {
    id:       "wordle" as const,
    emoji:    "🟩",
    title:    "Wordle",
    subtitle: "Günlük kelime",
    color:    "#22c55e",
    active:   true,
  },
  {
    id:       "coming1" as const,
    emoji:    "🎯",
    title:    "Hedef",
    subtitle: "Yakında",
    color:    "#6b7280",
    active:   false,
  },
  {
    id:       "coming2" as const,
    emoji:    "🧩",
    title:    "Bulmaca",
    subtitle: "Yakında",
    color:    "#6b7280",
    active:   false,
  },
];

/* ── Avatar + skor kartı ─────────────────────────────────────────────── */
function PlayerCard({
  player, score, hasCrown, label,
}: {
  player: Player; score: ScoreRow; hasCrown: boolean; label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 relative pt-5">
      {hasCrown && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-base leading-none">👑</span>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black overflow-hidden flex-shrink-0"
        style={{
          background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          border:     `2px solid ${hasCrown ? "#fbbf24" : "rgba(139,92,246,0.4)"}`,
          boxShadow:  hasCrown ? "0 0 10px rgba(251,191,36,0.45)" : "none",
        }}
      >
        {player.avatarUrl
          ? <img src={player.avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
          : player.displayName.charAt(0).toUpperCase()}
      </div>
      <span className="text-[10px] font-bold text-white/70 truncate max-w-[72px] text-center">{label}</span>
      <div className="flex gap-2">
        <div className="flex items-center gap-0.5">
          <Trophy className="w-3 h-3 text-yellow-400" />
          <span className="text-[11px] font-black text-white">{score.wins}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Flame className="w-3 h-3 text-orange-400" />
          <span className="text-[11px] font-black text-white">{score.bestStreak}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function GamePanel({ isOpen, onClose, me, other }: Props) {
  const [view,       setView]       = useState<"select" | "wordle">("select");
  const [myScore,    setMyScore]    = useState<ScoreRow>(EMPTY_SCORE);
  const [otherScore, setOtherScore] = useState<ScoreRow>(EMPTY_SCORE);
  const [loading,    setLoading]    = useState(false);
  const [wordList,   setWordList]   = useState<string[] | null>(null);

  /* Panel kapanınca seçici'ye dön */
  useEffect(() => { if (!isOpen) setView("select"); }, [isOpen]);

  /* Skorları çek */
  const fetchScores = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const qs  = other ? `?gameSlug=wordle&otherUserId=${other.id}` : "?gameSlug=wordle";
      const res = await fetch(`/api/games/records${qs}`);
      if (!res.ok) return;
      const { my, other: otherR } = await res.json();
      if (my)     setMyScore(my);
      if (otherR) setOtherScore(otherR);
    } finally {
      setLoading(false);
    }
  }, [isOpen, other]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  /* Kelime listesini çek */
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/games/wordle-words")
      .then(r => r.ok ? r.json() : null)
      .then(list => { if (list) setWordList(list); })
      .catch(() => {});
  }, [isOpen]);

  /* Oyun bitti */
  const handleGameEnd = async (won: boolean, attempts: number) => {
    await fetch("/api/games/records", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ gameSlug: "wordle", won, attempts }),
    });
    fetchScores();
  };

  const iLead    = myScore.wins > otherScore.wins;
  const theyLead = otherScore.wins > myScore.wins && !!other;
  const tied     = myScore.wins === otherScore.wins && myScore.wins > 0;

  const alreadyPlayed = myScore.lastPlayedDate === todayStr()
    ? { result: myScore.lastResult as "won" | "lost", attempts: myScore.lastAttempts ?? 6 }
    : null;

  /* Günlük kelimeyi tam listeden hesapla */
  const effectiveWordList = wordList ?? undefined;
  const targetWord = (() => {
    const list = effectiveWordList ?? [getDailyWord()];
    const epoch  = new Date("2024-01-01T00:00:00Z").getTime();
    const now    = new Date(); now.setHours(0, 0, 0, 0);
    const dayIdx = Math.floor((now.getTime() - epoch) / 86_400_000);
    return list[((dayIdx % list.length) + list.length) % list.length];
  })();

  if (!isOpen) return null;

  return (
    /* Tam ekran kaplama — hiç boyut değişmez */
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: "linear-gradient(170deg,#1a0e2e 0%,#0f172a 55%,#0c1a2e 100%)" }}
    >
      {/* Parlayan üst efekt */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -5%,rgba(139,92,246,0.22) 0%,transparent 55%)" }} />

      {/* ── HEADER (sabit yükseklik) ──────────────────────────────────── */}
      <div className="relative flex-none flex items-center justify-between px-5 pt-12 pb-3">
        <div className="flex items-center gap-3">
          {view === "wordle" && (
            <button
              onClick={() => setView("select")}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300/70">
              🎮 Oyun Alanı
            </p>
            <h2 className="text-lg font-black text-white leading-tight">
              {view === "select" ? "Mini Oyunlar" : "Wordle"}
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* ── SKOR BAŞLIĞI (sabit yükseklik) ───────────────────────────── */}
      <div className="relative flex-none px-5 pb-3">
        <div
          className="rounded-2xl px-4 py-2.5 flex items-center"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <PlayerCard
            player={me}
            score={myScore}
            hasCrown={iLead || tied}
            label="Sen"
          />
          <div className="flex flex-col items-center gap-0.5 px-4">
            <span className="text-xl font-black text-white/25">vs</span>
            {myScore.gamesPlayed > 0 && (
              <span className="text-[10px] text-white/25 font-bold">
                {myScore.wins}–{otherScore.wins}
              </span>
            )}
          </div>
          {other ? (
            <PlayerCard
              player={other}
              score={otherScore}
              hasCrown={theyLead}
              label={other.displayName.split(" ")[0]}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center gap-1 pt-5 opacity-30">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm">?</div>
              <span className="text-[10px] text-white/40">Grup</span>
            </div>
          )}
        </div>
      </div>

      {/* ── İÇERİK (kalan alan, sabit) ────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">

        {/* OYUN SEÇİCİ */}
        {view === "select" && (
          <div className="h-full px-5 pt-2 pb-6 flex flex-col gap-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Oyun Seç</p>
            <div className="grid grid-cols-3 gap-3">
              {GAME_CARDS.map(card => (
                <button
                  key={card.id}
                  onClick={() => card.active && setView("wordle")}
                  disabled={!card.active}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 px-2 transition-all active:scale-95"
                  style={{
                    background: card.active
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${card.active
                      ? "rgba(139,92,246,0.45)"
                      : "rgba(255,255,255,0.07)"}`,
                    opacity: card.active ? 1 : 0.45,
                    cursor:  card.active ? "pointer" : "default",
                  }}
                >
                  <span className="text-3xl leading-none">{card.emoji}</span>
                  <span className="text-[13px] font-black text-white leading-tight">{card.title}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: card.active ? `${card.color}22` : "rgba(255,255,255,0.05)",
                      color:      card.active ? card.color : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {card.subtitle}
                  </span>
                  {alreadyPlayed && card.id === "wordle" && (
                    <span className="text-[10px] font-bold text-purple-300/70">
                      {alreadyPlayed.result === "won" ? "✅ Tamamlandı" : "❌ Yarın tekrar"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WORDLE OYUNU — loading durumu WordleGame'i asla unmount etmemeli */}
        {view === "wordle" && (
          <div className="h-full flex flex-col overflow-hidden px-4 pb-4 pt-1">
            <WordleGame
              targetWord={targetWord}
              wordList={effectiveWordList}
              alreadyPlayed={alreadyPlayed}
              onGameEnd={handleGameEnd}
            />
          </div>
        )}
      </div>
    </div>
  );
}
