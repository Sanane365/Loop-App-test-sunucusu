import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Save, ChevronRight, ChevronLeft, Plus, X,
  Bold, Italic, Underline, Image as ImageIcon, Film,
  BarChart2, AlignLeft, AlignCenter, AlignRight, Type,
  BookOpen, Tag, Eye, Lock, Users, Trash2, GripVertical,
  CheckCircle2, Circle, Clock, ChevronDown, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { saveDraft, calcWordCount } from "@/lib/draftStore";

/* ── Sabitler ────────────────────────────────────────────────────────── */
const GENRES = [
  "Romantizm","Fantastik","Gerilim","Bilim Kurgu","Tarih",
  "Gizem","Macera","Korku","Komedi","Drama","Şiir","Deneme",
];
const FONTS = [
  { id:"serif",    label:"Klasik",    family:"Georgia, serif",           sample:"Bir varmış bir yokmuş…" },
  { id:"sans",     label:"Modern",    family:"system-ui, sans-serif",    sample:"Bir varmış bir yokmuş…" },
  { id:"mono",     label:"Yazıtipi",  family:"'Courier New', monospace", sample:"Bir varmış bir yokmuş…" },
  { id:"elegant",  label:"Zarif",     family:"'Palatino Linotype', serif",sample:"Bir varmış bir yokmuş…" },
];
const THEMES = [
  { id:"dark",   label:"Gece",    bg:"#0a0814", text:"#e2e8f0", page:"#120e20" },
  { id:"light",  label:"Gündüz", bg:"#f8f7f4", text:"#1a1a2e", page:"#ffffff" },
  { id:"sepia",  label:"Sepya",  bg:"#2d1f0a", text:"#f5e6cc", page:"#1e1508" },
  { id:"forest", label:"Orman",  bg:"#0a1a0f", text:"#d4ead9", page:"#0d2013" },
];
const SIZES = [14,16,18,20,22];
const VISIBILITY_OPTS = [
  { id:"public",    label:"Herkese Açık",  Icon: Eye      },
  { id:"followers", label:"Takipçilerim",  Icon: Users    },
  { id:"private",   label:"Gizli",         Icon: Lock     },
];

/* ── Tip tanımları ──────────────────────────────────────────────────── */
type PollOption = { id: string; text: string };
type BlockType = "text" | "image" | "video" | "poll";
interface Block {
  id: string;
  type: BlockType;
  content: string;      // metin için içerik, image/video için URL, poll için boş
  pollQuestion?: string;
  pollOptions?: PollOption[];
  pollDuration?: number; // saat
}
interface Chapter {
  id: string;
  title: string;
  blocks: Block[];
}

/* ── Yardımcı ────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2);
const newBlock = (type: BlockType = "text"): Block => ({
  id: uid(), type, content: "",
  ...(type === "poll" ? { pollQuestion: "", pollOptions:[{id:uid(),text:""},{id:uid(),text:""}], pollDuration: 24 } : {}),
});
const newChapter = (n: number): Chapter => ({
  id: uid(), title: `Bölüm ${n}`, blocks: [newBlock("text")],
});

/* ── İlerleme göstergesi ─────────────────────────────────────────────── */
const STEPS = ["Kapak & Bilgi","Yazı Stili","Bölümler","Yayınla"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all
            ${i < step ? "bg-violet-500 text-white" : i === step ? "bg-violet-600 text-white ring-2 ring-violet-400/40" : "bg-white/10 text-slate-400"}`}>
            {i < step ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded transition-all ${i < step ? "bg-violet-500" : "bg-white/10"}`} />}
        </div>
      ))}
    </div>
  );
}

/* ── Blok Editörü ────────────────────────────────────────────────────── */
function BlockEditor({
  block, theme, font, size,
  onChange, onDelete, onInsertAfter,
}: {
  block: Block; theme: typeof THEMES[0]; font: typeof FONTS[0];
  size: number;
  onChange: (b: Block) => void;
  onDelete: () => void;
  onInsertAfter: (type: BlockType) => void;
}) {
  const [showInsert, setShowInsert] = useState(false);

  /* Poll blok */
  if (block.type === "poll") {
    const opts = block.pollOptions ?? [];
    return (
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300 uppercase tracking-widest">
            <BarChart2 className="h-3.5 w-3.5" /> Anket
          </span>
          <button type="button" onClick={onDelete} className="text-slate-500 hover:text-rose-400 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <input
          placeholder="Anket sorusu…"
          value={block.pollQuestion ?? ""}
          onChange={e => onChange({ ...block, pollQuestion: e.target.value })}
          className="w-full bg-transparent text-[13px] font-semibold placeholder-slate-500 outline-none border-b border-violet-400/30 pb-2 mb-3"
          style={{ color: theme.text }}
        />
        {opts.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2 mb-2">
            <Circle className="h-3.5 w-3.5 shrink-0 text-violet-400/60" />
            <input
              placeholder={`Seçenek ${i + 1}`}
              value={opt.text}
              onChange={e => onChange({ ...block, pollOptions: opts.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o) })}
              className="flex-1 bg-transparent text-[12px] placeholder-slate-600 outline-none border-b border-white/10 pb-1"
              style={{ color: theme.text }}
            />
            {opts.length > 2 && (
              <button type="button" onClick={() => onChange({ ...block, pollOptions: opts.filter(o => o.id !== opt.id) })}>
                <X className="h-3.5 w-3.5 text-slate-500" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...block, pollOptions: [...opts, { id: uid(), text: "" }] })}
          className="mt-1 flex items-center gap-1 text-[11px] text-violet-400 font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Seçenek ekle
        </button>
        {/* Süre */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400">Süre:</span>
          {[24, 48, 72].map(h => (
            <button
              key={h}
              type="button"
              onClick={() => onChange({ ...block, pollDuration: h })}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors
                ${block.pollDuration === h ? "bg-violet-500 text-white" : "bg-white/10 text-slate-400"}`}
            >{h}s</button>
          ))}
        </div>
      </div>
    );
  }

  /* Görsel blok */
  if (block.type === "image") {
    return (
      <div className="relative rounded-2xl overflow-hidden mb-3 bg-white/5 border border-white/10">
        {block.content
          ? <img src={block.content} alt="" className="w-full max-h-64 object-cover" />
          : (
            <label className="flex flex-col items-center justify-center py-10 cursor-pointer text-slate-400 hover:text-violet-400 transition-colors">
              <ImageIcon className="h-8 w-8 mb-2" />
              <span className="text-[12px] font-semibold">Görsel seç</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onChange({ ...block, content: URL.createObjectURL(f) });
                }} />
            </label>
          )
        }
        <button type="button" onClick={onDelete} className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* Video blok */
  if (block.type === "video") {
    return (
      <div className="relative rounded-2xl overflow-hidden mb-3 bg-white/5 border border-white/10">
        {block.content
          ? <video src={block.content} controls className="w-full max-h-48" />
          : (
            <label className="flex flex-col items-center justify-center py-10 cursor-pointer text-slate-400 hover:text-violet-400 transition-colors">
              <Film className="h-8 w-8 mb-2" />
              <span className="text-[12px] font-semibold">Video seç</span>
              <input type="file" accept="video/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onChange({ ...block, content: URL.createObjectURL(f) });
                }} />
            </label>
          )
        }
        <button type="button" onClick={onDelete} className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* Metin blok */
  return (
    <div className="relative mb-2 group">
      <textarea
        placeholder="Yazmaya başla…"
        value={block.content}
        onChange={e => onChange({ ...block, content: e.target.value })}
        rows={4}
        className="w-full bg-transparent resize-none outline-none leading-relaxed placeholder-slate-600 transition-colors"
        style={{ fontFamily: font.family, fontSize: size, color: theme.text, lineHeight: 1.8 }}
      />
      {/* Ekle menüsü — hover'da görünür */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 mb-2">
        {[
          { type:"text"  as BlockType, Icon: Type,       label:"Metin"  },
          { type:"image" as BlockType, Icon: ImageIcon,  label:"Görsel" },
          { type:"video" as BlockType, Icon: Film,       label:"Video"  },
          { type:"poll"  as BlockType, Icon: BarChart2,  label:"Anket"  },
        ].map(({ type, Icon, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => onInsertAfter(type)}
            className="flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-violet-300 hover:bg-violet-500/15 transition-colors border border-white/8"
          >
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
        <button type="button" onClick={onDelete} className="ml-auto text-slate-600 hover:text-rose-400 transition-colors p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Ana Bileşen ─────────────────────────────────────────────────────── */
export default function MetinHikayesi() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  /* Adım 1 — Kapak & Bilgi */
  const [cover,      setCover]      = useState<string | null>(null);
  const [trailers,   setTrailers]   = useState<(string|null)[]>([null, null]);
  const [title,      setTitle]      = useState("");
  const [subtitle,   setSubtitle]   = useState("");
  const [genres,     setGenres]     = useState<string[]>([]);
  const [synopsis,   setSynopsis]   = useState("");
  const [ageRating,  setAgeRating]  = useState<"all"|"13+"|"18+">("all");

  /* Adım 2 — Yazı Stili */
  const [font,       setFont]       = useState(FONTS[0]);
  const [theme,      setTheme]      = useState(THEMES[0]);
  const [fontSize,   setFontSize]   = useState(16);
  const [textAlign,  setTextAlign]  = useState<"left"|"center"|"right">("left");

  /* Adım 3 — Bölümler */
  const [chapters,   setChapters]   = useState<Chapter[]>([newChapter(1)]);
  const [activeChap, setActiveChap] = useState(0);

  /* Adım 4 — Yayınla */
  const [visibility, setVisibility] = useState("public");
  const [isPremium,  setIsPremium]  = useState(false);
  const [draftId,    setDraftId]    = useState<string | undefined>(undefined);

  const coverRef    = useRef<HTMLInputElement>(null);
  const trailerRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  /* Chapter helpers */
  const updateChapter = useCallback((idx: number, ch: Chapter) => {
    setChapters(prev => prev.map((c, i) => i === idx ? ch : c));
  }, []);

  const insertBlock = useCallback((chapIdx: number, afterBlockIdx: number, type: BlockType) => {
    setChapters(prev => prev.map((ch, ci) => {
      if (ci !== chapIdx) return ch;
      const blocks = [...ch.blocks];
      blocks.splice(afterBlockIdx + 1, 0, newBlock(type));
      return { ...ch, blocks };
    }));
  }, []);

  const deleteBlock = useCallback((chapIdx: number, blockId: string) => {
    setChapters(prev => prev.map((ch, ci) => {
      if (ci !== chapIdx) return ch;
      const blocks = ch.blocks.filter(b => b.id !== blockId);
      return { ...ch, blocks: blocks.length ? blocks : [newBlock("text")] };
    }));
  }, []);

  const handleSave = useCallback((status: "draft" | "published" = "draft") => {
    const saved = saveDraft({
      id:         draftId,
      type:       "metin",
      status,
      title,
      subtitle,
      cover,
      trailers,
      genres,
      synopsis,
      ageRating,
      fontId:     font.id,
      themeId:    theme.id,
      fontSize,
      textAlign,
      chapters,
      wordCount:  calcWordCount(chapters),
    });
    setDraftId(saved.id);
    toast.success(
      status === "published" ? "Yayınlandı! 🎉" : "Taslak kaydedildi 💾",
      { description: title || "Başlıksız", duration: 2500 }
    );
    return saved;
  }, [draftId, title, subtitle, cover, trailers, genres, synopsis, ageRating, font, theme, fontSize, textAlign, chapters]);

  /* ── ADIM 1: Kapak & Bilgi ─────────────────────────────────────────── */
  const renderStep0 = () => (
    <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-5">
      {/* Kapak */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Kitap Kapağı</p>
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-violet-400/30 hover:border-violet-400/60 transition-colors"
          style={{ aspectRatio: "2/3", background: "rgba(109,40,217,0.07)" }}
        >
          {cover
            ? <img src={cover} alt="Kapak" className="w-full h-full object-cover" />
            : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-violet-400/60">
                <BookOpen className="h-12 w-12" strokeWidth={1.2} />
                <span className="text-[12px] font-semibold">Kapak fotoğrafı seç</span>
                <span className="text-[10px] text-slate-500">Önerilen: 600 × 900 px</span>
              </div>
            )
          }
          {cover && (
            <div className="absolute inset-0 flex items-end justify-center pb-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-[11px] text-white font-bold">Değiştir</span>
            </div>
          )}
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) setCover(URL.createObjectURL(f)); }} />
      </div>

      {/* Fragmanlar */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Fragman Videoları</p>
        <div className="grid grid-cols-2 gap-3">
          {trailers.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => trailerRefs[i].current?.click()}
              className="relative overflow-hidden rounded-xl border border-dashed border-violet-400/25 hover:border-violet-400/50 transition-colors"
              style={{ aspectRatio: "9/16", background: "rgba(109,40,217,0.07)" }}
            >
              {t
                ? <video src={t} className="w-full h-full object-cover" />
                : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Film className="h-8 w-8" strokeWidth={1.2} />
                    <span className="text-[10px] font-semibold">Fragman {i + 1}</span>
                  </div>
                )
              }
              {t && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setTrailers(prev => prev.map((v, j) => j === i ? null : v)); }}
                  className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </button>
          ))}
        </div>
        {trailers.map((_, i) => (
          <input key={i} ref={trailerRefs[i]} type="file" accept="video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setTrailers(prev => prev.map((v, j) => j === i ? URL.createObjectURL(f) : v)); }} />
        ))}
      </div>

      {/* Başlık */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Kitap Bilgileri</p>
        <input
          placeholder="Kitap başlığı *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] font-bold placeholder-slate-600 outline-none focus:border-violet-400/60 transition-colors mb-2"
        />
        <input
          placeholder="Alt başlık (opsiyonel)"
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[13px] placeholder-slate-600 outline-none focus:border-violet-400/60 transition-colors"
        />
      </div>

      {/* Tür */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Tür <span className="text-slate-500 normal-case tracking-normal font-normal">(en fazla 3)</span></p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map(g => {
            const active = genres.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  if (active) setGenres(prev => prev.filter(x => x !== g));
                  else if (genres.length < 3) setGenres(prev => [...prev, g]);
                }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-all ${active ? "bg-violet-500 border-violet-400 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:border-violet-400/40"}`}
              >{g}</button>
            );
          })}
        </div>
      </div>

      {/* Yaş sınırı */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Yaş Sınırı</p>
        <div className="flex gap-2">
          {(["all","13+","18+"] as const).map(r => (
            <button key={r} type="button" onClick={() => setAgeRating(r)}
              className={`flex-1 rounded-xl py-2 text-[12px] font-bold border transition-all ${ageRating === r ? "bg-violet-500 border-violet-400 text-white" : "bg-white/5 border-white/10 text-slate-400"}`}>
              {r === "all" ? "Genel" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Özet */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Özet / Sinopsis</p>
        <textarea
          placeholder="Kitabınızın kısa özetini yazın… Okuyucuların merakını uyandırsın."
          value={synopsis}
          onChange={e => setSynopsis(e.target.value)}
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-white placeholder-slate-600 outline-none focus:border-violet-400/60 transition-colors resize-none"
        />
      </div>
    </div>
  );

  /* ── ADIM 2: Yazı Stili ─────────────────────────────────────────────── */
  const renderStep1 = () => (
    <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-6">
      {/* Font */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Yazı Fontu</p>
        <div className="space-y-2">
          {FONTS.map(f => (
            <button key={f.id} type="button" onClick={() => setFont(f)}
              className={`w-full rounded-xl p-4 text-left border transition-all ${font.id === f.id ? "bg-violet-500/15 border-violet-400/60" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black text-violet-300 uppercase tracking-widest">{f.label}</span>
                {font.id === f.id && <CheckCircle2 className="h-4 w-4 text-violet-400" />}
              </div>
              <span className="text-[15px] text-slate-300" style={{ fontFamily: f.family }}>{f.sample}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Yazı boyutu */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Yazı Boyutu</p>
        <div className="flex items-center gap-3">
          {SIZES.map(s => (
            <button key={s} type="button" onClick={() => setFontSize(s)}
              className={`flex-1 rounded-xl py-2.5 text-center border transition-all ${fontSize === s ? "bg-violet-500 border-violet-400 text-white font-bold" : "bg-white/5 border-white/10 text-slate-400"}`}
              style={{ fontSize: Math.max(10, s - 3) }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Hizalama */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Metin Hizalama</p>
        <div className="flex gap-2">
          {([["left","Sol",AlignLeft],["center","Orta",AlignCenter],["right","Sağ",AlignRight]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTextAlign(id)}
              className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-all ${textAlign === id ? "bg-violet-500/20 border-violet-400/60 text-violet-300" : "bg-white/5 border-white/10 text-slate-500"}`}>
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tema */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Okuma Teması</p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map(t => (
            <button key={t.id} type="button" onClick={() => setTheme(t)}
              className={`rounded-xl p-4 border transition-all ${theme.id === t.id ? "border-violet-400/70" : "border-white/10"}`}
              style={{ background: t.page }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.text, opacity: 0.6 }}>{t.label}</span>
                {theme.id === t.id && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />}
              </div>
              <p className="text-[12px] leading-snug" style={{ fontFamily: font.family, color: t.text }}>
                Bir varmış bir yokmuş, çok eski bir zamanda…
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Canlı önizleme */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Canlı Önizleme</p>
        <div className="rounded-2xl p-5 border border-white/10" style={{ background: theme.page }}>
          <p style={{ fontFamily: font.family, fontSize, color: theme.text, lineHeight: 1.8, textAlign }}>
            Bahar geldiğinde, Elif her sabah balkona çıkar ve şehrin üzerine çöken sis tabakasını izlerdi. Bugün de aynıydı — ama bir şey farklıydı. Kapıda bir mektup bulmak onu içten içe heyecanlandırdı.
          </p>
        </div>
      </div>
    </div>
  );

  /* ── ADIM 3: Bölümler & Editör ──────────────────────────────────────── */
  const renderStep2 = () => {
    const ch = chapters[activeChap];
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Bölüm sekmeler */}
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide shrink-0 border-b border-white/8">
          {chapters.map((c, i) => (
            <button key={c.id} type="button" onClick={() => setActiveChap(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all whitespace-nowrap ${activeChap === i ? "bg-violet-500 border-violet-400 text-white" : "bg-white/5 border-white/10 text-slate-400"}`}>
              {c.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const n = newChapter(chapters.length + 1);
              setChapters(prev => [...prev, n]);
              setActiveChap(chapters.length);
            }}
            className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-violet-400 border border-dashed border-violet-400/40 hover:border-violet-400/70 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Bölüm
          </button>
        </div>

        {/* Bölüm başlığı */}
        <div className="px-4 pt-3 pb-1 shrink-0 border-b border-white/8">
          <input
            value={ch.title}
            onChange={e => updateChapter(activeChap, { ...ch, title: e.target.value })}
            className="w-full bg-transparent text-[18px] font-black text-white outline-none placeholder-slate-600"
            placeholder="Bölüm başlığı…"
          />
        </div>

        {/* Bloklar */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32"
          style={{ background: theme.bg }}>
          {ch.blocks.map((block, bi) => (
            <BlockEditor
              key={block.id}
              block={block}
              theme={theme}
              font={font}
              size={fontSize}
              onChange={newBlock => updateChapter(activeChap, {
                ...ch, blocks: ch.blocks.map(b => b.id === newBlock.id ? newBlock : b),
              })}
              onDelete={() => deleteBlock(activeChap, block.id)}
              onInsertAfter={type => insertBlock(activeChap, bi, type)}
            />
          ))}

          {/* Boşsa başla mesajı */}
          {ch.blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <Sparkles className="h-8 w-8 mb-3" />
              <p className="text-[13px] font-semibold">Yazmaya başla…</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── ADIM 4: Yayınla ────────────────────────────────────────────────── */
  const renderStep3 = () => (
    <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-5">
      {/* Özet kartı */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex gap-4 p-4">
          {cover
            ? <img src={cover} alt="" className="h-20 w-14 rounded-xl object-cover" />
            : <div className="h-20 w-14 rounded-xl bg-violet-500/20 flex items-center justify-center"><BookOpen className="h-7 w-7 text-violet-400" /></div>
          }
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black text-white leading-tight">{title || "Başlıksız Kitap"}</p>
            {subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {genres.map(g => (
                <span key={g} className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">{g}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/8 px-4 py-2 flex items-center gap-4 text-[11px] text-slate-400">
          <span>{chapters.length} bölüm</span>
          <span>·</span>
          <span>{chapters.reduce((acc, c) => acc + c.blocks.filter(b => b.type === "text").reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0), 0)} kelime</span>
          <span>·</span>
          <span>{ageRating === "all" ? "Genel" : ageRating} izin</span>
        </div>
      </div>

      {/* Görünürlük */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Görünürlük</p>
        <div className="space-y-2">
          {VISIBILITY_OPTS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setVisibility(id)}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${visibility === id ? "bg-violet-500/15 border-violet-400/60" : "bg-white/5 border-white/10"}`}>
              <Icon className={`h-4 w-4 ${visibility === id ? "text-violet-400" : "text-slate-500"}`} />
              <span className={`text-[13px] font-semibold ${visibility === id ? "text-white" : "text-slate-400"}`}>{label}</span>
              {visibility === id && <CheckCircle2 className="ml-auto h-4 w-4 text-violet-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Premium */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-3">Erişim Tipi</p>
        <div className="flex gap-2">
          {[
            { id: false, label: "Ücretsiz",  sub: "Herkes okuyabilir" },
            { id: true,  label: "Premium",   sub: "Abonelere özel" },
          ].map(opt => (
            <button key={String(opt.id)} type="button" onClick={() => setIsPremium(opt.id)}
              className={`flex-1 rounded-xl p-4 border text-left transition-all ${isPremium === opt.id ? "bg-violet-500/15 border-violet-400/60" : "bg-white/5 border-white/10"}`}>
              <p className={`text-[13px] font-bold ${isPremium === opt.id ? "text-violet-300" : "text-slate-300"}`}>{opt.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Yayınla butonu */}
      <button
        type="button"
        onClick={() => { handleSave("published"); setTimeout(() => setLocation("/notebook/calismalari"), 1200); }}
        className="w-full rounded-2xl py-4 font-black text-[15px] text-white transition-all active:scale-95"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7,#7c3aed)", boxShadow: "0 8px 32px rgba(124,58,237,0.4)" }}
      >
        🚀 Yayınla
      </button>

      <button
        type="button"
        onClick={() => handleSave("draft")}
        className="w-full rounded-2xl py-3.5 font-bold text-[14px] text-violet-300 border border-violet-400/30 hover:border-violet-400/60 transition-colors"
      >
        Taslak Olarak Kaydet
      </button>
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];
  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#0a0814" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-1 shrink-0">
        <button type="button" onClick={() => canPrev ? setStep(s => s - 1) : history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5 transition-colors">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-black text-white tracking-tight">Metin Hikayesi</p>
          <p className="text-[10px] text-slate-500 -mt-0.5">{STEPS[step]}</p>
        </div>
        <button type="button" onClick={() => handleSave("draft")}
          className="flex h-9 items-center gap-1.5 rounded-full bg-violet-500/20 px-3 text-violet-300 text-[12px] font-bold hover:bg-violet-500/30 transition-colors">
          <Save className="h-3.5 w-3.5" /> Kaydet
        </button>
      </div>

      {/* Adım çubuğu */}
      <StepBar step={step} />

      {/* İçerik */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {steps[step]()}
      </div>

      {/* Alt navigasyon */}
      {step !== 2 && (
        <div className="fixed bottom-0 inset-x-0 px-4 pb-8 pt-3 shrink-0 border-t border-white/8"
          style={{ background: "linear-gradient(to top,#0a0814 70%,transparent)" }}>
          <div className="flex gap-3">
            {canPrev && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex-1 rounded-2xl py-3.5 text-[14px] font-bold text-violet-300 border border-violet-400/30">
                <ChevronLeft className="inline h-4 w-4 -mt-0.5" /> Geri
              </button>
            )}
            {canNext && (
              <button type="button" onClick={() => setStep(s => s + 1)}
                className="flex-1 rounded-2xl py-3.5 text-[14px] font-bold text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                İleri <ChevronRight className="inline h-4 w-4 -mt-0.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editörde sabit kaydet + format toolbar */}
      {step === 2 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-white/8"
          style={{ background: "rgba(10,8,20,0.97)", backdropFilter: "blur(14px)" }}>
          {/* Satır 1 — format + ekle butonları (yatay kaydırma) */}
          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 overflow-x-auto scrollbar-hide">
            {/* Format */}
            {([
              [Bold,      "Kalın"      ],
              [Italic,    "İtalik"     ],
              [Underline, "Altı Çizili"],
            ] as const).map(([Icon, label]: any) => (
              <button key={label} type="button"
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 transition-colors">
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <div className="shrink-0 w-px h-5 bg-white/15 mx-0.5" />
            {/* Ekle */}
            {([
              [ImageIcon, "Görsel", "image" as BlockType, "#34d399"],
              [Film,      "Video",  "video" as BlockType, "#f59e0b"],
              [BarChart2, "Anket",  "poll"  as BlockType, "#a78bfa"],
            ] as const).map(([Icon, label, type, color]: any) => (
              <button key={label} type="button"
                onClick={() => insertBlock(activeChap, chapters[activeChap].blocks.length - 1, type)}
                className="shrink-0 flex items-center gap-1.5 h-8 rounded-lg px-2.5 text-[11px] font-bold border transition-colors"
                style={{ background: `${color}12`, borderColor: `${color}30`, color }}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          {/* Satır 2 — Kaydet butonu */}
          <div className="px-3 pb-5 pt-1">
            <button type="button" onClick={() => handleSave("draft")}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-[13px] font-black text-white active:scale-95 transition-all">
              <Save className="h-4 w-4" /> Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
