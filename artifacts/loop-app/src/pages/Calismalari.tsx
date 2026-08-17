import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  ArrowLeft, BookOpen, Trash2, Send, FileText,
  Clock, Hash, Layers,
  Search, Plus, PenLine, BookOpen as BookEdit, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllDrafts, deleteDraft, publishDraft, unpublishDraft,
  type Draft,
} from "@/lib/draftStore";

/* ── Yardımcılar ─────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Az önce";
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short" });
}

const TYPE_LABELS: Record<string, string> = {
  metin: "Metin", video: "Video", gorsel: "Görsel",
  sesli: "Sesli Kitap", etkilesim: "Etkileşimli",
};

const TYPE_COLORS: Record<string, string> = {
  metin: "#a78bfa", video: "#f59e0b", gorsel: "#34d399",
  sesli: "#38bdf8", etkilesim: "#f472b6",
};

/* ── Boş durum ───────────────────────────────────────────────────────── */
function Empty({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "rgba(109,40,217,0.12)", border: "1px dashed rgba(139,92,246,0.3)" }}>
        <FileText className="h-8 w-8 text-violet-400/50" strokeWidth={1.2} />
      </div>
      <p className="text-[15px] font-black text-white/80 mb-2">
        {tab === "draft" ? "Henüz taslak yok" : tab === "published" ? "Henüz yayın yok" : "Henüz içerik yok"}
      </p>
      <p className="text-[12px] text-slate-500 mb-6">
        {tab === "draft" ? "Bir içerik oluşturduktan sonra kaydet diyerek buraya taşıyabilirsin." : "İçeriklerini yayınladığında burada görünür."}
      </p>
      <Link href="/icerik-olustur"
        className="flex items-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-black text-white"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
        <Plus className="h-4 w-4" /> İçerik Oluştur
      </Link>
    </div>
  );
}

/* ── Kart aksiyonları — sabit bottom sheet ───────────────────────────── */
function CardMenu({ draft, onClose, onDelete, onPublish, onUnpublish, onRefresh }: {
  draft: Draft;
  onClose: () => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onRefresh: () => void;
}) {
  const [, setLocation] = useLocation();

  const go = (path: string) => { onClose(); setLocation(path); };

  const handleDelete = () => {
    onDelete(draft.id);
    toast.error("Silindi", { icon: "🗑" });
    onClose();
    onRefresh();
  };

  const handlePublish = () => {
    onPublish(draft.id);
    toast.success("Yayınlandı! 🎉");
    onClose();
    onRefresh();
  };

  const handleUnpublish = () => {
    onUnpublish(draft.id);
    toast.success("Yayından kaldırıldı", { description: "Taslağa dönüştürüldü" });
    onClose();
    onRefresh();
  };

  return (
    /* tam ekran overlay */
    <div
      className="fixed inset-0 z-[999] flex items-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* sheet */}
      <div
        className="w-full rounded-t-3xl overflow-hidden pb-8"
        style={{ background: "#16122a", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* tutamak çizgisi */}
        <div className="mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-white/15" />

        {/* Kitap adı */}
        <p className="px-5 pb-3 text-[12px] text-slate-500 font-semibold border-b border-white/8">
          {draft.title || "Başlıksız"}
        </p>

        {/* Kitabı Düzenle */}
        <button
          type="button"
          onClick={() => go(`/yaz/metin?id=${draft.id}&step=0`)}
          className="flex w-full items-center gap-3 px-5 py-4 text-[14px] text-white hover:bg-white/5 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20">
            <BookEdit className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-white">Kitabı Düzenle</p>
            <p className="text-[11px] text-slate-500">Kapak, tür, sinopsis…</p>
          </div>
        </button>

        {/* Yazmaya Devam Et */}
        <button
          type="button"
          onClick={() => go(`/yaz/metin?id=${draft.id}&step=2`)}
          className="flex w-full items-center gap-3 px-5 py-4 text-[14px] text-white hover:bg-white/5 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
            <PenLine className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-white">Yazmaya Devam Et</p>
            <p className="text-[11px] text-slate-500">Bölümler ve editör</p>
          </div>
        </button>

        {/* Yayınla */}
        {draft.status === "draft" && (
          <button
            type="button"
            onClick={handlePublish}
            className="flex w-full items-center gap-3 px-5 py-4 text-[14px] text-white hover:bg-white/5 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
              <Send className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">Yayınla</p>
              <p className="text-[11px] text-slate-500">Okuyucularla paylaş</p>
            </div>
          </button>
        )}

        {/* Yayından Kaldır */}
        {draft.status === "published" && (
          <button
            type="button"
            onClick={handleUnpublish}
            className="flex w-full items-center gap-3 px-5 py-4 text-[14px] text-white hover:bg-white/5 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15">
              <EyeOff className="h-4.5 w-4.5 text-orange-400" />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">Yayından Kaldır</p>
              <p className="text-[11px] text-slate-500">Taslağa geri döndür</p>
            </div>
          </button>
        )}

        {/* Sil */}
        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center gap-3 px-5 py-4 text-[14px] hover:bg-white/5 transition-colors border-t border-white/8 mt-1"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15">
            <Trash2 className="h-4.5 w-4.5 text-rose-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-rose-400">Sil</p>
            <p className="text-[11px] text-slate-500">Bu içeriği kalıcı sil</p>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ── Tek kart ────────────────────────────────────────────────────────── */
function DraftCard({ draft, onDelete, onPublish, onUnpublish, onRefresh }: {
  draft: Draft;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wordCount = draft.wordCount;
  const chCount   = draft.chapters?.length ?? 0;
  const typeColor = TYPE_COLORS[draft.type] ?? "#a78bfa";

  return (
    <>
      <div
        className="relative rounded-2xl border"
        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex gap-3 p-3">
          {/* Kapak */}
          <div className="relative shrink-0 overflow-hidden rounded-xl"
            style={{ width: 64, height: 92, background: "rgba(109,40,217,0.18)" }}>
            {draft.cover
              ? <img src={draft.cover} alt="" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-7 w-7 text-violet-400/40" strokeWidth={1.2} />
                </div>
              )
            }
            {/* Durum etiketi */}
            <span
              className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-black"
              style={{
                background: draft.status === "draft" ? "rgba(167,139,250,0.2)" : "rgba(52,211,153,0.2)",
                color: draft.status === "draft" ? "#a78bfa" : "#34d399",
                border: `1px solid ${draft.status === "draft" ? "rgba(167,139,250,0.35)" : "rgba(52,211,153,0.35)"}`,
              }}
            >
              {draft.status === "draft" ? "Taslak" : "Yayında"}
            </span>
          </div>

          {/* Bilgi */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-black text-white leading-tight">
                  {draft.title || "Başlıksız"}
                </p>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black"
                  style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}
                >
                  {TYPE_LABELS[draft.type] ?? "—"}
                </span>
              </div>
              {/* ⋯ Menü tetikleyici */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 transition-colors"
                style={{ fontSize: 20, lineHeight: 1 }}
              >⋯</button>
            </div>

            {/* Türler */}
            {draft.genres?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {draft.genres.slice(0, 2).map(g => (
                  <span key={g} className="rounded-full bg-white/6 px-2 py-0.5 text-[9px] text-slate-400">{g}</span>
                ))}
              </div>
            )}

            {/* Meta */}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />{chCount} bölüm
              </span>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />{wordCount.toLocaleString("tr")} kelime
              </span>
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3" />{timeAgo(draft.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet menü — card dışında render edilir */}
      {menuOpen && (
        <CardMenu
          draft={draft}
          onClose={() => setMenuOpen(false)}
          onDelete={onDelete}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

/* ── Ana sayfa ───────────────────────────────────────────────────────── */
type Tab = "all" | "draft" | "published";

export default function Calismalari() {
  const search     = useSearch();
  const initTab    = (new URLSearchParams(search).get("tab") as Tab) ?? "all";
  const [tab, setTab]       = useState<Tab>(initTab);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [query, setQuery]   = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const load = useCallback(() => setDrafts(getAllDrafts()), []);
  useEffect(() => { load(); }, [load]);

  /* Menü dışı tıklama ile kapat */
  useEffect(() => {
    const handler = () => {
      // menü kapansın — DraftCard içindeki menuOpen state'ini doğrudan kontrol etmek zor,
      // basit çözüm: body click ile sayfayı yenile
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",       label: "Tümü"       },
    { id: "draft",     label: "Taslaklar"  },
    { id: "published", label: "Yayınlar"   },
  ];

  const filtered = drafts
    .filter(d => tab === "all" || d.status === tab)
    .filter(d => !query || (d.title ?? "").toLowerCase().includes(query.toLowerCase()));

  const stats = {
    total:     drafts.length,
    drafts:    drafts.filter(d => d.status === "draft").length,
    published: drafts.filter(d => d.status === "published").length,
    words:     drafts.reduce((s, d) => s + (d.wordCount ?? 0), 0),
  };

  return (
    <div className="min-h-screen flex flex-col pb-20" style={{ background: "#0a0814" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-12 pb-2"
        style={{ background: "rgba(10,8,20,0.94)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3 mb-4">
          <Link href="/notebook" className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div className="flex-1">
            <h1 className="text-[18px] font-black text-white tracking-tight">Çalışmalarım</h1>
          </div>
          <button type="button" onClick={() => setShowSearch(v => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 transition-colors">
            <Search className="h-4.5 w-4.5" />
          </button>
          <Link href="/icerik-olustur"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            <Plus className="h-4.5 w-4.5" />
          </Link>
        </div>

        {/* Arama */}
        {showSearch && (
          <input
            placeholder="Başlık ara…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="w-full mb-3 rounded-xl bg-white/6 border border-white/10 px-4 py-2.5 text-[13px] text-white placeholder-slate-500 outline-none focus:border-violet-400/50 transition-colors"
          />
        )}

        {/* İstatistik şeridi */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Toplam",   val: stats.total     },
            { label: "Taslak",   val: stats.drafts    },
            { label: "Yayında",  val: stats.published },
            { label: "Kelime",   val: stats.words > 999 ? `${(stats.words/1000).toFixed(1)}B` : stats.words },
          ].map(s => (
            <div key={s.label}
              className="rounded-xl py-2 text-center"
              style={{ background: "rgba(109,40,217,0.10)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <p className="text-[15px] font-black text-violet-300">{s.val}</p>
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sekmeler */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2 text-[12px] font-bold border transition-all
                ${tab === t.id ? "bg-violet-500/20 border-violet-400/50 text-violet-300" : "bg-white/4 border-white/8 text-slate-500"}`}>
              {t.label}
              {t.id !== "all" && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({t.id === "draft" ? stats.drafts : stats.published})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 px-4 pt-4 space-y-3">
        {filtered.length === 0
          ? <Empty tab={tab} />
          : filtered.map(d => (
            <DraftCard
              key={d.id}
              draft={d}
              onDelete={id => { deleteDraft(id); }}
              onPublish={id => { publishDraft(id); }}
              onUnpublish={id => { unpublishDraft(id); }}
              onRefresh={load}
            />
          ))
        }
      </div>
    </div>
  );
}
