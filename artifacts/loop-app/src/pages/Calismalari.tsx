import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  ArrowLeft, BookOpen, Trash2, Send, FileText,
  Clock, Hash, Layers,
  Search, Plus, PenLine, BookOpen as BookEdit, EyeOff,
  ImagePlus, Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllDrafts, deleteDraft, publishDraft, unpublishDraft,
  updateDraftCoverAndLabel,
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

/* ── Bant stili yardımcısı ──────────────────────────────────────────── */
function bandStyle(pos: "top" | "mid" | "bottom", height: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(90deg,rgba(0,0,0,0.42),rgba(255,255,255,0.05),rgba(0,0,0,0.42))",
    backdropFilter: "blur(8px) saturate(1.6)",
    WebkitBackdropFilter: "blur(8px) saturate(1.6)",
    borderTop: "0.5px solid rgba(255,255,255,0.22)",
    borderBottom: "0.5px solid rgba(255,255,255,0.22)",
    overflow: "hidden",
  };
  if (pos === "top")    return { ...base, top: 0 };
  if (pos === "bottom") return { ...base, bottom: 0 };
  return { ...base, top: "50%", transform: "translateY(-50%)" };
}

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
        {tab === "draft"
          ? "Bir içerik oluşturduktan sonra kaydet diyerek buraya taşıyabilirsin."
          : "İçeriklerini yayınladığında burada görünür."}
      </p>
      <Link href="/icerik-olustur"
        className="flex items-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-black text-white"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
        <Plus className="h-4 w-4" /> İçerik Oluştur
      </Link>
    </div>
  );
}

/* ── Kapak & Etiket düzenleyici bottom sheet ─────────────────────────── */
function CoverEditSheet({ draft, onClose, onRefresh }: {
  draft: Draft;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [cover, setCover]       = useState<string | null>(draft.cover);
  const [label, setLabel]       = useState(draft.label ?? "");
  const [labelPos, setLabelPos] = useState<"top" | "mid" | "bottom">(draft.labelPos ?? "mid");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCover(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateDraftCoverAndLabel(draft.id, cover, label.trim(), labelPos);
    onRefresh();
    onClose();
    toast.success("Kapak güncellendi ✓");
  };

  const trimmed = label.trim();

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-[28px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg,#1a1530 0%,#16122a 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Tutamak */}
        <div className="mx-auto mt-3 h-[3px] w-10 rounded-full bg-white/15" />

        {/* Başlık */}
        <div className="px-5 py-4 border-b border-white/8">
          <p className="text-[15px] font-black text-white">Kapak & Etiket</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{draft.title || "Başlıksız"}</p>
        </div>

        {/* ── Canlı önizleme ── */}
        <div className="flex flex-col items-center pt-6 pb-2">
          <div
            className="relative overflow-hidden rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
            style={{ width: 140, height: 210, background: "rgba(109,40,217,0.18)", flexShrink: 0 }}
          >
            {cover
              ? <img src={cover} alt="" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-10 w-10 text-violet-400/40" strokeWidth={1.2} />
                </div>
              )
            }

            {/* Bant — sabit 28 px, asla büyümez/küçülmez */}
            {trimmed && (
              <div style={bandStyle(labelPos, 28)}>
                {/* soluk parlaklık süsü */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.06) 50%,transparent 100%)",
                  pointerEvents: "none",
                }} />
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.28em",
                  color: "rgba(255,255,255,0.95)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 130,
                  padding: "0 6px",
                  position: "relative",
                  zIndex: 1,
                }}>
                  {trimmed}
                </span>
              </div>
            )}
          </div>

          <p className="mt-3 text-[10px] text-slate-600 italic">Canlı önizleme</p>
        </div>

        {/* ── Form ── */}
        <div className="px-5 pb-8 space-y-5 pt-3">

          {/* Kapak değiştir */}
          <div>
            <p className="mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">Kapak Fotoğrafı</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold text-violet-300 transition-colors"
              style={{
                border: "1px dashed rgba(139,92,246,0.35)",
                background: "rgba(109,40,217,0.08)",
              }}
            >
              <ImagePlus className="h-4 w-4" />
              {cover ? "Fotoğrafı Değiştir" : "Kapak Fotoğrafı Ekle"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {/* Bant etiketi */}
          <div>
            <p className="mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">Şeffaf Bant Etiketi</p>
            <input
              value={label}
              onChange={e => setLabel(e.target.value.slice(0, 40))}
              placeholder='ör. "Breaking Point Serisi"'
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 text-[13px] text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-colors"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-slate-600">Boş bırakırsan bant görünmez</span>
              <span className="text-[10px] text-slate-600">{label.length}/40</span>
            </div>
          </div>

          {/* Konum seçici — sadece etiket varsa */}
          {trimmed && (
            <div>
              <p className="mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">Bant Konumu</p>
              <div className="grid grid-cols-3 gap-2">
                {(["top","mid","bottom"] as const).map((pos, i) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setLabelPos(pos)}
                    className={`rounded-2xl py-2.5 text-[12px] font-bold transition-all ${
                      labelPos === pos
                        ? "bg-violet-600 text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)]"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {["Üst","Orta","Alt"][i]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Kaydet */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl py-4 text-[14px] font-black text-white mt-2"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Kart aksiyonları — sabit bottom sheet ───────────────────────────── */
function CardMenu({ draft, onClose, onDelete, onPublish, onUnpublish, onRefresh, onOpenCoverEdit }: {
  draft: Draft;
  onClose: () => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onRefresh: () => void;
  onOpenCoverEdit: () => void;
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

  const MenuItem = ({
    icon, label, sub, onClick, accent,
    iconBg,
  }: {
    icon: React.ReactNode;
    label: string;
    sub: string;
    onClick: () => void;
    accent?: string;
    iconBg: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-4 text-[14px] hover:bg-white/5 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="text-left">
        <p className="font-bold" style={{ color: accent ?? "#fff" }}>{label}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl overflow-hidden pb-8"
        style={{ background: "#16122a", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-white/15" />

        <p className="px-5 pb-3 text-[12px] text-slate-500 font-semibold border-b border-white/8">
          {draft.title || "Başlıksız"}
        </p>

        <MenuItem
          icon={<BookEdit className="h-4.5 w-4.5 text-violet-400" />}
          iconBg="rgba(139,92,246,0.2)"
          label="Kitabı Düzenle"
          sub="Kapak, tür, sinopsis…"
          onClick={() => go(`/yaz/metin?id=${draft.id}&step=0`)}
        />

        <MenuItem
          icon={<Tag className="h-4.5 w-4.5 text-sky-400" />}
          iconBg="rgba(56,189,248,0.15)"
          label="Kapak & Etiket"
          sub="Kapak fotoğrafı ve şeffaf bant"
          onClick={() => { onClose(); onOpenCoverEdit(); }}
        />

        <MenuItem
          icon={<PenLine className="h-4.5 w-4.5 text-amber-400" />}
          iconBg="rgba(245,158,11,0.15)"
          label="Yazmaya Devam Et"
          sub="Bölümler ve editör"
          onClick={() => go(`/yaz/metin?id=${draft.id}&step=2`)}
        />

        {draft.status === "draft" && (
          <MenuItem
            icon={<Send className="h-4.5 w-4.5 text-emerald-400" />}
            iconBg="rgba(52,211,153,0.15)"
            label="Yayınla"
            sub="Okuyucularla paylaş"
            onClick={handlePublish}
          />
        )}

        {draft.status === "published" && (
          <MenuItem
            icon={<EyeOff className="h-4.5 w-4.5 text-orange-400" />}
            iconBg="rgba(251,146,60,0.15)"
            label="Yayından Kaldır"
            sub="Taslağa geri döndür"
            onClick={handleUnpublish}
          />
        )}

        <div className="border-t border-white/8 mt-1">
          <MenuItem
            icon={<Trash2 className="h-4.5 w-4.5 text-rose-400" />}
            iconBg="rgba(251,113,133,0.15)"
            label="Sil"
            sub="Bu içeriği kalıcı sil"
            accent="#fb7185"
            onClick={handleDelete}
          />
        </div>
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
  const [menuOpen, setMenuOpen]         = useState(false);
  const [coverEditOpen, setCoverEditOpen] = useState(false);
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
          <div
            className="relative shrink-0 overflow-hidden rounded-xl"
            style={{ width: 64, height: 92, background: "rgba(109,40,217,0.18)", flexShrink: 0 }}
          >
            {draft.cover
              ? <img src={draft.cover} alt="" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-7 w-7 text-violet-400/40" strokeWidth={1.2} />
                </div>
              )
            }

            {/* ── Şeffaf bant etiketi — h: sabit 18 px ── */}
            {draft.label && (
              <div style={bandStyle(draft.labelPos ?? "mid", 18)}>
                {/* ışıl parıltı */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg,transparent 15%,rgba(255,255,255,0.07) 50%,transparent 85%)",
                  pointerEvents: "none",
                }} />
                <span style={{
                  fontSize: 6,
                  fontWeight: 900,
                  letterSpacing: "0.22em",
                  color: "rgba(255,255,255,0.96)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 58,
                  padding: "0 3px",
                  position: "relative",
                  zIndex: 1,
                }}>
                  {draft.label}
                </span>
              </div>
            )}
          </div>

          {/* Bilgi */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-black text-white leading-tight">
                  {draft.title || "Başlıksız"}
                </p>
                {/* Tür + Durum satırı */}
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[9px] font-black"
                    style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}
                  >
                    {TYPE_LABELS[draft.type] ?? "—"}
                  </span>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[9px] font-black"
                    style={{
                      background: draft.status === "draft" ? "rgba(167,139,250,0.12)" : "rgba(52,211,153,0.12)",
                      color: draft.status === "draft" ? "#a78bfa" : "#34d399",
                      border: `1px solid ${draft.status === "draft" ? "rgba(167,139,250,0.3)" : "rgba(52,211,153,0.3)"}`,
                    }}
                  >
                    {draft.status === "draft" ? "Taslak" : "Yayında"}
                  </span>
                </div>
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

      {/* Bottom sheet menü */}
      {menuOpen && (
        <CardMenu
          draft={draft}
          onClose={() => setMenuOpen(false)}
          onDelete={onDelete}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onRefresh={onRefresh}
          onOpenCoverEdit={() => setCoverEditOpen(true)}
        />
      )}

      {/* Kapak & Etiket düzenleyici */}
      {coverEditOpen && (
        <CoverEditSheet
          draft={draft}
          onClose={() => setCoverEditOpen(false)}
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",       label: "Tümü"      },
    { id: "draft",     label: "Taslaklar" },
    { id: "published", label: "Yayınlar"  },
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
            { label: "Toplam",  val: stats.total     },
            { label: "Taslak",  val: stats.drafts    },
            { label: "Yayında", val: stats.published },
            { label: "Kelime",  val: stats.words > 999 ? `${(stats.words/1000).toFixed(1)}B` : stats.words },
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
