/**
 * Notebook — Loop Kitaplık Stüdyosu
 *
 * Adım 1: Kitaplar sekmesi
 *   • Hero kart (istatistik, yeni kitap, rapor)
 *   • Loop Seçkisi — Öne Çıkan Hikayeler
 *   • Özel bottom nav (BottomNav otomatik değişir)
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen, X, ChevronUp, ChevronDown, ArrowRight,
  Tag, Activity, BookMarked, CalendarDays, MoreVertical, Pencil,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

/* ── Mock veri — gerçek API bağlandığında değişecek ─────────────────── */
const FEATURED = [
  {
    id:     1,
    title:  "BİR ADININ BEDELİ",
    author: "Eylül Çetiner",
    desc:   "Eylül Çetiner kanser olduğunu öğrendiği gün ilk aşkı ile karşılaşır. Çağan Demirsoy kim...",
    genre:  "#25 içinde Romantizm",
    color:  "#f59e0b",
    rank:   "👑",
    reads:  "12",
  },
  {
    id:     2,
    title:  "GECE YARISI TRENI",
    author: "Deniz Karaköse",
    desc:   "İstanbul'un karanlık sokaklarında kaybolan bir dedektif ve gizemli bir sır...",
    genre:  "#8 içinde Gerilim",
    color:  "#6366f1",
    rank:   "🔥",
    reads:  "8",
  },
];

/* ── İstatistikler özeti ─────────────────────────────────────────────── */
const STATS = [
  { label: "Kitap",       value: "0" },
  { label: "Okuyucu",     value: "0" },
  { label: "Toplam Görüntülenme", value: "0" },
];

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

      {/* ── Loop Seçkisi: Öne Çıkan Hikayeler ────────────────────── */}
      <div
        className="mx-4 rounded-3xl overflow-hidden"
        style={{
          background: "#0f0f0f",
          border:     "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Başlık satırı */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-1">
              Loop Seçkisi
            </p>
            <h2 className="text-xl font-black text-white leading-tight">
              Öne Çıkan Hikayeler
            </h2>
          </div>
          <button className="flex items-center gap-1 text-sm font-bold text-white/60 hover:text-white transition-colors mt-1">
            Tümünü Gör <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Kitap kartları */}
        <div className="px-4 pb-5 flex flex-col gap-3">
          {FEATURED.map(book => (
            <div
              key={book.id}
              className="flex gap-3 rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Kapak */}
              <div
                className="w-20 h-24 flex-shrink-0 flex items-center justify-center text-2xl rounded-l-2xl"
                style={{ background: book.color }}
              >
                {book.rank}
              </div>

              {/* Bilgi */}
              <div className="flex-1 py-3 pr-2 min-w-0">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-black text-white leading-tight pr-2">{book.title}</p>
                  <button className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed line-clamp-2">{book.desc}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}
                  >
                    {book.genre}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
