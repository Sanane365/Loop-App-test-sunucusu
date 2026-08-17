import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, BookOpen, Hash, Clock, ChevronDown, ChevronUp,
  List, Play, Bookmark, Heart, Share2, ChevronRight,
} from "lucide-react";
import { getDraft, type Draft, type DraftChapter } from "@/lib/draftStore";

const THEMES: Record<string, { bg: string; text: string; page: string }> = {
  dark:   { bg: "#0a0814", text: "#e2e8f0", page: "#120e20" },
  light:  { bg: "#f8f7f4", text: "#1a1a2e", page: "#ffffff" },
  sepia:  { bg: "#2d1f0a", text: "#f5e6cc", page: "#1e1508" },
  forest: { bg: "#0a1a0f", text: "#d4ead9", page: "#0d2013" },
};
const FONT_FAMILIES: Record<string, string> = {
  serif:   "Georgia, serif",
  sans:    "system-ui, sans-serif",
  mono:    "'Courier New', monospace",
  elegant: "'Palatino Linotype', serif",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

/* ── Bölüm listesi görünümü ─────────────────────────────────────────── */
function ChapterList({
  chapters,
  onSelect,
}: {
  chapters: DraftChapter[];
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-4">
        {chapters.length} Bölüm
      </p>
      <div className="space-y-2">
        {chapters.map((ch, i) => {
          const wordCount = ch.blocks
            .filter(b => b.type === "text")
            .reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelect(i)}
              className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {/* Numara */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-[13px]"
                style={{ background: "rgba(109,40,217,0.18)", color: "#a78bfa" }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-bold text-white">{ch.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{wordCount} kelime</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Okuma görünümü ──────────────────────────────────────────────────── */
function Reader({
  book,
  chapterIdx,
  onBack,
  onNextChapter,
  onPrevChapter,
}: {
  book: Draft;
  chapterIdx: number;
  onBack: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
}) {
  const theme = THEMES[book.themeId] ?? THEMES.dark;
  const fontFamily = FONT_FAMILIES[book.fontId] ?? FONT_FAMILIES.sans;
  const fontSize = book.fontSize ?? 16;
  const chapter = book.chapters[chapterIdx];

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: theme.bg }}>
      {/* Reader header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: theme.bg }}>
        <button type="button" onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.07)", color: theme.text }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="truncate text-[12px] font-bold" style={{ color: theme.text }}>
            {chapter.title}
          </p>
          <p className="text-[10px]" style={{ color: `${theme.text}60` }}>
            {chapterIdx + 1} / {book.chapters.length}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-6">
        {chapter.blocks.map(block => {
          if (block.type === "text") {
            return (
              <p key={block.id}
                className="mb-5 leading-loose"
                style={{ fontFamily, fontSize, color: theme.text, lineHeight: 1.85 }}
              >
                {block.content || <span style={{ color: `${theme.text}30` }}>(boş paragraf)</span>}
              </p>
            );
          }
          if (block.type === "image" && block.content) {
            return (
              <div key={block.id} className="mb-5 rounded-2xl overflow-hidden">
                <img src={block.content} alt="" className="w-full object-cover" />
              </div>
            );
          }
          if (block.type === "video" && block.content) {
            return (
              <div key={block.id} className="mb-5 rounded-2xl overflow-hidden">
                <video src={block.content} controls className="w-full" />
              </div>
            );
          }
          if (block.type === "poll") {
            return (
              <div key={block.id}
                className="mb-5 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
                <p className="text-[13px] font-bold text-violet-200 mb-3">
                  📊 {block.pollQuestion || "Anket"}
                </p>
                <div className="space-y-2">
                  {(block.pollOptions ?? []).map(opt => (
                    <div key={opt.id}
                      className="rounded-xl bg-white/8 px-3 py-2.5 text-[12px] text-violet-200">
                      {opt.text || "—"}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Alt nav — bölümler arası */}
      <div className="fixed bottom-0 inset-x-0 border-t px-4 pb-8 pt-3"
        style={{ background: theme.bg, borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPrevChapter}
            disabled={chapterIdx === 0}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold border transition-all disabled:opacity-25"
            style={{ borderColor: "rgba(167,139,250,0.4)", color: "#a78bfa" }}
          >
            ← Önceki
          </button>
          <button
            type="button"
            onClick={onNextChapter}
            disabled={chapterIdx === book.chapters.length - 1}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold transition-all disabled:opacity-25"
            style={{ background: "rgba(109,40,217,0.7)", color: "#fff" }}
          >
            Sonraki →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Ana bileşen ─────────────────────────────────────────────────────── */
export default function KitapDetay() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [book, setBook] = useState<Draft | null>(null);
  const [view, setView] = useState<"detail" | "chapters" | "read">("detail");
  const [activeChap, setActiveChap] = useState(0);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (id) {
      const d = getDraft(id);
      if (d) setBook(d);
    }
  }, [id]);

  if (!book) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#07050f" }}>
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-violet-400/40 mx-auto mb-3" />
          <p className="text-white font-bold">Kitap bulunamadı</p>
          <button onClick={() => setLocation("/kitaplar")}
            className="mt-4 rounded-xl bg-violet-500/20 px-4 py-2 text-violet-300 text-[13px] font-bold">
            Kitaplara Dön
          </button>
        </div>
      </div>
    );
  }

  const theme = THEMES[book.themeId] ?? THEMES.dark;
  const wordCount = book.wordCount;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  /* Okuma görünümü */
  if (view === "read") {
    return (
      <Reader
        book={book}
        chapterIdx={activeChap}
        onBack={() => setView("chapters")}
        onNextChapter={() => setActiveChap(p => Math.min(p + 1, book.chapters.length - 1))}
        onPrevChapter={() => setActiveChap(p => Math.max(p - 1, 0))}
      />
    );
  }

  /* Bölüm listesi görünümü */
  if (view === "chapters") {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: "#07050f" }}>
        <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 border-b border-white/8">
          <button type="button" onClick={() => setView("detail")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-violet-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="flex-1 text-center text-[15px] font-black text-white">Bölümler</p>
          <div className="w-9" />
        </div>
        <ChapterList
          chapters={book.chapters}
          onSelect={i => { setActiveChap(i); setView("read"); }}
        />
      </div>
    );
  }

  /* Detay görünümü (varsayılan) */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>
      {/* Hero kapak */}
      <div className="relative shrink-0" style={{ height: 300 }}>
        {/* Bulanık arka plan */}
        {book.cover && (
          <img src={book.cover} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(20px) brightness(0.35)", transform: "scale(1.1)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-[#07050f]" />

        {/* Geri */}
        <button type="button" onClick={() => setLocation("/kitaplar")}
          className="absolute top-12 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Aksiyonlar */}
        <div className="absolute top-12 right-4 flex gap-2">
          <button type="button" onClick={() => setBookmarked(v => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${bookmarked ? "bg-amber-500/30 text-amber-400" : "bg-black/40 text-white"}`}>
            <Bookmark className={`h-4.5 w-4.5 ${bookmarked ? "fill-amber-400" : ""}`} />
          </button>
          <button type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Kapak + başlık */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-4 items-end">
          <div className="shrink-0 overflow-hidden rounded-2xl shadow-2xl border border-white/15"
            style={{ width: 88, height: 130, background: "rgba(109,40,217,0.3)" }}>
            {book.cover
              ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-8 w-8 text-violet-400/50" /></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[20px] font-black text-white leading-tight">{book.title || "Başlıksız"}</p>
            {book.subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{book.subtitle}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {book.genres?.map(g => (
                <span key={g} className="rounded-full bg-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-300">{g}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-3">
        {/* Meta çubuk */}
        <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-5 border-b border-white/8 pb-4">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />{book.chapters?.length ?? 0} bölüm
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />{wordCount.toLocaleString("tr")} kelime
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />~{readMinutes} dk
          </span>
          <span className="ml-auto text-[10px]">
            {book.ageRating === "all" ? "Genel" : book.ageRating}
          </span>
        </div>

        {/* Özet */}
        {book.synopsis && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Özet</p>
            <div
              className="text-[13px] leading-relaxed text-slate-300 overflow-hidden transition-all"
              style={{ maxHeight: synopsisOpen ? 9999 : 80 }}
            >
              {book.synopsis}
            </div>
            {book.synopsis.length > 180 && (
              <button type="button" onClick={() => setSynopsisOpen(v => !v)}
                className="mt-1 flex items-center gap-1 text-[11px] text-violet-400 font-semibold">
                {synopsisOpen ? <><ChevronUp className="h-3.5 w-3.5" />Kapat</> : <><ChevronDown className="h-3.5 w-3.5" />Devamını Oku</>}
              </button>
            )}
          </div>
        )}

        {/* İlk bölüme göz at */}
        {book.chapters.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Bölüm Önizlemesi</p>
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 overflow-hidden" style={{ maxHeight: 120 }}>
              {book.chapters[0].blocks
                .filter(b => b.type === "text" && b.content)
                .slice(0, 2)
                .map(b => (
                  <p key={b.id} className="text-[12px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{b.content}</p>
                ))
              }
              {book.chapters[0].blocks.filter(b => b.type === "text" && b.content).length === 0 && (
                <p className="text-[12px] text-slate-600">İçerik henüz eklenmemiş.</p>
              )}
            </div>
          </div>
        )}

        {/* Bölümler listesi (küçük önizleme) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70">Bölümler</p>
            <button type="button" onClick={() => setView("chapters")}
              className="text-[11px] text-violet-400 font-semibold flex items-center gap-1">
              Tümü <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {book.chapters.slice(0, 3).map((ch, i) => (
              <button key={ch.id} type="button"
                onClick={() => { setActiveChap(i); setView("read"); }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left">
                <span className="text-[11px] font-black text-violet-400/70 w-5">{i + 1}</span>
                <span className="flex-1 text-[12px] font-bold text-white truncate">{ch.title}</span>
                <Play className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              </button>
            ))}
            {book.chapters.length > 3 && (
              <button type="button" onClick={() => setView("chapters")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-2.5 text-[12px] text-slate-500">
                <List className="h-3.5 w-3.5" /> +{book.chapters.length - 3} bölüm daha
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CTA — sabit */}
      <div className="fixed bottom-0 inset-x-0 border-t border-white/8 px-4 pb-8 pt-3"
        style={{ background: "rgba(7,5,15,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="flex gap-3 items-center">
          <button type="button" onClick={() => setLiked(v => !v)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all ${liked ? "border-rose-400/60 bg-rose-500/15" : "border-white/10 bg-white/5"}`}>
            <Heart className={`h-5 w-5 ${liked ? "fill-rose-400 text-rose-400" : "text-slate-400"}`} />
          </button>
          <button
            type="button"
            onClick={() => { setActiveChap(0); setView("read"); }}
            className="flex-1 rounded-xl py-3.5 text-[14px] font-black text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
          >
            📖 Okumaya Başla
          </button>
        </div>
      </div>
    </div>
  );
}
