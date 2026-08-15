/**
 * CompanionMascot
 *
 * White-background removal: Canvas API reads every pixel at mount,
 * sets near-white (R,G,B > 220) alpha to 0, outputs a data-URL.
 * All limb layers use this transparent image — no CSS blend-mode tricks.
 *
 * Limb animation: each limb is the full image clipped to its region,
 * rotated around its anatomical joint via transform-origin.
 */

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { Check, Pencil, X } from "lucide-react";

/* ── types ─────────────────────────────────────────────────────────────── */
type AnimState = "idle" | "walk-right" | "walk-left" | "peek" | "wave" | "happy" | "sleep";

interface Props {
  companionId: string;
  name: string;
  isTyping: boolean;
  onMessageSent: boolean;
  onRename: (n: string) => void;
}

const ASSETS: Record<string, string> = { bear: "/companion-bear.png" };

const WALK_MIN    = 12_000;
const WALK_MAX    = 28_000;
const SLEEP_AFTER = 45_000;
const WAVE_DUR    = 2_500;
const HAPPY_DUR   = 1_800;
const PEEK_HOLD   = 2_000;
const BEAR_W      = 96; // display px

/* ── Canvas: strip white background ─────────────────────────────────── */
function stripWhite(imgSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // near-white → transparent; soft edge via distance from white
        const dist = Math.max(0, 255 - Math.max(r, g, b));
        if (dist < 38) {
          // blend alpha: 0 at dist=0, full alpha at dist=38
          d[i + 3] = Math.round((dist / 38) * d[i + 3]);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

/* ── Keyframes ───────────────────────────────────────────────────────── */
const KF = `
/* IDLE */
@keyframes ci-body {0%,100%{transform:scaleY(1) scaleX(1) rotate(0deg)}50%{transform:scaleY(1.035) scaleX(.982) rotate(.8deg)}}
@keyframes ci-head {0%,100%{transform:rotate(-3deg) translateY(0)}35%{transform:rotate(2.5deg) translateY(-2px)}70%{transform:rotate(-1deg) translateY(1px)}}
@keyframes ci-larm {0%,100%{transform:rotate(0deg)}50%{transform:rotate(5deg)}}
@keyframes ci-rarm {0%,100%{transform:rotate(0deg)}50%{transform:rotate(-5deg)}}
@keyframes ci-lleg {0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
@keyframes ci-rleg {0%,100%{transform:translateY(2px)}50%{transform:translateY(0)}}

/* WALK */
@keyframes cw-body {0%,100%{transform:translateY(0) scaleY(1) rotate(-.8deg)}25%{transform:translateY(-6px) scaleY(1.04) rotate(0)}50%{transform:translateY(0) scaleY(1) rotate(.8deg)}75%{transform:translateY(-6px) scaleY(1.04) rotate(0)}}
@keyframes cw-head {0%,100%{transform:rotate(-2deg) translateY(0)}25%{transform:rotate(1.5deg) translateY(-4px)}75%{transform:rotate(-1.5deg) translateY(-4px)}}
@keyframes cw-larm {0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}
@keyframes cw-rarm {0%,100%{transform:rotate(24deg)}50%{transform:rotate(-24deg)}}
@keyframes cw-lleg {0%,100%{transform:rotate(-18deg) translateY(0)}50%{transform:rotate(18deg) translateY(-6px)}}
@keyframes cw-rleg {0%,100%{transform:rotate(18deg) translateY(-6px)}50%{transform:rotate(-18deg) translateY(0)}}

/* WAVE */
@keyframes cv-rarm {0%{transform:rotate(0)}12%{transform:rotate(-72deg) translateY(-7px)}28%{transform:rotate(-52deg) translateY(-5px)}44%{transform:rotate(-78deg) translateY(-8px)}60%{transform:rotate(-58deg) translateY(-6px)}76%{transform:rotate(-70deg) translateY(-7px)}88%{transform:rotate(-28deg) translateY(-3px)}100%{transform:rotate(0)}}
@keyframes cv-head {0%,100%{transform:rotate(0)}50%{transform:rotate(6deg)}}
@keyframes cv-body {0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.02)}}

/* HAPPY */
@keyframes ch-body {0%,100%{transform:translateY(0) scaleY(1) scaleX(1)}18%{transform:translateY(-18px) scaleY(1.07) scaleX(.94)}38%{transform:translateY(-2px) scaleY(.94) scaleX(1.05)}58%{transform:translateY(-14px) scaleY(1.05) scaleX(.96)}78%{transform:translateY(-2px) scaleY(.95) scaleX(1.04)}}
@keyframes ch-larm {0%,100%{transform:rotate(0)}20%{transform:rotate(-50deg) translateY(-5px)}55%{transform:rotate(12deg)}}
@keyframes ch-rarm {0%,100%{transform:rotate(0)}20%{transform:rotate(50deg) translateY(-5px)}55%{transform:rotate(-12deg)}}
@keyframes ch-head {0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}

/* PEEK */
@keyframes cp-body {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes cp-head {0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) translateY(-4px)}}
@keyframes cp-larm {0%,100%{transform:rotate(10deg)}50%{transform:rotate(14deg)}}
@keyframes cp-rarm {0%,100%{transform:rotate(-10deg)}50%{transform:rotate(-14deg)}}

/* SLEEP */
@keyframes cs-body {0%,100%{transform:scaleY(1) rotate(0)}50%{transform:scaleY(1.025) rotate(.4deg)}}
@keyframes cs-head {0%,100%{transform:rotate(-8deg) translateY(3px)}50%{transform:rotate(-5deg) translateY(1px)}}
@keyframes cs-larm {0%,100%{transform:rotate(6deg)}50%{transform:rotate(9deg)}}
@keyframes cs-rarm {0%,100%{transform:rotate(-6deg)}50%{transform:rotate(-9deg)}}

/* MISC */
@keyframes cs-shadow {0%,100%{transform:scaleX(1)}50%{transform:scaleX(.76)}}
@keyframes cz-zzz   {0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:1}80%{opacity:.6}100%{opacity:0;transform:translate(10px,-18px) scale(1.1)}}
`;

/* ── Limb anatomy (% of 96×96 display box) ──────────────────────────── */
interface LimbDef { clip: string; ox: string; oy: string; z: number; }
const LIMBS: Record<string, LimbDef> = {
  lleg: { clip:"polygon(27% 64%, 51% 64%, 51% 96%, 27% 96%)", ox:"39%", oy:"65%", z:1 },
  rleg: { clip:"polygon(49% 64%, 73% 64%, 73% 96%, 49% 96%)", ox:"61%", oy:"65%", z:2 },
  body: { clip:"polygon(24% 32%, 76% 32%, 76% 67%, 24% 67%)",  ox:"50%", oy:"50%", z:3 },
  larm: { clip:"polygon(10% 33%, 35% 33%, 35% 70%, 10% 70%)",  ox:"33%", oy:"36%", z:4 },
  rarm: { clip:"polygon(65% 33%, 90% 33%, 90% 70%, 65% 70%)",  ox:"67%", oy:"36%", z:5 },
  head: { clip:"polygon(12% 1%,  88% 1%,  90% 37%, 10% 37%)", ox:"50%", oy:"36%", z:6 },
};
type LimbKey = keyof typeof LIMBS;

/* ── Animation map ───────────────────────────────────────────────────── */
type LimbAnim = { name: string; dur: string; iter: string };
const A = (name:string, dur:string, iter="infinite"): LimbAnim => ({ name, dur, iter });
const ANIM: Record<AnimState, Partial<Record<LimbKey, LimbAnim>>> = {
  idle:        { body:A("ci-body","3.4s"), head:A("ci-head","3.4s"), larm:A("ci-larm","3.4s"), rarm:A("ci-rarm","3.4s"), lleg:A("ci-lleg","3.4s"), rleg:A("ci-rleg","3.4s") },
  "walk-right":{ body:A("cw-body","0.5s"), head:A("cw-head","0.5s"), larm:A("cw-larm","0.5s"), rarm:A("cw-rarm","0.5s"), lleg:A("cw-lleg","0.5s"), rleg:A("cw-rleg","0.5s") },
  "walk-left": { body:A("cw-body","0.5s"), head:A("cw-head","0.5s"), larm:A("cw-rarm","0.5s"), rarm:A("cw-larm","0.5s"), lleg:A("cw-rleg","0.5s"), rleg:A("cw-lleg","0.5s") },
  wave:        { body:A("cv-body","3.4s"), head:A("cv-head","0.62s","4"), larm:A("ci-larm","3.4s"), rarm:A("cv-rarm","0.62s","4"), lleg:A("ci-lleg","3.4s"), rleg:A("ci-rleg","3.4s") },
  happy:       { body:A("ch-body","0.44s","4"), head:A("ch-head","0.44s","4"), larm:A("ch-larm","0.44s","4"), rarm:A("ch-rarm","0.44s","4"), lleg:A("ci-lleg","3.4s"), rleg:A("ci-rleg","3.4s") },
  peek:        { body:A("cp-body","2.1s"), head:A("cp-head","2.1s"), larm:A("cp-larm","2.1s"), rarm:A("cp-rarm","2.1s"), lleg:A("ci-lleg","3.4s"), rleg:A("ci-rleg","3.4s") },
  sleep:       { body:A("cs-body","5s"),  head:A("cs-head","5s"),   larm:A("cs-larm","5s"),   rarm:A("cs-rarm","5s"),   lleg:A("ci-lleg","5s"),  rleg:A("ci-rleg","5s") },
};

/* ── Component ───────────────────────────────────────────────────────── */
export default function CompanionMascot({ companionId, name, isTyping, onMessageSent, onRename }: Props) {
  const rawSrc = ASSETS[companionId] ?? ASSETS.bear;

  /* processed (white-stripped) image URL */
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    stripWhite(rawSrc).then(setSrc).catch(() => setSrc(rawSrc));
  }, [rawSrc]);

  /* state */
  const [posX,       setPosX]       = useState(14);
  const [flipped,    setFlipped]    = useState(false);
  const [anim,       setAnim]       = useState<AnimState>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [renaming,   setRenaming]   = useState(false);
  const [draft,      setDraft]      = useState(name);
  const [zzz,        setZzz]        = useState(false);

  const walkTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const sleepTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const animTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const peekTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const posXRef    = useRef(14);
  const cwRef      = useRef(320); // container width
  const rootRef    = useRef<HTMLDivElement>(null);

  /* measure real container width */
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    cwRef.current = parent.clientWidth;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? parent.clientWidth;
      cwRef.current = w;
      setPosX(prev => { const nx = Math.min(prev, Math.max(0, w - BEAR_W - 8)); posXRef.current = nx; return nx; });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  /* sleep */
  const resetSleep = useCallback(() => {
    clearTimeout(sleepTimer.current);
    setZzz(false);
    sleepTimer.current = setTimeout(() => { setAnim("sleep"); setZzz(true); }, SLEEP_AFTER);
  }, []);

  /* walk scheduler */
  const scheduleWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    const delay = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
    walkTimer.current = setTimeout(() => {
      const cw      = cwRef.current;
      const cur     = posXRef.current;
      const goRight = cur < cw / 2;
      const target  = Math.round(goRight ? Math.max(0, cw - BEAR_W - 8) : 8);
      const dist    = Math.abs(target - cur);
      const walkMs  = Math.max(2400, dist * 6);
      posXRef.current = target;
      setPosX(target);
      setFlipped(!goRight);
      setAnim(goRight ? "walk-right" : "walk-left");
      resetSleep();
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => { setAnim("idle"); setFlipped(false); scheduleWalk(); }, walkMs);
    }, delay);
  }, [resetSleep]);

  useEffect(() => {
    resetSleep();
    scheduleWalk();
    return () => { clearTimeout(walkTimer.current); clearTimeout(sleepTimer.current); clearTimeout(animTimer.current); clearTimeout(peekTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* peek while typing */
  useEffect(() => {
    if (isTyping && anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current); clearTimeout(peekTimer.current);
      setAnim("peek"); resetSleep();
    } else if (!isTyping && anim === "peek") {
      peekTimer.current = setTimeout(() => setAnim("idle"), PEEK_HOLD);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping]);

  /* happy on send */
  const prevSent = useRef(onMessageSent);
  useEffect(() => {
    if (onMessageSent === prevSent.current) return;
    prevSent.current = onMessageSent;
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("happy"); resetSleep();
      animTimer.current = setTimeout(() => setAnim("idle"), HAPPY_DUR);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessageSent]);

  /* tap */
  const handleTap = () => {
    resetSleep(); setZzz(false);
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

  /* limb CSS */
  const limbStyle = (key: LimbKey): CSSProperties => {
    const def = LIMBS[key];
    const a   = ANIM[anim][key];
    return {
      position: "absolute", inset: 0, width: "100%", height: "100%",
      zIndex: def.z, clipPath: def.clip,
      transformOrigin: `${def.ox} ${def.oy}`,
      animation: a ? `${a.name} ${a.dur} ease-in-out ${a.iter}` : "none",
      willChange: "transform",
    };
  };

  const imgCss: CSSProperties = {
    width: "100%", height: "100%", objectFit: "contain",
    display: "block", userSelect: "none", pointerEvents: "none",
    WebkitUserSelect: "none",
  };

  if (!src) return null; // wait for canvas processing

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <>
      <style>{KF}</style>

      <div
        ref={rootRef}
        className="absolute z-20 pointer-events-auto select-none"
        style={{
          bottom: 0,
          left: posX,
          transition: isWalking ? "left 3.6s linear" : "left 0.5s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* name bubble */}
        {showBubble && !renaming && (
          <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ background:"rgba(18,9,36,0.9)", backdropFilter:"blur(10px)", border:"1px solid rgba(139,92,246,0.45)" }}>
            <span className="text-[12px] font-black text-white tracking-wide">{name || "Yoldaşım"}</span>
            <button className="text-purple-300 hover:text-purple-100 transition-colors"
              onClick={e => { e.stopPropagation(); setDraft(name); setRenaming(true); }}>
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* rename input */}
        {renaming && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ background:"rgba(14,7,30,0.96)", border:"1px solid rgba(139,92,246,0.7)", minWidth:148 }}>
            <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter")submitName(); if(e.key==="Escape")setRenaming(false); }}
              maxLength={16} placeholder="İsim gir..."
              className="flex-1 bg-transparent text-white text-[12px] font-bold outline-none placeholder:text-white/30"
              style={{ width:88 }} />
            <button onClick={submitName}            className="text-emerald-400 hover:text-emerald-200 transition-colors"><Check className="w-3.5 h-3.5"/></button>
            <button onClick={()=>setRenaming(false)} className="text-white/30  hover:text-white/60  transition-colors"><X    className="w-3 h-3"/></button>
          </div>
        )}

        {/* shadow */}
        <div style={{ width:52, height:6, margin:"0 auto -2px",
          background:"radial-gradient(ellipse,rgba(0,0,0,.2) 0%,transparent 70%)",
          animation:"cs-shadow 3.4s ease-in-out infinite" }} />

        {/* figure: flip for walk-left */}
        <div onClick={handleTap} style={{
          position:"relative", width:BEAR_W, height:BEAR_W, cursor:"pointer",
          transform: flipped ? "scaleX(-1)" : "scaleX(1)",
          transition:"transform .3s ease",
        }}>
          {/* zzz */}
          {zzz && [0,1].map(i => (
            <span key={i} style={{
              position:"absolute", top:-2-i*14, right:-2-i*8,
              fontSize:10+i*3, fontWeight:900, color:"#a78bfa",
              animation:`cz-zzz 2.2s ease-in-out ${i*.85}s infinite`,
              opacity:0, zIndex:10,
              ...(flipped ? { transform:"scaleX(-1)" } : {}),
            }}>z</span>
          ))}

          {/* legs (back) */}
          <div style={limbStyle("lleg")}><img src={src} alt="" style={imgCss}/></div>
          <div style={limbStyle("rleg")}><img src={src} alt="" style={imgCss}/></div>
          {/* body */}
          <div style={limbStyle("body")}><img src={src} alt="" style={imgCss}/></div>
          {/* arms */}
          <div style={limbStyle("larm")}><img src={src} alt="" style={imgCss}/></div>
          <div style={limbStyle("rarm")}><img src={src} alt="" style={imgCss}/></div>
          {/* head (front) */}
          <div style={limbStyle("head")}><img src={src} alt="" style={imgCss}/></div>
        </div>
      </div>
    </>
  );
}
