import { useEffect, useRef, useState, useCallback } from "react";
import { Heart, MessageCircle, Bookmark, Share2, Volume2, VolumeX, Play, ChevronUp, ChevronDown, Music2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";

/* ── Sahte loop verisi ─────────────────────────────────────────────── */
const LOOPS = [
  {
    id: 1,
    user: { name: "İrem Uslu", username: "irem_uslu", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" },
    caption: "Baharın ilk günü, kahve ve yeni bir sayfa açmak… ✨ #yazarlık #döngü",
    audio: "Orijinal ses – İrem Uslu",
    likes: 4821,
    comments: 312,
    saves: 198,
    liked: false,
    saved: false,
    bg: "from-rose-950 via-fuchsia-950 to-slate-950",
    gradient: "linear-gradient(160deg,#1a0033 0%,#3b0764 50%,#0f172a 100%)",
    videoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1490750967868-88df5691cc19?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    user: { name: "Erhan Yılmaz", username: "erhan_y", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80" },
    caption: "Bir hikaye nasıl başlar? Belki böyle. Belki bir bakışla. 📖",
    audio: "Lofi Chill Beat",
    likes: 2190,
    comments: 87,
    saves: 431,
    liked: false,
    saved: false,
    gradient: "linear-gradient(160deg,#021724 0%,#0c2a3a 50%,#0f172a 100%)",
    videoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    user: { name: "Aslı Çetin", username: "asli.cetin", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80" },
    caption: "İstanbul sokaklarında kaybolmak en güzel şiir… 🌙 #istanbul #sokak",
    audio: "Akustik Gitar – Özgür",
    likes: 9034,
    comments: 612,
    saves: 870,
    liked: false,
    saved: false,
    gradient: "linear-gradient(160deg,#0d1a2a 0%,#1e3a2f 50%,#0a1628 100%)",
    videoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 4,
    user: { name: "Kaan Demir", username: "kaan_dm", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80" },
    caption: "Sözlerin gücü hiçbir zaman bitmez. Devam et. Yaz. 🖊️",
    audio: "Ambient Piano",
    likes: 3340,
    comments: 201,
    saves: 555,
    liked: false,
    saved: false,
    gradient: "linear-gradient(160deg,#1a0f00 0%,#3d1a00 50%,#0f0a00 100%)",
    videoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 5,
    user: { name: "Lale Yıldız", username: "lale_y", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80" },
    caption: "Bazen en iyi hikayeler sessizlikte yazılır 🌿 #doğa #yazı",
    audio: "Orman Sesleri",
    likes: 6122,
    comments: 489,
    saves: 720,
    liked: false,
    saved: false,
    gradient: "linear-gradient(160deg,#021a0a 0%,#0a2e14 50%,#04120a 100%)",
    videoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80",
  },
];

function fmtNum(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "B";
  return String(n);
}

/* ── Tek loop kartı ─────────────────────────────────────────────────── */
function LoopCard({
  loop,
  active,
  muted,
  onToggleMute,
}: {
  loop: typeof LOOPS[0];
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const [liked,   setLiked]   = useState(loop.liked);
  const [saved,   setSaved]   = useState(loop.saved);
  const [likes,   setLikes]   = useState(loop.likes);
  const [paused,  setPaused]  = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const togglePause = () => {
    setPaused(v => !v);
    setShowPlay(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowPlay(false), 900);
  };

  return (
    <div className="relative w-full h-full flex-none snap-start overflow-hidden select-none">
      {/* Arka plan / kapak */}
      <div className="absolute inset-0" style={{ background: loop.gradient }}>
        <img
          src={loop.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-55"
          draggable={false}
        />
        {/* vignette */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.35) 100%)" }} />
      </div>

      {/* Dokunma ile duraklat */}
      <button
        type="button"
        aria-label="Duraklat / devam et"
        className="absolute inset-0 z-10 w-full h-full"
        onClick={togglePause}
      />

      {/* Duraklat ikonu overlay */}
      {showPlay && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          style={{ animation: "loop-pop 0.4s ease forwards" }}
        >
          <div className="rounded-full bg-black/40 p-5 backdrop-blur-sm">
            {paused
              ? <Play  className="h-10 w-10 text-white fill-white" />
              : <Play  className="h-10 w-10 text-white" />
            }
          </div>
        </div>
      )}

      {/* Ses kapat / aç — sağ üst */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        className="absolute top-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm text-white"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Progress bar — üst */}
      <div className="absolute top-0 inset-x-0 z-30 h-0.5 bg-white/15">
        {active && !paused && (
          <div
            className="h-full bg-white/70 rounded-full"
            style={{ animation: "loop-progress 12s linear forwards", animationPlayState: paused ? "paused" : "running" }}
          />
        )}
      </div>

      {/* Sağ eylem butonu sütunu */}
      <div className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-5">
        {/* Avatar */}
        <div className="relative mb-1">
          <img src={loop.user.avatar} alt={loop.user.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-white/80 shadow-lg" />
          <button
            type="button"
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 ring-2 ring-black text-white text-[10px] font-black leading-none shadow"
          >+</button>
        </div>

        {/* Beğen */}
        <button type="button" onClick={(e) => { e.stopPropagation(); setLiked(v => !v); setLikes(n => liked ? n - 1 : n + 1); }} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 transition-all ${liked ? "fill-rose-500 text-rose-500 scale-110" : "text-white"}`} strokeWidth={liked ? 0 : 2} />
          <span className="text-[11px] font-bold text-white/90 tabular-nums">{fmtNum(likes)}</span>
        </button>

        {/* Yorum */}
        <button type="button" onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-[11px] font-bold text-white/90">{fmtNum(loop.comments)}</span>
        </button>

        {/* Kaydet */}
        <button type="button" onClick={(e) => { e.stopPropagation(); setSaved(v => !v); }} className="flex flex-col items-center gap-1">
          <Bookmark className={`h-7 w-7 transition-all ${saved ? "fill-amber-400 text-amber-400 scale-110" : "text-white"}`} strokeWidth={saved ? 0 : 2} />
          <span className="text-[11px] font-bold text-white/90">{fmtNum(loop.saves)}</span>
        </button>

        {/* Paylaş */}
        <button type="button" onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-white" />
          <span className="text-[11px] font-bold text-white/90">Paylaş</span>
        </button>
      </div>

      {/* Alt bilgi */}
      <div className="absolute bottom-20 left-4 right-20 z-30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-black text-white">@{loop.user.username}</span>
        </div>
        <p className="text-[13px] leading-snug text-white/90 line-clamp-2">{loop.caption}</p>
        {/* Müzik bilgisi */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
            <Music2 className="h-3 w-3 text-white" />
          </div>
          <span className="text-[11px] text-white/75 truncate max-w-[180px]">{loop.audio}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sayfa ─────────────────────────────────────────────────────────── */
export default function Loops() {
  const [activeIdx, setActiveIdx]   = useState(0);
  const [muted,     setMuted]       = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* IntersectionObserver ile aktif kart takibi */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(container.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = cards.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIdx(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  /* Yukarı/aşağı ok butonları */
  const scrollTo = useCallback((dir: 1 | -1) => {
    const container = containerRef.current;
    if (!container) return;
    const h = container.clientHeight;
    container.scrollBy({ top: dir * h, behavior: "smooth" });
  }, []);

  return (
    <AppLayout hideBottomNav={false}>
      {/* Keyframe styles */}
      <style>{`
        @keyframes loop-progress { from { width: 0% } to { width: 100% } }
        @keyframes loop-pop { 0% { opacity: 0; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1); } }
      `}</style>

      {/* Başlık — şeffaf üst bar */}
      <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 pt-safe-top pb-2 pointer-events-none md:hidden"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
        <span className="text-[15px] font-black text-white tracking-tight pointer-events-none">Loops</span>
        <div className="flex gap-2 pointer-events-auto">
          <button type="button" className="text-[13px] font-semibold text-white/80 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">Seni İzlediklerim</button>
          <button type="button" className="text-[13px] font-semibold text-white px-3 py-1 rounded-full bg-violet-600/80 backdrop-blur-sm">Keşfet</button>
        </div>
      </div>

      {/* Dikey snap scroll */}
      <div
        ref={containerRef}
        className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory md:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {LOOPS.map((loop, i) => (
          <div key={loop.id} className="w-full snap-start" style={{ height: "100dvh" }}>
            <LoopCard
              loop={loop}
              active={i === activeIdx}
              muted={muted}
              onToggleMute={() => setMuted(v => !v)}
            />
          </div>
        ))}
      </div>

      {/* Yukarı / Aşağı ok butonları — sağ orta */}
      <div className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 md:hidden pointer-events-none opacity-0">
        <button type="button" onClick={() => scrollTo(-1)} className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => scrollTo(1)} className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop fallback */}
      <div className="hidden md:flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Clapperboard className="h-16 w-16 opacity-30" />
        <p className="text-lg font-semibold">Loops mobilde görüntülenir</p>
      </div>
    </AppLayout>
  );
}

function Clapperboard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/>
      <path d="m6.2 5.3 3.1 3.9"/>
      <path d="m12.4 3.4 3.1 3.9"/>
      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
    </svg>
  );
}
