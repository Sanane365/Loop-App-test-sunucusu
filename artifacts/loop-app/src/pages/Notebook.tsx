/**
 * Notebook — Loop Kitaplık Stüdyosu
 *
 * Adım 1: Kitaplar sekmesi
 *   • Hero kart (istatistik, yeni kitap, rapor)
 *   • Loop Seçkisi — Öne Çıkan Hikayeler
 *   • Özel bottom nav (BottomNav otomatik değişir)
 */

import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen, X, ChevronUp, ChevronDown, ArrowRight,
  MoreVertical, Pencil, Heart, Star, Trophy, Flame, Sparkles, Compass,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

/* ── Mock veri — gerçek API bağlandığında değişecek ─────────────────── */
const FEATURED = [
  {
    id:      1,
    title:   "BİR ADININ BEDELİ",
    author:  "Eylül Çetiner",
    desc:    "Eylül Çetiner kanser olduğunu öğrendiği gün ilk aşkı ile karşılaşır. Çağan Demirsoy kim...",
    genre:   "#25 içinde Romantizm",
    coverBg: "linear-gradient(160deg,#78350f,#d97706)",
    badgeBg: "#b45309",
    BadgeIcon: Trophy,
    reads:   "12.8K",
    likes:   161,
    rating:  5.0,
    coverImg: null as string | null,
  },
  {
    id:      2,
    title:   "GECE YARISI TRENI",
    author:  "Deniz Karaköse",
    desc:    "İstanbul'un karanlık sokaklarında kaybolan bir dedektif ve gizemli bir sır çözmeye çalışır...",
    genre:   "#8 içinde Gerilim",
    coverBg: "linear-gradient(160deg,#1e1b4b,#4f46e5)",
    badgeBg: "#4338ca",
    BadgeIcon: Flame,
    reads:   "8.3K",
    likes:   94,
    rating:  4.8,
    coverImg: null as string | null,
  },
  {
    id:      3,
    title:   "YAĞMUR VE SESSİZLİK",
    author:  "Selin Arslan",
    desc:    "Dağ evinde mahsur kalan iki yabancı, fırtınanın ardından birbirlerini keşfeder...",
    genre:   "#41 içinde Romantizm",
    coverBg: "linear-gradient(160deg,#0c4a6e,#0284c7)",
    badgeBg: "#0369a1",
    BadgeIcon: Sparkles,
    reads:   "5.1K",
    likes:   73,
    rating:  4.6,
    coverImg: null as string | null,
  },
  {
    id:      4,
    title:   "KARANLIK LABİRENT",
    author:  "Baran Yıldız",
    desc:    "Tarihi bir labirentin derinliklerinde gizlenmiş sır, yüzyıllardır kimse tarafından çözülemedi...",
    genre:   "#12 içinde Macera",
    coverBg: "linear-gradient(160deg,#1c1917,#44403c)",
    badgeBg: "#57534e",
    BadgeIcon: Compass,
    reads:   "3.7K",
    likes:   48,
    rating:  4.5,
    coverImg: null as string | null,
  },
];

/* ── İstatistikler özeti ─────────────────────────────────────────────── */
const STATS = [
  { label: "Kitap",       value: "0" },
  { label: "Okuyucu",     value: "0" },
  { label: "Toplam Görüntülenme", value: "0" },
];

/* ── Loop Seçkisi Carousel ───────────────────────────────────────────── */
function FeaturedCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / FEATURED.length;
    setActiveIdx(Math.round(el.scrollLeft / cardW));
  }, []);

  return (
    <div
      className="mx-4 rounded-3xl overflow-hidden"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Başlık */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400 mb-1">
            Loop Seçkisi
          </p>
          <h2 className="text-[22px] font-black text-white leading-tight">
            Öne Çıkan Hikayeler
          </h2>
        </div>
        <button
          className="flex items-center gap-2 rounded-full font-bold text-sm text-white px-4 py-2 mt-1 whitespace-nowrap flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          Tümünü Gör <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Kaydırılabilir kart alanı */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto gap-0 px-4 pb-4"
        style={{
          scrollSnapType:       "x mandatory",
          scrollBehavior:       "smooth",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth:       "none",
          msOverflowStyle:      "none",
        }}
      >
        {FEATURED.map((book, idx) => {
          const { BadgeIcon } = book;
          return (
          <div
            key={book.id}
            className="flex-none mr-3 last:mr-0"
            style={{
              width:           "calc(100% - 24px)",
              scrollSnapAlign: "start",
              height:          310,
            }}
          >
            {/* Kart: sol = kapak, sağ = bilgi */}
            <div className="flex h-full rounded-2xl overflow-hidden" style={{
              border:     `1.5px solid ${idx === activeIdx ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.08)"}`,
              transition: "border-color 0.3s",
            }}>

              {/* Kapak */}
              <div className="relative flex-none" style={{ width: "40%", background: book.coverBg }}>
                {book.coverImg
                  ? <img src={book.coverImg} alt={book.title} className="w-full h-full object-cover" />
                  : null}
                {/* Rozet — lucide ikon */}
                <div
                  className="absolute top-3 left-3 w-11 h-11 rounded-full flex items-center justify-center shadow-xl"
                  style={{ background: book.badgeBg, boxShadow: `0 4px 16px ${book.badgeBg}88` }}
                >
                  <BadgeIcon className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
              </div>

              {/* Sağ bilgi paneli */}
              <div
                className="flex-1 flex flex-col px-4 pt-4 pb-4 min-w-0"
                style={{ background: "#0f0f0f", borderLeft: "1.5px solid rgba(251,191,36,0.45)" }}
              >
                {/* Başlık + menü */}
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-[15px] font-black text-white leading-snug flex-1">{book.title}</p>
                  <button className="text-white/35 hover:text-white/70 flex-shrink-0 mt-0.5">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Açıklama */}
                <p className="text-[12px] text-white/55 leading-relaxed line-clamp-3 mb-3 flex-1">
                  {book.desc}
                </p>

                {/* Tür etiketi */}
                <div className="mb-3">
                  <span
                    className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                    style={{
                      border:     "1.5px solid #fbbf24",
                      color:      "#fbbf24",
                      background: "rgba(251,191,36,0.1)",
                    }}
                  >
                    {book.genre}
                  </span>
                </div>

                {/* Okuma sayısı */}
                <div
                  className="flex items-center px-3 py-2 rounded-full mb-2.5"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <span className="text-sm font-black text-white mr-1.5">{book.reads}</span>
                  <span className="text-[13px] text-white/40 font-medium">okuma</span>
                </div>

                {/* Beğeni + Puan */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full flex-1 justify-center"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                    <span className="text-[13px] font-bold text-white">{book.likes}</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full flex-1 justify-center"
                    style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)" }}
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-[13px] font-bold text-white">{book.rating.toFixed(1)}</span>
                    <span className="text-[11px] text-white/40">/ 5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Sayfa noktaları */}
      <div className="flex items-center justify-center gap-2 pb-5">
        {FEATURED.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              const cardW = el.scrollWidth / FEATURED.length;
              el.scrollTo({ left: cardW * i, behavior: "smooth" });
            }}
            style={{
              width:        i === activeIdx ? 28 : 10,
              height:       10,
              borderRadius: 99,
              background:   i === activeIdx ? "#d4a320" : "rgba(255,255,255,0.2)",
              border:       "none",
              cursor:       "pointer",
              transition:   "all 0.3s ease",
              padding:      0,
              flexShrink:   0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Sekme içerikleri ─────────────────────────────────────────────── */
function KitaplarTab() {
  const [statsOpen, setStatsOpen]   = useState(false);
  const [heroOpen,  setHeroOpen]    = useState(true);

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* ── Hero kart ─────────────────────────────────────────────── */}
      {heroOpen && (
        <div
          className="mx-4 mt-4 rounded-3xl overflow-hidden relative"
          style={{
            background: "linear-gradient(145deg,#1e1245 0%,#0f172a 60%,#1a1040 100%)",
            border:     "1px solid rgba(139,92,246,0.25)",
          }}
        >
          {/* Parlak arka efekt */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 30% 0%,rgba(139,92,246,0.18) 0%,transparent 60%)" }} />

          <div className="relative p-5">
            {/* Üst etiket + kapat */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
                <BookOpen className="w-3.5 h-3.5 text-white/70" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Loop Kitaplık Stüdyosu
                </span>
              </div>
              <button
                onClick={() => setHeroOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Başlık */}
            <h1 className="text-[26px] font-black text-white leading-tight mb-4">
              İstatistiklerini Loop<br />diye gör
            </h1>

            {/* İstatistikler toggle */}
            <button
              onClick={() => setStatsOpen(v => !v)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 mb-3 transition-colors"
            >
              <span className="text-sm font-bold text-white">İstatistikler</span>
              {statsOpen
                ? <ChevronUp className="w-4 h-4 text-white" />
                : <ChevronDown className="w-4 h-4 text-white" />}
            </button>

            {statsOpen && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {STATS.map(s => (
                  <div key={s.label} className="bg-white/8 rounded-2xl p-3 text-center">
                    <p className="text-xl font-black text-white">{s.value}</p>
                    <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Açıklama */}
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Kitap yazma ve okuma deneyimini tek bir profesyonel panelde birleştirin.
            </p>

            {/* Eylem butonları */}
            <div className="flex flex-wrap gap-3 mb-3">
              <Link
                href="/notebook/yeni"
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors"
              >
                Yeni kitap başlat <ArrowRight className="w-4 h-4" />
              </Link>
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors">
                Rapor <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/80 font-bold text-sm px-4 py-2 rounded-full transition-colors">
              Daha fazla <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Loop Seçkisi: Öne Çıkan Hikayeler carousel ─────────────── */}
      <FeaturedCarousel />

      {/* ── Yeni bölüm placeholder ───────────────────────────────── */}
      <div
        className="mx-4 rounded-3xl px-5 py-6"
        style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 mb-1">
          Kitaplarım
        </p>
        <h2 className="text-xl font-black text-white mb-3">Henüz kitap yok</h2>
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          İlk kitabını oluştur ve okuyucularınla buluş.
        </p>
        <Link
          href="/notebook/yeni"
          className="inline-flex items-center gap-2 bg-primary text-white font-bold text-sm px-5 py-2.5 rounded-full"
        >
          Yeni kitap başlat <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-white/30 px-8 text-center">
      <BookOpen className="w-12 h-12 opacity-30" />
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm">Yakında geliyor…</p>
    </div>
  );
}

/* ── Ana sayfa bileşeni ─────────────────────────────────────────────── */
export default function Notebook() {
  const [location] = useLocation();

  // Aktif sekmeye göre içerik
  const renderContent = () => {
    if (location === "/notebook" || location === "/notebook/kitaplar") return <KitaplarTab />;
    if (location.startsWith("/notebook/kategoriler")) return <PlaceholderTab title="Kategoriler" />;
    if (location.startsWith("/notebook/akis"))        return <PlaceholderTab title="Akış" />;
    if (location.startsWith("/notebook/kitaplik"))    return <PlaceholderTab title="Kitaplık" />;
    if (location.startsWith("/notebook/etkinlikler")) return <PlaceholderTab title="Etkinlikler" />;
    return <KitaplarTab />;
  };

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: "linear-gradient(180deg,#0d0720 0%,#111827 40%,#0f172a 100%)" }}
    >
      {/* Standart Loop header — kitaplık logosuna dönüşüyor */}
      <Header />

      {/* Kaydırılabilir içerik */}
      <div className="max-w-screen-md mx-auto">
        {renderContent()}
      </div>

      {/* Floating kalem butonu */}
      <button
        className="fixed bottom-20 left-4 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <Pencil className="w-5 h-5 text-white/80" />
      </button>

      {/* Kitaplık özel bottom nav (BottomNav bileşeni otomatik değişir) */}
      <BottomNav />
    </div>
  );
}
