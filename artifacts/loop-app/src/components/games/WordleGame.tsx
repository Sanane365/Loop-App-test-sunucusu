/**
 * WordleGame — 5 harfli Türkçe Wordle
 *
 * Layout:
 *   • Dış kapsayıcı: flex-col, h-full
 *   • Tahta bölgesi: flex-1 min-h-0 overflow-y-auto (küçük ekranlarda kaydırılır)
 *   • Klavye: flex-none — ASLA kesilmez
 *
 * Klavye tasarımı:
 *   • Sabit karo boyutu 44 px — JS ölçüm yok, layout atlaması yok
 *   • Tuş genişliği: w-full / sütun sayısı — satır hiçbir zaman taşmaz
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getDailyWord, WORDLE_WORDS } from "./words";

const ROWS = 6;
const COLS = 5;
const T    = 44;   // karo boyutu (px)
const GAP  = 5;

type LetterStatus = "correct" | "present" | "absent" | "empty" | "filled";
interface Cell { letter: string; status: LetterStatus }

interface Props {
  targetWord?:    string;
  alreadyPlayed?: { result: "won" | "lost"; attempts: number } | null;
  onGameEnd:      (won: boolean, attempts: number) => void;
}

/* ── Türkçe Q klavye satırları ──────────────────────────────────────── */
const KB_ROWS = [
  ["E","R","T","Y","U","İ","O","P","Ğ","Ü"],
  ["A","S","D","F","G","H","J","K","L","Ş","I"],
  ["GİR","Z","C","V","B","N","M","Ö","Ç","SİL"],
] as const;

const STATUS_BG: Record<LetterStatus, string> = {
  correct:  "#22c55e",
  present:  "#d97706",
  absent:   "#374151",
  empty:    "transparent",
  filled:   "transparent",
};
const STATUS_BD: Record<LetterStatus, string> = {
  correct:  "#22c55e",
  present:  "#d97706",
  absent:   "#374151",
  empty:    "rgba(255,255,255,0.15)",
  filled:   "rgba(255,255,255,0.65)",
};

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: "", status: "empty" as LetterStatus }))
  );
}

export default function WordleGame({ targetWord, alreadyPlayed, onGameEnd }: Props) {
  const target = (targetWord ?? getDailyWord()).toUpperCase();

  const [board,       setBoard]      = useState<Cell[][]>(emptyBoard);
  const [currentRow,  setCurrentRow] = useState(0);
  const [currentCol,  setCurrentCol] = useState(0);
  const [gameState,   setGameState]  = useState<"playing"|"won"|"lost">(
    alreadyPlayed ? (alreadyPlayed.result === "won" ? "won" : "lost") : "playing"
  );
  const [usedLetters, setUsedLetters] = useState<Map<string, LetterStatus>>(new Map());
  const [shakeRow,    setShakeRow]   = useState<number | null>(null);
  const [message,     setMessage]    = useState<string | null>(null);
  const [flipRow,     setFlipRow]    = useState<number | null>(null);

  /* klavye satırı genişliği — kap ölçülür, tuş genişliği hesaplanır */
  const kbRef   = useRef<HTMLDivElement>(null);
  const [keyW,  setKeyW]  = useState(28);
  const [actnW, setActnW] = useState(42);

  useEffect(() => {
    const calc = () => {
      if (!kbRef.current) return;
      const W = kbRef.current.clientWidth - 4; // 2px padding her yanda
      // Satır 2 en uzun: 11 tuş + 10 boşluk (gap-0.5 = 2px)
      const w = Math.floor((W - 11 * 2) / 11);
      setKeyW(Math.max(22, Math.min(32, w)));
      setActnW(Math.max(34, Math.min(48, Math.floor(w * 1.5))));
    };
    calc();
    const obs = new ResizeObserver(calc);
    if (kbRef.current) obs.observe(kbRef.current);
    return () => obs.disconnect();
  }, []);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 1600);
  };

  const evaluateGuess = useCallback((guess: string): Cell[] => {
    const result: Cell[] = Array(COLS).fill(null).map((_, i) => ({
      letter: guess[i], status: "absent" as LetterStatus,
    }));
    const tArr = target.split(""); const gArr = guess.split("");
    gArr.forEach((l, i) => {
      if (l === tArr[i]) { result[i].status = "correct"; tArr[i] = "#"; }
    });
    gArr.forEach((l, i) => {
      if (result[i].status !== "correct") {
        const ti = tArr.indexOf(l);
        if (ti !== -1) { result[i].status = "present"; tArr[ti] = "#"; }
      }
    });
    return result;
  }, [target]);

  const submitGuess = useCallback(() => {
    if (currentCol < COLS) {
      setShakeRow(currentRow); setTimeout(() => setShakeRow(null), 450);
      showMsg("5 harf gerekli!"); return;
    }
    const guess = board[currentRow].map(c => c.letter).join("");
    if (!WORDLE_WORDS.includes(guess)) {
      setShakeRow(currentRow); setTimeout(() => setShakeRow(null), 450);
      showMsg("Kelime listesinde yok"); return;
    }
    const evaluated = evaluateGuess(guess);
    setBoard(prev => { const n = prev.map(r => [...r]); n[currentRow] = evaluated; return n; });
    setFlipRow(currentRow); setTimeout(() => setFlipRow(null), 650);

    setUsedLetters(prev => {
      const next = new Map(prev);
      evaluated.forEach(({ letter, status }) => {
        const cur = next.get(letter);
        if (!cur || cur === "absent" || (cur === "present" && status === "correct"))
          next.set(letter, status);
      });
      return next;
    });

    const won = evaluated.every(c => c.status === "correct");
    if (won) {
      setTimeout(() => { setGameState("won"); onGameEnd(true, currentRow + 1); }, 700);
    } else if (currentRow + 1 >= ROWS) {
      setTimeout(() => { setGameState("lost"); onGameEnd(false, ROWS); }, 700);
    } else {
      setCurrentRow(r => r + 1); setCurrentCol(0);
    }
  }, [board, currentRow, currentCol, evaluateGuess, onGameEnd]);

  const addLetter = useCallback((letter: string) => {
    if (gameState !== "playing" || currentCol >= COLS) return;
    setBoard(prev => {
      const n = prev.map(r => [...r]);
      n[currentRow][currentCol] = { letter, status: "filled" };
      return n;
    });
    setCurrentCol(c => c + 1);
  }, [gameState, currentRow, currentCol]);

  const deleteLetter = useCallback(() => {
    if (currentCol === 0) return;
    setBoard(prev => {
      const n = prev.map(r => [...r]);
      n[currentRow][currentCol - 1] = { letter: "", status: "empty" };
      return n;
    });
    setCurrentCol(c => c - 1);
  }, [currentRow, currentCol]);

  const handleKey = useCallback((key: string) => {
    if (gameState !== "playing") return;
    if (key === "GİR" || key === "ENTER")     { submitGuess(); return; }
    if (key === "SİL" || key === "BACKSPACE") { deleteLetter(); return; }
    if (/^[A-ZÇŞĞÜÖİI]$/.test(key))          addLetter(key);
  }, [gameState, submitGuess, deleteLetter, addLetter]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => handleKey(e.key.toUpperCase());
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleKey]);

  const boardW = COLS * T + (COLS - 1) * GAP;

  return (
    <div className="flex flex-col h-full w-full select-none">

      {/* ── Üst alan: açıklama + toast + tahta (kaydırılabilir) ─────── */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 py-2 px-1">

        {/* Nasıl oynanır — tek satır */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {[
            { color: "#22c55e", label: "Doğru yerde" },
            { color: "#d97706", label: "Var, yanlış" },
            { color: "#374151", label: "Yok" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="inline-flex w-4 h-4 rounded items-center justify-center text-[8px] font-black text-white"
                style={{ background: color }}>A</span>
              {label}
            </span>
          ))}
        </div>

        {/* Toast / sonuç */}
        <div className="min-h-[28px] flex items-center justify-center w-full">
          {message && (
            <div className="px-4 py-1 rounded-xl text-[12px] font-bold text-white"
              style={{ background: "rgba(30,15,60,0.97)", border: "1px solid rgba(139,92,246,0.55)" }}>
              {message}
            </div>
          )}
          {!message && gameState === "won" && (
            <div className="px-4 py-1 rounded-xl text-[12px] font-bold"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" }}>
              🎉 Kazandın! {alreadyPlayed?.attempts ?? currentRow} denemede.
            </div>
          )}
          {!message && gameState === "lost" && (
            <div className="px-4 py-1 rounded-xl text-[12px] font-bold"
              style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              😔 Kelime: <strong>{target}</strong>
            </div>
          )}
        </div>

        {/* ── Tahmin tahtası ─────────────────────────────────────────── */}
        <div style={{ width: boardW }}>
          {board.map((row, ri) => (
            <div key={ri} className="flex" style={{
              gap: GAP,
              marginBottom: ri < ROWS - 1 ? GAP : 0,
              animation: shakeRow === ri ? "wshake 0.42s ease" : undefined,
            }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width:          T,
                  height:         T,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       20,
                  fontWeight:     900,
                  color:          cell.status === "empty" ? "rgba(255,255,255,0.18)" : "#fff",
                  background:     STATUS_BG[cell.status],
                  border:         `2px solid ${STATUS_BD[cell.status]}`,
                  borderRadius:   7,
                  /* Flip satırında transition kapalı — renk scaleY(0) anında anında değişir */
                  transition:     flipRow === ri ? "none" : "background 0.28s, border-color 0.28s",
                  animation:      flipRow === ri ? `wflip 0.55s ease ${ci * 0.08}s both` : undefined,
                }}>
                  {cell.letter}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Klavye — her zaman görünür (flex-none) ───────────────────── */}
      <div ref={kbRef} className="flex-none w-full pb-3 pt-1">
        {KB_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center" style={{ gap: 2, marginBottom: ri < KB_ROWS.length - 1 ? 4 : 0 }}>
            {(row as readonly string[]).map(key => {
              const status   = usedLetters.get(key);
              const isAction = key === "GİR" || key === "SİL";
              return (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); handleKey(key); }}
                  style={{
                    width:        isAction ? actnW : keyW,
                    height:       38,
                    padding:      0,
                    fontSize:     isAction ? 9 : 13,
                    fontWeight:   isAction ? 800 : 700,
                    borderRadius: 5,
                    border:       "none",
                    cursor:       "pointer",
                    flexShrink:   0,
                    color:        status ? "#fff" : "rgba(255,255,255,0.88)",
                    background:   status ? STATUS_BG[status] : "rgba(255,255,255,0.11)",
                    transition:   "background 0.22s",
                    letterSpacing: isAction ? "-0.03em" : 0,
                    lineHeight:   1,
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
        @keyframes wshake {
          0%,100%{ transform:translateX(0) }
          18%{ transform:translateX(-7px) }
          36%{ transform:translateX(7px) }
          54%{ transform:translateX(-4px) }
          72%{ transform:translateX(4px) }
        }
        @keyframes wflip {
          0%   { transform:scaleY(1) }
          40%  { transform:scaleY(0) }
          100% { transform:scaleY(1) }
        }
      `}</style>
    </div>
  );
}
