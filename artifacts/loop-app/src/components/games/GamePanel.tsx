/**
 * GamePanel — Tam ekran oyun paneli
 *
 * Görünümler:
 *   "select" → oyun seçici grid
 *   "wordle" → Wordle oyunu
 *
 * Boyutlandırma: height: 100dvh + fixed flex layout → asla büyüyüp küçülmez.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Trophy, Flame, ArrowLeft } from "lucide-react";
import WordleGame from "./WordleGame";
import XoxGame from "./XoxGame";
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
  initialGameId?: number | null;
}

const EMPTY_SCORE: ScoreRow = {
  wins: 0, losses: 0, gamesPlayed: 0,
  currentStreak: 0, bestStreak: 0,
  lastPlayedDate: null, lastResult: null, lastAttempts: null,
};

/* ── Oyun kartları tanımı ─────────────────────────────────────────────── */
const GAME_CARDS = [
  {
    id:       "flappy" as const,
    emoji:    "🐤",
    title:    "Flappy Kuş",
    subtitle: "Engelleri aş",
    color:    "#f97316",
    active:   true,
  },
  {
    id:       "wordle" as const,
    emoji:    "🟩",
    title:    "Wordle",
    subtitle: "Günlük kelime",
    color:    "#22c55e",
    active:   true,
  },
  {
    id:       "xox" as const,
    emoji:    "⭕",
    title:    "XOX",
    subtitle: "Rakibinle oyna",
    color:    "#fbbf24",
    active:   true,
  },
  {
    id:       "target" as const,
    emoji:    "🎯",
    title:    "Hedef",
    subtitle: "Tahmin et",
    color:    "#7c3aed",
    active:   true,
  },
  {
    id:       "puzzle" as const,
    emoji:    "🧩",
    title:    "Bulmaca",
    subtitle: "Kelime bul",
    color:    "#38bdf8",
    active:   true,
  },
  {
    id:       "memory" as const,
    emoji:    "🎴",
    title:    "Eşleştir",
    subtitle: "Hafıza oyunu",
    color:    "#f97316",
    active:   true,
  },
  {
    id:       "emoji" as const,
    emoji:    "🎮",
    title:    "Emoji Rush",
    subtitle: "Hızlı vur",
    color:    "#f59e0b",
    active:   true,
  },
  {
    id:       "math" as const,
    emoji:    "⚡",
    title:    "Hızlı Hesap",
    subtitle: "Dört işlem",
    color:    "#ef4444",
    active:   true,
  },
  {
    id:       "tap" as const,
    emoji:    "👆",
    title:    "Speed Tap",
    subtitle: "Tepki hızı",
    color:    "#3b82f6",
    active:   true,
  },
  {
    id:       "catch" as const,
    emoji:    "🎣",
    title:    "Hazine Av",
    subtitle: "Düşenleri yakala",
    color:    "#8b5cf6",
    active:   true,
  },
  {
    id:       "blitz" as const,
    emoji:    "�",
    title:    "Tile Blitz",
    subtitle: "Sırayla tıkla",
    color:    "#ec4899",
    active:   true,
  },
  {
    id:       "letter" as const,
    emoji:    "🔤",
    title:    "Letter Dash",
    subtitle: "Hızlı yaz",
    color:    "#06b6d4",
    active:   true,
  },
  {
    id:       "snake" as const,
    emoji:    "🐍",
    title:    "Yılan Oyunu",
    subtitle: "Yemi yakala",
    color:    "#22c55e",
    active:   true,
  },
  {
    id:       "colors" as const,
    emoji:    "🎨",
    title:    "Renk Hafızası",
    subtitle: "Sırayı hatırla",
    color:    "#14b8a6",
    active:   true,
  },
  {
    id:       "2048" as const,
    emoji:    "🔢",
    title:    "2048",
    subtitle: "Taşları birleştir",
    color:    "#eab308",
    active:   true,
  },
  {
    id:       "mines" as const,
    emoji:    "💣",
    title:    "Mayın Tarlası",
    subtitle: "Güvenli kareleri aç",
    color:    "#ef4444",
    active:   true,
  },
  {
    id:       "rps" as const,
    emoji:    "✂️",
    title:    "Taş Kağıt Makas",
    subtitle: "Bilgisayarla oyna",
    color:    "#3b82f6",
    active:   true,
  },
  {
    id:       "maze" as const,
    emoji:    "🧭",
    title:    "Labirent",
    subtitle: "Çıkışı bul",
    color:    "#a855f7",
    active:   true,
  },
  {
    id:       "space" as const,
    emoji:    "🚀",
    title:    "Uzay Kaçışı",
    subtitle: "Güneş topla",
    color:    "#38bdf8",
    active:   true,
  },
  {
    id:       "neon" as const,
    emoji:    "⚡",
    title:    "Neon Tap",
    subtitle: "Doğru renge dokun",
    color:    "#f59e0b",
    active:   true,
  },
  {
    id:       "nova" as const,
    emoji:    "☄️",
    title:    "Nova Rush",
    subtitle: "Hedefe vur",
    color:    "#fb7185",
    active:   true,
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
function WordPuzzleGame() {
  const puzzles = [
    { clue: "Güneşin doğduğu yer", answer: "DOĞU" },
    { clue: "Kışın karla kaplı ağaç", answer: "ÇAM" },
    { clue: "Bir canlı, sevgi dolu, en çok köpeğe benzer", answer: "KOPEK" },
    { clue: "Su yüzeyinde yüzen, küçük bir taşıt", answer: "KAYIK" },
    { clue: "Gece gökyüzündeki ışıklar", answer: "YILDIZ" },
    { clue: "Yazın en sevilen soğuk içecek", answer: "LIMONATA" },
  ];

  const QUESTION_TIME_MS = 60_000;
  const TOTAL_LIVES = 3;

  const shuffleWord = (word: string) => {
    const letters = word.split("");
    for (let i = letters.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join("");
  };

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("Harfleri doğru sıraya koyup kelimeyi bul.");
  const [finished, setFinished] = useState(false);
  const [lives, setLives] = useState(TOTAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scrambled, setScrambled] = useState(() => shuffleWord(puzzles[0].answer));

  const current = puzzles[index];

  const advanceRound = useCallback((nextIndex: number, nextLives = lives) => {
    if (nextIndex >= puzzles.length) {
      setFinished(true);
      setIsTransitioning(false);
      return;
    }

    const nextPuzzle = puzzles[nextIndex];
    setIndex(nextIndex);
    setGuess("");
    setFeedback("Harfleri doğru sıraya koyup kelimeyi bul.");
    setScrambled(shuffleWord(nextPuzzle.answer));
    setTimeLeft(QUESTION_TIME_MS);
    setIsTransitioning(false);
    if (nextLives <= 0) {
      setFinished(true);
    }
  }, [lives]);

  useEffect(() => {
    if (finished || isTransitioning) return;

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextTime = Math.max(0, QUESTION_TIME_MS - elapsed);
      setTimeLeft(nextTime);

      if (nextTime <= 0) {
        window.clearInterval(interval);
        setIsTransitioning(true);
        const nextLives = lives - 1;
        setLives(nextLives);
        setFeedback("Süre doldu! 1 can kaybettin.");

        if (nextLives <= 0) {
          setFinished(true);
          return;
        }

        window.setTimeout(() => {
          const nextIndex = index + 1;
          advanceRound(nextIndex, nextLives);
        }, 900);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [index, finished, isTransitioning, lives, advanceRound]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isTransitioning || finished) return;

    const normalized = guess.trim().toUpperCase();
    if (!normalized) {
      setFeedback("Bir cevap yazmalısın.");
      return;
    }

    if (normalized === current.answer) {
      const nextScore = score + 1;
      setScore(nextScore);
      setFeedback("Doğru! Harika bir bulmaca çözdün.");
      setIsTransitioning(true);

      const isLast = index >= puzzles.length - 1;
      if (isLast) {
        setFinished(true);
        return;
      }

      window.setTimeout(() => {
        const nextIndex = index + 1;
        advanceRound(nextIndex, lives);
      }, 900);
      return;
    }

    const nextLives = lives - 1;
    setLives(nextLives);
    setFeedback("Yanlış cevap! 1 can kaybettin.");
    setIsTransitioning(true);

    if (nextLives <= 0) {
      setFinished(true);
      return;
    }

    window.setTimeout(() => {
      const nextIndex = index + 1;
      advanceRound(nextIndex, nextLives);
    }, 900);
  };

  const resetRound = () => {
    setIndex(0);
    setScore(0);
    setGuess("");
    setFeedback("Harfleri doğru sıraya koyup kelimeyi bul.");
    setFinished(false);
    setLives(TOTAL_LIVES);
    setTimeLeft(QUESTION_TIME_MS);
    setIsTransitioning(false);
    setScrambled(shuffleWord(puzzles[0].answer));
  };

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-violet-400/30 bg-violet-500/10 p-5 text-center text-white">
        <div className="text-4xl">🏆</div>
        <h3 className="text-2xl font-black">Bulmaca tamamlandı!</h3>
        <p className="text-sm text-violet-100">Doğru cevap sayısı: {score} / {puzzles.length}</p>
        <p className="text-sm text-violet-100">Kalan can: {Math.max(0, lives)}</p>
        <button
          type="button"
          onClick={resetRound}
          className="rounded-2xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-violet-400/30 bg-violet-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/80">Bulmaca</p>
          <h3 className="text-xl font-black">Kelime Karıştırma</h3>
        </div>
        <div className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-black text-violet-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-violet-100">
        <span>⏱ {Math.ceil(timeLeft / 1000)} sn</span>
        <span>❤️ {lives} can</span>
      </div>

      <div className="rounded-2xl bg-slate-950/30 p-4 text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-300/80">İpucu</div>
        <div className="text-lg font-black text-violet-50">{current.clue}</div>
      </div>

      <div className="rounded-2xl border border-dashed border-violet-300/40 bg-slate-900/40 p-4 text-center text-3xl font-black tracking-[0.4em] text-violet-100">
        {scrambled}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={guess}
          onChange={event => setGuess(event.target.value)}
          placeholder="Cevabını yaz"
          disabled={isTransitioning}
          className="flex-1 rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-3 text-base font-bold text-white outline-none placeholder:text-slate-400 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={isTransitioning}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          Gönder
        </button>
      </form>

      <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-violet-100">
        {feedback}
      </div>

      <div className="mt-auto flex items-center justify-between rounded-2xl bg-black/10 px-3 py-2 text-xs text-violet-100">
        <span>Soru {index + 1} / {puzzles.length}</span>
        <button
          type="button"
          onClick={() => {
            const nextLives = lives;
            setTimeLeft(QUESTION_TIME_MS);
            setScrambled(shuffleWord(current.answer));
            setFeedback(`Süre sıfırlandı. 1 dakikanız yeniden başladı. Kalan can: ${nextLives}`);
          }}
          className="rounded-full border border-violet-300/30 px-2 py-1 font-bold text-violet-100"
        >
          Yenile
        </button>
      </div>
    </div>
  );
}

function EmojiRushGame() {
  const emojiPool = ["⭐", "🌙", "☀️", "🌧️", "🔥", "🎯", "💎", "🍀"];
  const [target, setTarget] = useState<string>(emojiPool[0]);
  const [tiles, setTiles] = useState<string[]>(() => createBoard(3, emojiPool[0]));
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(20);
  const [message, setMessage] = useState("Hedef emojiyi bul ve tıkla!");
  const [isPlaying, setIsPlaying] = useState(true);

  const getBoardSize = (nextScore: number) => Math.min(3 + Math.floor(nextScore / 2), 6);

  function createBoard(size: number, targetEmoji: string) {
    const total = size * size;
    const board: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const randomEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
      board.push(randomEmoji);
    }

    const targetIndex = Math.floor(Math.random() * total);
    board[targetIndex] = targetEmoji;
    return board;
  }

  const resetGame = () => {
    const firstTarget = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    setTarget(firstTarget);
    setTiles(createBoard(3, firstTarget));
    setScore(0);
    setStreak(0);
    setLevel(1);
    setTimeLeft(20);
    setMessage("Hedef emojiyi bul ve tıkla!");
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setTimeLeft(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          setMessage("Süre doldu! Tekrar dene.");
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const nextRound = (nextScore: number) => {
    const nextTarget = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    const nextBoardSize = getBoardSize(nextScore);
    setTarget(nextTarget);
    setLevel(Math.min(1 + Math.floor(nextScore / 2), 6));
    setTiles(createBoard(nextBoardSize, nextTarget));
  };

  const handleTileClick = (emoji: string) => {
    if (!isPlaying) return;

    if (emoji === target) {
      const nextScore = score + 1;
      const nextStreak = streak + 1;
      setScore(nextScore);
      setStreak(nextStreak);
      setMessage(`Doğru! ${nextStreak} seri. Seviye ${Math.min(1 + Math.floor(nextScore / 2), 6)}`);
      nextRound(nextScore);
      return;
    }

    setStreak(0);
    setMessage("Yanlış! Hedef emojiyi bul.");
  };

  if (!isPlaying) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-center text-white">
        <div className="text-4xl">🎯</div>
        <h3 className="text-2xl font-black">Oyun bitti!</h3>
        <p className="text-sm text-amber-100">Toplam skor: {score}</p>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/80">Emoji Rush</p>
          <h3 className="text-xl font-black">Hedefi vur</h3>
        </div>
        <div className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-amber-100">
        <span>⏱ {timeLeft}s</span>
        <span>🔥 {streak} seri</span>
        <span>⚙️ Seviye {level}</span>
      </div>

      <div className="rounded-2xl bg-slate-950/30 p-4 text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-300/80">Hedef</div>
        <div className="text-5xl">{target}</div>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${getBoardSize(score)}, minmax(0, 1fr))` }}
      >
        {tiles.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => handleTileClick(emoji)}
            className="flex h-16 items-center justify-center rounded-2xl border border-amber-300/30 bg-slate-900/40 text-3xl transition hover:scale-[1.02] hover:bg-slate-800/60"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-2xl bg-black/10 px-3 py-2 text-xs text-amber-100">
        {message}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
function SpeedTapGame() {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [times, setTimes] = useState<number[]>([]);
  const [waiting, setWaiting] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [tapX, setTapX] = useState<number | null>(null);
  const [tapY, setTapY] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [showMissed, setShowMissed] = useState(false);

  const MAX_ROUNDS = 15;
  const MOVE_INTERVAL_MS = 2500; // Daire her 2.5 saniyede yeni yere yer değiştirir

  const generateNewPosition = useCallback(() => {
    const container = document.getElementById("tap-container");
    if (container) {
      const rect = container.getBoundingClientRect();
      const randomX = Math.random() * (rect.width - 60) + 30;
      const randomY = Math.random() * (rect.height - 60) + 30;
      return { x: randomX, y: randomY };
    }
    return null;
  }, []);

  const repositionCircle = useCallback(() => {
    const newPos = generateNewPosition();
    if (newPos) {
      setTapX(newPos.x);
      setTapY(newPos.y);
      setShowMissed(true);
      window.setTimeout(() => setShowMissed(false), 200);
    }
  }, [generateNewPosition]);

  const nextRound = useCallback(() => {
    if (round >= MAX_ROUNDS - 1) {
      setFinished(true);
      return;
    }

    setWaiting(true);
    setCountdown(3);
    setTapX(null);
    setTapY(null);
    setReactionTime(null);
    setStartTime(null);
  }, [round]);

  useEffect(() => {
    if (finished || !waiting || countdown === 0) return;

    const timer = window.setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          window.clearInterval(timer);
          const newPos = generateNewPosition();
          if (newPos) {
            setTapX(newPos.x);
            setTapY(newPos.y);
            setWaiting(false);
            setStartTime(Date.now());
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown, waiting, finished, generateNewPosition]);

  useEffect(() => {
    if (waiting || finished || startTime === null || !tapX || !tapY) return;

    const moveTimer = window.setInterval(() => {
      repositionCircle();
    }, MOVE_INTERVAL_MS);

    return () => window.clearInterval(moveTimer);
  }, [waiting, finished, startTime, tapX, tapY, repositionCircle]);

  const handleTap = () => {
    if (waiting || finished || startTime === null) return;

    const elapsed = Date.now() - startTime;
    setReactionTime(elapsed);
    setTimes(t => [...t, elapsed]);
    setRound(r => r + 1);
    setScore(s => s + 1);

    if (elapsed < (bestTime ?? Infinity)) {
      setBestTime(elapsed);
    }

    if (round >= MAX_ROUNDS - 1) {
      setFinished(true);
      return;
    }

    window.setTimeout(() => nextRound(), 500);
  };

  const resetGame = () => {
    setRound(0);
    setScore(0);
    setBestTime(null);
    setTimes([]);
    setWaiting(true);
    setCountdown(3);
    setTapX(null);
    setTapY(null);
    setReactionTime(null);
    setStartTime(null);
    setFinished(false);
    setShowMissed(false);
  };

  if (finished) {
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5 text-center text-white">
        <div className="text-4xl">🎯</div>
        <h3 className="text-2xl font-black">Oyun Bitti!</h3>
        <div className="space-y-2 text-sm text-blue-100">
          <p>En İyi Zaman: <span className="font-black text-blue-300">{bestTime}ms</span></p>
          <p>Ortalama Zaman: <span className="font-black text-blue-300">{avgTime}ms</span></p>
        </div>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-blue-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-blue-400/30 bg-blue-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/80">Speed Tap</p>
          <h3 className="text-xl font-black">Tepki Hızı</h3>
        </div>
        <div className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-black text-blue-100">Round {round + 1}/{MAX_ROUNDS}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-blue-100">
        <span>⏱ {reactionTime ? `${reactionTime}ms` : "Bekleniyor..."}</span>
        <span>⭐ {bestTime ? `${bestTime}ms` : "—"}</span>
      </div>

      <div
        id="tap-container"
        className="relative flex-1 rounded-2xl bg-slate-900/30 border border-blue-300/20 cursor-pointer overflow-hidden flex items-center justify-center"
      >
        {waiting && countdown > 0 && (
          <div className="text-6xl font-black text-blue-300">{countdown}</div>
        )}

        {waiting && countdown === 0 && (
          <div className="text-sm text-blue-200 text-center">Hazırlanıyor...</div>
        )}

        {!waiting && tapX !== null && tapY !== null && (
          <button
            type="button"
            onClick={handleTap}
            className={`absolute w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-400 shadow-lg transition-all active:scale-90 ${
              showMissed ? "animate-pulse" : ""
            }`}
            style={{ left: `${tapX}px`, top: `${tapY}px`, transform: "translate(-50%, -50%)" }}
          >
            <span className="text-2xl">👆</span>
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-blue-100 text-center">
        {waiting ? "Daireyi bekle ve tıkla!" : "Daireyi hızlı tıkla! (Taşınıyor)"}
      </div>
    </div>
  );
}

function QuickMathGame() {
  type Question = {
    left: number;
    right: number;
    operator: "+" | "-" | "×";
    answer: number;
  };

  const shuffle = <T,>(items: T[]) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const buildQuestion = (): Question => {
    const operator = (Math.random() < 0.34 ? "+" : Math.random() < 0.67 ? "-" : "×") as Question["operator"];
    const left = Math.floor(Math.random() * 12) + 2;
    const right = Math.floor(Math.random() * 9) + 1;

    if (operator === "+") return { left, right, operator, answer: left + right };
    if (operator === "-") {
      const higher = Math.max(left, right);
      const lower = Math.min(left, right);
      return { left: higher, right: lower, operator, answer: higher - lower };
    }
    return { left, right, operator, answer: left * right };
  };

  const buildOptions = (answer: number) => {
    const options = new Set<number>([answer]);
    while (options.size < 4) {
      const delta = Math.floor(Math.random() * 9) + 1;
      const candidate = answer + (Math.random() > 0.5 ? delta : -delta);
      options.add(candidate);
    }
    return shuffle([...options]);
  };

  const [question, setQuestion] = useState<Question>(() => buildQuestion());
  const [options, setOptions] = useState<number[]>(() => buildOptions(0));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10);
  const [message, setMessage] = useState("Doğru cevabı seç");
  const [finished, setFinished] = useState(false);

  const nextRound = useCallback((customMessage?: string) => {
    const nextQuestion = buildQuestion();
    setQuestion(nextQuestion);
    setOptions(buildOptions(nextQuestion.answer));
    setTimeLeft(10);
    setMessage(customMessage ?? "Doğru cevabı seç");
  }, []);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setTimeLeft(current => {
        if (current <= 1) {
          const nextLives = lives - 1;
          setLives(nextLives);
          setMessage("Süre doldu! 1 can kaybettin.");

          if (nextLives <= 0) {
            setFinished(true);
            return 0;
          }

          nextRound("Süre doldu, yeni soru!");
          return 10;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished, lives, nextRound]);

  const handleAnswer = (value: number) => {
    if (finished) return;

    if (value === question.answer) {
      const nextScore = score + 1;
      setScore(nextScore);
      setMessage(`Doğru! Skor: ${nextScore}`);
      nextRound("Harika! Yeni soru!");
      return;
    }

    const nextLives = lives - 1;
    setLives(nextLives);
    setMessage("Yanlış cevap! 1 can kaybettin.");

    if (nextLives <= 0) {
      setFinished(true);
      return;
    }

    nextRound("Tekrar dene!");
  };

  const resetGame = () => {
    setScore(0);
    setLives(3);
    setTimeLeft(10);
    setFinished(false);
    setMessage("Doğru cevabı seç");
    const fresh = buildQuestion();
    setQuestion(fresh);
    setOptions(buildOptions(fresh.answer));
  };

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-red-400/30 bg-red-500/10 p-5 text-center text-white">
        <div className="text-4xl">⏰</div>
        <h3 className="text-2xl font-black">Oyun bitti!</h3>
        <p className="text-sm text-red-100">Toplam skor: {score}</p>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200/80">Hızlı Hesap</p>
          <h3 className="text-xl font-black">Dört İşlem</h3>
        </div>
        <div className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-black text-red-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-red-100">
        <span>⏱ {timeLeft}s</span>
        <span>❤️ {lives} can</span>
      </div>

      <div className="rounded-2xl bg-slate-950/30 p-5 text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-red-300/80">Soru</div>
        <div className="text-4xl font-black tracking-tight text-red-50">
          {question.left} {question.operator} {question.right}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map(value => (
          <button
            key={value}
            type="button"
            onClick={() => handleAnswer(value)}
            className="rounded-2xl border border-red-300/30 bg-slate-900/50 px-3 py-4 text-xl font-black text-red-50 transition hover:bg-slate-800/60"
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-2xl bg-black/10 px-3 py-2 text-xs text-red-100">
        {message}
      </div>
    </div>
  );
}

function MemoryGame() {
  const symbols = ["🌙", "⭐", "☀️", "🌧️", "🍀", "🎵"];

  const buildDeck = () =>
    [...symbols, ...symbols]
      .map((symbol, index) => ({ id: `${symbol}-${index}-${Math.random()}`, symbol, matched: false }))
      .sort(() => Math.random() - 0.5);

  const [cards, setCards] = useState(() => buildDeck());
  const [flipped, setFlipped] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [finished, setFinished] = useState(false);

  const resetBoard = () => {
    setCards(buildDeck());
    setFlipped([]);
    setMoves(0);
    setMatchedPairs(0);
    setFinished(false);
  };

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [firstId, secondId] = flipped;
    const firstCard = cards.find(card => card.id === firstId);
    const secondCard = cards.find(card => card.id === secondId);

    if (!firstCard || !secondCard) return;

    if (firstCard.symbol === secondCard.symbol) {
      setCards(current => current.map(card => card.id === firstId || card.id === secondId ? { ...card, matched: true } : card));
      setMatchedPairs(value => value + 1);
      setFlipped([]);
      return;
    }

    const timeout = window.setTimeout(() => setFlipped([]), 700);
    return () => window.clearTimeout(timeout);
  }, [cards, flipped]);

  useEffect(() => {
    if (matchedPairs === symbols.length && cards.length > 0) {
      setFinished(true);
    }
  }, [cards.length, matchedPairs, symbols.length]);

  const handleCardClick = (cardId: string) => {
    if (flipped.length === 2 || finished) return;
    const card = cards.find(item => item.id === cardId);
    if (!card || card.matched || flipped.includes(cardId)) return;

    setFlipped(current => [...current, cardId]);
    setMoves(value => value + 1);
  };

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-orange-400/30 bg-orange-500/10 p-5 text-center text-white">
        <div className="text-4xl">🎉</div>
        <h3 className="text-2xl font-black">Eşleştirme tamamlandı!</h3>
        <p className="text-sm text-orange-100">Toplam hamle: {moves}</p>
        <button
          type="button"
          onClick={resetBoard}
          className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Yeniden oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-orange-400/30 bg-orange-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200/80">Eşleştir</p>
          <h3 className="text-xl font-black">Hafıza</h3>
        </div>
        <div className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-black text-orange-100">Hamle: {moves}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map(card => {
          const isVisible = flipped.includes(card.id) || card.matched;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card.id)}
              disabled={card.matched || flipped.includes(card.id) || flipped.length === 2}
              className={`flex h-16 items-center justify-center rounded-2xl border text-2xl transition-all ${
                isVisible
                  ? "border-orange-300 bg-orange-400/20"
                  : "border-white/10 bg-slate-900/50 hover:bg-slate-800/60"
              } ${card.matched ? "opacity-90" : ""}`}
            >
              {isVisible ? card.symbol : "?"}
            </button>
          );
        })}
      </div>

      <div className="mt-auto rounded-2xl bg-black/10 px-3 py-2 text-xs text-orange-100">
        Eşleşen çift: {matchedPairs} / {symbols.length}
      </div>
    </div>
  );
}

function TargetGame() {
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 100) + 1);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState("1 ile 100 arasında bir sayı tahmin et.");
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const resetRound = useCallback(() => {
    setTarget(Math.floor(Math.random() * 100) + 1);
    setGuess("");
    setAttempts(0);
    setFinished(false);
    setMessage("Yeni tur başladı. 1 ile 100 arasında bir sayı tahmin et.");
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericGuess = Number(guess);
    if (!Number.isInteger(numericGuess) || numericGuess < 1 || numericGuess > 100) {
      setMessage("Geçerli bir sayı yazmalısın. 1 ile 100 arası olmalı.");
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (numericGuess === target) {
      const nextScore = score + 1;
      setScore(nextScore);
      setMessage(`Tebrikler! ${nextAttempts} denemede buldun. Skor: ${nextScore}`);
      setFinished(true);
      return;
    }

    setMessage(numericGuess < target ? "Daha yüksek bir sayı dene." : "Daha düşük bir sayı dene.");
    if (nextAttempts >= 6) {
      setMessage(`Tur bitti. Hedef sayı: ${target}. Yeni tur için tekrar dene.`);
      setFinished(true);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/80">Hedef</p>
          <h3 className="text-xl font-black">Sayı Tahmini</h3>
        </div>
        <div className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-black text-violet-200">Skor: {score}</div>
      </div>

      <div className="rounded-2xl bg-slate-950/30 p-3 text-sm text-slate-200">
        {message}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={guess}
          onChange={event => setGuess(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={finished}
          placeholder="Sayı gir"
          className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-base font-bold text-white outline-none placeholder:text-slate-400 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={finished}
          className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          Tahmin
        </button>
      </form>

      <div className="flex items-center justify-between rounded-2xl bg-black/10 px-3 py-2 text-xs text-slate-300">
        <span>Deneme: {attempts}/6</span>
        <span>{finished ? "Tur tamamlandı" : "Devam ediyorsun"}</span>
      </div>

      <button
        type="button"
        onClick={resetRound}
        className="mt-auto rounded-2xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-sm font-bold text-violet-200"
      >
        Yeni Tur
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
function FallingCatchGame() {
  interface FallingItem {
    id: string;
    emoji: string;
    isBomb: boolean;
    x: number;
    y: number;
  }

  const items = ["🍎", "🌟", "💎", "🎁", "🏆", "🍌", "🎯"];
  const [falling, setFalling] = useState<FallingItem[]>([]);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [bombHit, setBombHit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [finished, setFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const basketRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef({
    falling: [] as FallingItem[],
    basketX: 50,
    score: 0,
    caught: 0,
    finished: false,
    containerWidth: 400,
  });

  const BASKET_WIDTH = 60;
  const ITEM_SIZE = 40;
  const SPAWN_INTERVAL = 650;

  useEffect(() => {
    stateRef.current.falling = falling;
  }, [falling]);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          stateRef.current.finished = true;
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (finished) return;

    const spawnTimer = window.setInterval(() => {
      setFalling(prev => {
        const newItem: FallingItem = {
          id: `${Date.now()}-${Math.random()}`,
          emoji: Math.random() < 0.16 ? "💣" : items[Math.floor(Math.random() * items.length)],
          isBomb: Math.random() < 0.16,
          x: Math.random() * 80 + 10,
          y: 0,
        };
        if (newItem.isBomb) newItem.emoji = "💣";
        return [...prev, newItem];
      });
    }, SPAWN_INTERVAL);

    return () => window.clearInterval(spawnTimer);
  }, [finished]);

  useEffect(() => {
    if (finished) return;

    if (containerRef.current) {
      stateRef.current.containerWidth = containerRef.current.clientWidth;
    }

    let animationId: number;
    let lastUpdateTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateTime;

      if (deltaTime >= 40) {
        lastUpdateTime = now;

        setFalling(prev => {
          const updated: FallingItem[] = [];
          let itemsCaught = 0;

          prev.forEach(item => {
            const newY = item.y + 2.7;

            if (newY > 90) {
              return;
            }

            const itemLeft = (item.x / 100) * stateRef.current.containerWidth;
            const itemRight = itemLeft + ITEM_SIZE;
            const basketLeft = (stateRef.current.basketX / 100) * stateRef.current.containerWidth;
            const basketRight = basketLeft + BASKET_WIDTH;

            if (newY > 80 && itemRight > basketLeft && itemLeft < basketRight) {
              if (item.isBomb) {
                setBombHit(true);
                setFinished(true);
                return;
              }
              itemsCaught += 1;
              return;
            }

            updated.push({ ...item, y: newY });
          });

          if (itemsCaught > 0) {
            setCaught(c => c + itemsCaught);
            setScore(s => s + itemsCaught);
          }

          return updated;
        });
      }

      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationId);
  }, [finished]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !basketRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100 - 10, (relativeX / rect.width) * 100));
    
    stateRef.current.basketX = percentage;
    basketRef.current.style.left = `${percentage}%`;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!containerRef.current || !basketRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(90, ((touch.clientX - rect.left) / rect.width) * 100));
    stateRef.current.basketX = percentage;
    basketRef.current.style.left = `${percentage}%`;
  };

  const resetGame = () => {
    setFalling([]);
    setScore(0);
    setCaught(0);
    setBombHit(false);
    setTimeLeft(30);
    setFinished(false);
    stateRef.current.basketX = 50;
    if (basketRef.current) {
      basketRef.current.style.left = "50%";
    }
  };

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-purple-400/30 bg-purple-500/10 p-5 text-center text-white">
        <div className="text-4xl">🎉</div>
        <h3 className="text-2xl font-black">{bombHit ? "Bomba!" : "Oyun Bitti!"}</h3>
        <div className="space-y-2 text-sm text-purple-100">
          <p>Toplam Skor: <span className="font-black text-purple-300">{score}</span></p>
          <p>{bombHit ? "Bombaya yakalandın!" : <>Yakalanan: <span className="font-black text-purple-300">{caught}</span></>}</p>
        </div>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-purple-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-4 rounded-3xl border border-purple-400/30 bg-purple-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-200/80">Hazine Av</p>
          <h3 className="text-xl font-black">Düşenleri Yakala</h3>
        </div>
        <div className="rounded-full bg-purple-500/20 px-2.5 py-1 text-xs font-black text-purple-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-purple-100">
        <span>⏱ {timeLeft}s</span>
        <span>📦 {caught} yakalandı</span>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        className="relative min-h-[260px] flex-1 rounded-2xl bg-slate-900/30 border border-purple-300/20 cursor-none overflow-hidden"
      >
        {falling.map(item => (
          <div
            key={item.id}
            className="absolute text-3xl"
            style={{ left: `${item.x}%`, top: `${item.y}%`, transform: "translate(-50%, -50%)" }}
          >
            {item.emoji}
          </div>
        ))}

        <div
          ref={basketRef}
          className="absolute bottom-2 bg-purple-500 rounded-lg border-2 border-purple-300 flex items-center justify-center text-2xl"
          style={{
            left: "50%",
            width: `${BASKET_WIDTH}px`,
            height: "40px",
            transform: "translateX(-50%)",
            transition: "none",
          }}
        >
          🧺
        </div>
      </div>

      <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-purple-100 text-center">
        Fareyi hareket ettir, düşenleri yakala!
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
function TileBlitzGame() {
  const [tiles, setTiles] = useState<number[]>([]);
  const [nextTarget, setNextTarget] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("Hazırlanıyor...");

  const GRID_SIZE = 4;
  const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

  const generateTiles = useCallback(() => {
    const nums = Array.from({ length: TOTAL_TILES }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    setTiles(nums);
    setNextTarget(1);
    setMessage("1'den başla!");
  }, []);

  useEffect(() => {
    generateTiles();
  }, [generateTiles]);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setFinished(true);
          setMessage("Oyun bitti!");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished]);

  const handleTileClick = (tileValue: number) => {
    if (finished) return;

    if (tileValue === nextTarget) {
      const newScore = score + 1;
      setScore(newScore);
      setMessage(`Doğru! ${newScore} puan`);

      const nextVal = nextTarget + 1;
      if (nextVal > TOTAL_TILES) {
        setTiles(prev => {
          const updated = [...prev];
          for (let i = 0; i < updated.length; i += 1) {
            if (updated[i] === nextTarget) {
              updated[i] = -1;
            }
          }
          return updated;
        });
        setNextTarget(1);
        window.setTimeout(() => generateTiles(), 500);
      } else {
        setTiles(prev => {
          const updated = [...prev];
          for (let i = 0; i < updated.length; i += 1) {
            if (updated[i] === nextTarget) {
              updated[i] = -1;
            }
          }
          return updated;
        });
        setNextTarget(nextVal);
      }
      return;
    }

    setMessage(`Yanlış! ${nextTarget} arıyorsun`);
  };

  const resetGame = () => {
    setScore(0);
    setTimeLeft(30);
    setFinished(false);
    setNextTarget(1);
    generateTiles();
  };

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-pink-400/30 bg-pink-500/10 p-5 text-center text-white">
        <div className="text-4xl">🎊</div>
        <h3 className="text-2xl font-black">Oyun Bitti!</h3>
        <p className="text-sm text-pink-100">Toplam Skor: <span className="font-black text-pink-300">{score}</span></p>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-pink-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-pink-400/30 bg-pink-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-200/80">Tile Blitz</p>
          <h3 className="text-xl font-black">Sırayla Tıkla</h3>
        </div>
        <div className="rounded-full bg-pink-500/20 px-2.5 py-1 text-xs font-black text-pink-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-pink-100">
        <span>⏱ {timeLeft}s</span>
        <span>🎯 Hedef: {nextTarget}</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
        {tiles.map((value, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleTileClick(value)}
            disabled={value === -1 || finished}
            className={`flex h-16 items-center justify-center rounded-2xl text-lg font-black transition-all active:scale-95 ${
              value === -1
                ? "bg-slate-700/30 text-slate-500 cursor-default opacity-30"
                : value === nextTarget
                ? "border-2 border-pink-400 bg-pink-500/40 text-white"
                : "border border-pink-300/30 bg-slate-900/50 text-pink-200 hover:bg-slate-800/60"
            }`}
          >
            {value === -1 ? "✓" : value}
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-2xl bg-black/10 px-3 py-2 text-xs text-pink-100 text-center">
        {message}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
function LetterDashGame() {
  const [currentLetter, setCurrentLetter] = useState("");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("Harfleri yaz!");
  const [letterDisplay, setLetterDisplay] = useState("");
  const [letterLifetime, setLetterLifetime] = useState(3);
  const inputRef = useRef<HTMLInputElement>(null);

  const LETTER_TIMEOUT = 3000;

  const generateLetter = useCallback(() => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const newLetter = letters[Math.floor(Math.random() * letters.length)];
    setCurrentLetter(newLetter);
    setLetterDisplay(newLetter);
    setLetterLifetime(3);
  }, []);

  useEffect(() => {
    generateLetter();
  }, [generateLetter]);

  useEffect(() => {
    if (finished) return;

    const timer = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setFinished(true);
          setMessage("Oyun bitti!");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (finished || !letterDisplay) return;

    const fadeTimer = window.setInterval(() => {
      setLetterLifetime(prev => {
        if (prev <= 0.1) {
          setLetterDisplay("");
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => window.clearInterval(fadeTimer);
  }, [finished, letterDisplay]);

  const handleKeyInput = (key: string) => {
    if (finished || !letterDisplay) return;

    const upperKey = key.toUpperCase();
    if (/^[A-Z]$/.test(upperKey)) {
      if (upperKey === currentLetter) {
        const newScore = score + 1;
        setScore(newScore);
        setMessage(`Doğru! ${newScore} puan`);
        generateLetter();
      } else {
        setMessage(`Yanlış! ${currentLetter} arıyordum`);
      }
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    handleKeyInput(event.key);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value) {
      handleKeyInput(value[value.length - 1]);
      event.target.value = "";
    }
  };

  const handleInputFocus = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const resetGame = () => {
    setScore(0);
    setTimeLeft(30);
    setFinished(false);
    setMessage("Harfleri yaz!");
    generateLetter();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    if (!finished) {
      inputRef.current?.focus();
    }
  }, [finished]);

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-5 text-center text-white">
        <div className="text-4xl">⌨️</div>
        <h3 className="text-2xl font-black">Oyun Bitti!</h3>
        <p className="text-sm text-cyan-100">Toplam Skor: <span className="font-black text-cyan-300">{score}</span></p>
        <button
          type="button"
          onClick={resetGame}
          className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-white"
        >
          Tekrar oyna
        </button>
      </div>
    );
  }

  return (
    <div
      onKeyPress={handleKeyPress}
      className="flex h-full flex-col gap-2 rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-white shadow-2xl outline-none md:gap-4 md:p-4"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        className="absolute w-0 h-0 opacity-0"
        autoFocus
        autoCapitalize="characters"
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Letter Dash</p>
          <h3 className="text-xl font-black">Hızlı Yazı</h3>
        </div>
        <div className="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-black text-cyan-100">Skor: {score}</div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/30 px-3 py-1.5 text-xs text-cyan-100 md:py-2">
        <span>⏱ {timeLeft}s</span>
        <span>⌨️ Harfleri yaz</span>
      </div>

      <div className="flex-1 -mt-1 flex items-start justify-center rounded-2xl border border-cyan-300/20 bg-slate-900/50 pt-8 md:mt-0 md:items-center md:pt-0">
        {letterDisplay && (
          <div
            className="text-9xl font-black"
            style={{
              opacity: Math.max(0, letterLifetime / 3),
              transition: "opacity 0.1s",
              color: letterLifetime < 1 ? "#ff6b6b" : "#06b6d4",
            }}
          >
            {letterDisplay}
          </div>
        )}
        {!letterDisplay && (
          <div className="text-3xl text-cyan-400 font-bold">⏳ Harf geliyor...</div>
        )}
      </div>

      <div className="rounded-2xl bg-black/10 px-3 py-2 text-xs text-cyan-100 text-center">
        {message}
      </div>
    </div>
  );
}

function FlappyBirdGame() {
  const [birdY, setBirdY] = useState(45);
  const [pipes, setPipes] = useState([{ x: 100, gap: 34 + Math.random() * 32 }]);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const velocityRef = useRef(0);
  const birdYRef = useRef(45);

  const resetGame = useCallback(() => {
    setBirdY(45);
    setPipes([{ x: 100, gap: 34 + Math.random() * 32 }]);
    setScore(0);
    setStarted(false);
    setFinished(false);
    velocityRef.current = 0;
    birdYRef.current = 45;
  }, []);

  const flap = useCallback(() => {
    if (finished) { resetGame(); return; }
    setStarted(true);
    velocityRef.current = -2.7;
  }, [finished, resetGame]);

  useEffect(() => {
    if (finished || !started) return;
    let frame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const elapsed = time - previousTime;
      if (elapsed < 30) {
        frame = requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min(elapsed / 16.67, 2);
      previousTime = time;
      velocityRef.current = Math.min(velocityRef.current + 0.18 * delta, 3.8);
      const nextBirdY = birdYRef.current + velocityRef.current * delta;
      birdYRef.current = nextBirdY;
      setBirdY(nextBirdY);

      setPipes(current => {
        const next = current.map(pipe => ({ ...pipe, x: pipe.x - 0.95 * delta }));
        if (next[0].x < 48 && next.length < 2) next.push({ x: 100, gap: 30 + Math.random() * 40 });
        if (next[0].x < -18) { next.shift(); setScore(value => value + 1); }
        const pipe = next[0];
        if (pipe && pipe.x < 28 && pipe.x > 12 && (nextBirdY < pipe.gap - 19 || nextBirdY > pipe.gap + 19)) setFinished(true);
        return next;
      });

      if (nextBirdY < 0 || nextBirdY > 94) setFinished(true);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [finished, started]);

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-3xl border border-orange-300/30 bg-orange-500/10 p-3 text-white shadow-2xl outline-none md:gap-4 md:p-4" onPointerDown={flap} role="button" tabIndex={0} aria-label="Flappy Kuş oyun alanı">
      <div className="flex items-center justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200/80">Flappy Kuş</p><h3 className="text-xl font-black">Engelleri aş</h3></div>
        <div className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-black text-orange-100">Skor: {score}</div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-orange-200/20 bg-sky-400/20" style={{ background: "linear-gradient(#7dd3fc,#bae6fd 68%,#86efac 68%)" }}>
        <div className="absolute left-[22%] z-10 text-3xl drop-shadow-md" style={{ top: `${birdY}%`, transform: "translateY(-50%)" }}>🐤</div>
        {pipes.map((pipe, index) => <div key={index} className="absolute inset-y-0 w-11" style={{ left: `${pipe.x}%` }}>
          <div className="absolute top-0 w-full rounded-b-md bg-emerald-600 shadow-inner" style={{ height: `${pipe.gap - 22}%` }} />
          <div className="absolute top-0 -left-1 w-[calc(100%+8px)] rounded-md bg-emerald-500" style={{ height: "7%" }} />
          <div className="absolute bottom-0 w-full rounded-t-md bg-emerald-600 shadow-inner" style={{ height: `${78 - pipe.gap}%` }} />
          <div className="absolute bottom-0 -left-1 w-[calc(100%+8px)] rounded-md bg-emerald-500" style={{ height: "7%" }} />
        </div>)}
        <div className="absolute inset-x-0 bottom-0 h-[7%] bg-lime-500/90" />
        {finished && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/55 text-center"><p className="text-2xl font-black">Oyun bitti</p><p className="mt-1 text-sm text-orange-100">Skor: {score}</p><button type="button" onPointerDown={event => { event.stopPropagation(); resetGame(); }} className="mt-3 rounded-full bg-orange-500 px-4 py-2 text-sm font-black">Tekrar oyna</button></div>}
        {!finished && !started && <p className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-slate-700/70">Başlamak için dokun</p>}
      </div>
    </div>
  );
}

function SnakeGame() {
  type Cell = { x: number; y: number };
  type Direction = "up" | "down" | "left" | "right";
  const WIDTH = 12;
  const HEIGHT = 18;
  const [snake, setSnake] = useState<Cell[]>([{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }]);
  const [food, setFood] = useState<Cell>({ x: 9, y: 9 });
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");

  const resetGame = useCallback(() => {
    setSnake([{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }]);
    setFood({ x: 9, y: 9 });
    setScore(0);
    setStarted(false);
    setFinished(false);
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
  }, []);

  const changeDirection = useCallback((direction: Direction) => {
    const current = directionRef.current;
    if ((current === "up" && direction === "down") || (current === "down" && direction === "up") || (current === "left" && direction === "right") || (current === "right" && direction === "left")) return;
    queuedDirectionRef.current = direction;
    setStarted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keys: Record<string, Direction> = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
      const direction = keys[event.key];
      if (direction) { event.preventDefault(); changeDirection(direction); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeDirection]);

  useEffect(() => {
    if (!started || finished) return;
    const timer = window.setInterval(() => {
      setSnake(current => {
        const direction = queuedDirectionRef.current;
        directionRef.current = direction;
        const head = current[0];
        const nextHead = { x: head.x + (direction === "right" ? 1 : direction === "left" ? -1 : 0), y: head.y + (direction === "down" ? 1 : direction === "up" ? -1 : 0) };
        const hitWall = nextHead.x < 0 || nextHead.x >= WIDTH || nextHead.y < 0 || nextHead.y >= HEIGHT;
        const ateSelf = current.some(cell => cell.x === nextHead.x && cell.y === nextHead.y);
        if (hitWall || ateSelf) { setFinished(true); return current; }
        const ateFood = nextHead.x === food.x && nextHead.y === food.y;
        const nextSnake = [nextHead, ...current];
        if (!ateFood) nextSnake.pop();
        if (ateFood) {
          setScore(value => value + 1);
          const freeCells = Array.from({ length: WIDTH * HEIGHT }, (_, index) => ({ x: index % WIDTH, y: Math.floor(index / WIDTH) }))
            .filter(cell => !nextSnake.some(part => part.x === cell.x && part.y === cell.y));
          setFood(freeCells[Math.floor(Math.random() * freeCells.length)] ?? { x: 9, y: 9 });
        }
        return nextSnake;
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [food, finished, started]);

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-3xl border border-green-300/30 bg-green-500/10 p-3 text-white shadow-2xl md:gap-4 md:p-4">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-200/80">Yılan Oyunu</p><h3 className="text-xl font-black">Yemi yakala</h3></div><div className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-black text-green-100">Skor: {score}</div></div>
      <div className="mx-auto grid h-[min(58vh,480px)] w-full max-w-[320px] overflow-hidden rounded-2xl border border-green-300/30 bg-slate-950/50 shadow-inner" style={{ gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${HEIGHT}, minmax(0, 1fr))` }}>
        {Array.from({ length: WIDTH * HEIGHT }, (_, index) => { const cell = { x: index % WIDTH, y: Math.floor(index / WIDTH) }; const snakePart = snake.some(part => part.x === cell.x && part.y === cell.y); const isHead = snake[0]?.x === cell.x && snake[0]?.y === cell.y; const isFood = food.x === cell.x && food.y === cell.y; return <div key={index} className={`flex min-h-0 items-center justify-center border-[0.5px] border-white/5 text-[clamp(10px,3vw,18px)] leading-none ${snakePart ? (isHead ? "bg-green-300" : "bg-green-500") : isFood ? "bg-red-500/40 ring-2 ring-inset ring-red-300/80" : "bg-transparent"}`}>{isHead ? "●" : snakePart ? "•" : isFood ? "🍎" : ""}</div>; })}
      </div>
      <div className="text-center text-xs text-green-100/80">{finished ? "Oyun bitti" : started ? "Yılanı yönlendir" : "Başlamak için bir yöne dokun"}</div>
      <div className="mx-auto grid w-36 grid-cols-3 gap-1.5">
        <span /><button type="button" onClick={() => changeDirection("up")} className="rounded-lg bg-green-500/30 py-2 text-lg">↑</button><span />
        <button type="button" onClick={() => changeDirection("left")} className="rounded-lg bg-green-500/30 py-2 text-lg">←</button><button type="button" onClick={() => changeDirection("down")} className="rounded-lg bg-green-500/30 py-2 text-lg">↓</button><button type="button" onClick={() => changeDirection("right")} className="rounded-lg bg-green-500/30 py-2 text-lg">→</button>
      </div>
      {finished && <button type="button" onClick={resetGame} className="mx-auto rounded-full bg-green-500 px-4 py-2 text-sm font-black">Tekrar oyna</button>}
    </div>
  );
}

function ColorMemoryGame() {
  const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];
  const [sequence, setSequence] = useState<number[]>([Math.floor(Math.random() * colors.length)]);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [userIndex, setUserIndex] = useState(0);
  const [showing, setShowing] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setShowing(true);
    setUserIndex(0);
    sequence.forEach((tile, index) => {
      window.setTimeout(() => { if (!cancelled) setActiveTile(tile); }, index * 650);
      window.setTimeout(() => { if (!cancelled) setActiveTile(null); }, index * 650 + 400);
    });
    const done = window.setTimeout(() => { if (!cancelled) setShowing(false); }, sequence.length * 650 + 100);
    return () => { cancelled = true; window.clearTimeout(done); };
  }, [sequence]);

  const chooseTile = (tile: number) => {
    if (showing || finished) return;
    if (tile !== sequence[userIndex]) { setFinished(true); return; }
    if (userIndex + 1 === sequence.length) {
      setSequence(current => [...current, Math.floor(Math.random() * colors.length)]);
      return;
    }
    setUserIndex(index => index + 1);
    setActiveTile(tile);
    window.setTimeout(() => setActiveTile(null), 180);
  };

  const resetGame = () => {
    setSequence([Math.floor(Math.random() * colors.length)]);
    setUserIndex(0);
    setFinished(false);
  };

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-4 rounded-3xl border border-teal-300/30 bg-teal-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-200/80">Renk Hafızası</p><h3 className="text-xl font-black">Sırayı hatırla</h3></div><div className="rounded-full bg-teal-500/20 px-2.5 py-1 text-xs font-black text-teal-100">Tur: {Math.max(0, sequence.length - 1)}</div></div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-teal-200/20 bg-slate-950/30 p-5">
        <p className="text-center text-sm font-semibold text-teal-100">{finished ? "Yanlış sıra!" : showing ? "Sırayı izle..." : "Aynı sıraya dokun"}</p>
        <div className="grid w-full max-w-[260px] grid-cols-3 gap-3">
          {colors.map((color, index) => <button key={color} type="button" aria-label={`Renk ${index + 1}`} onClick={() => chooseTile(index)} className="aspect-square rounded-2xl border-2 border-white/10 transition-transform active:scale-90" style={{ backgroundColor: color, opacity: activeTile === index ? 1 : 0.55, boxShadow: activeTile === index ? `0 0 28px ${color}` : "none" }} />)}
        </div>
        {finished && <button type="button" onClick={resetGame} className="rounded-full bg-teal-500 px-4 py-2 text-sm font-black">Tekrar oyna</button>}
      </div>
    </div>
  );
}

function Game2048() {
  type Direction = "up" | "down" | "left" | "right";
  const [tiles, setTiles] = useState<number[]>(() => addTile(addTile(Array(16).fill(0))));
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function addTile(board: number[]) {
    const empty = board.map((tile, index) => tile === 0 ? index : -1).filter(index => index >= 0);
    if (!empty.length) return board;
    const next = [...board];
    next[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    return next;
  }

  const move = useCallback((direction: Direction) => {
    if (finished) return;
    const lines: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const line = direction === "left" || direction === "right" ? tiles.slice(i * 4, i * 4 + 4) : [tiles[i], tiles[i + 4], tiles[i + 8], tiles[i + 12]];
      lines.push(direction === "right" || direction === "down" ? line.reverse() : line);
    }
    let gained = 0;
    const merged = lines.map(line => {
      const compact = line.filter(Boolean);
      const result: number[] = [];
      for (let i = 0; i < compact.length; i++) {
        if (compact[i] === compact[i + 1]) { result.push(compact[i] * 2); gained += compact[i] * 2; i++; }
        else result.push(compact[i]);
      }
      while (result.length < 4) result.push(0);
      return direction === "right" || direction === "down" ? result.reverse() : result;
    });
    const next = Array(16).fill(0);
    merged.forEach((line, i) => line.forEach((value, j) => { if (direction === "left" || direction === "right") next[i * 4 + j] = value; else next[j * 4 + i] = value; }));
    if (next.every((tile, index) => tile === tiles[index])) return;
    const withNewTile = addTile(next);
    setTiles(withNewTile);
    setScore(value => value + gained);
    const canMove = withNewTile.some((tile, index) => tile === 0 || (index % 4 < 3 && tile === withNewTile[index + 1]) || (index < 12 && tile === withNewTile[index + 4]));
    if (!canMove) setFinished(true);
  }, [finished, tiles]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { const key: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }; if (key[event.key]) { event.preventDefault(); move(key[event.key]); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);

  const reset = () => { setTiles(addTile(addTile(Array(16).fill(0)))); setScore(0); setFinished(false); };
  const tileColor = (tile: number) => tile === 0 ? "bg-white/5" : tile <= 4 ? "bg-yellow-100 text-yellow-900" : tile <= 16 ? "bg-yellow-300 text-yellow-950" : tile <= 64 ? "bg-orange-400 text-white" : "bg-red-500 text-white";

  return <div className="flex min-h-[420px] h-full flex-col gap-4 rounded-3xl border border-yellow-300/30 bg-yellow-500/10 p-4 text-white shadow-2xl">
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200/80">2048</p><h3 className="text-xl font-black">Taşları birleştir</h3></div><div className="rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-black text-yellow-100">Skor: {score}</div></div>
    <div className="mx-auto grid w-full max-w-[320px] touch-none grid-cols-4 gap-2 rounded-2xl bg-yellow-950/40 p-2" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => { if (!touchStart.current) return; const dx = event.changedTouches[0].clientX - touchStart.current.x; const dy = event.changedTouches[0].clientY - touchStart.current.y; touchStart.current = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); }}>
      {tiles.map((tile, index) => <div key={index} className={`flex aspect-square items-center justify-center rounded-lg text-lg font-black transition-colors ${tileColor(tile)}`}>{tile || ""}</div>)}
    </div>
    <p className="text-center text-xs text-yellow-100/80">Kaydır veya yön düğmelerini kullan</p>
    <div className="mx-auto grid w-36 grid-cols-3 gap-1.5"><span /><button type="button" onClick={() => move("up")} className="rounded-lg bg-yellow-500/30 py-2 text-lg">↑</button><span /><button type="button" onClick={() => move("left")} className="rounded-lg bg-yellow-500/30 py-2 text-lg">←</button><button type="button" onClick={() => move("down")} className="rounded-lg bg-yellow-500/30 py-2 text-lg">↓</button><button type="button" onClick={() => move("right")} className="rounded-lg bg-yellow-500/30 py-2 text-lg">→</button></div>
    {finished && <div className="text-center"><p className="font-black">Oyun bitti</p><button type="button" onClick={reset} className="mt-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-black">Tekrar oyna</button></div>}
  </div>;
}

function MinesweeperGame() {
  const SIZE = 8;
  const MINES = 8;
  const createBoard = () => {
    const mines = new Set<number>();
    while (mines.size < MINES) mines.add(Math.floor(Math.random() * SIZE * SIZE));
    return Array.from({ length: SIZE * SIZE }, (_, index) => ({
      mine: mines.has(index),
      open: false,
      flag: false,
      count: Array.from({ length: SIZE * SIZE }, (_, neighbor) => neighbor)
        .filter(neighbor => mines.has(neighbor) && Math.abs((neighbor % SIZE) - (index % SIZE)) <= 1 && Math.abs(Math.floor(neighbor / SIZE) - Math.floor(index / SIZE)) <= 1 && neighbor !== index).length,
    }));
  };
  const [board, setBoard] = useState(createBoard);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [flags, setFlags] = useState(0);

  const neighbors = (index: number) => {
    const x = index % SIZE; const y = Math.floor(index / SIZE); const cells: number[] = [];
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) { const nx = x + col; const ny = y + row; if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && (nx !== x || ny !== y)) cells.push(ny * SIZE + nx); }
    return cells;
  };

  const openCell = (index: number) => {
    setBoard(current => {
      if (finished || current[index].open || current[index].flag) return current;
      if (current[index].mine) {
        setFinished(true);
        setWon(false);
        return current.map(cell => cell.mine ? { ...cell, open: true } : cell);
      }
      const next = [...current]; const queue = [index];
      while (queue.length) { const currentIndex = queue.shift()!; if (next[currentIndex].open || next[currentIndex].flag || next[currentIndex].mine) continue; next[currentIndex] = { ...next[currentIndex], open: true }; if (next[currentIndex].count === 0) neighbors(currentIndex).forEach(neighbor => { if (!next[neighbor].open) queue.push(neighbor); }); }
      const cleared = next.filter(cell => !cell.mine && cell.open).length === SIZE * SIZE - MINES;
      if (cleared) { setFinished(true); setWon(true); }
      return next;
    });
  };

  const toggleFlag = (event: React.MouseEvent, index: number) => { event.preventDefault(); if (finished || board[index].open) return; setBoard(current => current.map((cell, cellIndex) => cellIndex === index ? { ...cell, flag: !cell.flag } : cell)); setFlags(value => value + (board[index].flag ? -1 : 1)); };
  const reset = () => { setBoard(createBoard()); setFinished(false); setWon(false); setFlags(0); };
  const numberColor = ["", "text-blue-300", "text-green-300", "text-red-300", "text-purple-300", "text-yellow-300", "text-cyan-300", "text-white", "text-white"];

  return <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-3xl border border-red-300/30 bg-red-500/10 p-3 text-white shadow-2xl md:gap-4 md:p-4">
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200/80">Mayın Tarlası</p><h3 className="text-xl font-black">Güvenli kareleri aç</h3></div><div className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-black text-red-100">Mayın: {Math.max(0, MINES - flags)}</div></div>
    <div className="mx-auto grid w-full max-w-[340px] grid-cols-8 gap-1 rounded-2xl bg-red-950/40 p-2">{board.map((cell, index) => <button key={index} type="button" onClick={() => openCell(index)} onContextMenu={event => toggleFlag(event, index)} className={`flex aspect-square items-center justify-center rounded-md text-sm font-black transition-colors ${cell.open ? (cell.mine ? "bg-red-500" : "bg-slate-700/80") : "bg-slate-500/60 hover:bg-slate-400/70"} ${cell.open && !cell.mine ? numberColor[cell.count] : ""}`}>{cell.open && cell.mine ? "💣" : cell.flag && !cell.open ? "🚩" : cell.open && cell.count ? cell.count : ""}</button>)}</div>
    <p className="text-center text-xs text-red-100/80">{finished ? (won ? "Tebrikler, alan temiz!" : "Mayına bastın!") : "Dokunarak aç, basılı tutarak bayrakla"}</p>
    {finished && <button type="button" onClick={reset} className="mx-auto rounded-full bg-red-500 px-4 py-2 text-sm font-black">Tekrar oyna</button>}
  </div>;
}

function MazeGame() {
  const ROWS = 11;
  const COLS = 11;

  const shuffle = <T,>(items: T[]) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const generateMaze = (level: number) => {
    const maze = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const stack: Array<[number, number]> = [[0, 0]];
    visited[0][0] = true;
    maze[0][0] = 0;

    while (stack.length > 0) {
      const [row, col] = stack[stack.length - 1];
      const directions = shuffle([
        [0, 2],
        [2, 0],
        [0, -2],
        [-2, 0],
      ] as Array<[number, number]>);

      let moved = false;

      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        const wallRow = row + dr / 2;
        const wallCol = col + dc / 2;

        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
          visited[nr][nc] = true;
          maze[nr][nc] = 0;
          maze[wallRow][wallCol] = 0;
          stack.push([nr, nc]);
          moved = true;
          break;
        }
      }

      if (!moved) {
        stack.pop();
      }
    }

    const findPathToExit = (grid: number[][]) => {
      const queue: Array<[number, number]> = [[0, 0]];
      const visitedCells = new Set<string>(["0,0"]);
      const previous = new Map<string, string | null>([["0,0", null]]);

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        if (r === ROWS - 1 && c === COLS - 1) break;

        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          const key = `${nr},${nc}`;

          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === 0 && !visitedCells.has(key)) {
            visitedCells.add(key);
            previous.set(key, `${r},${c}`);
            queue.push([nr, nc]);
          }
        }
      }

      const exitKey = `${ROWS - 1},${COLS - 1}`;
      if (!visitedCells.has(exitKey)) {
        return new Set<string>();
      }

      const path = new Set<string>();
      let cursor: string | null = exitKey;
      while (cursor) {
        path.add(cursor);
        cursor = previous.get(cursor) ?? null;
      }

      return path;
    };

    const protectedPath = findPathToExit(maze);
    const extraWalls = Math.min(18 + (level - 1) * 8, 44);

    for (let i = 0; i < extraWalls; i += 1) {
      const r = 1 + Math.floor(Math.random() * (ROWS - 2));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      const key = `${r},${c}`;
      if ((r === 0 && c === 0) || (r === ROWS - 1 && c === COLS - 1) || protectedPath.has(key)) continue;
      maze[r][c] = 1;
    }

    const finalProtectedPath = findPathToExit(maze);
    if (finalProtectedPath.size === 0) {
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) {
            maze[r][c] = 0;
          }
        }
      }
    }

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if ((r === 0 && c === 0) || (r === ROWS - 1 && c === COLS - 1)) {
          maze[r][c] = 0;
        }
      }
    }

    if (maze[0][0] !== 0) maze[0][0] = 0;
    if (maze[ROWS - 1][COLS - 1] !== 0) maze[ROWS - 1][COLS - 1] = 0;

    return { maze, start: { r: 0, c: 0 }, exit: { r: ROWS - 1, c: COLS - 1 } };
  };

  const getZombieSpawn = (currentMaze: number[][]) => {
    const candidates: Array<[number, number]> = [];
    for (let r = 1; r < ROWS - 1; r += 1) {
      for (let c = 1; c < COLS - 1; c += 1) {
        if (currentMaze[r][c] === 0 && (Math.abs(r - (ROWS - 1)) + Math.abs(c - (COLS - 1)) > 8)) {
          candidates.push([r, c]);
        }
      }
    }
    if (candidates.length === 0) return { r: ROWS - 2, c: COLS - 2 };
    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    return { r, c };
  };

  const [level, setLevel] = useState(1);
  const [mazeState, setMazeState] = useState(() => generateMaze(1));
  const [maze, setMaze] = useState<number[][]>(mazeState.maze);
  const [playerPos, setPlayerPos] = useState({ r: 0, c: 0 });
  const [zombiePos, setZombiePos] = useState(() => getZombieSpawn(mazeState.maze));
  const [startTime] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [time, setTime] = useState(0);

  const loadLevel = useCallback((nextLevel: number) => {
    const nextMap = generateMaze(nextLevel);
    setMaze(nextMap.maze);
    setMazeState(nextMap);
    setPlayerPos({ r: 0, c: 0 });
    setZombiePos(getZombieSpawn(nextMap.maze));
    setFinished(false);
    setGameOver(false);
  }, []);

  useEffect(() => {
    loadLevel(level);
  }, [level, loadLevel]);

  const canMove = useCallback((r: number, c: number) => {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && maze[r][c] === 0;
  }, [maze]);

  const move = useCallback((dr: number, dc: number) => {
    if (finished || gameOver) return;

    setPlayerPos((current) => {
      const nr = current.r + dr;
      const nc = current.c + dc;

      if (!canMove(nr, nc)) {
        return current;
      }

      const nextPos = { r: nr, c: nc };
      if (nextPos.r === zombiePos.r && nextPos.c === zombiePos.c) {
        setGameOver(true);
        return current;
      }

      if (nr === ROWS - 1 && nc === COLS - 1) {
        setFinished(true);
        setTimeout(() => {
          setLevel(prev => prev + 1);
        }, 900);
      }

      return nextPos;
    });
  }, [canMove, finished, gameOver, zombiePos]);

  useEffect(() => {
    if (finished || gameOver) return;
    const timer = setInterval(() => {
      setTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, [finished, gameOver, startTime]);

  useEffect(() => {
    if (finished || gameOver) return;

    const intervalMs = Math.max(500, 900 - level * 40);
    const timer = setInterval(() => {
      setZombiePos((current) => {
        const options: Array<[number, number]> = [];
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

        for (const [dr, dc] of dirs) {
          const nr = current.r + dr;
          const nc = current.c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && maze[nr][nc] === 0) {
            options.push([nr, nc]);
          }
        }

        if (options.length === 0) return current;

        let best = options[0];
        let bestScore = Number.POSITIVE_INFINITY;

        for (const [nr, nc] of options) {
          const score = Math.abs(nr - playerPos.r) + Math.abs(nc - playerPos.c);
          if (score < bestScore) {
            bestScore = score;
            best = [nr, nc];
          }
        }

        const [nextR, nextC] = best;
        if (nextR === playerPos.r && nextC === playerPos.c) {
          setGameOver(true);
          return current;
        }

        return { r: nextR, c: nextC };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [finished, gameOver, level, maze, playerPos]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); move(-1, 0); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(1, 0); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(0, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(0, 1); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [move]);

  const cellSize = Math.min(22, Math.floor((window.innerWidth - 64) / COLS));

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-[28px] border border-violet-300/30 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.28),_rgba(15,23,42,0.92)_42%)] p-4 text-white shadow-[0_22px_60px_rgba(76,29,149,0.45)]">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2 backdrop-blur-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/80">Labirent</p>
          <h3 className="text-xl font-black text-white">Seviye {level}</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1.5 text-xs font-black text-violet-100 shadow-inner shadow-violet-900/30">
          <span>⏱️</span>
          <span>{time}s</span>
        </div>
      </div>

      {gameOver ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-[24px] border border-red-300/30 bg-red-500/10 p-5 text-center shadow-inner shadow-red-900/20">
          <span className="text-5xl">💀</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200/80">Öldün</p>
            <h4 className="mt-2 text-3xl font-black text-white">Zombi seni yakaladı!</h4>
          </div>
          <button
            type="button"
            onClick={() => {
              setLevel(1);
              setTimeout(() => loadLevel(1), 0);
            }}
            className="rounded-full border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm font-black text-red-50"
          >
            Tekrar başla
          </button>
        </div>
      ) : !finished ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="mx-auto rounded-2xl border border-violet-200/15 bg-slate-950/40 p-2 shadow-[inset_0_0_20px_rgba(139,92,246,0.12)]"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                gap: "2px",
              }}
            >
              {maze.map((row, r) => row.map((cell, c) => {
                const isPlayer = playerPos.r === r && playerPos.c === c;
                const isZombie = zombiePos.r === r && zombiePos.c === c;
                const isExit = r === ROWS - 1 && c === COLS - 1;
                const tileBg = cell === 1
                  ? "linear-gradient(135deg, rgba(71,85,105,0.96), rgba(30,41,59,0.98))"
                  : isExit
                    ? "linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.95))"
                    : "linear-gradient(135deg, rgba(96,165,250,0.20), rgba(59,130,246,0.12))";

                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      background: tileBg,
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isPlayer || isZombie || isExit ? "13px" : "9px",
                      boxShadow: cell === 1 ? "inset 0 0 0 1px rgba(148,163,184,0.08)" : "inset 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    {isPlayer ? "🧍" : isZombie ? "🧟" : isExit ? "🚪" : null}
                  </div>
                );
              }))}
            </div>
            <p className="text-xs font-medium text-violet-100/70">Sakin ol, zombi seni takip ediyor. Çıkışa ulaş!</p>
          </div>

          <div className="grid grid-cols-3 gap-2 px-1 pb-1">
            <div />
            <button onClick={() => move(-1, 0)} className="rounded-xl border border-violet-300/25 bg-violet-500/20 py-2 text-lg font-black text-violet-50 shadow-sm shadow-violet-700/25 transition hover:bg-violet-500/30 active:scale-95">⬆️</button>
            <div />
            <button onClick={() => move(0, -1)} className="rounded-xl border border-violet-300/25 bg-violet-500/20 py-2 text-lg font-black text-violet-50 shadow-sm shadow-violet-700/25 transition hover:bg-violet-500/30 active:scale-95">⬅️</button>
            <button onClick={() => move(1, 0)} className="rounded-xl border border-violet-300/25 bg-violet-500/20 py-2 text-lg font-black text-violet-50 shadow-sm shadow-violet-700/25 transition hover:bg-violet-500/30 active:scale-95">⬇️</button>
            <button onClick={() => move(0, 1)} className="rounded-xl border border-violet-300/25 bg-violet-500/20 py-2 text-lg font-black text-violet-50 shadow-sm shadow-violet-700/25 transition hover:bg-violet-500/30 active:scale-95">➡️</button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-[24px] border border-emerald-300/30 bg-emerald-500/10 p-5 text-center shadow-inner shadow-emerald-900/20">
          <span className="text-5xl">🎉</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-200/80">Çıktın</p>
            <h4 className="mt-2 text-3xl font-black text-white">Seviye {level} tamamlandı!</h4>
          </div>
          <div className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-lg font-black text-emerald-100">
            ⏱️ {time} saniye
          </div>
        </div>
      )}
    </div>
  );
}

function RockPaperScissorsGame() {
  type Choice = "rock" | "paper" | "scissors";
  const choices: Choice[] = ["rock", "paper", "scissors"];
  const emojis: Record<Choice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
  const labels: Record<Choice, string> = { rock: "Taş", paper: "Kağıt", scissors: "Makas" };
  const TOTAL_ROUNDS = 10;

  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const determineWinner = (player: Choice, computer: Choice): "win" | "lose" | "draw" => {
    if (player === computer) return "draw";
    if ((player === "rock" && computer === "scissors") ||
        (player === "paper" && computer === "rock") ||
        (player === "scissors" && computer === "paper")) {
      return "win";
    }
    return "lose";
  };

  const play = (player: Choice) => {
    if (gameFinished || roundCount >= TOTAL_ROUNDS) return;
    
    const computer = choices[Math.floor(Math.random() * choices.length)];
    const outcome = determineWinner(player, computer);
    
    setPlayerChoice(player);
    setComputerChoice(computer);
    setResult(outcome);
    
    const newRound = roundCount + 1;
    setRoundCount(newRound);
    
    if (outcome === "win") {
      setPlayerScore(p => p + 1);
    } else if (outcome === "lose") {
      setComputerScore(c => c + 1);
    }
    
    if (newRound >= TOTAL_ROUNDS) {
      setGameFinished(true);
    }
  };

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-4 rounded-3xl border border-blue-300/30 bg-blue-500/10 p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/80">Taş Kağıt Makas</p>
          <h3 className="text-xl font-black">Bilgisayarla oyna</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-full bg-blue-500/20 px-3 py-1.5 text-xs font-black text-blue-100">
            {playerScore}–{computerScore}
          </div>
          <span className="text-[10px] text-blue-200/60 font-bold">Tur: {roundCount}/{TOTAL_ROUNDS}</span>
        </div>
      </div>

      {/* Oyun alanı */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {playerChoice && computerChoice && (
          <div className="flex items-center justify-center gap-8">
            {/* Oyuncu seçimi */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-6xl">{emojis[playerChoice]}</span>
              <span className="text-sm font-bold text-blue-300">{labels[playerChoice]}</span>
            </div>

            {/* Sonuç */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl font-black">
                {result === "win" ? "✅" : result === "lose" ? "❌" : "🤝"}
              </span>
              <span className="text-xs font-bold text-blue-200">
                {result === "win" ? "Kazandın!" : result === "lose" ? "Kaybettin!" : "Berabere!"}
              </span>
            </div>

            {/* Bilgisayar seçimi */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-6xl">{emojis[computerChoice]}</span>
              <span className="text-sm font-bold text-blue-300">Bilgisayar</span>
            </div>
          </div>
        )}

        {!gameFinished && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-blue-200/70 text-center">
              {roundCount === 0 ? "10 tur oyna!" : roundCount === TOTAL_ROUNDS ? "Son tur!" : `Tur ${roundCount + 1}/10`}
            </p>
            <div className="flex gap-4">
              {choices.map(choice => (
                <button
                  key={choice}
                  onClick={() => play(choice)}
                  disabled={roundCount >= TOTAL_ROUNDS}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-blue-500/20 px-4 py-3 hover:bg-blue-500/30 transition-colors active:scale-95 disabled:opacity-50"
                >
                  <span className="text-4xl">{emojis[choice]}</span>
                  <span className="text-xs font-bold">{labels[choice]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-3xl font-black">🏁 Oyun Bitti!</p>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-blue-200/70">Final Sonuç</span>
              <div className="text-4xl font-black">
                {playerScore > computerScore ? "🎉 Kazandın!" : playerScore < computerScore ? "😢 Kaybettin!" : "🤝 Berabere!"}
              </div>
              <span className="text-2xl font-black text-blue-300">{playerScore}–{computerScore}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamePanel({ isOpen, onClose, me, other, initialGameId = null }: Props) {
  const [view,       setView]       = useState<"select" | "wordle" | "xox" | "target" | "puzzle" | "memory" | "emoji" | "math" | "tap" | "catch" | "blitz" | "letter" | "flappy" | "snake" | "colors" | "2048" | "mines" | "rps" | "maze" | "space" | "neon" | "nova">(initialGameId ? "xox" : "select");
  const [myScore,    setMyScore]    = useState<ScoreRow>(EMPTY_SCORE);
  const [otherScore, setOtherScore] = useState<ScoreRow>(EMPTY_SCORE);
  const [loading,    setLoading]    = useState(false);
  const [wordList,   setWordList]   = useState<string[] | null>(null);
  const [xoxStatus,  setXoxStatus]  = useState("published");

  /* Panel kapanınca seçici'ye dön */
  useEffect(() => { if (!isOpen) setView("select"); }, [isOpen]);
  useEffect(() => { if (initialGameId) setView("xox"); }, [initialGameId]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/games/xox/status", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.status) setXoxStatus(data.status); })
      .catch(() => undefined);
  }, [isOpen]);

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
      className="fixed inset-0 z-[90] flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col"
      style={{
        background: "linear-gradient(170deg,#1a0e2e 0%,#0f172a 55%,#0c1a2e 100%)",
        overscrollBehavior: "contain" as const,
      }}
    >
      {/* Parlayan üst efekt */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -5%,rgba(139,92,246,0.22) 0%,transparent 55%)" }} />

      {/* ── HEADER (sabit yükseklik) ──────────────────────────────────── */}
      <div className="relative flex-none flex items-center justify-between px-5 pt-12 pb-3">
        <div className="flex items-center gap-3">
          {view !== "select" && (
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
              {view === "select" ? "Mini Oyunlar" : view === "xox" ? "XOX" : view === "target" ? "Hedef" : view === "puzzle" ? "Bulmaca" : view === "memory" ? "Eşleştir" : view === "emoji" ? "Emoji Rush" : view === "math" ? "Hızlı Hesap" : view === "tap" ? "Speed Tap" : view === "catch" ? "Hazine Av" : view === "blitz" ? "Tile Blitz" : view === "letter" ? "Letter Dash" : view === "flappy" ? "Flappy Kuş" : view === "snake" ? "Yılan Oyunu" : view === "colors" ? "Renk Hafızası" : view === "2048" ? "2048" : view === "mines" ? "Mayın Tarlası" : view === "rps" ? "Taş Kağıt Makas" : view === "maze" ? "Labirent" : "Wordle"}
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

      {/* ── İÇERİK (kalan alan, kaydırılabilir) ────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>

        {/* OYUN SEÇİCİ */}
        {view === "select" && (
          <div className="px-5 pt-2 pb-24 flex flex-col gap-4">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Oyun Seç</p>
            <div className="grid grid-cols-3 gap-3">
              {GAME_CARDS.map(card => {
                const cardActive = card.id === "xox" ? xoxStatus !== "closed" : card.active;
                const cardSubtitle = card.id === "xox" ? ({ published: "Rakibinle oyna", coming_soon: "Yakında", draft: "Taslak / Test", closed: "Kapalı" }[xoxStatus] ?? "Kapalı") : card.subtitle;
                return (
                <button
                  key={card.id}
                  onClick={() => {
                    if (!cardActive) return;
                      if (card.id === "xox") setView("xox");
                    else if (card.id === "target") setView("target");
                    else if (card.id === "puzzle") setView("puzzle");
                    else if (card.id === "memory") setView("memory");
                    else if (card.id === "emoji") setView("emoji");
                    else if (card.id === "math") setView("math");
                    else if (card.id === "tap") setView("tap");
                    else if (card.id === "catch") setView("catch");
                    else if (card.id === "blitz") setView("blitz");
                    else if (card.id === "letter") setView("letter");
                    else if (card.id === "flappy") setView("flappy");
                    else if (card.id === "snake") setView("snake");
                    else if (card.id === "colors") setView("colors");
                    else if (card.id === "2048") setView("2048");
                    else if (card.id === "mines") setView("mines");
                    else if (card.id === "rps") setView("rps");
                    else if (card.id === "maze") setView("maze");
                    else if (card.id === "space") setView("space");
                    else if (card.id === "neon") setView("neon");
                    else if (card.id === "nova") setView("nova");
                    else setView("wordle");
                  }}
                  disabled={!cardActive}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 px-2 transition-all active:scale-95"
                  style={{
                    background: cardActive
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${card.active
                      ? "rgba(139,92,246,0.45)"
                      : "rgba(255,255,255,0.07)"}`,
                    opacity: cardActive ? 1 : 0.45,
                    cursor:  cardActive ? "pointer" : "default",
                  }}
                >
                  <span className="text-3xl leading-none">{card.emoji}</span>
                  <span className="text-[13px] font-black text-white leading-tight">{card.title}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: cardActive ? `${card.color}22` : "rgba(255,255,255,0.05)",
                      color:      cardActive ? card.color : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {cardSubtitle}
                  </span>
                  {alreadyPlayed && card.id === "wordle" && (
                    <span className="text-[10px] font-bold text-purple-300/70">
                      {alreadyPlayed.result === "won" ? "✅ Tamamlandı" : "❌ Yarın tekrar"}
                    </span>
                  )}
                </button>
              ); })}
            </div>
          </div>
        )}

        {/* WORDLE OYUNU — loading durumu WordleGame'i asla unmount etmemeli */}
        {view === "wordle" && (
          <div className="flex flex-col px-4 pb-24 pt-1">
            <WordleGame
              targetWord={targetWord}
              wordList={effectiveWordList}
              alreadyPlayed={alreadyPlayed}
              onGameEnd={handleGameEnd}
            />
          </div>
        )}

        {view === "xox" && (
          <div className="px-4 pb-24 pt-1">
            <XoxGame me={me} other={other} initialGameId={initialGameId} onExit={onClose} />
          </div>
        )}

        {view === "target" && (
          <div className="px-4 pb-24 pt-1">
            <TargetGame />
          </div>
        )}

        {view === "puzzle" && (
          <div className="px-4 pb-24 pt-1">
            <WordPuzzleGame />
          </div>
        )}

        {view === "memory" && (
          <div className="px-4 pb-24 pt-1">
            <MemoryGame />
          </div>
        )}

        {view === "emoji" && (
          <div className="px-4 pb-24 pt-1">
            <EmojiRushGame />
          </div>
        )}

        {view === "math" && (
          <div className="px-4 pb-24 pt-1">
            <QuickMathGame />
          </div>
        )}

        {view === "tap" && (
          <div className="px-4 pb-24 pt-1">
            <SpeedTapGame />
          </div>
        )}

        {view === "catch" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <FallingCatchGame />
          </div>
        )}

        {view === "blitz" && (
          <div className="px-4 pb-24 pt-1">
            <TileBlitzGame />
          </div>
        )}

        {view === "letter" && (
          <div className="px-4 pb-24 pt-1">
            <LetterDashGame />
          </div>
        )}

        {view === "flappy" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <FlappyBirdGame />
          </div>
        )}

        {view === "snake" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <SnakeGame />
          </div>
        )}

        {view === "colors" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <ColorMemoryGame />
          </div>
        )}

        {view === "2048" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <Game2048 />
          </div>
        )}

        {view === "mines" && (
          <div className="flex h-full min-h-[420px] flex-col px-4 pb-24 pt-1">
            <MinesweeperGame />
          </div>
        )}

        {view === "rps" && (
          <div className="px-4 pb-24 pt-1">
            <RockPaperScissorsGame />
          </div>
        )}

        {view === "maze" && (
          <div className="px-4 pb-24 pt-1">
            <MazeGame />
          </div>
        )}

        {view === "space" && (
          <div className="px-4 pb-24 pt-1">
            <SpaceEscapeGame />
          </div>
        )}

        {view === "neon" && (
          <div className="px-4 pb-24 pt-1">
            <NeonTapGame />
          </div>
        )}

        {view === "nova" && (
          <div className="px-4 pb-24 pt-1">
            <NovaRushGame />
          </div>
        )}
      </div>
    </div>
  );
}

function Cloud() {
  return (
    <div className="relative h-16 w-28 rounded-full bg-white/90 shadow-[0_6px_0_rgba(255,255,255,0.2)]">
      <div className="absolute -left-5 top-3 h-12 w-12 rounded-full bg-white/90" />
      <div className="absolute right-1 top-1 h-12 w-12 rounded-full bg-white/90" />
      <div className="absolute left-5 bottom-1 h-8 w-14 rounded-full bg-white/90" />
    </div>
  );
}

function Coin({ size }: { size: "small" | "large" }) {
  return (
    <div
      className="relative rounded-full border-2 border-[#f5c53a] bg-[radial-gradient(circle_at_30%_30%,#fff7b0_0%,#fddf5b_25%,#f3b819_70%,#d69a00_100%)] shadow-[0_3px_0_rgba(0,0,0,0.15)]"
      style={{
        width: size === "small" ? 26 : 34,
        height: size === "small" ? 26 : 34,
      }}
    >
      <div className="absolute inset-[5px] rounded-full border border-[#fff6b5]" />
    </div>
  );
}

function PlayerBlob({ y }: { y: number }) {
  return (
    <div
      className="relative"
      style={{ transform: `translateY(${y}px)` }}
    >
      <div className="relative h-16 w-16 rounded-[46%_54%_52%_48%/58%_58%_42%_42%] border-[3px] border-[#a66d3f] bg-[linear-gradient(180deg,#d5b184_0%,#b7814e_100%)] shadow-[inset_0_-6px_0_rgba(104,73,48,0.18)]">
        <div className="absolute left-4 top-5 h-2.5 w-2.5 rounded-full bg-[#47341c]" />
        <div className="absolute right-4 top-5 h-2.5 w-2.5 rounded-full bg-[#47341c]" />
        <div className="absolute left-1/2 top-7 h-2 w-4 -translate-x-1/2 rounded-full bg-[#5f4028]" />
      </div>
    </div>
  );
}

function House() {
  return (
    <div className="relative h-20 w-24">
      <div className="absolute bottom-0 left-0 h-10 w-24 rounded-t-[10px] bg-[linear-gradient(180deg,#f0d476_0%,#efc756_100%)] border-[3px] border-[#8a5a30]" />
      <div className="absolute left-0 top-0 h-10 w-24 rounded-t-[10px] bg-[#e5543a] border-[3px] border-[#8a5a30]" />
      <div className="absolute bottom-2 left-4 h-4 w-4 rounded-sm bg-[#f3d06a] border-[2px] border-[#8a5a30]" />
      <div className="absolute bottom-2 right-4 h-4 w-4 rounded-sm bg-[#f3d06a] border-[2px] border-[#8a5a30]" />
      <div className="absolute left-1/2 top-[-10px] h-8 w-[86%] -translate-x-1/2 rounded-t-[15px] bg-[#d83d2c]" />
    </div>
  );
}

function Tree() {
  return (
    <div className="relative h-20 w-16">
      <div className="absolute bottom-0 left-1/2 h-12 w-3 -translate-x-1/2 rounded-full bg-[#8a5a30]" />
      <div className="absolute bottom-8 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#adf399_0%,#71d555_40%,#3ea63b_100%)] border-[3px] border-[#2e7d32]" />
    </div>
  );
}

function NovaRushGame() {
  const GRID = 4;
  const [target, setTarget] = useState({ x: 1, y: 1 });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(1);

  const randomCell = useCallback(() => ({
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID),
  }), []);

  useEffect(() => {
    setTarget(randomCell());
  }, [randomCell]);

  useEffect(() => {
    if (gameOver) return;

    const timer = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameOver]);

  useEffect(() => {
    if (gameOver) return;

    const move = window.setInterval(() => {
      setTarget(prev => {
        const next = randomCell();
        if (next.x === prev.x && next.y === prev.y) {
          return { x: Math.min(GRID - 1, prev.x + 1) % GRID, y: Math.min(GRID - 1, prev.y + 1) % GRID };
        }
        return next;
      });
    }, Math.max(700, 1200 - level * 80));

    return () => window.clearInterval(move);
  }, [gameOver, level, randomCell]);

  const handleHit = () => {
    if (gameOver) return;
    setScore(current => current + 10 + level * 2);
    setLevel(current => current + 1);
    setTarget(randomCell());
  };

  const resetGame = () => {
    setTarget({ x: 1, y: 1 });
    setScore(0);
    setTimeLeft(20);
    setLevel(1);
    setGameOver(false);
  };

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-[28px] border border-pink-300/30 bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.18),_rgba(15,23,42,0.92)_45%)] p-4 text-white shadow-[0_22px_60px_rgba(244,63,94,0.35)]">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-200/80">Nova Rush</p>
          <h3 className="text-xl font-black text-white">Hedefe vur</h3>
        </div>
        <div className="rounded-full border border-pink-300/30 bg-pink-500/15 px-3 py-1.5 text-xs font-black text-pink-100">
          {score} puan
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-pink-200/10 bg-slate-950/20 px-3 py-2 text-sm font-bold text-pink-100">
        <span>⏱ {timeLeft}s</span>
        <span>Seviye {level}</span>
      </div>

      {gameOver ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-red-300/30 bg-red-500/10 p-5 text-center shadow-inner shadow-red-900/20">
          <span className="text-5xl">💣</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200/80">Oyun bitti</p>
            <h4 className="mt-2 text-3xl font-black text-white">Skor: {score}</h4>
          </div>
          <button
            type="button"
            onClick={resetGame}
            className="rounded-full border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm font-black text-red-50"
          >
            Tekrar oyna
          </button>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-[330px] grid-cols-4 gap-2 rounded-2xl border border-pink-200/10 bg-slate-950/40 p-3 shadow-[inset_0_0_18px_rgba(244,63,94,0.08)]">
          {Array.from({ length: GRID * GRID }, (_, index) => {
            const x = index % GRID;
            const y = Math.floor(index / GRID);
            const isTarget = target.x === x && target.y === y;

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={isTarget ? handleHit : undefined}
                className={`aspect-square rounded-xl border transition-all ${
                  isTarget
                    ? "border-pink-200 bg-pink-500 shadow-[0_0_24px_rgba(251,113,133,0.75)]"
                    : "border-white/5 bg-slate-800/60"
                }`}
                aria-label={isTarget ? "Hedef" : "Boş hücre"}
              >
                {isTarget ? "✦" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NeonTapGame() {
  const baseColors = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];
  const baseLabels = ["Kırmızı", "Turuncu", "Yeşil", "Mavi", "Mor", "Pembe", "Turkuaz", "Sarı"];

  const [round, setRound] = useState(1);
  const [targetColor, setTargetColor] = useState<string>(baseColors[0]);
  const [targetLabel, setTargetLabel] = useState<string>(baseLabels[0]);
  const [options, setOptions] = useState<string[]>(baseColors.slice(0, 5));
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);

  const optionCount = Math.min(5 + round - 1, baseColors.length);

  const pickNext = useCallback(() => {
    const available = baseColors.slice();
    const chosen = new Set<string>();

    while (chosen.size < optionCount) {
      const nextIndex = Math.floor(Math.random() * available.length);
      chosen.add(available[nextIndex]);
      available.splice(nextIndex, 1);
      if (available.length === 0) break;
    }

    const nextOptions = [...chosen];
    const nextTarget = nextOptions[Math.floor(Math.random() * nextOptions.length)];
    const nextIndex = baseColors.indexOf(nextTarget);

    setOptions(nextOptions);
    setTargetColor(nextTarget);
    setTargetLabel(baseLabels[nextIndex] ?? "Renk");
  }, [optionCount]);

  useEffect(() => {
    pickNext();
  }, [pickNext]);

  useEffect(() => {
    if (gameOver) return;
    const timer = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameOver]);

  const handleTap = (color: string) => {
    if (gameOver) return;
    if (color === targetColor) {
      const nextScore = 10 + streak * 2 + round * 2;
      setScore(current => current + nextScore);
      setStreak(current => current + 1);
      setRound(current => current + 1);
      pickNext();
    } else {
      setScore(current => Math.max(0, current - 5));
      setStreak(0);
    }
  };

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-[28px] border border-amber-300/30 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_rgba(15,23,42,0.92)_45%)] p-4 text-white shadow-[0_22px_60px_rgba(245,158,11,0.25)]">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/80">Neon Tap</p>
          <h3 className="text-xl font-black text-white">Doğru renge bas</h3>
        </div>
        <div className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-100">
          {score} puan
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-amber-200/10 bg-slate-950/20 px-3 py-2 text-sm font-bold text-amber-100">
        <span>⏱ {timeLeft}s</span>
        <span>Tur: {round} · Seri: {streak}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-amber-200/10 bg-slate-900/25 p-4">
        <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-200/80">Hedef</div>
        <div
          className="h-28 w-28 rounded-[28px] border-4 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          style={{ background: targetColor, boxShadow: `0 0 28px ${targetColor}66` }}
        />
        <div className="text-2xl font-black text-white">{targetLabel}</div>
      </div>

      {gameOver ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-red-300/30 bg-red-500/10 p-4 text-center">
          <span className="text-3xl">⏰</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-200/80">Süre doldu</p>
            <h4 className="mt-2 text-2xl font-black text-white">Toplam skor: {score}</h4>
          </div>
          <button
            type="button"
            onClick={() => {
              setRound(1);
              setScore(0);
              setStreak(0);
              setTimeLeft(20);
              setGameOver(false);
              pickNext();
            }}
            className="rounded-full border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm font-black text-red-50"
          >
            Yeniden başla
          </button>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(optionCount, 5)}, minmax(0, 1fr))` }}>
          {options.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => handleTap(color)}
              className="h-16 rounded-2xl border-2 border-white/10 transition active:scale-95"
              style={{ background: color, boxShadow: `0 0 18px ${color}66` }}
              aria-label={baseLabels[baseColors.indexOf(color)] ?? "Renk"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceEscapeGame() {
  const BOARD_SIZE = 8;
  const totalTime = 30;

  type Cell = { id: number; kind: "star" | "meteor"; x: number; y: number };

  const [playerX, setPlayerX] = useState(3);
  const [stars, setStars] = useState<Cell[]>([]);
  const [meteors, setMeteors] = useState<Cell[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [gameOver, setGameOver] = useState(false);
  const [active, setActive] = useState(true);

  const startNewGame = useCallback(() => {
    setPlayerX(3);
    setStars([{ id: 1, kind: "star", x: 1, y: 0 }, { id: 2, kind: "star", x: 5, y: 2 }]);
    setMeteors([{ id: 10, kind: "meteor", x: 2, y: 0 }, { id: 11, kind: "meteor", x: 6, y: 1 }]);
    setScore(0);
    setTimeLeft(totalTime);
    setGameOver(false);
    setActive(true);
  }, []);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  useEffect(() => {
    if (!active || gameOver) return;

    const timer = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setActive(false);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active, gameOver]);

  useEffect(() => {
    if (!active || gameOver) return;

    const tick = window.setInterval(() => {
      setStars(prev => {
        const moved = prev.map(item => ({ ...item, y: item.y + 1 })).filter(item => item.y < BOARD_SIZE);
        return moved;
      });

      setMeteors(prev => {
        const moved = prev.map(item => ({ ...item, y: item.y + 1 })).filter(item => item.y < BOARD_SIZE);
        return moved;
      });
    }, 480);

    return () => window.clearInterval(tick);
  }, [active, gameOver]);

  useEffect(() => {
    if (!active || gameOver) return;

    const nextStars = stars.filter(star => {
      const reached = star.y === BOARD_SIZE - 1 && star.x === playerX;
      if (reached) {
        setScore(current => current + 1);
        return false;
      }
      return true;
    });

    if (nextStars.length !== stars.length) {
      setStars([...nextStars, { id: Date.now(), kind: "star", x: Math.floor(Math.random() * BOARD_SIZE), y: 0 }]);
    }

    const crash = meteors.some(meteor => meteor.y === BOARD_SIZE - 1 && meteor.x === playerX);
    if (crash) {
      setGameOver(true);
      setActive(false);
    }
  }, [active, gameOver, meteors, playerX, stars]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (gameOver || !active) return;
      setMeteors(prev => {
        if (prev.length > 7) return prev;
        const newMeteor = {
          id: Date.now() + Math.random(),
          kind: "meteor",
          x: Math.floor(Math.random() * BOARD_SIZE),
          y: 0,
        } as Cell;
        return [...prev, newMeteor];
      });
      setStars(prev => {
        if (prev.length > 5) return prev;
        const newStar = {
          id: Date.now() + Math.random() + 1000,
          kind: "star",
          x: Math.floor(Math.random() * BOARD_SIZE),
          y: 0,
        } as Cell;
        return [...prev, newStar];
      });
    }, 1600);

    return () => window.clearInterval(interval);
  }, [active, gameOver]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setPlayerX(value => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setPlayerX(value => Math.min(BOARD_SIZE - 1, value + 1));
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const tiles = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    const starHere = stars.some(item => item.x === x && item.y === y);
    const meteorHere = meteors.some(item => item.x === x && item.y === y);
    const playerHere = playerX === x && y === BOARD_SIZE - 1;

    let symbol = "";
    if (playerHere) symbol = "🚀";
    else if (meteorHere) symbol = "☄️";
    else if (starHere) symbol = "⭐";

    return { x, y, symbol };
  });

  return (
    <div className="flex min-h-[420px] h-full flex-col gap-3 rounded-[28px] border border-sky-300/30 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_rgba(15,23,42,0.92)_45%)] p-4 text-white shadow-[0_22px_60px_rgba(14,116,144,0.35)]">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-200/80">Uzay Kaçışı</p>
          <h3 className="text-xl font-black text-white">Yıldız topla</h3>
        </div>
        <div className="rounded-full border border-sky-300/30 bg-sky-500/15 px-3 py-1.5 text-xs font-black text-sky-100">
          {score} Puan
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-sky-200/10 bg-slate-950/20 px-3 py-2 text-sm font-bold text-sky-100">
        <span>⏱ {timeLeft}s</span>
        <span>Hız: {Math.min(3, 1 + Math.floor(score / 5))}x</span>
      </div>

      {gameOver ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-red-300/30 bg-red-500/10 p-5 text-center shadow-inner shadow-red-900/20">
          <span className="text-5xl">💥</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200/80">Oyun bitti</p>
            <h4 className="mt-2 text-3xl font-black text-white">Skor: {score}</h4>
          </div>
          <button
            type="button"
            onClick={startNewGame}
            className="rounded-full border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm font-black text-red-50"
          >
            Tekrar oyna
          </button>
        </div>
      ) : (
        <>
          <div className="mx-auto grid w-full max-w-[360px] grid-cols-8 gap-1 rounded-2xl border border-sky-200/10 bg-slate-950/40 p-2 shadow-[inset_0_0_18px_rgba(14,165,233,0.08)]">
            {tiles.map((cell, index) => (
              <div
                key={`${cell.x}-${cell.y}-${index}`}
                className="flex aspect-square items-center justify-center rounded-md border border-sky-200/5 bg-slate-800/30 text-xs"
              >
                {cell.symbol}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 px-1 pb-2">
            <div />
            <button
              type="button"
              onClick={() => setPlayerX(value => Math.max(0, value - 1))}
              className="rounded-xl border border-sky-300/25 bg-sky-500/20 py-2 text-lg font-black text-sky-50"
            >
              ⬅️
            </button>
            <div />
            <button
              type="button"
              onClick={() => setPlayerX(value => Math.min(BOARD_SIZE - 1, value + 1))}
              className="rounded-xl border border-sky-300/25 bg-sky-500/20 py-2 text-lg font-black text-sky-50"
            >
              ➡️
            </button>
            <div />
          </div>
        </>
      )}
    </div>
  );
}
