import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowLeft, BookOpen, Clock, Hash, Sparkles, X, Search,
} from "lucide-react";
import { getAllDrafts, type Draft } from "@/lib/draftStore";

const GENRES = [
  "Tümü","Romantizm","Fantastik","Gerilim","Bilim Kurgu",
  "Tarih","Gizem","Macera","Korku","Komedi","Drama","Şiir","Deneme",
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "az önce";
  if (s < 3600)  return `${Math.floor(s / 60)}dk`;
  if (s < 86400) return `${Math.floor(s / 3600)}sa`;
  return `${Math.floor(s / 86400)}g`;
}

function BookCard({ book }: { book: Draft }) {
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
            <BookOpen className="h-2.5 w-2.5" />{book.chapters?.length ?? 0} bölüm
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

export default function Kitaplar() {
  const [genre, setGenre] = useState("Tümü");
  const [query, setQuery] = useState("");

  /* ── Veri: tüm taslakları oku, yayındakileri filtrele ── */
  // getAllDrafts() her render'da doğrudan localStorage'ı okur
  const allDrafts     = getAllDrafts();
  const publishedBooks = allDrafts.filter(d => d.status === "published");
  const draftCount    = allDrafts.filter(d => d.status !== "published").length;

  /* ── Filtre ── */
  const q = query.trim().toLowerCase();

  const filtered = publishedBooks.filter(b => {
    const genres = Array.isArray(b.genres) ? b.genres : [];

    // Arama sorgusunun aktif olduğu durumda TÜR FİLTRESİNİ ATLA —
    // kullanıcı kitap adını yazarken aktif genre chip engel çıkarmamalı.
    const matchGenre = q
      ? true
      : genre === "Tümü" || genres.some(g => g.toLowerCase() === genre.toLowerCase());

    const matchQ =
      !q ||
      (b.title  ?? "").toLowerCase().includes(q) ||
      (b.subtitle ?? "").toLowerCase().includes(q) ||
      (b.synopsis ?? "").toLowerCase().includes(q) ||
      genres.some(g => g.toLowerCase().includes(q));

    return matchGenre && matchQ;
  });

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-12 pb-3 space-y-3">

        {/* Üst satır */}
        <div className="flex items-center gap-3">
          <Link href="/notebook">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-[20px] font-black text-white tracking-tight">Kitaplar</h1>
            <p className="text-[11px] text-slate-500">{publishedBooks.length} eser yayında</p>
          </div>
        </div>

        {/* Arama kutusu — HER ZAMAN GÖRÜNÜR */}
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

        {/* Tür chip'leri — arama aktifken soluk göster */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          {GENRES.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold border transition-all ${
                genre === g && !q
                  ? "bg-violet-500 border-violet-400 text-white"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-violet-400/30"
              } ${q ? "opacity-40" : ""}`}
            >{g}</button>
          ))}
        </div>

        {/* Arama aktifken bilgi etiketi */}
        {q && (
          <p className="text-[11px] text-violet-400/80 px-1">
            Tüm kategorilerde "{query}" aranıyor
          </p>
        )}
      </div>

      {/* ── Liste ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* Hiç yayın yok ama taslak var → yol göster */}
        {publishedBooks.length === 0 && draftCount > 0 && (
          <div className="mt-4 mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <p className="text-[12px] font-bold text-amber-300">
              {draftCount} taslak var, hiçbiri henüz yayında değil
            </p>
            <p className="mt-0.5 text-[11px] text-amber-400/70">
              Çalışmalarım → ⋯ → Yayınla yaparak kitabını buraya ekle
            </p>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "rgba(109,40,217,0.12)" }}>
              <Sparkles className="h-8 w-8 text-violet-400/50" />
            </div>
            <p className="text-[15px] font-bold text-white mb-1">
              {publishedBooks.length === 0 ? "Henüz yayında kitap yok" : "Eşleşen kitap bulunamadı"}
            </p>
            <p className="text-[12px] text-slate-500 max-w-[230px]">
              {publishedBooks.length === 0
                ? "Çalışmalarım sayfasından bir kitabı yayınlayın"
                : q
                  ? `"${query}" ile eşleşen yayında kitap yok`
                  : "Farklı bir tür deneyin"}
            </p>
            {publishedBooks.length === 0 && (
              <Link href="/notebook/calismalari">
                <button className="mt-5 rounded-xl bg-violet-500/20 px-4 py-2.5 text-[13px] font-bold text-violet-300 border border-violet-400/30">
                  Çalışmalarıma Git
                </button>
              </Link>
            )}
            {publishedBooks.length > 0 && q && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 text-[12px] text-violet-400 underline"
              >
                Aramayı temizle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-3">
            <p className="text-[11px] text-slate-600 mb-3">
              {filtered.length} kitap
              {q ? ` · "${query}" araması` : genre !== "Tümü" ? ` · ${genre}` : ""}
            </p>
            {filtered.map(book => <BookCard key={book.id} book={book} />)}
          </div>
        )}
      </div>
    </div>
  );
}
