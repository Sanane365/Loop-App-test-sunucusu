/**
 * CompanionMascot
 *
 * • Canvas API strips near-white pixels → transparent bear, no CSS hacks.
 * • Single <img> keeps anatomy intact; CSS keyframes animate the whole figure.
 * • Evening mode  (21:00–07:00): bear sleeps after 15 s of inactivity,
 *   auto-sleeps immediately on mount if hour >= 22.
 * • Question bubbles: random speech bubbles every 3–7 min (skipped while
 *   walking or sleeping).
 */

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { Check, Moon, Pencil, X } from "lucide-react";

type AnimState = "idle" | "walk-right" | "walk-left" | "peek" | "wave" | "happy" | "sleep";

interface Props {
  imgUrl:        string;   // direct URL to companion image (from API or static)
  name:          string;
  isTyping:      boolean;
  onMessageSent: boolean;
  onRename:      (n: string) => void;
}

/* ASSETS map removed — imgUrl is now passed directly as a prop */

/* ── timing ──────────────────────────────────────────────────────────── */
const WALK_MIN       = 12_000;
const WALK_MAX       = 28_000;
const SLEEP_AFTER    = 45_000;   // idle before sleep — day
const SLEEP_EVE      = 15_000;   // idle before sleep — evening
const WAVE_DUR       = 2_600;
const HAPPY_DUR      = 1_900;
const PEEK_HOLD      = 2_200;
const Q_MIN          = 3 * 60_000;   // 3 min
const Q_MAX          = 7 * 60_000;   // 7 min
const Q_SHOW         = 6_000;        // bubble visible duration
const BEAR_W         = 88;

/* ── evening detection ───────────────────────────────────────────────── */
function isEveningNow(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}
function isDeepNight(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

/* ── question pool ───────────────────────────────────────────────────── */
const QUESTIONS = [
  "Bugün nasıl geçti? 🐾",
  "Ne yapıyorsun? 🤔",
  "Sana bir şey sorsam? 🐻",
  "Bugün mutlu musun?",
  "Biraz anlatır mısın?",
  "Seninle sohbet etmek istiyorum ✨",
  "Yeni bir şey öğrendin mi?",
  "Favorin hangisi? 🍯",
  "Bugün hava nasıldı?",
  "Şu an aklında ne var?",
  "Beni düşündün mü hiç? 🐾",
  "Bir dilek dilesen ne olurdu?",
  "En sevdiğin şey nedir?",
];

/* ── canvas: strip near-white ────────────────────────────────────────── */
function stripWhite(imgSrc: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const cv  = document.createElement("canvas");
      cv.width  = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, cv.width, cv.height);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (brightness > 240) {
          d[i + 3] = 0;
        } else if (brightness > 210) {
          d[i + 3] = Math.round(d[i + 3] * (1 - (brightness - 210) / 30));
        }
      }
      ctx.putImageData(id, 0, 0);
      resolve(cv.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imgSrc);
    img.src = imgSrc;
  });
}

/* ── keyframes ───────────────────────────────────────────────────────── */
const KF = `
@keyframes cm-idle {
  0%,100%{ transform: scaleY(1)    scaleX(1)    rotate(0deg)   translateY(0);    }
  30%    { transform: scaleY(1.04) scaleX(.97)  rotate(.8deg)  translateY(-1px); }
  60%    { transform: scaleY(.98)  scaleX(1.01) rotate(-.4deg) translateY(0);    }
}
@keyframes cm-walk {
  0%,100%{ transform: translateY(0)    scaleY(1)    scaleX(1)   rotate(-.6deg); }
  25%    { transform: translateY(-7px)  scaleY(1.05) scaleX(.96) rotate(0deg);   }
  50%    { transform: translateY(0)    scaleY(1)    scaleX(1)   rotate(.6deg);   }
  75%    { transform: translateY(-7px)  scaleY(1.05) scaleX(.96) rotate(0deg);   }
}
@keyframes cm-wave {
  0%,100%{ transform: rotate(0deg)   translateY(0);    }
  15%    { transform: rotate(-10deg) translateY(-5px); }
  30%    { transform: rotate(4deg)   translateY(-2px); }
  45%    { transform: rotate(-12deg) translateY(-6px); }
  60%    { transform: rotate(3deg)   translateY(-2px); }
  75%    { transform: rotate(-8deg)  translateY(-4px); }
  88%    { transform: rotate(2deg)   translateY(-1px); }
}
@keyframes cm-happy {
  0%,100%{ transform: translateY(0)    scaleY(1)    scaleX(1);    }
  18%    { transform: translateY(-20px) scaleY(1.08) scaleX(.93);  }
  36%    { transform: translateY(-2px)  scaleY(.94)  scaleX(1.06); }
  54%    { transform: translateY(-15px) scaleY(1.06) scaleX(.95);  }
  72%    { transform: translateY(-2px)  scaleY(.96)  scaleX(1.04); }
}
@keyframes cm-peek {
  0%,100%{ transform: translateY(0)    scaleY(1);    }
  50%    { transform: translateY(-12px) scaleY(1.03); }
}
@keyframes cm-sleep {
  0%,100%{ transform: scaleY(1)    scaleX(1)   rotate(0deg)  translateY(0);   }
  50%    { transform: scaleY(1.03) scaleX(.98) rotate(.6deg) translateY(-1px); }
}
@keyframes cm-shadow     { 0%,100%{transform:scaleX(1)  ;opacity:.18}25%{transform:scaleX(.78);opacity:.12}75%{transform:scaleX(.78);opacity:.12} }
@keyframes cm-shadow-idle{ 0%,100%{transform:scaleX(1)  ;opacity:.18}50% {transform:scaleX(.9) ;opacity:.12} }
@keyframes cz-zzz        { 0%{opacity:0;transform:translate(0,0) scale(.5)} 20%{opacity:1} 80%{opacity:.6} 100%{opacity:0;transform:translate(10px,-18px) scale(1.1)} }
@keyframes cq-pop        { 0%{opacity:0;transform:translateY(6px) scale(.9)} 12%{opacity:1;transform:translateY(0) scale(1)} 85%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-4px) scale(.95)} }
@keyframes cq-dot        { 0%,80%,100%{transform:translateY(0)}  40%{transform:translateY(-4px)} }
`;

/* ── animation config ────────────────────────────────────────────────── */
const ANIM_CFG: Record<AnimState, { name: string; dur: string; iter: string; easing: string }> = {
  idle:         { name:"cm-idle",  dur:"3.4s",  iter:"infinite", easing:"ease-in-out" },
  "walk-right": { name:"cm-walk",  dur:"0.5s",  iter:"infinite", easing:"ease-in-out" },
  "walk-left":  { name:"cm-walk",  dur:"0.5s",  iter:"infinite", easing:"ease-in-out" },
  wave:         { name:"cm-wave",  dur:"0.65s", iter:"4",        easing:"ease-in-out" },
  happy:        { name:"cm-happy", dur:"0.44s", iter:"4",        easing:"ease-in-out" },
  peek:         { name:"cm-peek",  dur:"2.1s",  iter:"infinite", easing:"ease-in-out" },
  sleep:        { name:"cm-sleep", dur:"5s",    iter:"infinite", easing:"ease-in-out" },
};

/* ══════════════════════════════════════════════════════════════════════ */
export default function CompanionMascot({
  imgUrl, name, isTyping, onMessageSent, onRename,
}: Props) {
  const rawSrc = imgUrl;

  const [src,        setSrc]        = useState<string | null>(null);
  const [posX,       setPosX]       = useState(14);
  const [flipped,    setFlipped]    = useState(false);
  const [anim,       setAnim]       = useState<AnimState>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [renaming,   setRenaming]   = useState(false);
  const [draft,      setDraft]      = useState(name);
  const [zzz,        setZzz]        = useState(false);
  const [question,   setQuestion]   = useState<string | null>(null); // question bubble text
  const [evening,    setEvening]    = useState(isEveningNow);        // reactive evening flag

  /* canvas strip */
  useEffect(() => {
    setSrc(null);
    stripWhite(rawSrc).then(setSrc);
  }, [rawSrc]);

  /* update evening flag every minute */
  useEffect(() => {
    const id = setInterval(() => setEvening(isEveningNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  const walkTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const sleepTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const animTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const peekTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const qTimer     = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const qHideTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const posXRef    = useRef(14);
  const cwRef      = useRef(320);
  const animRef    = useRef<AnimState>("idle");
  const rootRef    = useRef<HTMLDivElement>(null);

  /* keep animRef in sync */
  useEffect(() => { animRef.current = anim; }, [anim]);

  /* measure container */
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    cwRef.current = parent.clientWidth;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? parent.clientWidth;
      cwRef.current = w;
      setPosX(prev => {
        const nx = Math.min(prev, Math.max(0, w - BEAR_W - 8));
        posXRef.current = nx;
        return nx;
      });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  /* ── sleep timer ─────────────────────────────────────────────────── */
  const resetSleep = useCallback(() => {
    clearTimeout(sleepTimer.current);
    setZzz(false);
    const delay = isEveningNow() ? SLEEP_EVE : SLEEP_AFTER;
    sleepTimer.current = setTimeout(() => { setAnim("sleep"); setZzz(true); }, delay);
  }, []);

  /* ── question scheduler ──────────────────────────────────────────── */
  const scheduleQuestion = useCallback(() => {
    clearTimeout(qTimer.current);
    const delay = Q_MIN + Math.random() * (Q_MAX - Q_MIN);
    qTimer.current = setTimeout(() => {
      const cur = animRef.current;
      if (cur !== "sleep" && cur !== "walk-right" && cur !== "walk-left") {
        const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
        setQuestion(q);
        clearTimeout(qHideTimer.current);
        qHideTimer.current = setTimeout(() => setQuestion(null), Q_SHOW);
      }
      scheduleQuestion(); // reschedule regardless
    }, delay);
  }, []);

  /* ── walk scheduler ──────────────────────────────────────────────── */
  const scheduleWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    const delay = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
    walkTimer.current = setTimeout(() => {
      if (isEveningNow()) { scheduleWalk(); return; } // no walks at night
      const cw      = cwRef.current;
      const cur     = posXRef.current;
      const goRight = cur < cw / 2;
      const target  = goRight ? Math.max(0, cw - BEAR_W - 8) : 8;
      const dist    = Math.abs(target - cur);
      const walkMs  = Math.max(2200, dist * 6);
      posXRef.current = target;
      setPosX(target);
      setFlipped(!goRight);
      setAnim(goRight ? "walk-right" : "walk-left");
      resetSleep();
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => {
        setAnim("idle");
        setFlipped(false);
        scheduleWalk();
      }, walkMs);
    }, delay);
  }, [resetSleep]);

  /* ── mount ───────────────────────────────────────────────────────── */
  useEffect(() => {
    // auto-sleep immediately if deep night (≥22:00)
    if (isDeepNight()) {
      setAnim("sleep");
      setZzz(true);
    } else {
      resetSleep();
    }
    scheduleWalk();
    scheduleQuestion();
    return () => {
      clearTimeout(walkTimer.current);
      clearTimeout(sleepTimer.current);
      clearTimeout(animTimer.current);
      clearTimeout(peekTimer.current);
      clearTimeout(qTimer.current);
      clearTimeout(qHideTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── peek while typing ───────────────────────────────────────────── */
  useEffect(() => {
    if (isTyping && anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      clearTimeout(peekTimer.current);
      setAnim("peek");
      resetSleep();
    } else if (!isTyping && anim === "peek") {
      peekTimer.current = setTimeout(() => setAnim("idle"), PEEK_HOLD);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping]);

  /* ── happy on message send ───────────────────────────────────────── */
  const prevSent = useRef(onMessageSent);
  useEffect(() => {
    if (onMessageSent === prevSent.current) return;
    prevSent.current = onMessageSent;
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setQuestion(null); // hide question on send
      setAnim("happy");
      resetSleep();
      animTimer.current = setTimeout(() => setAnim("idle"), HAPPY_DUR);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessageSent]);

  /* ── tap ─────────────────────────────────────────────────────────── */
  const handleTap = () => {
    resetSleep(); setZzz(false); setQuestion(null);
    if (anim === "sleep") { setAnim("idle"); return; }
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("wave");
      animTimer.current = setTimeout(() => setAnim("idle"), WAVE_DUR);
    }
    setShowBubble(v => !v);
  };

  const submitName = () => { if (draft.trim()) onRename(draft.trim()); setRenaming(false); };

  const isWalking = anim === "walk-right" || anim === "walk-left";
  const isSleeping = anim === "sleep";
  const cfg = ANIM_CFG[anim];

  /* figure dim + blue tint when sleeping at night */
  const nightFilter = evening && isSleeping
    ? "drop-shadow(0 4px 12px rgba(80,60,160,0.4)) brightness(.75) saturate(.7)"
    : "drop-shadow(0 4px 10px rgba(0,0,0,0.22))";

  return (
    <>
      <style>{KF}</style>

      <div
        ref={rootRef}
        className="absolute z-20 pointer-events-auto select-none"
        style={{
          bottom: 0,
          left:   posX,
          transition: isWalking ? "left 3.6s linear" : "left 0.5s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* ── question bubble ─────────────────────────────────────── */}
        {question && !showBubble && !renaming && (
          <div
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-3 pt-2.5 pb-2 flex flex-col items-center gap-0.5"
            style={{
              bottom: BEAR_W + 18,
              animation: `cq-pop ${Q_SHOW}ms ease forwards`,
              background:    "rgba(20,10,42,0.92)",
              backdropFilter:"blur(12px)",
              border:        "1.5px solid rgba(139,92,246,0.5)",
              borderRadius:  16,
              boxShadow:     "0 4px 24px rgba(100,60,200,0.25)",
              zIndex:        30,
              minWidth:      120,
              maxWidth:      220,
              textAlign:     "center",
            }}
          >
            <span className="text-[12px] font-semibold text-white/90 leading-snug" style={{ whiteSpace:"normal" }}>
              {question}
            </span>
            {/* tail dots */}
            <div className="flex gap-[3px] mt-0.5">
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:5, height:5, borderRadius:"50%",
                  background:"rgba(139,92,246,0.7)",
                  animation:`cq-dot 1.1s ease-in-out ${i*0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ── name bubble ─────────────────────────────────────────── */}
        {showBubble && !renaming && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ background:"rgba(18,9,36,0.9)", backdropFilter:"blur(10px)", border:"1px solid rgba(139,92,246,0.4)" }}
          >
            <span className="text-[12px] font-black text-white tracking-wide">{name || "Yoldaşım"}</span>
            <button
              className="text-purple-300 hover:text-purple-100 transition-colors"
              onClick={e => { e.stopPropagation(); setDraft(name); setRenaming(true); }}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── rename input ─────────────────────────────────────────── */}
        {renaming && (
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ background:"rgba(14,7,30,0.96)", border:"1px solid rgba(139,92,246,0.7)", minWidth:148 }}
          >
            <input
              autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") submitName(); if (e.key==="Escape") setRenaming(false); }}
              maxLength={16} placeholder="İsim gir..."
              className="flex-1 bg-transparent text-white text-[12px] font-bold outline-none placeholder:text-white/30"
              style={{ width:88 }}
            />
            <button onClick={submitName}               className="text-emerald-400 hover:text-emerald-200 transition-colors"><Check className="w-3.5 h-3.5"/></button>
            <button onClick={() => setRenaming(false)} className="text-white/30  hover:text-white/60  transition-colors"><X    className="w-3 h-3"/></button>
          </div>
        )}

        {/* ── shadow ───────────────────────────────────────────────── */}
        <div style={{
          width:52, height:7, margin:"0 auto -3px",
          background:"radial-gradient(ellipse,rgba(0,0,0,.22) 0%,transparent 70%)",
          animation: isWalking ? "cm-shadow 0.5s ease-in-out infinite" : "cm-shadow-idle 3.4s ease-in-out infinite",
        }} />

        {/* ── figure ───────────────────────────────────────────────── */}
        <div
          onClick={handleTap}
          style={{
            width:     BEAR_W,
            height:    BEAR_W,
            cursor:    "pointer",
            transform: flipped ? "scaleX(-1)" : "scaleX(1)",
            transition:"transform .3s ease",
            animation: `${cfg.name} ${cfg.dur} ${cfg.easing} ${cfg.iter}`,
            willChange:"transform",
            position:  "relative",
            flexShrink:0,
          }}
        >
          {/* zzz bubbles */}
          {zzz && [0,1].map(i => (
            <span key={i} style={{
              position:"absolute", top:-4-i*13, right:-4-i*7,
              fontSize:10+i*4, fontWeight:900, color:"#a78bfa",
              animation:`cz-zzz 2.2s ease-in-out ${i*.9}s infinite`, opacity:0, zIndex:10,
              ...(flipped ? { transform:"scaleX(-1)" } : {}),
            }}>z</span>
          ))}

          {/* moon badge — evening + sleeping */}
          {evening && isSleeping && (
            <div style={{
              position:"absolute", top:-8, left:-8, zIndex:12,
              background:"rgba(30,18,60,0.92)", borderRadius:"50%",
              width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
              border:"1px solid rgba(139,92,246,0.55)",
              boxShadow:"0 0 8px rgba(139,92,246,0.5)",
            }}>
              <Moon style={{ width:11, height:11, color:"#c4b5fd" }} />
            </div>
          )}

          {src && (
            <img
              src={src}
              alt={name || "Yoldaş"}
              style={{
                width:"100%", height:"100%",
                objectFit:"contain", display:"block",
                userSelect:"none", WebkitUserSelect:"none", pointerEvents:"none",
                filter: nightFilter,
                transition:"filter 2s ease",
              }}
              draggable={false}
            />
          )}
        </div>
      </div>
    </>
  );
}
