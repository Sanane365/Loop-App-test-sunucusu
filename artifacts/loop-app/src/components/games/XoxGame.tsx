import { useCallback, useEffect, useRef, useState } from "react";

interface Player {
  id: number;
  displayName: string;
}

interface XoxGameState {
  id: number;
  player_x_id: number;
  player_o_id: number;
  board: string[];
  current_turn: "X" | "O";
  status: "playing" | "won" | "draw" | "cancelled";
  winner_id: number | null;
}

interface Props {
  me: Player;
  other: Player | null;
  initialGameId?: number | null;
  onExit: () => void;
}

function normalizeGame(game: XoxGameState & Record<string, unknown>): XoxGameState {
  const rawBoard = game.board ?? game["Board"];
  return {
    ...game,
    id: Number(game.id),
    status: String(game.status ?? "playing").toLowerCase() as XoxGameState["status"],
    player_x_id: Number(game.player_x_id ?? game["playerXId"]),
    player_o_id: Number(game.player_o_id ?? game["playerOId"]),
    current_turn: String(game.current_turn ?? game["currentTurn"] ?? "X").toUpperCase() as "X" | "O",
    winner_id: game.winner_id == null ? (game["winnerId"] as number | null) : Number(game.winner_id),
    board: (Array.isArray(rawBoard) ? rawBoard : JSON.parse(String(rawBoard ?? "[\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"]"))).map((cell: unknown) => typeof cell === "string" ? cell.toUpperCase() : ""),
  };
}

function playerMark(game: XoxGameState, userId: number): "X" | "O" {
  return Number(game.player_x_id) === Number(userId) ? "X" : "O";
}

export default function XoxGame({ me, other, initialGameId = null, onExit }: Props) {
  const opponentId = other?.id ?? null;
  const [game, setGame] = useState<XoxGameState | null>(null);
  const [message, setMessage] = useState(initialGameId ? "Oyun yükleniyor..." : "Rakibine davet gönderiliyor...");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const moveInFlightRef = useRef(false);

  const loadGame = useCallback(async (gameId: number) => {
    if (refreshInFlightRef.current || moveInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/games/xox/${gameId}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Oyun yüklenemedi");
      const data = await response.json();
      setGame(normalizeGame(data.game as XoxGameState & Record<string, unknown>));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    setCountdown(3);
    let value = 3;
    countdownTimerRef.current = window.setInterval(() => {
      value -= 1;
      if (value <= 0) {
        if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
      } else {
        setCountdown(value);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (!game || game.status !== "playing") return;
    startCountdown();
    return () => {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [game?.id, game?.status, startCountdown]);

  useEffect(() => {
    if (!opponentId || opponentId === me.id) {
      if (opponentId === me.id) setMessage("XOX için farklı bir rakip seçmelisin.");
      return;
    }
    let cancelled = false;
    let interval: number | undefined;

    const start = async () => {
      try {
        if (initialGameId) {
          await loadGame(initialGameId);
          interval = window.setInterval(() => {
            void loadGame(initialGameId).catch(() => {});
          }, 1500);
          return;
        }
        const response = await fetch("/api/games/xox/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opponentId }),
        });
        if (!response.ok) throw new Error("Oyun başlatılamadı");
        const data = await response.json() as { inviteId: number };
        if (cancelled) return;
        setMessage("Davet gönderildi. Rakibinin kabul etmesi bekleniyor...");
        interval = window.setInterval(async () => {
          const inviteResponse = await fetch(`/api/games/xox/invites/${data.inviteId}?t=${Date.now()}`, { cache: "no-store" });
          if (!inviteResponse.ok) return;
          const invite = await inviteResponse.json() as { status: string; gameId: number | null };
          if (invite.status === "accepted" && invite.gameId) {
            window.clearInterval(interval);
            await loadGame(invite.gameId);
          } else if (invite.status === "rejected") {
            window.clearInterval(interval);
            setMessage("Rakibin daveti reddetti.");
          }
        }, 1500);
      } catch {
        if (!cancelled) setMessage("Oyun başlatılamadı");
      }
    };

    void start();
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [opponentId, me.id, loadGame, initialGameId]);

  const exitGame = async () => {
    if (game) {
      await fetch(`/api/games/xox/${game.id}/cancel`, { method: "POST" }).catch(() => {});
    }
    onExit();
  };

  const makeMove = async (position: number) => {
    if (!game) {
      setMessage("Oyun henüz yüklenmedi");
      return;
    }
    if (game.board[position]) return;
    if (busy) return;
    if (game.status !== "playing") {
      setMessage("Bu oyun sona erdi");
      return;
    }
    const mark = playerMark(game, me.id);
    if (game.current_turn !== mark) {
      setMessage(`Sıra ${game.current_turn} oyuncusunda`);
      return;
    }

    const previousGame = game;
    const optimisticBoard = [...game.board];
    optimisticBoard[position] = mark;
    setGame({
      ...game,
      board: optimisticBoard,
      current_turn: mark === "X" ? "O" : "X",
    });
    moveInFlightRef.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/games/xox/${game.id}/move`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.game) setGame(normalizeGame(data.game as XoxGameState & Record<string, unknown>));
        else setGame(previousGame);
        throw new Error(data.error ?? "Hamle yapılamadı");
      }
      setGame(normalizeGame(data.game as XoxGameState & Record<string, unknown>));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hamle yapılamadı");
      void loadGame(game.id).catch(() => {});
    } finally {
      moveInFlightRef.current = false;
      setBusy(false);
    }
  };

  if (!other) {
    return <div className="flex h-full items-center justify-center text-sm font-bold text-white/60">XOX için birebir sohbet gerekli.</div>;
  }

  const mark = game ? playerMark(game, me.id) : "O";
  const turnName = game?.current_turn === mark ? "Sıra sende" : `${other.displayName} düşünüyor`;
  const result = game?.status === "draw"
    ? "Berabere!"
    : game?.status === "cancelled"
      ? "Oyun iptal edildi"
    : game?.status === "won"
      ? game.winner_id === me.id ? "Kazandın!" : `${other.displayName} kazandı` : turnName;

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 px-4 pb-8 text-white">
      {countdown !== null && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-slate-950/90 backdrop-blur-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Oyun başlıyor</p>
          <span className="text-8xl font-black text-white">{countdown}</span>
          <button type="button" onClick={() => void exitGame()} className="pointer-events-auto rounded-xl border border-white/20 px-5 py-2 text-sm font-bold text-white/80 hover:bg-white/10">Çıkış</button>
        </div>
      )}
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-300/70">Sıra tabanlı oyun</p>
        <p className="mt-2 text-lg font-black">{result}</p>
        <p className="mt-1 text-xs font-bold text-white/45">Sen: {mark} · {other.displayName}: {mark === "X" ? "O" : "X"}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-2" aria-label="XOX tahtası">
        {(game?.board ?? Array(9).fill("")).map((cell, index) => (
          <button
            key={index}
            type="button"
            onClick={() => void makeMove(index)}
            disabled={Boolean(cell)}
            className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-4xl font-black transition-colors hover:bg-white/20 disabled:cursor-default disabled:hover:bg-white/10"
            style={{ color: cell === "X" ? "#a78bfa" : "#fbbf24" }}
            aria-label={`${index + 1}. kare${cell ? `: ${cell}` : ""}`}
          >
            {cell}
          </button>
        ))}
      </div>

      {game?.status === "playing" && <p className="text-xs font-bold text-white/40">{game ? result : message}</p>}
      {!game && <p className="text-xs font-bold text-red-300">{message}</p>}
    </div>
  );
}
