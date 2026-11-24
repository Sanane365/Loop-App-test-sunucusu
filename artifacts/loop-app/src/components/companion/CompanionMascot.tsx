/**
 * CompanionMascot
 *
 * • Canvas API flood-fills from edges → only the actual white background
 *   is removed; white pixels inside the figure (fur, eyes) are preserved.
 * • Single <img> keeps anatomy intact; CSS keyframes animate the whole figure.
 * • Evening mode (21:00–07:00): bear sleeps after 15 s of inactivity,
 *   auto-sleeps immediately on mount if hour >= 22.
 * • Question bubbles: random speech bubbles every 3–7 min (skipped while
 *   walking or sleeping).
 * • Test mode: add ?testEvening=1 to URL → forces evening + instant sleep
 *   (SLEEP_AFTER becomes 3 s). Useful for QA.
 */

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { Check, Moon, Pencil, X } from "lucide-react";

type AnimState = "idle" | "walk-right" | "walk-left" | "peek" | "wave" | "happy" | "sleep" | "angry";

interface Props {
  imgUrl:        string;
  name:          string;
  isTyping:      boolean;
  onMessageSent: boolean;
  onRename:      (n: string) => void;
}

/* ── timing ──────────────────────────────────────────────────────────── */
const WALK_MIN    = 12_000;
const WALK_MAX    = 28_000;
const SLEEP_AFTER = 45_000;
const SLEEP_EVE   = 15_000;
const WAVE_DUR    = 2_600;
const HAPPY_DUR   = 1_900;
const PEEK_HOLD   = 2_200;
const Q_MIN       = 3 * 60_000;
const Q_MAX       = 7 * 60_000;
const Q_SHOW      = 6_000;
const BEAR_W      = 88;

/* ── test mode (URL ?testEvening=1) ─────────────────────────────────── */
const TEST_EVENING =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("testEvening") === "1";

/* ── evening detection ───────────────────────────────────────────────── */
function isEveningNow(): boolean {
  if (TEST_EVENING) return true;
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}
function isDeepNight(): boolean {
  if (TEST_EVENING) return true;
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

/* ── canvas: flood-fill background removal ───────────────────────────
 *  Two modes, auto-detected:
 *
 *  A) Image already has an alpha channel (any pixel with alpha < 200):
 *     BFS only through ALREADY-TRANSPARENT pixels.  White opaque pixels
 *     (e.g. panda fur, rabbit body) are NEVER touched — they are
 *     foreground.  This mode correctly handles PNGs downloaded with a
 *     pre-existing transparent background.
 *
 *  B) Fully opaque image (all alpha = 255, e.g. JPG or solid-bg PNG):
 *     BFS from edges through near-white pixels (r,g,b > 235).
 *     Works well for non-white subjects on white backgrounds.
 * ────────────────────────────────────────────────────────────────── */
/* ── canvas: background removal ─────────────────────────────────────
 *  Three modes (auto-detected):
 *
 *  A) Image has alpha channel (≥0.5% transparent pixels):
 *     BFS only through already-transparent pixels — never touches opaque
 *     white fur/body. Best for cartoon PNGs with pre-made transparency.
 *
 *  B) Fully opaque image, corners are near-white (solid white BG):
 *     BFS from edges; a pixel is "background" iff it matches the corner
 *     colour within ±TOL on every channel (default TOL=12).
 *     Very tight → preserves off-white fur (≥243 but not pure white).
 *
 *  C) Fully opaque, corners are not white (no detectable white BG):
 *     Return image unchanged.
 *
 *  NOTE: No crossOrigin attribute — this is a same-origin request through
 *  the Vite proxy and adding crossOrigin="anonymous" can taint the canvas
 *  if the API server doesn't send explicit CORS headers.
 * ──────────────────────────────────────────────────────────────────── */
function stripWhiteBackground(imgSrc: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      if (!W || !H) { resolve(imgSrc); return; }

      const cv  = document.createElement("canvas");
      cv.width  = W; cv.height = H;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      let id: ImageData;
      try { id = ctx.getImageData(0, 0, W, H); }
      catch (error) {
        console.error("Yoldaş görselinin arka planı temizlenemedi", error);
        resolve(imgSrc);
        return;
      }
      const d = id.data;

      /* ── Mode A: check for existing transparency ────────────────── */
      let transparentCount = 0;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] < 200) { transparentCount++; if (transparentCount > W * H * 0.005) break; }
      }
      const hasAlpha = transparentCount > W * H * 0.005;

      let isBg: (idx4: number) => boolean;

      if (hasAlpha) {
        /* Mode A — propagate ONLY through transparent pixels.
         * Opaque white pixels (fur, eyes, body) are always foreground. */
        isBg = (idx4: number) => d[idx4 + 3] < 30;

      } else {
        /* Sample 4 corners to get background colour */
        const cx = [0, W - 1, 0, W - 1];
        const cy = [0, 0, H - 1, H - 1];
        let bgR = 0, bgG = 0, bgB = 0;
        for (let k = 0; k < 4; k++) {
          const p = (cy[k] * W + cx[k]) * 4;
          bgR += d[p]; bgG += d[p + 1]; bgB += d[p + 2];
        }
        bgR = Math.round(bgR / 4);
        bgG = Math.round(bgG / 4);
        bgB = Math.round(bgB / 4);

        /* Mode C: corners are not near-white → no white background to remove */
        if (bgR < 220 || bgG < 220 || bgB < 220) {
          resolve(cv.toDataURL("image/png")); return;
        }

        /* Mode B — iki katmanlı tolerans:
         *  · TIGHT (≤15): kesinlikle arkaplan → sil
         *  · OUTER (≤38): gri/nötr anti-aliased kenar → sil (satürasyon düşük)
         *  · OUTER + renkli piksel (satürasyon ≥ 0.18): figürün parçası → koru
         *
         * Bu yöntem kenar anti-aliasing'ini yakalayıp renkli figür piksellerini korur.
         */
        const TIGHT = 15;
        const OUTER = 38;
        isBg = (idx4: number) => {
          if (d[idx4 + 3] < 30) return true;
          const r = d[idx4], g = d[idx4 + 1], b = d[idx4 + 2];
          const dr = Math.abs(r - bgR);
          const dg = Math.abs(g - bgG);
          const db = Math.abs(b - bgB);
          if (dr > OUTER || dg > OUTER || db > OUTER) return false;  // kesinlikle figür
          if (dr <= TIGHT && dg <= TIGHT && db <= TIGHT) return true; // kesinlikle arka plan
          // Gri bölge: satürasyon kontrolü
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          return sat < 0.18;  // düşük satürasyon = nötr kenar → arka plan
        };
      }

      /* ── BFS from every edge pixel ───────────────────────────────── */
      const visited = new Uint8Array(W * H);
      const queue: number[] = [];
      const enqueue = (i: number) => {
        if (!visited[i] && isBg(i * 4)) { visited[i] = 1; queue.push(i); }
      };
      for (let x = 0; x < W; x++) { enqueue(x); enqueue((H - 1) * W + x); }
      for (let y = 1; y < H - 1; y++) { enqueue(y * W); enqueue(y * W + W - 1); }

      let head = 0;
      while (head < queue.length) {
        const i = queue[head++];
        const x = i % W; const y = (i - x) / W;
        d[i * 4 + 3] = 0;
        if (y > 0)     enqueue(i - W);
        if (y < H - 1) enqueue(i + W);
        if (x > 0)     enqueue(i - 1);
        if (x < W - 1) enqueue(i + 1);
      }

      ctx.putImageData(id, 0, 0);
      resolve(cv.toDataURL("image/png"));
    };
    img.onerror = () => {
      console.error("Yoldaş görseli yüklenemedi:", imgSrc);
      resolve(imgSrc);
    };
    img.src = imgSrc;
  });
}

function CompanionVideo({ src, filter }: { src: string; filter: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setCanvasFailed(false);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let frame = 0;
    let stopped = false;

    const drawFrame = () => {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        let image: ImageData;
        try {
          image = context.getImageData(0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.error("Yoldaş videosunun arka planı temizlenemedi", error);
          setCanvasFailed(true);
          stopped = true;
          return;
        }
        const pixels = image.data;
        const width = canvas.width;
        const height = canvas.height;
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];
        const isBackground = (pixel: number) => {
          const red = pixels[pixel];
          const green = pixels[pixel + 1];
          const blue = pixels[pixel + 2];
          return red > 220 && green > 220 && blue > 220;
        };
        const enqueue = (index: number) => {
          if (!visited[index] && isBackground(index * 4)) {
            visited[index] = 1;
            queue.push(index);
          }
        };
        for (let x = 0; x < width; x += 2) {
          enqueue(x); enqueue((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y += 2) {
          enqueue(y * width); enqueue(y * width + width - 1);
        }
        for (let head = 0; head < queue.length; head += 1) {
          const index = queue[head]!;
          pixels[index * 4 + 3] = 0;
          const x = index % width;
          const y = Math.floor(index / width);
          if (y > 0) enqueue(index - width);
          if (y < height - 1) enqueue(index + width);
          if (x > 0) enqueue(index - 1);
          if (x < width - 1) enqueue(index + 1);
        }
        context.putImageData(image, 0, 0);
      }
      frame = requestAnimationFrame(drawFrame);
    };

    video.play().catch(() => undefined);
    frame = requestAnimationFrame(drawFrame);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        src={src}
        muted
        loop
        playsInline
        className={canvasFailed ? "h-full w-full object-contain" : "hidden"}
        aria-label={canvasFailed ? "Hareketli yoldaş" : undefined}
        aria-hidden={!canvasFailed}
        style={canvasFailed ? { filter } : undefined}
      />
      <canvas ref={canvasRef} aria-label="Hareketli yoldaş" style={{ width: "100%", height: "100%", objectFit: "contain", display: canvasFailed ? "none" : "block", filter }} />
    </>
  );
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
@keyframes cm-turn-right { 0%{transform:scaleX(-1) scaleY(1)} 45%{transform:scaleX(0) scaleY(1.1)} 100%{transform:scaleX(1)  scaleY(1)} }
@keyframes cm-turn-left  { 0%{transform:scaleX(1)  scaleY(1)} 45%{transform:scaleX(0) scaleY(1.1)} 100%{transform:scaleX(-1) scaleY(1)} }
@keyframes cm-angry {
  0%,100%{ transform: rotate(0deg)   translateX(0)    translateY(0); }
  8%     { transform: rotate(-9deg)  translateX(-4px) translateY(-2px); }
  16%    { transform: rotate(9deg)   translateX(4px)  translateY(-3px); }
  24%    { transform: rotate(-8deg)  translateX(-3px) translateY(-1px); }
  32%    { transform: rotate(8deg)   translateX(3px)  translateY(-2px); }
  40%    { transform: rotate(-6deg)  translateX(-3px) translateY(-1px); }
  48%    { transform: rotate(6deg)   translateX(3px)  translateY(-1px); }
  56%    { transform: rotate(-4deg)  translateX(-2px) translateY(0); }
  64%    { transform: rotate(4deg)   translateX(2px)  translateY(0); }
  72%    { transform: rotate(-2deg)  translateX(-1px) translateY(0); }
  80%    { transform: rotate(2deg)   translateX(1px)  translateY(0); }
  90%    { transform: rotate(-1deg)  translateX(0)    translateY(0); }
}
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
  angry:        { name:"cm-angry", dur:"0.38s", iter:"5",        easing:"ease-in-out" },
};

/* ══════════════════════════════════════════════════════════════════════ */
export default function CompanionMascot({
  imgUrl, name, isTyping, onMessageSent, onRename,
}: Props) {
  const rawSrc = imgUrl;
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(rawSrc);

  const [src,        setSrc]        = useState<string | null>(null);
  const [posX,       setPosX]       = useState(14);
  const [flipped,    setFlipped]    = useState(false);
  const [turnAnim,   setTurnAnim]   = useState<"cm-turn-left"|"cm-turn-right"|null>(null);
  const [anim,       setAnim]       = useState<AnimState>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [renaming,   setRenaming]   = useState(false);
  const [draft,      setDraft]      = useState(name);
  const [zzz,        setZzz]        = useState(false);
  const [question,   setQuestion]   = useState<string | null>(null);
  const [evening,    setEvening]    = useState(isEveningNow);

  /* canvas strip (flood-fill) */
  useEffect(() => {
    if (isVideo) { setSrc(rawSrc); return; }
    setSrc(null);
    stripWhiteBackground(rawSrc).then(setSrc);
  }, [isVideo, rawSrc]);

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
  const turnTimer  = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const posXRef    = useRef(14);
  const cwRef      = useRef(320);
  const animRef    = useRef<AnimState>("idle");
  const rootRef    = useRef<HTMLDivElement>(null);

  /* keep animRef in sync */
  useEffect(() => { animRef.current = anim; }, [anim]);

  /* ── 2D turn animation on flip change ───────────────────────────── */
  const prevFlipped = useRef(false);
  useEffect(() => {
    if (prevFlipped.current === flipped) return;
    const goingLeft = flipped;           // true = now facing left
    prevFlipped.current = flipped;
    clearTimeout(turnTimer.current);
    setTurnAnim(goingLeft ? "cm-turn-left" : "cm-turn-right");
    turnTimer.current = setTimeout(() => setTurnAnim(null), 340);
  }, [flipped]);

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
    /* test mode → fall asleep in 3 s */
    const delay = TEST_EVENING ? 3_000 : isEveningNow() ? SLEEP_EVE : SLEEP_AFTER;
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
      scheduleQuestion();
    }, delay);
  }, []);

  /* ── walk scheduler ──────────────────────────────────────────────── */
  const scheduleWalk = useCallback(() => {
    clearTimeout(walkTimer.current);
    const delay = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
    walkTimer.current = setTimeout(() => {
      if (isEveningNow()) { scheduleWalk(); return; }
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
      setQuestion(null);
      setAnim("happy");
      resetSleep();
      animTimer.current = setTimeout(() => setAnim("idle"), HAPPY_DUR);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessageSent]);

  /* ── tap ─────────────────────────────────────────────────────────── */
  const ANGRY_DUR = 0.38 * 5 * 1000; // 5 iter × 380 ms

  const startWalkNow = () => {
    clearTimeout(walkTimer.current);
    clearTimeout(animTimer.current);
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
    animTimer.current = setTimeout(() => {
      setAnim("idle");
      setFlipped(false);
      scheduleWalk();
    }, walkMs);
  };

  const handleTap = () => {
    setQuestion(null);
    if (anim === "sleep") {
      /* Uykudan uyandırıldı → sinirli titreme, ardından hemen yürümeye başla */
      setZzz(false);
      clearTimeout(sleepTimer.current);
      clearTimeout(animTimer.current);
      setAnim("angry");
      animTimer.current = setTimeout(() => {
        startWalkNow();
      }, ANGRY_DUR);
      return;
    }
    resetSleep();
    if (anim !== "walk-right" && anim !== "walk-left") {
      clearTimeout(animTimer.current);
      setAnim("wave");
      animTimer.current = setTimeout(() => setAnim("idle"), WAVE_DUR);
    }
    setShowBubble(v => !v);
  };

  const submitName = () => { if (draft.trim()) onRename(draft.trim()); setRenaming(false); };

  const isWalking  = anim === "walk-right" || anim === "walk-left";
  const isSleeping = anim === "sleep";
  const cfg = ANIM_CFG[anim];

  /* dim + blue tint when sleeping at night */
  const nightFilter = evening && isSleeping
    ? "drop-shadow(0 4px 12px rgba(80,60,160,0.4)) brightness(.75) saturate(.7)"
    : "drop-shadow(0 4px 10px rgba(0,0,0,0.22))";

  return (
    <>
      <style>{KF}</style>

      <div
        ref={rootRef}
        className="absolute z-20 pointer-events-none select-none"
        style={{
          bottom: "calc(4.25rem + env(safe-area-inset-bottom))",
          left:   posX,
          /* smooth 2-D positional slide */
          transition: isWalking ? "left 3.6s linear" : "left 0.5s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* ── question bubble ─────────────────────────────────────── */}
        {question && !showBubble && !renaming && (
          <div
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-3 pt-2.5 pb-2 flex flex-col items-center gap-0.5"
            style={{
              bottom:        BEAR_W + 18,
              animation:     `cq-pop ${Q_SHOW}ms ease forwards`,
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

        {/* ── figure: flip wrapper (2-D cartoon turn) ──────────────── */}
        {/*   Outer div  → scaleX flip via turn keyframe              */}
        {/*   Inner div  → bob/walk/wave animations                   */}
        {/*   zzz + moon live OUTSIDE the flip so they never mirror   */}
        <div style={{ position:"relative", width:BEAR_W, height:BEAR_W }}>

          {/* zzz bubbles — always top-right, never flipped */}
          {zzz && [0,1].map(i => (
            <span key={i} style={{
              position:"absolute", top:-4-i*13, right:-4-i*7,
              fontSize:10+i*4, fontWeight:900, color:"#a78bfa",
              animation:`cz-zzz 2.2s ease-in-out ${i*.9}s infinite`,
              opacity:0, zIndex:10, pointerEvents:"none",
            }}>z</span>
          ))}

          {/* moon badge — always top-left, never flipped */}
          {evening && isSleeping && (
            <div style={{
              position:"absolute", top:-8, left:-8, zIndex:12,
              background:"rgba(30,18,60,0.92)", borderRadius:"50%",
              width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
              border:"1px solid rgba(139,92,246,0.55)",
              boxShadow:"0 0 8px rgba(139,92,246,0.5)",
              pointerEvents:"none",
            }}>
              <Moon style={{ width:11, height:11, color:"#c4b5fd" }} />
            </div>
          )}

          {/* flip wrapper: only handles scaleX direction via turn keyframe */}
          <div style={{
            width:"100%", height:"100%",
            /* when turning: run keyframe; otherwise hold final scaleX */
            animation: turnAnim
              ? `${turnAnim} 0.32s ease-in-out forwards`
              : undefined,
            transform: turnAnim ? undefined : `scaleX(${flipped ? -1 : 1})`,
            transformOrigin: "50% 100%",
          }}>
            {/* anim wrapper: walk/idle/wave/peek/happy/sleep */}
            <div
              onClick={handleTap}
              className="pointer-events-auto"
              style={{
                width:"100%", height:"100%",
                cursor:"pointer",
                animation:`${cfg.name} ${cfg.dur} ${cfg.easing} ${cfg.iter}`,
                willChange:"transform",
                transformOrigin:"50% 100%",
              }}
            >
              {src && (isVideo ? (
                <CompanionVideo src={src} filter={nightFilter} />
              ) : (
                <img src={src} alt={name || "Yoldaş"} style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", userSelect:"none", WebkitUserSelect:"none", pointerEvents:"none", filter: nightFilter, transition:"filter 2s ease" }} draggable={false} />
              ))}
            </div>
          </div>
        </div>

        {/* ── test mode badge ───────────────────────────────────────── */}
        {TEST_EVENING && (
          <div style={{
            position:"absolute", bottom:-18, left:"50%", transform:"translateX(-50%)",
            fontSize:9, fontWeight:700, color:"#f59e0b", opacity:.7,
            letterSpacing:".04em", whiteSpace:"nowrap",
          }}>
            🌙 TEST
          </div>
        )}
      </div>
    </>
  );
}
