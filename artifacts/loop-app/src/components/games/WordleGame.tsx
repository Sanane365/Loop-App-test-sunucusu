/**
 * WordleGame — 5 harfli Türkçe Wordle
 *
 * Props:
 *   targetWord  — tahmin edilecek kelime (büyük harf)
 *   alreadyPlayed — bugün oynandıysa { result, attempts } geçilir
 *   onGameEnd   — (won, attempts) → parent API çağrısını yapar
 */

import { useState, useEffect, useCallback } from "react";
import { getDailyWord, WORDLE_WORDS } from "./words";

const ROWS = 6;
const COLS = 5;

type LetterStatus = "correct" | "present" | "absent" | "empty" | "filled";

interface Cell { letter: string; status: LetterStatus }

interface Props {
  targetWord?: string;
  alreadyPlayed?: { result: "won" | "lost"; attempts: number } | null;
  onGameEnd: (won: boolean, attempts: number) => void;
}

/* ── Klavye satırları (Türkçe Q) ─────────────────────────────────────── */
const KB_ROWS = [
  ["E", "R", "T", "Y", "U", "İ", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "I"],
  ["↵", "Z", "C", "V", "B", "N", "M", "Ö", "Ç", "⌫"],
];

const STATUS_COLORS: Record<LetterStatus, string> = {
  correct: "#22c55e",
  present: "#eab308",
  absent:  "#4b5563",
  empty:   "transparent",
  filled:  "transparent",
};

const STATUS_BORDER: Record<LetterStatus, string> = {
  correct: "#22c55e",
  present: "#eab308",
  absent:  "#4b5563",
  empty:   "rgba(255,255,255,0.12)",
  filled:  "rgba(255,255,255,0.5)",
};

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: "", status: "empty" as LetterStatus }))
  );
}

export default function WordleGame({ targetWord, alreadyPlayed, onGameEnd }: Props) {
  const target = (targetWord ?? getDailyWord()).toUpperCase();

  const [board,       setBoard]       = useState<Cell[][]>(emptyBoard);
  const [currentRow,  setCurrentRow]  = useState(0);
  const [currentCol,  setCurrentCol]  = useState(0);
  const [gameState,   setGameState]   = useState<"playing" | "won" | "lost">(
    alreadyPlayed ? (alreadyPlayed.result === "won" ? "won" : "lost") : "playing"
  );
  const [usedLetters, setUsedLetters] = useState<Map<string, LetterStatus>>(new Map());
  const [shake,       setShake]       = useState(false);
  const [message,     setMessage]     = useState<string | null>(null);

  /* Uyarı mesajı */
  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 1800);
  };

  /* Tahmin değerlendir */
  const evaluateGuess = useCallback((guess: string): Cell[] => {
    const result: Cell[] = Array(COLS).fill(null).map((_, i) => ({
      letter: guess[i], status: "absent" as LetterStatus,
    }));
    const targetArr = target.split("");
    const guessArr  = guess.split("");

    // Önce doğru pozisyonları işaretle
    guessArr.forEach((l, i) => {
      if (l === targetArr[i]) {
        result[i].status = "correct";
        targetArr[i] = "#";
      }
    });
    // Sonra yanlış pozisyonları
    guessArr.forEach((l, i) => {
      if (result[i].status !== "correct") {
        const ti = targetArr.indexOf(l);
        if (ti !== -1) {
          result[i].status = "present";
          targetArr[ti] = "#";
        }
      }
    });
    return result;
  }, [target]);

  /* Tahmin gönder */
  const submitGuess = useCallback(() => {
    if (currentCol < COLS) { setShake(true); setTimeout(() => setShake(false), 400); showMsg("5 harf gerekli!"); return; }

    const guess = board[currentRow].map(c => c.letter).join("");

    if (!WORDLE_WORDS.includes(guess)) {
      setShake(true); setTimeout(() => setShake(false), 400);
      showMsg("Kelime listesinde yok");
      return;
    }

    const evaluated = evaluateGuess(guess);
    setBoard(prev => {
      const next = prev.map(r => [...r]);
      next[currentRow] = evaluated;
      return next;
    });

    // Klavye renklerini güncelle
    setUsedLetters(prev => {
      const next = new Map(prev);
      evaluated.forEach(({ letter, status }) => {
        const cur = next.get(letter);
        if (!cur || cur === "absent" || (cur === "present" && status === "correct")) {
          next.set(letter, status);
        }
      });
      return next;
    });

    const won = evaluated.every(c => c.status === "correct");
    if (won) {
      setGameState("won");
      onGameEnd(true, currentRow + 1);
    } else if (currentRow + 1 >= ROWS) {
      setGameState("lost");
      onGameEnd(false, ROWS);
    } else {
      setCurrentRow(r => r + 1);
      setCurrentCol(0);
    }
  }, [board, currentRow, currentCol, evaluateGuess, onGameEnd]);

  /* Harf ekle */
  const addLetter = useCallback((letter: string) => {
    if (gameState !== "playing" || currentCol >= COLS) return;
    setBoard(prev => {
      const next = prev.map(r => [...r]);
      next[currentRow][currentCol] = { letter, status: "filled" };
      return next;
    });
    setCurrentCol(c => c + 1);
  }, [gameState, currentRow, currentCol]);

  /* Harf sil */
  const deleteLetter = useCallback(() => {
    if (currentCol === 0) return;
    setBoard(prev => {
      const next = prev.map(r => [...r]);
      next[currentRow][currentCol - 1] = { letter: "", status: "empty" };
      return next;
    });
    setCurrentCol(c => c - 1);
  }, [currentRow, currentCol]);

  /* Klavye tuşu */
  const handleKey = useCallback((key: string) => {
    if (gameState !== "playing") return;
    if (key === "↵" || key === "ENTER") { submitGuess(); return; }
    if (key === "⌫" || key === "BACKSPACE") { deleteLetter(); return; }
    if (/^[A-ZÇŞĞÜÖİI]$/.test(key)) addLetter(key);
  }, [gameState, submitGuess, deleteLetter, addLetter]);

  /* Fiziksel klavye */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      handleKey(k);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  /* ── Render ────────────────────────────────────────────────────────── */
  const tileSize = 48;

  return (
    <div className="flex flex-col items-center gap-3 w-full select-none">
      {/* Mesaj */}
      {message && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "rgba(30,15,60,0.96)", border: "1px solid rgba(139,92,246,0.6)" }}>
          {message}
        </div>
      )}

      {/* Oyun sonu banner */}
      {gameState !== "playing" && (
        <div className="w-full text-center py-2 px-4 rounded-xl font-bold text-sm"
          style={{
            background: gameState === "won"
              ? "linear-gradient(90deg,rgba(34,197,94,0.18),rgba(34,197,94,0.08))"
              : "linear-gradient(90deg,rgba(239,68,68,0.18),rgba(239,68,68,0.08))",
            border: `1px solid ${gameState === "won" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.35)"}`,
            color:  gameState === "won" ? "#86efac" : "#fca5a5",
          }}
        >
          {gameState === "won"
            ? `🎉 Kazandın! ${alreadyPlayed?.attempts ?? currentRow} denemede buldun.`
            : `😔 Kelime: ${target}`}
        </div>
      )}

      {/* Tahmin tahtası */}
      <div className="flex flex-col gap-1.5">
        {board.map((row, ri) => (
          <div
            key={ri}
            className="flex gap-1.5"
            style={{ animation: ri === currentRow && shake ? "wordle-shake 0.4s ease" : undefined }}
          >
            {row.map((cell, ci) => (
              <div
                key={ci}
                style={{
                  width:  tileSize,
                  height: tileSize,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       22,
                  fontWeight:     900,
                  color:          cell.status === "empty" ? "rgba(255,255,255,0.2)" : "#fff",
                  background:     STATUS_COLORS[cell.status],
                  border:         `2px solid ${STATUS_BORDER[cell.status]}`,
                  borderRadius:   8,
                  transition:     "background 0.3s, border-color 0.3s",
                  letterSpacing:  0,
                }}
              >
                {cell.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Klavye */}
      <div className="flex flex-col gap-1.5 w-full mt-1">
        {KB_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map(key => {
              const status = usedLetters.get(key);
              const isAction = key === "↵" || key === "⌫";
              return (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); handleKey(key); }}
                  style={{
                    minWidth:       isAction ? 44 : 28,
                    height:         40,
                    padding:        "0 4px",
                    fontSize:       isAction ? 16 : 13,
                    fontWeight:     700,
                    borderRadius:   6,
                    border:         "none",
                    cursor:         "pointer",
                    color:          status ? "#fff" : "rgba(255,255,255,0.85)",
                    background: status
                      ? STATUS_COLORS[status]
                      : "rgba(255,255,255,0.12)",
                    transition:     "background 0.25s",
                    flexShrink:     0,
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes wordle-shake {
          0%,100%{ transform:translateX(0) }
          20%{ transform:translateX(-6px) }
          40%{ transform:translateX(6px) }
          60%{ transform:translateX(-4px) }
          80%{ transform:translateX(4px) }
        }
      `}</style>
    </div>
  );
}
