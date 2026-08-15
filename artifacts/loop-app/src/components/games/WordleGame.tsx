/**
 * WordleGame — 5 harfli Türkçe Wordle
 *
 * Layout stratejisi:
 *   - Kapsayıcı h-full flex-col
 *   - Üst kısım (açıklama + toast + tahta): flex:1, overflow-y:auto
 *   - Alt kısım (klavye): flex-none, her zaman görünür
 *   - Karo boyutu dinamik: kapsayıcı yüksekliği ölçülür, en fazla 50px
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getDailyWord, WORDLE_WORDS } from "./words";

const ROWS = 6;
const COLS = 5;

type LetterStatus = "correct" | "present" | "absent" | "empty" | "filled";
interface Cell { letter: string; status: LetterStatus }

interface Props {
  targetWord?:    string;
  alreadyPlayed?: { result: "won" | "lost"; attempts: number } | null;
  onGameEnd:      (won: boolean, attempts: number) => void;
}

/* ── Türkçe Q klavye ────────────────────────────────────────────────── */
const KB_ROWS = [
  ["E","R","T","Y","U","İ","O","P","Ğ","Ü"],
  ["A","S","D","F","G","H","J","K","L","Ş","I"],
  ["GİR","Z","C","V","B","N","M","Ö","Ç","SİL"],
];

const BG: Record<LetterStatus, string> = {
  correct: "#22c55e", present: "#d97706", absent: "#374151",
  empty: "transparent", filled: "transparent",
};
const BD: Record<LetterStatus, string> = {
  correct: "#22c55e", present: "#d97706", absent: "#374151",
  empty: "rgba(255,255,255,0.15)", filled: "rgba(255,255,255,0.65)",
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
  const [gameState,   setGameState]   = useState<"playing"|"won"|"lost">(
    alreadyPlayed ? (alreadyPlayed.result === "won" ? "won" : "lost") : "playing"
  );
  const [usedLetters, setUsedLetters] = useState<Map<string, LetterStatus>>(new Map());
  const [shakeRow,    setShakeRow]    = useState<number | null>(null);
  const [message,     setMessage]     = useState<string | null>(null);
  const [flipRow,     setFlipRow]     = useState<number | null>(null);
  const [tileSize,    setTileSize]    = useState(46);

  /* ── Dinamik karo boyutu ─────────────────────────────────────────── */
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      // Tahta: 6T + 5*GAP(6) = 6T + 30
      // Klavye: ~128px (3 satır × 40px + 8px boşluk)
      // Açıklama + toast: ~80px
      // Toplam: 6T + 30 + 128 + 80 = 6T + 238 ≤ h
      const T = Math.min(50, Math.max(36, Math.floor((h - 250) / 6)));
      setTileSize(T);
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const GAP      = 5;
  const boardW   = COLS * tileSize + (COLS - 1) * GAP;
  const keyH     = Math.max(34, Math.round(tileSize * 0.78));

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 1600);
  };

  const evaluateGuess = useCallback((guess: string): Cell[] => {
    const result: Cell[] = Array(COLS).fill(null).map((_, i) => ({
      letter: guess[i], status: "absent" as LetterStatus,
    }));
    const tArr = target.split(""); const gArr = guess.split("");
    gArr.forEach((l, i) => { if (l === tArr[i]) { result[i].status = "correct"; tArr[i] = "#"; } });
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
    setBoard(prev => { const n = prev.map(r => [...r]); n[currentRow][currentCol] = { letter, status: "filled" }; return n; });
    setCurrentCol(c => c + 1);
  }, [gameState, currentRow, currentCol]);

  const deleteLetter = useCallback(() => {
    if (currentCol === 0) return;
    setBoard(prev => { const n = prev.map(r => [...r]); n[currentRow][currentCol - 1] = { letter: "", status: "empty" }; return n; });
    setCurrentCol(c => c - 1);
  }, [currentRow, currentCol]);

  const handleKey = useCallback((key: string) => {
    if (gameState !== "playing") return;
    if (key === "GİR" || key === "ENTER")    { submitGuess(); return; }
    if (key === "SİL" || key === "BACKSPACE") { deleteLetter(); return; }
    if (/^[A-ZÇŞĞÜÖİI]$/.test(key)) addLetter(key);
  }, [gameState, submitGuess, deleteLetter, addLetter]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => handleKey(e.key.toUpperCase());
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleKey]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full select-none">

      {/* ── Üst alan: açıklama + toast + tahta (kaydırılabilir) ────── */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 py-2">

        {/* Nasıl oynanır */}
        <div className="flex items-center gap-2 flex-wrap justify-center px-2">
          <span className="flex items-center gap-1 text-[10px] text-white/50">
            <span className="inline-block w-4 h-4 rounded text-[8px] leading-4 text-center font-black"
              style={{ background: "#22c55e" }}>A</span>
            Doğru yerde
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/50">
            <span className="inline-block w-4 h-4 rounded text-[8px] leading-4 text-center font-black"
              style={{ background: "#d97706" }}>B</span>
            Var, yanlış yer
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/50">
            <span className="inline-block w-4 h-4 rounded text-[8px] leading-4 text-center font-black"
              style={{ background: "#374151" }}>C</span>
            Kelimede yok
          </span>
        </div>

        {/* Toast / sonuç bandı */}
        <div className="min-h-[30px] flex items-center justify-center w-full px-4">
          {message && (
            <div className="px-4 py-1 rounded-xl text-[12px] font-bold text-white"
              style={{ background: "rgba(30,15,60,0.97)", border: "1px solid rgba(139,92,246,0.55)" }}>
              {message}
            </div>
          )}
          {!message && gameState === "won" && (
            <div className="px-4 py-1 rounded-xl text-[12px] font-bold"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac" }}>
              🎉 Kazandın! {alreadyPlayed?.attempts ?? currentRow} denemede buldun.
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
        <div style={{ width: boardW, flexShrink: 0 }}>
          {board.map((row, ri) => (
            <div key={ri} className="flex" style={{
              gap: GAP, marginBottom: ri < ROWS - 1 ? GAP : 0,
              animation: shakeRow === ri ? "wshake 0.42s ease" : undefined,
            }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width: tileSize, height: tileSize, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: Math.round(tileSize * 0.44), fontWeight: 900,
                  color:       cell.status === "empty" ? "rgba(255,255,255,0.18)" : "#fff",
                  background:  BG[cell.status],
                  border:      `2px solid ${BD[cell.status]}`,
                  borderRadius: 7,
                  transition:  "background 0.28s, border-color 0.28s",
                  animation:   flipRow === ri ? `wflip 0.55s ease ${ci * 0.08}s` : undefined,
                }}>
                  {cell.letter}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Klavye — her zaman altta ─────────────────────────────────── */}
      <div className="flex-none pb-2 pt-1 flex flex-col gap-1.5 w-full">
        {KB_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map(key => {
              const status   = usedLetters.get(key);
              const isAction = key === "GİR" || key === "SİL";
              return (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); handleKey(key); }}
                  style={{
                    minWidth:    isAction ? 44 : 28,
                    height:      keyH,
                    padding:     "0 3px",
                    fontSize:    isAction ? 10 : 13,
                    fontWeight:  isAction ? 800 : 700,
                    borderRadius: 6,
                    border:      "none",
                    cursor:      "pointer",
                    color:       status ? "#fff" : "rgba(255,255,255,0.88)",
                    background:  status ? BG[status] : "rgba(255,255,255,0.11)",
                    transition:  "background 0.22s",
                    flexShrink:  0,
                    letterSpacing: isAction ? "-0.04em" : 0,
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
