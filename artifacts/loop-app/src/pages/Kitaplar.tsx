import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, BookOpen, Clock, Hash, Sparkles, X, Search, Crown,
} from "lucide-react";

/* ── Sabitler ──────────────────────────────────────────────────────────── */
const STORAGE_KEY = "loop_drafts_v1";

const GENRES = [
  "Tümü","Romantizm","Fantastik","Gerilim","Bilim Kurgu",
  "Tarih","Gizem","Macera","Korku","Komedi","Drama","Şiir","Deneme",
];

/* ── Tipler ───────────────────────────────────────────────────────────── */
interface Book {
  id: string;
  type: string;
  status: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
  genres?: string[];
  synopsis?: string;
  chapters?: unknown[];
  wordCount?: number;
  updatedAt: string;
  isPremiumAuthor?: boolean;
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

/* ── Loop Seçkisi kapak kartı ─────────────────────────────────────────── */
function FeaturedCard({ book }: { book: Book }) {
  const [, setLocation] = useLocation();
  return (
    <button
      type="button"
      onClick={() => setLocation(`/kitap/${book.id}`)}
      className="relative shrink-0 w-36 overflow-hidden rounded-2xl text-left transition-all active:scale-[0.97] focus:outline-none"
      style={{ height: 220 }}
    >
      {/* Kapak */}
      <div className="absolute inset-0" style={{ background: "rgba(109,40,217,0.25)" }}>
        {book.cover
          ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
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
  return (
    <button
      type="button"
      onClick={() => setLocation(`/kitap/${book.id}`)}
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
          ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
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
            <BookOpen className="h-2.5 w-2.5" />{(book.chapters as unknown[])?.length ?? 0} bölüm
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
  return (
    <button
      type="button"
      onClick={() => setLocation(`/kitap/${book.id}`)}
      className="flex gap-3 p-3 rounded-2xl border text-left w-full transition-all active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="shrink-0 overflow-hidden rounded-xl"
        style={{ width: 60, height: 88, background: "rgba(109,40,217,0.2)" }}>
        {book.cover
          ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
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
            <BookOpen className="h-2.5 w-2.5" />{(book.chapters as unknown[])?.length ?? 0} bölüm
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

/* ── Ana bileşen ──────────────────────────────────────────────────────── */
export default function Kitaplar() {
  const [genre, setGenre]   = useState("Tümü");
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

  void tick;
  const published  = loadPublished();
  const draftCount = loadDraftCount();

  // Bölümlere ayır
  const premiumBooks  = published.filter(b => b.isPremiumAuthor);
  const featuredBooks = published.slice(0, 8); // Loop Seçkisi — en son 8 kitap

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
      genres.some(g => norm(g).includes(q));
    return matchGenre && matchQ;
  });

  const isSearchActive = !!q || genre !== "Tümü";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-12 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/notebook">
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
                <div className="space-y-2">
                  {premiumBooks.map(book => (
                    <PremiumCard key={book.id} book={book} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Tüm Kitaplar ─────────────────────────────────────────── */}
            <section className="mt-6 px-4">
              <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-wider mb-3">
                Tüm Kitaplar
              </h2>
              <div className="space-y-2">
                {published.map(book => <BookCard key={book.id} book={book} />)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
