import { useState, useEffect, useRef } from "react";
import { useLocation, Link, useSearch } from "wouter";
import {
  ArrowLeft, BookOpen, Clock, Hash, Sparkles, X, Search, Crown, PenLine, ChevronLeft, ChevronRight, List,
  GitBranch, Vote, Volume2, VolumeX, Play, Pause,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BOOK_GENRES } from "@/data/genres";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";

/* ── Sabitler ──────────────────────────────────────────────────────────── */
const STORAGE_KEY = "loop_drafts_v1";

const GENRES = ["Tümü", ...BOOK_GENRES];

function normalizeMediaUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (url.startsWith("data:image/")) return url.replace(/\s+/g, "");
  return url;
}

/* ── Tipler ───────────────────────────────────────────────────────────── */
interface Book {
  id: string;
  authorId?: number;
  author?: { id: number; username: string; displayName: string; badgeAssetUrl?: string | null; emblemAssetUrl?: string | null; badgeLabel?: string | null } | null;
  type: string;
  status: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
    trailers?: (string | null)[];
  genres?: string[];
  synopsis?: string;
  chapters?: unknown[];
  chapterCount?: number;
  wordCount?: number;
  updatedAt: string;
  isPremiumAuthor?: boolean;
}

interface InteractiveStory {
  id: string;
  title: string;
  summary: string;
  eventTitle: string;
  eventText: string;
  options: Array<{ id: string; label: string }>;
  steps?: Array<{ id: string; title: string; text: string; options: Array<{ id: string; label: string; nextStepId?: string | null }> }>;
  votes?: Record<string, number>;
  cover?: string;
  status: "ongoing" | "completed";
  eventTag?: string;
  theme?: "night" | "ember" | "ocean" | "mint";
}

/* ── Yardımcılar ─────────────────────────────────────────────────────── */
function loadPublished(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: Book[] = JSON.parse(raw);
    return all
      .filter(d => d.status === "published")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function loadDraftCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const all: Book[] = JSON.parse(raw);
    return all.filter(d => d.status !== "published").length;
  } catch {
    return 0;
  }
}

/** Türkçe karakterleri de kapsayan küçük harf normalize */
function norm(s: string): string {
  return (s ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "az önce";
  if (s < 3600)  return `${Math.floor(s / 60)}dk`;
  if (s < 86400) return `${Math.floor(s / 3600)}sa`;
  return `${Math.floor(s / 86400)}g`;
}

function InteractiveSection({
  stories,
  choices,
  onChoose,
}: {
  stories: InteractiveStory[];
  choices: Record<string, string>;
  onChoose: (storyId: string, optionId: string) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <section className="mt-7 px-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
          <GitBranch className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[12px] font-black text-cyan-200">Keşfet · Seçimli hikâyeler</span>
        </div>
        <span className="text-[11px] text-slate-500">Karar ver, akışı değiştir</span>
      </div>
      <div className="space-y-3">
        {stories.map(story => <InteractiveCard key={story.id} story={story} initialChoice={choices[story.id]} onChoose={onChoose} />)}
      </div>
    </section>
  );
}

function InteractiveCard({ story, initialChoice, onChoose }: { story: InteractiveStory; initialChoice?: string; onChoose: (storyId: string, optionId: string) => void }) {
  const steps = story.steps?.length ? story.steps : [{ id: "step-1", title: story.eventTitle, text: story.eventText, options: story.options }];
  const [stepId, setStepId] = useState(steps[0].id);
  const [selected, setSelected] = useState(initialChoice ?? "");
  const [votes, setVotes] = useState<Record<string, number>>(story.votes ?? {});
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [readerOpen, setReaderOpen] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const step = steps.find(item => item.id === stepId) ?? steps[0];
  const stepIndex = Math.max(0, steps.findIndex(item => item.id === step.id));
  const goToStep = (targetId: string) => {
    if (!steps.some(item => item.id === targetId)) return;
    setStepId(targetId);
    setContentsOpen(false);
    readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = async (option: { id: string; label: string; nextStepId?: string | null }) => {
    if (voting || selected.startsWith(`${step.id}:`)) return;
    setVoting(true);
    setVoteError("");
    try {
      const response = await fetch(`/api/interactive-stories/${story.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: option.id, stepId: step.id }),
      });
      const data = await response.json().catch(() => null) as { votes?: Record<string, number>; error?: string } | null;
      if (!response.ok || !data?.votes) throw new Error(data?.error || "Seçimin kaydedilemedi. Lütfen tekrar dene.");
      setSelected(`${step.id}:${option.id}`);
      setVotes(data.votes);
      onChoose(story.id, option.id);
      if (option.nextStepId && steps.some(item => item.id === option.nextStepId)) setStepId(option.nextStepId);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : "Seçimin kaydedilemedi. Lütfen tekrar dene.");
    } finally {
      setVoting(false);
    }
  };
  const themeClass = { night: "from-slate-950 via-slate-900 to-violet-950", ember: "from-orange-950 via-slate-950 to-rose-950", ocean: "from-cyan-950 via-slate-950 to-blue-950", mint: "from-emerald-950 via-slate-950 to-teal-950" }[story.theme ?? "night"];
  return (
    <>
      <article className={`relative overflow-hidden rounded-2xl border border-cyan-200/15 bg-gradient-to-br ${themeClass} shadow-[0_16px_50px_rgba(8,47,73,0.2)]`}>
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl" />
        {story.cover && <img src={story.cover} alt={story.title} loading="lazy" decoding="async" className="h-40 w-full object-cover opacity-85" />}
        <div className="relative p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100"><Sparkles className="h-3 w-3" />Loop AI · seçimli kitap</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{story.status === "completed" ? "Tamamlandı" : "Devam ediyor"}</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">{story.title}</h3>
          {story.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{story.summary}</p>}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wider text-cyan-100/80">{steps.length} bölüm · Kitap formatında</p><p className="mt-1 truncate font-serif text-sm text-slate-100">Bölümleri oku, dilediğin yerden devam et</p></div>
            <button type="button" onClick={() => setReaderOpen(true)} className="shrink-0 rounded-xl border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-200/20">Kitabı oku</button>
          </div>
        </div>
      </article>

      {readerOpen && (
        <div ref={readerRef} role="dialog" aria-modal="true" aria-label={`${story.title} kitabı`} className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#090a11] text-white">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cyan-100/10 bg-[#090a11]/90 px-4 py-3 backdrop-blur-xl sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100"><BookOpen className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-black">{story.title}</p><p className="text-[10px] text-cyan-100/60">LOOP AI · Seçimlerinle şekillenen kitap</p></div>
            </div>
            <button type="button" onClick={() => setReaderOpen(false)} aria-label="Kitabı kapat" className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100"><Sparkles className="h-3 w-3" />AI ile şekillenen anlatı</span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500">{steps.length} YAYINLANMIŞ BÖLÜM · {story.status === "completed" ? "TAMAMLANDI" : "DEVAM EDİYOR"}</span>
            </div>
            {story.summary && <p className="mb-8 border-l-2 border-cyan-200/40 pl-4 font-serif text-base italic leading-7 text-slate-300">{story.summary}</p>}
            <section className="mb-6 overflow-hidden rounded-2xl border border-cyan-100/15 bg-white/[0.03]">
              <button type="button" aria-expanded={contentsOpen} onClick={() => setContentsOpen(open => !open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]">
                <span className="flex items-center gap-2 text-sm font-bold text-cyan-100"><List className="h-4 w-4" />İçindekiler <span className="text-xs font-medium text-slate-400">({steps.length} bölüm)</span></span>
                <span className="text-xs text-slate-400">{contentsOpen ? "Kapat" : "Bölümlere göz at"}</span>
              </button>
              {contentsOpen && <nav aria-label="Kitap bölümleri" className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">{steps.map((chapter, index) => <button key={chapter.id} type="button" aria-current={chapter.id === step.id ? "page" : undefined} onClick={() => goToStep(chapter.id)} className={`rounded-xl border px-3 py-2 text-left transition ${chapter.id === step.id ? "border-cyan-200/40 bg-cyan-200/10 text-cyan-50" : "border-white/10 bg-black/10 text-slate-300 hover:border-cyan-200/25 hover:bg-white/[0.04]"}`}><span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-100/60">Bölüm {String(index + 1).padStart(2, "0")}</span><span className="mt-1 block truncate text-sm font-semibold">{chapter.title}</span></button>)}</nav>}
            </section>
            {story.cover && <div className="mb-8 flex items-center gap-4 rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-3"><img src={story.cover} alt={`${story.title} kapağı`} className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-lg" /><div className="min-w-0"><p className="truncate font-serif text-lg font-bold text-white">{story.title}</p><p className="mt-1 text-xs text-slate-400">{steps.length} bölüm · Loop AI seçimli kitap</p></div></div>}
            <div className="mb-3 flex items-center justify-between gap-3">
              <button type="button" disabled={stepIndex === 0} onClick={() => goToStep(steps[stepIndex - 1].id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-4 w-4" />Önceki bölüm</button>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500">BÖLÜM {String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
              <button type="button" disabled={stepIndex === steps.length - 1} onClick={() => goToStep(steps[stepIndex + 1].id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">Sonraki bölüm<ChevronRight className="h-4 w-4" /></button>
            </div>
            <article className="relative overflow-hidden rounded-[1.5rem] border border-cyan-100/15 bg-[#f4eddf] text-[#29251f] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "linear-gradient(to right, transparent 0, transparent 4.5rem, rgba(101,80,54,.2) 4.5rem, rgba(101,80,54,.2) 4.56rem, transparent 4.56rem), repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(101,80,54,.07) 32px)" }} />
              <div className="relative px-6 py-8 sm:px-14 sm:py-12">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7558]">{story.title}</p>
                <h1 className="mt-4 text-center font-serif text-2xl font-bold leading-tight text-[#342a20] sm:text-3xl">{step.title}</h1>
                <div className="mx-auto my-6 h-px w-16 bg-gradient-to-r from-transparent via-[#aa8e63] to-transparent" />
                <p className="whitespace-pre-wrap font-serif text-[17px] leading-[2] text-[#342f28] sm:text-[18px] sm:leading-[2.05]">{step.text}</p>
                <div className="mt-9 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a7558]"><span className="h-px w-8 bg-[#aa8e63]/50" /><Sparkles className="h-3 w-3 text-cyan-700" />LOOP AI<span className="h-px w-8 bg-[#aa8e63]/50" /></div>
              </div>
            </article>
            <section className="mt-8 rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-violet-400/[0.07] to-cyan-300/[0.05] p-4 shadow-[0_0_35px_rgba(34,211,238,0.05)] sm:p-6">
              <div className="mb-4 flex items-center gap-2"><GitBranch className="h-4 w-4 text-cyan-200" /><h2 className="text-sm font-bold text-white">Hikâyenin yönünü sen seç</h2></div>
              <div className="grid gap-2 sm:grid-cols-2">{step.options.map((option, index) => <button key={option.id} type="button" disabled={voting || selected.startsWith(`${step.id}:`)} onClick={() => void choose(option)} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-default ${selected === `${step.id}:${option.id}` ? "border-cyan-200/60 bg-cyan-200/15 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-200 hover:border-cyan-200/35 hover:bg-cyan-200/[0.08]"}`}><span className="mr-2 text-cyan-200/70">{String.fromCharCode(65 + index)}.</span>{option.label}<span className="float-right ml-2 text-[10px] text-cyan-100/60">{votes[option.id] ?? 0} oy</span></button>)}</div>
              {voteError && <p role="alert" className="mt-3 text-xs text-rose-300">{voteError}</p>}
              {selected && <p className="mt-4 text-center text-xs font-semibold text-cyan-100/80">Seçimin kaydedildi. {stepId !== steps[0].id ? "Hikâyenin yeni bölümü açıldı." : ""}</p>}
            </section>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <button type="button" disabled={stepIndex === 0} onClick={() => goToStep(steps[stepIndex - 1].id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-4 w-4" />Önceki bölüm</button>
              <button type="button" onClick={() => setContentsOpen(open => !open)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-100/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-100/[0.06]"><List className="h-4 w-4" />İçindekiler</button>
              <button type="button" disabled={stepIndex === steps.length - 1} onClick={() => goToStep(steps[stepIndex + 1].id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">Sonraki bölüm<ChevronRight className="h-4 w-4" /></button>
            </div>
          </main>
        </div>
      )}
    </>
  );
}

/* ── Loop Seçkisi kapak kartı ─────────────────────────────────────────── */
function FeaturedCard({ book }: { book: Book }) {
  const [, setLocation] = useLocation();
  const openBook = () => {
    sessionStorage.setItem("loop_last_book_entry_v1", "book");
    sessionStorage.setItem("loop_last_book_author_v1", JSON.stringify(book.author ?? { id: book.authorId, displayName: "Yazar", username: "yazar" }));
    setLocation(`/kitap/${book.id}`);
  };
  return (
    <button
      type="button"
      onClick={openBook}
      className="relative shrink-0 w-36 overflow-hidden rounded-2xl text-left transition-all active:scale-[0.97] focus:outline-none"
      style={{ height: 220 }}
    >
      {/* Kapak */}
      <div className="absolute inset-0" style={{ background: "rgba(109,40,217,0.25)" }}>
        {book.cover
          ? <img src={book.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-10 w-10 text-violet-400/30" strokeWidth={1.2} />
            </div>
        }
      </div>
      {/* Alt gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      {/* Premium rozet */}
      {book.isPremiumAuthor && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400/90 px-1.5 py-0.5 backdrop-blur-sm">
          <Crown className="h-2.5 w-2.5 text-amber-900" />
        </div>
      )}
      {/* Alt metin */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[11px] font-black text-white leading-tight line-clamp-2">
          {book.title || "Başlıksız"}
        </p>
        {(book.genres?.length ?? 0) > 0 && (
          <span className="mt-1 inline-block rounded-full bg-violet-500/70 px-1.5 py-0.5 text-[8px] font-bold text-white">
            {book.genres![0]}
          </span>
        )}
      </div>
    </button>
  );
}

/* ── Premium yazar kartı ──────────────────────────────────────────────── */
function PremiumCard({ book }: { book: Book }) {
  const [, setLocation] = useLocation();
  const openBook = () => {
    sessionStorage.setItem("loop_last_book_entry_v1", "book");
    sessionStorage.setItem("loop_last_book_author_v1", JSON.stringify(book.author ?? { id: book.authorId, displayName: "Yazar", username: "yazar" }));
    setLocation(`/kitap/${book.id}`);
  };
  return (
    <button
      type="button"
      onClick={openBook}
      className="flex gap-3 p-3 rounded-2xl border text-left w-full transition-all active:scale-[0.98]"
      style={{
        background: "linear-gradient(135deg,rgba(251,191,36,0.06),rgba(109,40,217,0.06))",
        borderColor: "rgba(251,191,36,0.25)",
      }}
    >
      {/* Kapak */}
      <div className="shrink-0 overflow-hidden rounded-xl relative"
        style={{ width: 56, height: 80, background: "rgba(251,191,36,0.15)" }}>
        {book.cover
          ? <img src={book.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center">
              <Crown className="h-5 w-5 text-amber-400/50" strokeWidth={1.2} />
            </div>
        }
        <div className="absolute inset-0 ring-1 ring-amber-400/20 rounded-xl" />
      </div>
      {/* Bilgi */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Crown className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Premium Yazar</span>
        </div>
        <p className="truncate text-[14px] font-black text-white leading-tight">
          {book.title || "Başlıksız"}
        </p>
        {book.subtitle && (
          <p className="truncate text-[11px] text-slate-500 mt-0.5">{book.subtitle}</p>
        )}
        {(book.genres?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(book.genres ?? []).slice(0, 3).map(g => (
              <span key={g} className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-400/10 text-amber-300">{g}</span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <BookOpen className="h-2.5 w-2.5" />{book.chapterCount ?? (book.chapters as unknown[])?.length ?? 0} bölüm
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />{(book.wordCount ?? 0).toLocaleString("tr")} kelime
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-2.5 w-2.5" />{timeAgo(book.updatedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Normal kitap kartı ───────────────────────────────────────────────── */
function BookCard({ book }: { book: Book }) {
  const [, setLocation] = useLocation();
  const openBook = () => {
    sessionStorage.setItem("loop_last_book_entry_v1", "book");
    sessionStorage.setItem("loop_last_book_author_v1", JSON.stringify(book.author ?? { id: book.authorId, displayName: "Yazar", username: "yazar" }));
    setLocation(`/kitap/${book.id}`);
  };
  return (
    <button
      type="button"
      onClick={openBook}
      className="flex gap-3 p-3 rounded-2xl border text-left w-full transition-all active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", contentVisibility: "auto", containIntrinsicSize: "104px" }}
    >
      <div className="shrink-0 overflow-hidden rounded-xl"
        style={{ width: 60, height: 88, background: "rgba(109,40,217,0.2)" }}>
        {book.cover
          ? <img src={book.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-6 w-6 text-violet-400/50" strokeWidth={1.2} />
            </div>
        }
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="truncate text-[14px] font-black text-white leading-tight">
          {book.title || "Başlıksız"}
        </p>
        {book.subtitle && (
          <p className="truncate text-[11px] text-slate-500 mt-0.5">{book.subtitle}</p>
        )}
        {(book.genres?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(book.genres ?? []).slice(0, 3).map(g => (
              <span key={g} className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-violet-500/15 text-violet-300">{g}</span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <BookOpen className="h-2.5 w-2.5" />{book.chapterCount ?? (book.chapters as unknown[])?.length ?? 0} bölüm
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />{(book.wordCount ?? 0).toLocaleString("tr")} kelime
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-2.5 w-2.5" />{timeAgo(book.updatedAt)}
          </span>
        </div>
      </div>
      {/* Premium rozet — küçük */}
      {book.isPremiumAuthor && (
        <div className="shrink-0 self-start mt-1">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
        </div>
      )}
    </button>
  );
}

function ReaderWriterCard({ books, authorBio, viewedAuthor }: { books: Book[]; authorBio: string; viewedAuthor?: { id?: number; username?: string; displayName?: string; avatarUrl?: string | null } | null }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  if (!user && !viewedAuthor) return null;

  const authorId = viewedAuthor?.id ?? user?.id;
  const authorName = viewedAuthor?.displayName || user?.displayName || user?.username || "Yazar";
  const authoredBooks = books.filter(book => book.authorId === authorId || book.author?.id === authorId || book.author?.displayName === authorName);
  const totalWords = authoredBooks.reduce((sum, book) => sum + (book.wordCount ?? 0), 0);
  const latestBook = authoredBooks[0];
  const totalLikes = authoredBooks.reduce((sum, book) => sum + ((book as any).rating?.likeCount ?? 0), 0);
  const initials = authorName.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => viewedAuthor?.id ? setLocation(`/profile/${viewedAuthor.id}`) : setLocation("/profile/me")}
      className="mx-4 w-[calc(100%-2rem)] overflow-hidden rounded-[1.75rem] text-left text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(109,40,217,0.28)] active:scale-[0.99]"
      style={{ background: "linear-gradient(135deg,#171329 0%,#27134a 52%,#0f3b4b 100%)" }}
    >
      <div className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border-[22px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-20 left-1/2 h-44 w-44 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-cyan-300 text-2xl font-black text-slate-950 ring-4 ring-white/15">
              {(viewedAuthor?.avatarUrl || user?.avatarUrl) ? <img src={viewedAuthor?.avatarUrl || user?.avatarUrl || ""} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg">
              <PenLine className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200">Okur / Yazar</span>
              <span className="text-[10px] font-semibold text-white/45">Gerçek zamanlı profil</span>
            </div>
            <h2 className="mt-2 truncate text-xl font-black sm:text-2xl">{authorName}</h2>
            <p className="mt-0.5 truncate text-xs text-white/55">@{viewedAuthor?.username || user?.username || "yazar"} · Yazar kartı</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <div><p className="text-lg font-black">{authoredBooks.length}</p><p className="text-[10px] text-white/50">Yayınlanan kitap</p></div>
          <div><p className="text-lg font-black">{totalWords.toLocaleString("tr-TR")}</p><p className="text-[10px] text-white/50">Toplam kelime</p></div>
          <div><p className="text-lg font-black">{totalLikes}</p><p className="text-[10px] text-white/50">Toplam beğeni</p></div>
        </div>
        <p className="relative mt-4 line-clamp-2 text-xs leading-relaxed text-white/70">
          {viewedAuthor ? "Bu kitaplık alanı, görüntülediğin kitabın yazarına göre hazırlandı." : authorBio || "Okur ve yazar olarak kendi hikâyelerini burada büyütüyor."}
        </p>
        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[11px] text-white/65"><BookOpen className="h-3.5 w-3.5 text-cyan-300" /> <span className="truncate">{latestBook ? `Son yayın: ${latestBook.title}` : "İlk kitabını yayınlamaya hazırsın"}</span></span>
          <span className="shrink-0 text-[10px] font-bold text-cyan-200">Yazar profiline git →</span>
        </div>
      </div>
    </button>
  );
}

function PremiumTrailerCard({ book, compact = false }: { book: Book; compact?: boolean }) {
  const [, setLocation] = useLocation();
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trailer = normalizeMediaUrl((book.trailers ?? []).find(Boolean));
  const [trailerSrc, setTrailerSrc] = useState("");
  const [trailerFailed, setTrailerFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    setTrailerFailed(false);
    if (!trailer) {
      setTrailerSrc("");
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    let loaded = false;
    const loadTrailer = () => {
      if (loaded) return;
      loaded = true;
      if (!trailer.startsWith("data:")) {
        setTrailerSrc(trailer);
        return;
      }
      void fetch(trailer)
        .then(response => response.blob())
        .then(blob => {
          objectUrl = URL.createObjectURL(blob);
          setTrailerSrc(objectUrl);
        })
        .catch(() => setTrailerFailed(true));
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadTrailer();
        observer.disconnect();
      }
    }, { rootMargin: "240px", threshold: 0.01 });
    observer.observe(card);
    return () => {
      observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [trailer]);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video || !trailerSrc) return;
    const handleActiveTrailer = (event: Event) => {
      const activeId = (event as CustomEvent<string>).detail;
      const isActive = activeId === book.id;
      setActive(isActive);
      video.muted = !isActive;
      setMuted(!isActive);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.dispatchEvent(new CustomEvent("premium-trailer-active", { detail: book.id }));
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    }, { threshold: 0.6 });
    observer.observe(card);
    window.addEventListener("premium-trailer-active", handleActiveTrailer);
    video.muted = true;
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => {
      observer.disconnect();
      window.removeEventListener("premium-trailer-active", handleActiveTrailer);
    };
  }, [book.id, trailerSrc]);

  const moveToNextTrailer = () => {
    if (!active) return;
    const cards = Array.from(cardRef.current?.parentElement?.querySelectorAll<HTMLElement>("[data-premium-trailer-card]") ?? []);
    const currentIndex = cards.indexOf(cardRef.current as HTMLElement);
    const nextCard = cards[(currentIndex + 1) % cards.length];
    if (nextCard && nextCard !== cardRef.current) {
      nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      window.dispatchEvent(new CustomEvent("premium-trailer-active", { detail: book.id }));
      video.muted = false;
      setMuted(false);
      void video.play().catch(() => {});
      return;
    }
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) void video.play().catch(() => {});
  };
  const openBook = () => {
    sessionStorage.setItem("loop_last_book_entry_v1", "book");
    sessionStorage.setItem("loop_last_book_author_v1", JSON.stringify(book.author ?? { id: book.authorId, displayName: "Yazar", username: "yazar" }));
    setLocation(`/kitap/${book.id}`);
  };
  return (
    <article ref={cardRef} data-premium-trailer-card className={`overflow-hidden rounded-2xl border border-amber-400/20 bg-white/[0.04] ${compact ? "w-[220px] shrink-0" : "w-full"}`}>
      <div className={`relative flex items-center justify-center bg-black ${compact ? "h-64" : "h-[70vh] min-h-[420px] max-h-[760px] sm:h-[74vh]"}`}>
        {isPortrait && book.cover && <img src={book.cover} alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />}
        {trailerSrc && !trailerFailed ? <video
          ref={videoRef}
          key={trailer}
          src={trailerSrc}
          muted={muted}
          playsInline
          preload="metadata"
          onLoadedMetadata={event => setIsPortrait(event.currentTarget.videoHeight > event.currentTarget.videoWidth)}
          onError={() => setTrailerFailed(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={moveToNextTrailer}
          onClick={togglePlayback}
          className={isPortrait ? "relative z-[1] h-full w-full object-cover object-center shadow-2xl" : "relative z-[1] h-full w-full object-contain"}
        /> : book.cover ? <img src={book.cover} alt={book.title} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">📖</div>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-amber-400 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950">{trailerFailed ? "Fragman kullanılamıyor" : "Premium fragman"}</div>
        {trailerSrc && !trailerFailed && <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none">
          {!playing && <div className="rounded-full bg-black/45 p-3 text-white backdrop-blur-sm"><Play className="h-5 w-5 fill-white" /></div>}
        </div>}
        {trailerSrc && !trailerFailed && <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Fragmanı duraklat" : "Fragmanı oynat"} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75">
            {playing ? <Pause className="h-3.5 w-3.5 fill-white" /> : <Play className="h-3.5 w-3.5 fill-white" />}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Fragman sesini aç" : "Fragman sesini kapat"} className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-amber-400 text-amber-950" : "bg-black/55 text-white"} backdrop-blur-sm transition hover:bg-black/75`}>
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>}
      </div>
      <div className={`flex gap-3 p-3 ${compact ? "min-h-[78px] flex-col items-stretch" : "items-center justify-between"}`}>
        <div className="min-w-0"><p className="truncate text-sm font-black text-white">{book.title || "Başlıksız"}</p><UserNameWithDecorations user={book.author} fallback="Premium yazar" className="truncate text-[10px] text-slate-400" /></div>
        <button type="button" onClick={openBook} className={`shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-black text-amber-950 transition hover:bg-amber-300 ${compact ? "w-full" : ""}`}>Kitabı görüntüle</button>
      </div>
    </article>
  );
}

/* ── Ana bileşen ──────────────────────────────────────────────────────── */
export default function Kitaplar() {
  const [remoteBooks, setRemoteBooks] = useState<Book[]>([]);
  const [localBooks] = useState<Book[]>(() => loadPublished());
  const [interactiveStories, setInteractiveStories] = useState<InteractiveStory[]>([]);
  const [interactiveChoices, setInteractiveChoices] = useState<Record<string, string>>({});
  const [authorBio, setAuthorBio] = useState("");
  const [viewedAuthor, setViewedAuthor] = useState<{ id?: number; username?: string; displayName?: string; avatarUrl?: string | null } | null>(null);
  const [entrySource, setEntrySource] = useState<"book" | "author" | null>(null);
  const search = useSearch();
  const initialGenre = new URLSearchParams(search).get("genre");
  const [genre, setGenre]   = useState(() => initialGenre && GENRES.includes(initialGenre) ? initialGenre : "Tümü");
  const [query, setQuery]   = useState("");
  const [tick, setTick]     = useState(0);

  /* Mount'ta ve "focus" ile "storage" eventlerinde localStorage'ı yenile */
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener("focus",   refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus",   refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("loop_last_book_author_v1");
      setViewedAuthor(stored ? JSON.parse(stored) : null);
      setEntrySource((new URLSearchParams(search).get("source") as "book" | "author" | null) || (sessionStorage.getItem("loop_last_book_entry_v1") as "book" | "author" | null));
    } catch {
      setViewedAuthor(null);
    }
  }, [tick]);

  useEffect(() => {
    const nextGenre = new URLSearchParams(search).get("genre");
    setGenre(nextGenre && GENRES.includes(nextGenre) ? nextGenre : "Tümü");
  }, [search]);
  useEffect(() => {
    let cancelled = false;
    const syncLocalBooks = async () => {
      await Promise.all(localBooks.map(book =>
        fetch("/api/books", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(book),
        }).catch(() => null),
      ));
    };
    const loadRemoteBooks = async () => {
      try {
        const response = await fetch("/api/books", { credentials: "include", cache: "no-store" });
        const data = response.ok ? await response.json() : [];
        if (!cancelled) setRemoteBooks(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRemoteBooks([]);
      }
    };
    // Render the local catalog immediately; persistence and server refresh happen in the background.
    void loadRemoteBooks();
    void syncLocalBooks().then(loadRemoteBooks);
    return () => { cancelled = true; };
  }, [localBooks]);

  useEffect(() => {
    fetch("/api/interactive-stories", { cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => setInteractiveStories(Array.isArray(data) ? data : []))
      .catch(() => setInteractiveStories([]));
  }, [tick]);

  useEffect(() => {
    fetch("/api/users/me/profile", { credentials: "include" })
      .then(response => response.ok ? response.json() : null)
      .then(profile => setAuthorBio(profile?.authorBio ?? ""))
      .catch(() => setAuthorBio(""));
  }, [tick]);

  const published = [...remoteBooks, ...localBooks.filter(local => !remoteBooks.some(remote => remote.id === local.id))]
    .map(book => ({ ...book, cover: normalizeMediaUrl(book.cover) || null }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const draftCount = loadDraftCount();

  // Bölümlere ayır
  const featuredBooks = published.slice(0, 8); // Loop Seçkisi — en son 8 kitap
  const completedInteractiveStories = interactiveStories.filter(story => story.status === "completed" && Boolean(story.cover));
  const activeGenreParam = new URLSearchParams(search).get("genre");
  const isCategoryView = Boolean(activeGenreParam && GENRES.includes(activeGenreParam));
  const showAuthorContext = Boolean(viewedAuthor && !isCategoryView && entrySource);
  const viewedAuthorBooks = showAuthorContext && viewedAuthor
    ? published.filter(book => book.authorId === viewedAuthor.id || book.author?.id === viewedAuthor.id || book.author?.displayName === viewedAuthor.displayName)
    : [];
  const booksByLikes = [...published].sort((a, b) => Number((b as any).rating?.likeCount ?? 0) - Number((a as any).rating?.likeCount ?? 0));

  /* ── Arama + Tür filtresi ── */
  const q = norm(query);

  const filtered = published.filter(b => {
    const genres = Array.isArray(b.genres) ? b.genres : [];
    const matchGenre = q
      ? true
      : genre === "Tümü" || genres.some(g => norm(g) === norm(genre));
    const matchQ =
      !q ||
      norm(b.title).includes(q)    ||
      norm(b.subtitle ?? "").includes(q) ||
      norm(b.synopsis ?? "").includes(q) ||
      norm(b.author?.displayName ?? "").includes(q) ||
      genres.some(g => norm(g).includes(q));
    return matchGenre && matchQ;
  });

  const categoryBooks = genre === "Tümü" ? published : filtered;
  const premiumBooks = categoryBooks.filter(b => b.isPremiumAuthor);
  const categoryBooksByLikes = [...categoryBooks].sort((a, b) => Number((b as any).rating?.likeCount ?? 0) - Number((a as any).rating?.likeCount ?? 0));
  const isSearchActive = !!q;
  const backHref = genre !== "Tümü" ? "/notebook?tab=categories" : "/notebook";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-12 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-[20px] font-black text-white tracking-tight">Kitaplar</h1>
            <p className="text-[11px] text-slate-500">{published.length} eser yayında</p>
          </div>
        </div>

        {/* Arama kutusu */}
        <div className="flex items-center gap-2 rounded-2xl bg-white/6 border border-white/10 px-4 py-2.5">
          <Search className="h-4 w-4 text-slate-500 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Kitap adı, tür veya özet ara…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder-slate-600 outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}>
              <X className="h-4 w-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* Tür chip'leri */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          {GENRES.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => { setGenre(g); setQuery(""); }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all ${
                genre === g
                  ? "bg-violet-500 border-violet-400 text-white"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-violet-400/30"
              } ${q ? "opacity-40" : ""}`}
            >{g}</button>
          ))}
        </div>

        {q && (
          <p className="text-[11px] text-violet-400/80 px-1">
            Tüm kategorilerde "{query}" aranıyor
          </p>
        )}
      </div>

      {/* ── İçerik ── */}
      <div className="flex-1 overflow-y-auto pb-24">
          <ReaderWriterCard books={published} authorBio={authorBio} viewedAuthor={showAuthorContext ? viewedAuthor : null} />

          {showAuthorContext && viewedAuthor && (
            <section className="mt-6 px-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300">Yazarın eserleri</p>
                  <h2 className="mt-1 text-[16px] font-black text-white">{viewedAuthor.displayName || "Yazar"} tarafından yazılan kitaplar</h2>
                </div>
                <span className="text-[11px] text-slate-500">{viewedAuthorBooks.length} eser</span>
              </div>
              {viewedAuthorBooks.length > 0 ? <div className="space-y-2">{viewedAuthorBooks.map(book => <BookCard key={book.id} book={book} />)}</div> : <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-xs text-slate-500">Bu yazarın yayınlanan başka eseri bulunmuyor.</p>}
            </section>
          )}

        {/* Taslak var ama hiçbiri yayında değil */}
        {published.length === 0 && draftCount > 0 && (
          <div className="mx-4 mt-4 mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <p className="text-[12px] font-bold text-amber-300">
              {draftCount} taslak var, hiçbiri yayında değil
            </p>
            <p className="mt-0.5 text-[11px] text-amber-400/70">
              Çalışmalarım → ⋯ → Yayınla yaparak kitabını buraya ekle
            </p>
          </div>
        )}

        {/* Arama/filtre aktifken sadece liste göster */}
        {isSearchActive ? (
          <div className="px-4 pt-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(109,40,217,0.12)" }}>
                  <Sparkles className="h-8 w-8 text-violet-400/50" />
                </div>
                <p className="text-[15px] font-bold text-white mb-1">Eşleşen kitap bulunamadı</p>
                <p className="text-[12px] text-slate-500">
                  {q ? `"${query}" ile eşleşen kitap yok` : "Farklı bir tür deneyin"}
                </p>
                <button
                  type="button"
                  onClick={() => { setQuery(""); setGenre("Tümü"); }}
                  className="mt-4 text-[12px] text-violet-400 underline"
                >
                  Filtreyi temizle
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-slate-600 mb-3">
                  {filtered.length} kitap
                  {q ? ` · "${query}" araması` : genre !== "Tümü" ? ` · ${genre}` : ""}
                </p>
                {filtered.map(book => <BookCard key={book.id} book={book} />)}
              </div>
            )}
          </div>

        ) : published.length === 0 ? (
          /* Hiç kitap yok */
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ background: "rgba(109,40,217,0.12)" }}>
              <BookOpen className="h-10 w-10 text-violet-400/40" strokeWidth={1.2} />
            </div>
            <p className="text-[18px] font-black text-white mb-2">Henüz yayında kitap yok</p>
            <p className="text-[13px] text-slate-500 max-w-[220px] leading-relaxed">
              Çalışmalarım sayfasından bir kitabı yayınlayın
            </p>
            <Link href="/notebook/calismalari">
              <button className="mt-6 rounded-xl bg-violet-500/20 px-5 py-3 text-[13px] font-bold text-violet-300 border border-violet-400/30">
                Çalışmalarıma Git
              </button>
            </Link>
            <InteractiveSection
              stories={interactiveStories}
              choices={interactiveChoices}
              onChoose={(storyId, optionId) => setInteractiveChoices(prev => ({ ...prev, [storyId]: optionId }))}
            />
          </div>

        ) : (
          /* Normal durum — bölümler */
          <>
            {/* ── Loop Seçkisi ─────────────────────────────────────────── */}
            <section className="mt-2">
              <div className="flex items-center gap-2 px-4 mb-3">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h2 className="text-[13px] font-black text-white">Loop Seçkisi</h2>
                <span className="text-[11px] text-slate-500 ml-1">Öne Çıkan Hikayeler</span>
              </div>
              {/* Yatay kaydırma */}
              <div
                className="flex gap-3 overflow-x-auto px-4 pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {featuredBooks.map(book => (
                  <FeaturedCard key={book.id} book={book} />
                ))}
              </div>
            </section>

            {completedInteractiveStories.length > 0 && (
              <section className="mt-7 px-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
                    <GitBranch className="h-3.5 w-3.5 text-cyan-300" />
                    <span className="text-[12px] font-black text-cyan-200">Loop AI</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Tamamlanan öne çıkan hikâyeler</span>
                </div>
                <InteractiveSection stories={completedInteractiveStories} choices={interactiveChoices} onChoose={(storyId, optionId) => setInteractiveChoices(prev => ({ ...prev, [storyId]: optionId }))} />
              </section>
            )}

            <InteractiveSection
              stories={interactiveStories}
              choices={interactiveChoices}
              onChoose={(storyId, optionId) => setInteractiveChoices(prev => ({ ...prev, [storyId]: optionId }))}
            />

            {/* ── Premium Yazarlardan ───────────────────────────────────── */}
            {premiumBooks.length > 0 && (
              <section className="mt-6 px-4">
                {/* Başlık */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1">
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[12px] font-black text-amber-300">Premium Yazarlardan</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{premiumBooks.length} kitap</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>{premiumBooks.map(book => <div key={book.id} className="snap-start"><PremiumTrailerCard book={book} compact /></div>)}</div>
              </section>
            )}

            {/* ── Tüm Kitaplar ─────────────────────────────────────────── */}
            <section className="mt-6 px-4">
              <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-wider mb-3">
                Tüm Kitaplar
              </h2>
              <div className="space-y-2">
                {categoryBooksByLikes.map(book => <BookCard key={book.id} book={book} />)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
