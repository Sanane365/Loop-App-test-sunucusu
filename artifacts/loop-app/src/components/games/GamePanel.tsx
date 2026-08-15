/**
 * GamePanel — DM ekranının alt oyun paneli
 *
 * • Skor başlığı: iki oyuncu yan yana, kazanan tarafta 👑 taç
 * • Wordle oyunu (günlük kelime)
 */

import { useState, useEffect, useCallback } from "react";
import { X, Trophy, Flame } from "lucide-react";
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
  isOpen:    boolean;
  onClose:   () => void;
  me:        Player;
  other:     Player | null;   // null → grup sohbeti
}

/* ── Skor satırı default ─────────────────────────────────────────────── */
const EMPTY_SCORE: ScoreRow = {
  wins: 0, losses: 0, gamesPlayed: 0,
  currentStreak: 0, bestStreak: 0,
  lastPlayedDate: null, lastResult: null, lastAttempts: null,
};

/* ── Avatar bileşeni ─────────────────────────────────────────────────── */
function PlayerCard({
  player, score, hasCrown, label,
}: {
  player: Player; score: ScoreRow; hasCrown: boolean; label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 relative">
      {/* Taç */}
      {hasCrown && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg leading-none" title="Lider!">
          👑
        </span>
      )}

      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black overflow-hidden flex-shrink-0"
        style={{
          background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          border: `2px solid ${hasCrown ? "#fbbf24" : "rgba(139,92,246,0.5)"}`,
          boxShadow: hasCrown ? "0 0 12px rgba(251,191,36,0.5)" : "none",
        }}
      >
        {player.avatarUrl
          ? <img src={player.avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
          : player.displayName.charAt(0).toUpperCase()}
      </div>

      <span className="text-[11px] font-bold text-white/80 truncate max-w-[80px] text-center">{label}</span>

      {/* İstatistikler */}
      <div className="flex gap-2 mt-0.5">
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
  const [myScore,    setMyScore]    = useState<ScoreRow>(EMPTY_SCORE);
  const [otherScore, setOtherScore] = useState<ScoreRow>(EMPTY_SCORE);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<"wordle">("wordle");

  /* Bugün zaten oynadıysa */
  const alreadyPlayed = myScore.lastPlayedDate === todayStr()
    ? { result: myScore.lastResult as "won" | "lost", attempts: myScore.lastAttempts ?? 6 }
    : null;

  /* Skorları çek */
  const fetchScores = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const qs = other ? `?gameSlug=wordle&otherUserId=${other.id}` : "?gameSlug=wordle";
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

  /* Oyun bitti → API'ye kaydet */
  const handleGameEnd = async (won: boolean, attempts: number) => {
    await fetch("/api/games/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameSlug: "wordle", won, attempts }),
    });
    fetchScores(); // skoru yenile
  };

  /* Kimin tacı var */
  const iLead    = myScore.wins > otherScore.wins;
  const theyLead = otherScore.wins > myScore.wins && !!other;
  const tied     = myScore.wins === otherScore.wins && myScore.wins > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      {/* Arka plan */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-t-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-400"
        style={{
          background: "linear-gradient(170deg,#1a0e2e 0%,#0f172a 55%,#0c1a2e 100%)",
          maxHeight:  "92dvh",
        }}
      >
        {/* Parlayan üst efekt */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% -10%,rgba(139,92,246,0.2) 0%,transparent 60%)" }} />

        {/* Başlık */}
        <div className="relative flex items-center justify-between pt-5 pb-3 px-5">
          <div className="w-10 h-1 rounded-full bg-white/20 absolute top-2.5 left-1/2 -translate-x-1/2" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300/70">🎮 Oyun Alanı</p>
            <h2 className="text-lg font-black text-white leading-tight">Wordle</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* ── Skor başlığı ────────────────────────────────────────────── */}
        <div className="relative px-5 pb-4">
          <div
            className="rounded-2xl px-4 py-3 flex items-center"
            style={{
              background: "rgba(255,255,255,0.05)",
              border:     "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {/* Ben */}
            <PlayerCard
              player={me}
              score={myScore}
              hasCrown={iLead || (tied)}
              label="Sen"
            />

            {/* VS */}
            <div className="flex flex-col items-center gap-0.5 px-3">
              <span className="text-2xl font-black text-white/30">vs</span>
              {myScore.gamesPlayed > 0 && (
                <span className="text-[10px] text-white/30 font-bold">
                  {myScore.wins}–{otherScore.wins}
                </span>
              )}
            </div>

            {/* Arkadaş */}
            {other ? (
              <PlayerCard
                player={other}
                score={otherScore}
                hasCrown={theyLead}
                label={other.displayName.split(" ")[0]}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center gap-1 opacity-40">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">?</div>
                <span className="text-[11px] text-white/50">Grup sohbeti</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Oyun içeriği ─────────────────────────────────────────────── */}
        <div className="relative overflow-y-auto flex-1 px-4 pb-6 pt-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-white/30 text-sm">Yükleniyor…</div>
          ) : (
            <WordleGame
              targetWord={getDailyWord()}
              alreadyPlayed={alreadyPlayed}
              onGameEnd={handleGameEnd}
            />
          )}
        </div>
      </div>
    </div>
  );
}
