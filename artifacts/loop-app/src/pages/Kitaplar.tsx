import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, Search, BookOpen, Clock, Hash,
  Sparkles, SlidersHorizontal, X,
} from "lucide-react";
import { getPublishedBooks, type Draft } from "@/lib/draftStore";

const GENRES = [
  "Tümü","Romantizm","Fantastik","Gerilim","Bilim Kurgu",
  "Tarih","Gizem","Macera","Korku","Komedi","Drama","Şiir","Deneme",
];

const AGE_LABELS: Record<string, string> = {
  all: "Genel", "13+": "13+", "18+": "18+",
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)}dk`;
  if (s < 86400) return `${Math.floor(s / 3600)}sa`;
  return `${Math.floor(s / 86400)}g`;
}

function BookCard({ book }: { book: Draft }) {
  const [, setLocation] = useLocation();
  const wordCount = book.wordCount;
  const chCount = book.chapters?.length ?? 0;

  return (
    <button
      type="button"
      onClick={() => setLocation(`/kitap/${book.id}`)}
      className="flex gap-3 p-3 rounded-2xl border text-left w-full transition-all active:scale-[0.98]"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Kapak */}
      <div
        className="shrink-0 overflow-hidden rounded-xl"
        style={{ width: 60, height: 88, background: "rgba(109,40,217,0.2)" }}
      >
        {book.cover
          ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
          : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-6 w-6 text-violet-400/50" strokeWidth={1.2} />
            </div>
          )
        }
      </div>

      {/* Bilgi */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="truncate text-[14px] font-black text-white leading-tight">
          {book.title || "Başlıksız"}
        </p>
        {book.subtitle && (
          <p className="truncate text-[11px] text-slate-500 mt-0.5">{book.subtitle}</p>
        )}

        {/* Türler */}
        {book.genres?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {book.genres.slice(0, 3).map(g => (
              <span key={g}
                className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-violet-500/15 text-violet-300"
              >{g}</span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <BookOpen className="h-2.5 w-2.5" />{chCount} bölüm
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />{wordCount.toLocaleString("tr")} kelime
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-2.5 w-2.5" />{timeAgo(book.updatedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Kitaplar() {
  const [books, setBooks] = useState<Draft[]>([]);
  const [genre, setGenre] = useState("Tümü");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const refresh = useCallback(() => setBooks(getPublishedBooks()), []);

  useEffect(() => {
    refresh();
    // Kullanıcı başka sekmeden/sayfadan döndüğünde yenile
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const filtered = books.filter(b => {
    const genres = Array.isArray(b.genres) ? b.genres : [];
    const matchGenre =
      genre === "Tümü" ||
      genres.some(g => g.trim().toLowerCase() === genre.trim().toLowerCase());
    const q = query.trim().toLowerCase();
    const matchQ =
      !q ||
      (b.title ?? "").toLowerCase().includes(q) ||
      (b.synopsis ?? "").toLowerCase().includes(q) ||
      genres.some(g => g.toLowerCase().includes(q));
    return matchGenre && matchQ;
  });

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/notebook">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-[20px] font-black text-white tracking-tight">Kitaplar</h1>
            <p className="text-[11px] text-slate-500">{books.length} eser yayında</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSearch(v => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${showSearch ? "bg-violet-500 text-white" : "bg-white/8 text-slate-400"}`}
          >
            <Search className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Arama kutusu */}
        {showSearch && (
          <div className="mb-3 flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kitap veya tür ara…"
              className="flex-1 bg-transparent text-[13px] text-white placeholder-slate-600 outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                <X className="h-4 w-4 text-slate-500" />
              </button>
            )}
          </div>
        )}

        {/* Tür filtreleri */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {GENRES.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all ${
                genre === g
                  ? "bg-violet-500 border-violet-400 text-white"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-violet-400/30"
              }`}
            >{g}</button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "rgba(109,40,217,0.12)" }}>
              <Sparkles className="h-8 w-8 text-violet-400/50" />
            </div>
            <p className="text-[15px] font-bold text-white mb-1">
              {books.length === 0 ? "Henüz yayında kitap yok" : "Eşleşen kitap bulunamadı"}
            </p>
            <p className="text-[12px] text-slate-500 max-w-[220px]">
              {books.length === 0
                ? "Çalışmalarım sayfasından bir kitabı yayınlayın"
                : "Farklı bir tür veya arama deneyin"}
            </p>
            {books.length === 0 && (
              <Link href="/notebook/calismalari">
                <button className="mt-5 rounded-xl bg-violet-500/20 px-4 py-2.5 text-[13px] font-bold text-violet-300 border border-violet-400/30">
                  Çalışmalarıma Git
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-3">
            {/* Toplam sonuç */}
            <p className="text-[11px] text-slate-600 mb-3">
              {filtered.length} kitap{genre !== "Tümü" ? ` · ${genre}` : ""}
            </p>
            {filtered.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
