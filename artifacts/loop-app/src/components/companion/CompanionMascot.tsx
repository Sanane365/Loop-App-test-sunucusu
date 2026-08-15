/**
 * CompanionMascot — multi-limb animated companion
 *
 * Technique: each "limb" is the full bear image clipped to its anatomical region.
 * transform-origin is placed at the joint. CSS @keyframes animate each limb
 * independently. mix-blend-mode:multiply removes the white background.
 */

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { Check, Pencil, X } from "lucide-react";

/* ── types ─────────────────────────────────────────────────────────────── */
type AnimState =
  | "idle"
  | "walk-right"
  | "walk-left"
  | "peek"
  | "wave"
  | "happy"
  | "sleep";

interface Props {
  companionId: string;
  name: string;
  isTyping: boolean;
  onMessageSent: boolean;
  onRename: (n: string) => void;
}

/* ── assets ─────────────────────────────────────────────────────────────── */
const ASSETS: Record<string, string> = { bear: "/companion-bear.png" };

/* ── timing ─────────────────────────────────────────────────────────────── */
const WALK_MIN      = 13_000;
const WALK_MAX      = 30_000;
const SLEEP_AFTER   = 45_000;
const WAVE_DUR      = 2_600;
const HAPPY_DUR     = 1_800;
const PEEK_HOLD     = 2_200;

/* ── keyframe CSS ────────────────────────────────────────────────────────── */
const KF = `
/* ── IDLE ── */
@keyframes li-body   {0%,100%{transform:scaleY(1) rotate(0deg)}50%{transform:scaleY(1.03) rotate(.6deg)}}
@keyframes li-head   {0%,100%{transform:rotate(-2.5deg) translateY(0)}40%{transform:rotate(2deg) translateY(-1px)}70%{transform:rotate(-1deg) translateY(1px)}}
@keyframes li-larm   {0%,100%{transform:rotate(0deg)}50%{transform:rotate(4deg)}}
@keyframes li-rarm   {0%,100%{transform:rotate(0deg)}50%{transform:rotate(-4deg)}}
@keyframes li-lleg   {0%,100%{transform:translateY(0)}50%{transform:translateY(1.5px)}}
@keyframes li-rleg   {0%,100%{transform:translateY(1.5px)}50%{transform:translateY(0)}}

/* ── WALK ── */
@keyframes lw-body   {0%,100%{transform:translateY(0) rotate(-.8deg)}25%{transform:translateY(-5px) rotate(0deg)}50%{transform:translateY(0) rotate(.8deg)}75%{transform:translateY(-5px) rotate(0deg)}}
@keyframes lw-head   {0%,100%{transform:rotate(-1.5deg) translateY(0)}25%{transform:rotate(1deg) translateY(-3px)}50%{transform:rotate(.5deg) translateY(0)}75%{transform:rotate(-1deg) translateY(-3px)}}
@keyframes lw-larm   {0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}
@keyframes lw-rarm   {0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}
@keyframes lw-lleg   {0%,100%{transform:rotate(-16deg) translateY(0)}50%{transform:rotate(16deg) translateY(-5px)}}
@keyframes lw-rleg   {0%,100%{transform:rotate(16deg) translateY(-5px)}50%{transform:rotate(-16deg) translateY(0)}}

/* ── WAVE ── */
@keyframes lv-rarm   {0%{transform:rotate(0deg)}10%{transform:rotate(-70deg) translateY(-6px)}25%{transform:rotate(-50deg) translateY(-5px)}40%{transform:rotate(-75deg) translateY(-7px)}55%{transform:rotate(-55deg) translateY(-5px)}70%{transform:rotate(-70deg) translateY(-6px)}85%{transform:rotate(-30deg) translateY(-3px)}100%{transform:rotate(0deg)}}
@keyframes lv-head   {0%,100%{transform:rotate(0)}50%{transform:rotate(5deg)}}
@keyframes lv-larm   {0%,100%{transform:rotate(0)}50%{transform:rotate(6deg)}}

/* ── HAPPY ── */
@keyframes lh-body   {0%,100%{transform:translateY(0) scaleY(1)}20%{transform:translateY(-16px) scaleY(1.06)}40%{transform:translateY(-2px) scaleY(.95)}60%{transform:translateY(-13px) scaleY(1.04)}80%{transform:translateY(-2px) scaleY(.96)}}
@keyframes lh-larm   {0%,100%{transform:rotate(0)}20%{transform:rotate(-45deg) translateY(-4px)}50%{transform:rotate(10deg)}70%{transform:rotate(-35deg) translateY(-3px)}}
@keyframes lh-rarm   {0%,100%{transform:rotate(0)}20%{transform:rotate(45deg) translateY(-4px)}50%{transform:rotate(-10deg)}70%{transform:rotate(35deg) translateY(-3px)}}
@keyframes lh-head   {0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}

/* ── PEEK ── */
@keyframes lp-body   {0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes lp-head   {0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) translateY(-3px)}}
@keyframes lp-larm   {0%,100%{transform:rotate(8deg)}50%{transform:rotate(12deg)}}
@keyframes lp-rarm   {0%,100%{transform:rotate(-8deg)}50%{transform:rotate(-12deg)}}

/* ── SLEEP ── */
@keyframes ls-body   {0%,100%{transform:scaleY(1) rotate(0)}50%{transform:scaleY(1.02) rotate(.3deg)}}
@keyframes ls-head   {0%,100%{transform:rotate(-7deg) translateY(2px)}50%{transform:rotate(-4deg) translateY(1px)}}
@keyframes ls-larm   {0%,100%{transform:rotate(5deg)}50%{transform:rotate(8deg)}}
@keyframes ls-rarm   {0%,100%{transform:rotate(-5deg)}50%{transform:rotate(-8deg)}}

/* ── SHADOW ── */
@keyframes ls-shadow {0%,100%{transform:scaleX(1) scaleY(1)}50%{transform:scaleX(.8) scaleY(.9)}}

/* ── ZZZ ── */
@keyframes lz-zzz    {0%{opacity:0;transform:translate(0,0) scale(.5)}25%{opacity:1}80%{opacity:.6}100%{opacity:0;transform:translate(8px,-16px) scale(1.1)}}
`;

/* ── per-limb clip regions & joint pivots ────────────────────────────────
   All values are % of the 90×90 display container.
   Coordinates are estimated from the bear's anatomy.
   Clip-path isolates each region; transform-origin is the joint.          */
interface LimbDef {
  clip: string;      // CSS polygon
  ox: string;        // transform-origin x (% of full element)
  oy: string;        // transform-origin y
  z: number;
}
const LIMBS: Record<string, LimbDef> = {
  lleg: { clip: "polygon(27% 65%, 51% 65%, 51% 95%, 27% 95%)", ox:"38%", oy:"66%", z:1 },
  rleg: { clip: "polygon(49% 65%, 73% 65%, 73% 95%, 49% 95%)", ox:"62%", oy:"66%", z:2 },
  body: { clip: "polygon(25% 33%, 75% 33%, 75% 68%, 25% 68%)", ox:"50%", oy:"50%", z:3 },
  larm: { clip: "polygon(11% 34%, 36% 34%, 36% 69%, 11% 69%)", ox:"33%", oy:"37%", z:4 },
  rarm: { clip: "polygon(64% 34%, 89% 34%, 89% 69%, 64% 69%)", ox:"67%", oy:"37%", z:5 },
  head: { clip: "polygon(13% 2%, 87% 2%, 89% 37%, 11% 37%)",  ox:"50%", oy:"36%", z:6 },
};

/* ── anim mapping: limb → keyframe name per state ───────────────────────── */
type LimbKey = keyof typeof LIMBS;
const ANIM_MAP: Record<AnimState, Partial<Record<LimbKey, { name: string; dur: string; iter: string }>>> = {
  idle: {
    body: { name:"li-body", dur:"3.4s", iter:"infinite" },
    head: { name:"li-head", dur:"3.4s", iter:"infinite" },
    larm: { name:"li-larm", dur:"3.4s", iter:"infinite" },
    rarm: { name:"li-rarm", dur:"3.4s", iter:"infinite" },
    lleg: { name:"li-lleg", dur:"3.4s", iter:"infinite" },
    rleg: { name:"li-rleg", dur:"3.4s", iter:"infinite" },
  },
  "walk-right": {
    body: { name:"lw-body", dur:"0.52s", iter:"infinite" },
    head: { name:"lw-head", dur:"0.52s", iter:"infinite" },
    larm: { name:"lw-larm", dur:"0.52s", iter:"infinite" },
    rarm: { name:"lw-rarm", dur:"0.52s", iter:"infinite" },
    lleg: { name:"lw-lleg", dur:"0.52s", iter:"infinite" },
    rleg: { name:"lw-rleg", dur:"0.52s", iter:"infinite" },
  },
  "walk-left": {
    body: { name:"lw-body", dur:"0.52s", iter:"infinite" },
    head: { name:"lw-head", dur:"0.52s", iter:"infinite" },
    larm: { name:"lw-rarm", dur:"0.52s", iter:"infinite" }, // swap arms when flipped
    rarm: { name:"lw-larm", dur:"0.52s", iter:"infinite" },
    lleg: { name:"lw-rleg", dur:"0.52s", iter:"infinite" }, // swap legs when flipped
    rleg: { name:"lw-lleg", dur:"0.52s", iter:"infinite" },
  },
  wave: {
    body: { name:"li-body", dur:"3.4s", iter:"infinite" },
    head: { name:"lv-head", dur:"0.65s", iter:"4" },
    larm: { name:"lv-larm", dur:"0.65s", iter:"4" },
    rarm: { name:"lv-rarm", dur:"0.65s", iter:"4" },
    lleg: { name:"li-lleg", dur:"3.4s", iter:"infinite" },
    rleg: { name:"li-rleg", dur:"3.4s", iter:"infinite" },
  },
  happy: {
    body: { name:"lh-body", dur:"0.45s", iter:"4" },
    head: { name:"lh-head", dur:"0.45s", iter:"4" },
    larm: { name:"lh-larm", dur:"0.45s", iter:"4" },
    rarm: { name:"lh-rarm", dur:"0.45s", iter:"4" },
    lleg: { name:"li-lleg", dur:"3.4s", iter:"infinite" },
    rleg: { name:"li-rleg", dur:"3.4s", iter:"infinite" },
  },
  peek: {
    body: { name:"lp-body", dur:"2.2s", iter:"infinite" },
    head: { name:"lp-head", dur:"2.2s", iter:"infinite" },
    larm: { name:"lp-larm", dur:"2.2s", iter:"infinite" },
    rarm: { name:"lp-rarm", dur:"2.2s", iter:"infinite" },
    lleg: { name:"li-lleg", dur:"3.4s", iter:"infinite" },
    rleg: { name:"li-rleg", dur:"3.4s", iter:"infinite" },
  },
  sleep: {
    body: { name:"ls-body", dur:"5s", iter:"infinite" },
    head: { name:"ls-head", dur:"5s", iter:"infinite" },
    larm: { name:"ls-larm", dur:"5s", iter:"infinite" },
    rarm: { name:"ls-rarm", dur:"5s", iter:"infinite" },
    lleg: { name:"li-lleg", dur:"5s", iter:"infinite" },
    rleg: { name:"li-rleg", dur:"5s", iter:"infinite" },
  },
};

/* ── component ───────────────────────────────────────────────────────────── */
export default function CompanionMascot({ companionId, name, isTyping, onMessageSent, onRename }: Props) {
  const src = ASSETS[companionId] ?? ASSETS.bear;

  const [posX,      setPosX]      = useState(14);
  const [flipped,   setFlipped]   = useState(false);
  const [anim,      setAnim]      = useState<AnimState>("idle");
  const [showBubble,setShowBubble]= useState(false);
  const [renaming,  setRenaming]  = useState(false);
  const [draft,     setDraft]     = useState(name);
  const [zzz,       setZzz]       = useState(false);

  const walkTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sleepTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const peekTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const vwRef       = useRef(320); // actual parent container width, updated via ResizeObserver
  const posXRef     = useRef(14);  // mirror of posX for use inside closures
  const wrapperRef  = useRef<HTMLDivElement>(null); // root div of this component

  /* ── measure actual parent container width (not window) ── */
  useEffect(() => {
    const el = wrapperRef.current?.parentElement;
    if (!el) { vwRef.current = window.innerWidth; return; }
    vwRef.current = el.clientWidth;
    const ro = new ResizeObserver(entries => {
      vwRef.current = entries[0]?.contentRect.width ?? el.clientWidth;
      // re-clamp posX if needed after resize
      setPosX(prev => {
        const max = Math.max(0, vwRef.current - 100);
        const next = Math.min(prev, max);
        posXRef.current = next;
        return next;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── sleep timer ── */
  const resetSleep = useCallback(() => {
    clearTimeout(sleepTimer.current);
    setZzz(false);
    sleepTimer.current = setTimeout(() => { setAnim("sleep"); setZzz(true); }, SLEEP_AFTER);
  }, []);

  /* ── walk ── */
  const scheduleWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    const delay = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
    walkTimer.current = setTimeout(() => {
      const vw      = vwRef.current;
      const cur     = posXRef.current;
      const goRight = cur < vw / 2;
      // clamp target so bear never exits the container (90px bear + 8px margin)
      const target  = goRight ? Math.max(0, vw - 98) : 8;
      const dist    = Math.abs(target - cur);
      const walkMs  = Math.max(2400, dist * 6);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSleep]);

  useEffect(() => {
    resetSleep();
    scheduleWalk();
    return () => {
      clearTimeout(walkTimer.current);
      clearTimeout(sleepTimer.current);
      clearTimeout(animTimer.current);
      clearTimeout(peekTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── peek on typing ── */
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

  /* ── happy on send ── */
  const prevSent = useRef(onMessageSent);
  useEffect(() => {
    if (onMessageSent === prevSent.current) return;
    prevSent.current = onMessageSent;
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("happy");
      resetSleep();
      animTimer.current = setTimeout(() => setAnim("idle"), HAPPY_DUR);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessageSent]);

  /* ── tap ── */
  const handleTap = () => {
    resetSleep();
    setZzz(false);
    if (anim === "sleep") { setAnim("idle"); return; }
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("wave");
      animTimer.current = setTimeout(() => setAnim("idle"), WAVE_DUR);
    }
    setShowBubble(v => !v);
  };

  const submitName = () => {
    if (draft.trim()) onRename(draft.trim());
    setRenaming(false);
  };

  /* ── walk transition ── */
  const isWalking = anim === "walk-right" || anim === "walk-left";
  const walkMs = 3500; // fixed generous duration; actual dist varies but this always covers it

  /* ── limb style helper ── */
  const limbStyle = (key: LimbKey): CSSProperties => {
    const def = LIMBS[key];
    const a   = ANIM_MAP[anim][key];
    return {
      position:        "absolute",
      inset:           0,
      width:           "100%",
      height:          "100%",
      zIndex:          def.z,
      clipPath:        def.clip,
      transformOrigin: `${def.ox} ${def.oy}`,
      animation:       a ? `${a.name} ${a.dur} ease-in-out ${a.iter}` : "none",
      willChange:      "transform",
    };
  };

  const imgStyle: CSSProperties = {
    width:         "100%",
    height:        "100%",
    objectFit:     "contain",
    /* NO mix-blend-mode here — applied to the outer figure wrapper instead */
    display:       "block",
    userSelect:    "none",
    WebkitUserSelect: "none",
    pointerEvents: "none",
  };

  /* ─── render ────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{KF}</style>

      <div
        ref={wrapperRef}
        className="absolute z-20 pointer-events-auto select-none"
        style={{
          bottom: 0,
          left: posX,
          /* hard-clamp so it never visually exits container */
          maxWidth: 90,
          transition: isWalking
            ? `left ${walkMs}ms linear`
            : "left 0.5s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* ── name bubble ── */}
        {showBubble && !renaming && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2 px-3 py-1.5 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{
              background:    "rgba(20,10,40,0.88)",
              backdropFilter:"blur(10px)",
              border:        "1px solid rgba(139,92,246,0.45)",
              borderRadius:  12,
            }}
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

        {/* ── rename input ── */}
        {renaming && (
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              background:    "rgba(14,8,32,0.95)",
              border:        "1px solid rgba(139,92,246,0.7)",
              borderRadius:  14,
              minWidth:      148,
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitName(); if (e.key === "Escape") setRenaming(false); }}
              maxLength={16}
              placeholder="İsim gir..."
              className="flex-1 bg-transparent text-white text-[12px] font-bold outline-none placeholder:text-white/30 min-w-0"
              style={{ width: 88 }}
            />
            <button onClick={submitName}         className="text-emerald-400 hover:text-emerald-200 transition-colors"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setRenaming(false)} className="text-white/30 hover:text-white/60 transition-colors"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* ── shadow ── */}
        <div style={{
          width: 52, height: 7, margin: "0 auto -3px",
          background: "radial-gradient(ellipse,rgba(0,0,0,.18) 0%,transparent 72%)",
          animation: "ls-shadow 3.4s ease-in-out infinite",
        }} />

        {/* ── figure wrapper: flip for walk-left, multiply removes white bg ── */}
        <div
          onClick={handleTap}
          style={{
            position:    "relative",
            width:       90,
            height:      90,
            cursor:      "pointer",
            transform:   flipped ? "scaleX(-1)" : "scaleX(1)",
            transition:  "transform .28s ease",
            /* All layers composite to white in non-bear areas, then the whole
               thing is multiplied against the page background → white becomes
               transparent without each layer bleeding into its siblings.      */
            mixBlendMode: "multiply",
          }}
        >
          {/* zzz bubbles */}
          {zzz && [0,1].map(i => (
            <span key={i} style={{
              position:  "absolute",
              top:       -2 - i * 14,
              right:     -2 - i * 8,
              fontSize:  10 + i * 3,
              fontWeight:900,
              color:     "#a78bfa",
              animation: `lz-zzz 2.2s ease-in-out ${i * .8}s infinite`,
              opacity:   0,
              zIndex:    10,
              transform: flipped ? "scaleX(-1)" : "scaleX(1)", // zzz never flip
            }}>z</span>
          ))}

          {/* ── LEGS ── */}
          <div style={limbStyle("lleg")}><img src={src} alt="" style={imgStyle} /></div>
          <div style={limbStyle("rleg")}><img src={src} alt="" style={imgStyle} /></div>

          {/* ── BODY ── */}
          <div style={limbStyle("body")}><img src={src} alt="" style={imgStyle} /></div>

          {/* ── ARMS ── */}
          <div style={limbStyle("larm")}><img src={src} alt="" style={imgStyle} /></div>
          <div style={limbStyle("rarm")}><img src={src} alt="" style={imgStyle} /></div>

          {/* ── HEAD ── */}
          <div style={limbStyle("head")}><img src={src} alt="" style={imgStyle} /></div>
        </div>
      </div>
    </>
  );
}
