import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  ArrowLeft, BookOpen, Trash2, Send, FileText,
  Clock, Hash, Layers,
  Search, Plus, PenLine, BookOpen as BookEdit, EyeOff,
  ImagePlus, Tag, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllDrafts, deleteDraft, publishDraft, unpublishDraft,
  updateDraftCoverAndLabel,
  type Draft,
  type ProgressStatus,
} from "@/lib/draftStore";
import { useAuth } from "@/lib/auth";

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
function CoverEditSheet({ draft, onClose, onRefresh, canEditLabel }: {
  draft: Draft;
  onClose: () => void;
  onRefresh: () => void;
  canEditLabel: boolean;
}) {
  const [cover, setCover]       = useState<string | null>(draft.cover);
  const [label, setLabel]       = useState(draft.label ?? "");
  const [labelPos, setLabelPos] = useState<"top" | "mid" | "bottom">(draft.labelPos ?? "mid");
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>(draft.progressStatus ?? "ongoing");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCover(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateDraftCoverAndLabel(draft.id, cover, canEditLabel ? label.trim() : draft.label ?? "", labelPos, progressStatus);
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
            {canEditLabel ? <input
                value={label}
                onChange={e => setLabel(e.target.value.slice(0, 40))}
                placeholder='ör. "Breaking Point Serisi"'
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 text-[13px] text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-colors"
              /> : <p className="rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3.5 text-[11px] text-amber-300">Test aşamasında: Etiket alanı yalnızca adminler için açık.</p>}
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

          <div>
            <p className="mb-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">Kitap Durumu</p>
            <div className="grid grid-cols-2 gap-2">
              {([ ["ongoing", "Devam ediyor"], ["completed", "Bitti"] ] as const).map(([value, text]) => (
                <button key={value} type="button" onClick={() => setProgressStatus(value)} className={`rounded-2xl py-3 text-[12px] font-bold ${progressStatus === value ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400"}`}>{text}</button>
              ))}
            </div>
          </div>

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
  const { user } = useAuth();
  const canEditLabel = user?.role === "admin";

  const go = (path: string) => { onClose(); setLocation(path); };

  const handleDelete = () => {
    onDelete(draft.id);
    toast.error("Silindi", { icon: "🗑" });
    onClose();
    onRefresh();
  };

  const handlePublish = () => {
    onPublish(draft.id);
    toast.success("Yayınlandı! 🎉 Kitaplara eklendi.");
    onClose();
    onRefresh();
    // Yayınlanan kitabı hemen göster
    setTimeout(() => go("/kitaplar"), 900);
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
          sub={canEditLabel ? "Kapak fotoğrafı ve şeffaf bant" : "Kapak fotoğrafı · Etiket test aşamasında"}
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
  const { user } = useAuth();
  const canEditLabel = user?.role === "admin";

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
                  <span className="inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black text-slate-400">
                    {draft.progressStatus === "completed" ? "Bitti" : "Devam ediyor"}
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
          canEditLabel={canEditLabel}
        />
      )}
    </>
  );
}

/* ── Ana sayfa ───────────────────────────────────────────────────────── */
type Tab = "all" | "draft" | "published";

type Universe = {
  id?: string;
  title: string;
  description: string;
  color: string;
  gallery: string[];
};

const UNIVERSES_KEY = "loop_my_universes_v1";

const DEFAULT_UNIVERSES: Universe[] = [
  { title: "Geceye Kalanlar", description: "Sessiz şehirlerde saklanan sırların ve cesur başlangıçların evreni.", color: "from-indigo-950 via-slate-900 to-cyan-950", gallery: ["https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=80"] },
  { title: "Kayıp Haritalar", description: "Her yolculuğun yeni bir kapı açtığı keşif evreni.", color: "from-emerald-950 via-slate-900 to-teal-950", gallery: ["https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80"] },
];

function readUniverses(): Universe[] {
  try {
    const saved = JSON.parse(localStorage.getItem(UNIVERSES_KEY) || "null");
    return Array.isArray(saved) ? saved.filter((item: Universe) => !DEFAULT_UNIVERSES.some(defaultUniverse => defaultUniverse.title === item.title)) : [];
  } catch { return []; }
}

function UniverseCreateSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (universe: Universe) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);

  const addImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || gallery.length >= 3) return;
    const reader = new FileReader();
    reader.onload = () => setGallery(items => [...items, String(reader.result)].slice(0, 3));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const create = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim(), color: "from-violet-950 via-slate-900 to-cyan-950", gallery });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-[#16122a] p-5 text-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Kendi evrenin</p><h2 className="mt-1 text-xl font-black">Evren kartı oluştur</h2></div><button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button></div>
        <div className="mt-5 space-y-3">
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Evren adı" maxLength={80} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
          <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Evrenini anlat..." maxLength={240} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {gallery.map((image, index) => <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-xl"><img src={image} alt={`Yeni evren görseli ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setGallery(items => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Görseli sil" className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-rose-300"><X className="h-3 w-3" /></button></div>)}
          {gallery.length < 3 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/40 bg-cyan-400/5 text-cyan-200"><ImagePlus className="h-6 w-6" /><span className="mt-1 text-[10px] font-bold">Görsel ekle</span><input type="file" accept="image/*" className="hidden" onChange={addImage} /></label>}
        </div>
        <button type="button" disabled={!title.trim()} onClick={create} className="mt-5 w-full rounded-xl bg-cyan-400 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Kartı oluştur</button>
      </div>
    </div>
  );
}

function UniverseEditSheet({ universe, onClose, onSave }: { universe: Universe; onClose: () => void; onSave: (universe: Universe) => void }) {
  const [gallery, setGallery] = useState(universe.gallery.slice(0, 3));

  const addImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || gallery.length >= 3) return;
    const reader = new FileReader();
    reader.onload = () => setGallery(items => [...items, String(reader.result)].slice(0, 3));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-[#16122a] p-5 text-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Evrenlerim</p><h2 className="mt-1 text-xl font-black">{universe.title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Loop anlatı haritası kartında görünecek görselleri seç.</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {gallery.map((image, index) => (
            <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
              <img src={image} alt={`${universe.title} ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setGallery(items => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Görseli sil" className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-rose-300"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {gallery.length < 3 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/40 bg-cyan-400/5 text-cyan-200">
              <ImagePlus className="h-6 w-6" /><span className="mt-1 text-[10px] font-bold">Görsel ekle</span>
              <input type="file" accept="image/*" className="hidden" onChange={addImage} />
            </label>
          )}
        </div>
        <p className="mt-3 text-[10px] text-slate-500">{gallery.length}/3 görsel seçildi</p>
        <button type="button" onClick={() => onSave({ ...universe, gallery })} className="mt-5 w-full rounded-xl bg-cyan-400 py-3 text-sm font-black text-slate-950">Görselleri kaydet</button>
      </div>
    </div>
  );
}

export default function Calismalari() {
  const search     = useSearch();
  const initTab    = new URLSearchParams(search).get("tab");
  const initialTab: Tab | "universes" = initTab === "universes" ? "universes" : (initTab as Tab | null) ?? "all";
  const [tab, setTab]       = useState<Tab | "universes">(initialTab);
  const [universes, setUniverses] = useState<Universe[]>(() => readUniverses());
  const [selectedUniverse, setSelectedUniverse] = useState<Universe | null>(null);
  const [createUniverseOpen, setCreateUniverseOpen] = useState(false);
  const universePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [query, setQuery]   = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { user } = useAuth();
  const isPremiumUser = user?.role === "admin";

  const load = useCallback(async () => {
    const localDrafts = getAllDrafts();
    setDrafts(localDrafts);
    try {
      const response = await fetch("/api/books", { credentials: "include", cache: "no-store" });
      const remoteBooks = response.ok ? await response.json() : [];
      const merged = localDrafts.map(draft => {
        const remote = Array.isArray(remoteBooks) ? remoteBooks.find((book: Draft) => book.id === draft.id) : null;
        return remote
          ? { ...draft, cover: draft.cover ?? remote.cover, trailers: draft.trailers.some(Boolean) ? draft.trailers : (remote.trailers ?? draft.trailers) }
          : draft;
      });
      setDrafts(merged);
    } catch {
      setDrafts(localDrafts);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",       label: "Tümü"      },
    { id: "draft",     label: "Taslaklar" },
    { id: "published", label: "Yayınlar"  },
  ];

  const saveUniverse = (universe: Universe) => {
    const next = universes.map(item => item.title === universe.title ? universe : item);
    setUniverses(next);
    localStorage.setItem(UNIVERSES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("loop-universes-updated"));
    setSelectedUniverse(null);
    toast.success("Evren görselleri kaydedildi ✓");
  };

  const deleteUniverse = async (universe: Universe) => {
    if (!window.confirm(`"${universe.title}" evreni silinsin mi?`)) return;
    if (universe.id) {
      const response = await fetch(`/api/universes/${encodeURIComponent(universe.id)}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) { toast.error("Evren silinemedi"); return; }
    }
    const next = universes.filter(item => item.id ? item.id !== universe.id : item.title !== universe.title);
    setUniverses(next);
    localStorage.setItem(UNIVERSES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("loop-universes-updated"));
    toast.success("Evren silindi");
  };

  const createUniverse = async (universe: Universe) => {
    const next = [...universes, universe];
    setUniverses(next);
    localStorage.setItem(UNIVERSES_KEY, JSON.stringify(next));
    const response = await fetch("/api/universes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(universe) });
    if (!response.ok) { toast.error("Evren ortak alana kaydedilemedi"); return; }
    window.dispatchEvent(new Event("loop-universes-updated"));
    setCreateUniverseOpen(false);
    toast.success("Kendi evren kartın oluşturuldu ✓");
  };

  const startUniversePress = (universe: Universe) => {
    universePressTimer.current = setTimeout(() => setSelectedUniverse(universe), 550);
  };
  const cancelUniversePress = () => {
    if (universePressTimer.current) clearTimeout(universePressTimer.current);
    universePressTimer.current = null;
  };

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
          {[...TABS, { id: "universes" as const, label: "Evrenlerim" }].map(t => (
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
      {tab === "universes" ? (
        <div className="grid flex-1 gap-4 px-4 pt-4 sm:grid-cols-2">
          <button type="button" onClick={() => setCreateUniverseOpen(true)} className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-cyan-300/40 bg-cyan-400/5 text-cyan-200 transition hover:bg-cyan-400/10">
            <Plus className="h-8 w-8" /><span className="mt-2 text-sm font-black">Kendi evren kartını oluştur</span><span className="mt-1 text-[10px] text-cyan-200/60">En fazla 3 görsel ekleyebilirsin</span>
          </button>
          {universes.map(universe => (
            <article key={universe.id ?? universe.title} onPointerDown={() => startUniversePress(universe)} onPointerUp={cancelUniversePress} onPointerLeave={cancelUniversePress} onPointerCancel={cancelUniversePress} className={`relative min-h-56 overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${universe.color} p-5 text-white shadow-lg`}>
              {universe.gallery[0] && <img src={universe.gallery[0]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <button type="button" onClick={(event) => { event.stopPropagation(); void deleteUniverse(universe); }} aria-label={`${universe.title} evrenini sil`} className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-rose-200 transition hover:bg-rose-500/80 hover:text-white"><Trash2 className="h-4 w-4" /></button>
              <div className="relative flex h-full min-h-48 flex-col justify-end">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-200">Loop anlatı haritası</p>
                <h2 className="mt-1 text-xl font-black">{universe.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-white/70">{universe.description}</p>
                <p className="mt-3 text-[10px] font-bold text-cyan-200">Basılı tut: görselleri düzenle · {universe.gallery.length}/3</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
      <div className="flex-1 px-4 pt-4 space-y-3">
        {filtered.length === 0
          ? <Empty tab={tab} />
          : filtered.map(d => (
            <DraftCard
              key={d.id}
              draft={d}
              onDelete={id => { deleteDraft(id); }}
              onPublish={id => { publishDraft(id, isPremiumUser); }}
              onUnpublish={id => { unpublishDraft(id); }}
              onRefresh={load}
            />
          ))
        }
      </div>
      )}
      {selectedUniverse && <UniverseEditSheet universe={selectedUniverse} onClose={() => setSelectedUniverse(null)} onSave={saveUniverse} />}
      {createUniverseOpen && <UniverseCreateSheet onClose={() => setCreateUniverseOpen(false)} onCreate={createUniverse} />}
    </div>
  );
}
