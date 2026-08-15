import { useState, useEffect, useRef, useCallback } from "react";
import { X, Check, Pencil } from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────────────── */
type AnimState =
  | "idle"        // gentle breathing bob
  | "walk-right"  // walking across screen →
  | "walk-left"   // walking across screen ←
  | "peek"        // peeking up from bottom (typing hint)
  | "wave"        // waving paw
  | "happy"       // jump on message sent
  | "sleep";      // eyes closed, zzz

interface Props {
  companionId: string;    // "bear"
  name: string;
  isTyping: boolean;      // user is typing → trigger peek
  onMessageSent: boolean; // toggled to trigger happy
  onRename: (name: string) => void;
}

/* ─── asset map ──────────────────────────────────────────────────────────── */
const ASSETS: Record<string, string> = {
  bear: "/companion-bear.png",
};

/* ─── timing constants (ms) ─────────────────────────────────────────────── */
const WALK_INTERVAL_MIN = 12000;
const WALK_INTERVAL_MAX = 28000;
const IDLE_AFTER_WALK   = 4000;
const SLEEP_AFTER       = 40000; // idle this long → sleep
const WAVE_DURATION     = 2400;
const HAPPY_DURATION    = 1800;
const PEEK_MIN_HOLD     = 2000;

/* ─── component ─────────────────────────────────────────────────────────── */
export default function CompanionMascot({ companionId, name, isTyping, onMessageSent, onRename }: Props) {
  const src = ASSETS[companionId] ?? ASSETS.bear;

  /* position: x offset from left edge */
  const [posX, setPosX]         = useState(16);
  const [flipped, setFlipped]   = useState(false);
  const [anim, setAnim]         = useState<AnimState>("idle");
  const [showName, setShowName] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft]       = useState(name);
  const [zzz, setZzz]           = useState(false);

  const walkTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sleepTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerW  = useRef(window.innerWidth);

  /* ── keep containerW updated ── */
  useEffect(() => {
    const upd = () => { containerW.current = window.innerWidth; };
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  /* ── schedule next walk ── */
  const scheduleWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    const delay = WALK_INTERVAL_MIN + Math.random() * (WALK_INTERVAL_MAX - WALK_INTERVAL_MIN);
    walkTimer.current = setTimeout(startWalk, delay);
  }, []);

  const resetSleepTimer = useCallback(() => {
    clearTimeout(sleepTimer.current);
    setZzz(false);
    sleepTimer.current = setTimeout(() => {
      setAnim("sleep");
      setZzz(true);
    }, SLEEP_AFTER);
  }, []);

  /* ── start a walk ── */
  const startWalk = useCallback(() => {
    const w = containerW.current;
    const goRight = posX < w / 2;
    const target  = goRight ? w - 110 : 16;
    setFlipped(!goRight);
    setAnim(goRight ? "walk-right" : "walk-left");
    setPosX(target);
    resetSleepTimer();

    // duration: roughly 3–5 s depending on distance
    const dist = Math.abs(target - posX);
    const walkDuration = Math.max(2800, dist * 6);
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      setAnim("idle");
      setFlipped(false);
      scheduleWalk();
    }, walkDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posX, resetSleepTimer, scheduleWalk]);

  /* ── init ── */
  useEffect(() => {
    resetSleepTimer();
    scheduleWalk();
    return () => {
      clearTimeout(walkTimer.current);
      clearTimeout(sleepTimer.current);
      clearTimeout(animTimer.current);
    };
  // only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── peek when user is typing ── */
  const peekRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (isTyping && anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("peek");
      resetSleepTimer();
    } else if (!isTyping && anim === "peek") {
      peekRef.current = setTimeout(() => {
        setAnim("idle");
      }, PEEK_MIN_HOLD);
    }
    return () => clearTimeout(peekRef.current);
  }, [isTyping, anim, resetSleepTimer]);

  /* ── happy on message sent ── */
  const prevSentRef = useRef(onMessageSent);
  useEffect(() => {
    if (onMessageSent !== prevSentRef.current) {
      prevSentRef.current = onMessageSent;
      if (anim !== "walk-right" && anim !== "walk-left") {
        clearTimeout(animTimer.current);
        setAnim("happy");
        resetSleepTimer();
        animTimer.current = setTimeout(() => setAnim("idle"), HAPPY_DURATION);
      }
    }
  }, [onMessageSent, anim, resetSleepTimer]);

  /* ── tap → wave / wake / name dialog ── */
  const handleTap = () => {
    resetSleepTimer();
    setZzz(false);
    if (anim === "sleep") { setAnim("idle"); return; }
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("wave");
      animTimer.current = setTimeout(() => setAnim("idle"), WAVE_DURATION);
    }
    setShowName(v => !v);
  };

  /* ── rename submit ── */
  const submitRename = () => {
    if (draft.trim()) { onRename(draft.trim()); }
    setRenaming(false);
  };

  /* ── walk speed → transition duration ── */
  const isWalking = anim === "walk-right" || anim === "walk-left";
  const walkDurationMs = isWalking ? Math.max(2800, Math.abs(posX - (isWalking && flipped ? 16 : window.innerWidth - 110)) * 6) : 0;

  /* ── y offset for peek: bear rises above bottom edge ── */
  const peekY = anim === "peek" ? -18 : 0;

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* inline keyframes */}
      <style>{`
        @keyframes c-idle   { 0%,100%{transform:translateY(0) rotate(-1.5deg)} 50%{transform:translateY(-5px) rotate(1.5deg)} }
        @keyframes c-walk   { 0%,100%{transform:translateY(0) scaleY(1)} 25%{transform:translateY(-7px) scaleY(1.04)} 75%{transform:translateY(-7px) scaleY(1.04)} }
        @keyframes c-peek   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes c-wave   { 0%{transform:rotate(0deg)} 20%{transform:rotate(-14deg) translateY(-4px)} 40%{transform:rotate(14deg) translateY(-4px)} 60%{transform:rotate(-10deg) translateY(-2px)} 80%{transform:rotate(8deg)} 100%{transform:rotate(0deg)} }
        @keyframes c-happy  { 0%,100%{transform:translateY(0) scaleY(1)} 25%{transform:translateY(-18px) scaleY(1.08)} 50%{transform:translateY(-6px) scaleY(0.96)} 75%{transform:translateY(-14px) scaleY(1.05)} }
        @keyframes c-zzz    { 0%{opacity:0;transform:translate(0,0) scale(0.6)} 20%{opacity:1} 80%{opacity:0.7} 100%{opacity:0;transform:translate(6px,-14px) scale(1)} }
        @keyframes c-shadow { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(0.75)} }
      `}</style>

      {/* ── mascot container (absolute, positioned above input bar) ── */}
      <div
        className="absolute z-20 pointer-events-auto select-none"
        style={{
          bottom: 0,
          left: posX,
          transition: isWalking ? `left ${walkDurationMs}ms linear` : "left 0.4s ease-out",
          transform: `translateY(${peekY}px)`,
          transitionProperty: isWalking ? "left" : "left, transform",
          transitionDuration: isWalking ? `${walkDurationMs}ms, 0.35s` : "0.4s, 0.35s",
          transitionTimingFunction: isWalking ? "linear, ease" : "ease-out, ease-out",
        }}
      >
        {/* ── name bubble ── */}
        {showName && !renaming && (
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{
              background: "rgba(30,20,50,0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(139,92,246,0.4)",
              borderRadius: 12,
              padding: "4px 10px",
            }}
          >
            <span className="text-[12px] font-bold text-white">{name || "Yoldaşım"}</span>
            <button
              className="text-purple-300 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setDraft(name); setRenaming(true); }}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── rename input ── */}
        {renaming && (
          <div
            className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              background: "rgba(18,12,40,0.95)",
              border: "1px solid rgba(139,92,246,0.6)",
              borderRadius: 14,
              padding: "5px 8px",
              minWidth: 140,
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
              maxLength={16}
              placeholder="İsim gir..."
              className="flex-1 bg-transparent text-white text-[12px] font-semibold outline-none placeholder:text-white/30 min-w-0"
              style={{ width: 90 }}
            />
            <button onClick={submitRename} className="text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setRenaming(false)} className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── shadow ── */}
        <div
          className="mx-auto rounded-full"
          style={{
            width: 48,
            height: 8,
            background: "rgba(0,0,0,0.12)",
            filter: "blur(4px)",
            marginBottom: -4,
            animation: anim === "idle" || isWalking ? "c-shadow 3s ease-in-out infinite" : "none",
          }}
        />

        {/* ── bear figure ── */}
        <div
          onClick={handleTap}
          className="cursor-pointer relative"
          style={{
            width: 90,
            height: 90,
            transform: flipped ? "scaleX(-1)" : "scaleX(1)",
            transition: "transform 0.25s ease",
          }}
        >
          {/* zzz sleep bubbles */}
          {zzz && (
            <div className="absolute -top-1 -right-1 pointer-events-none" style={{ transform: "scaleX(1)" /* never flip zzz */ }}>
              {[0, 1].map(i => (
                <span key={i} style={{
                  position: "absolute",
                  top: i * -14,
                  right: i * -8,
                  fontSize: 10 + i * 3,
                  fontWeight: 900,
                  color: "#a78bfa",
                  animation: `c-zzz 2s ease-in-out ${i * 0.7}s infinite`,
                  opacity: 0,
                }}>z</span>
              ))}
            </div>
          )}

          <img
            src={src}
            alt="Yoldaş"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              /* remove white background */
              mixBlendMode: "multiply",
              /* animation per state */
              animation: {
                idle:           "c-idle 3.2s ease-in-out infinite",
                "walk-right":   "c-walk 0.55s ease-in-out infinite",
                "walk-left":    "c-walk 0.55s ease-in-out infinite",
                peek:           "c-peek 2s ease-in-out infinite",
                wave:           "c-wave 0.55s ease-in-out 4",
                happy:          "c-happy 0.45s ease-in-out 4",
                sleep:          "c-idle 5s ease-in-out infinite",
              }[anim],
              filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          />
        </div>
      </div>
    </>
  );
}
