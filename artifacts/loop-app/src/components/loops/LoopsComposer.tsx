import {
  AtSign,
  Eye,
  Hash,
  Link as LinkIcon,
  MapPin,
  Maximize2,
  Mic,
  MoreHorizontal,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export function LoopsComposer({
  files,
  title,
  caption,
  tags,
  audio,
  uploading,
  progress,
  onTitleChange,
  onCaptionChange,
  onTagsChange,
  onAudioChange,
  onPublish,
  onChooseVideo,
  onClose,
}: {
  files: File[];
  title: string;
  caption: string;
  tags: string;
  audio: string;
  uploading: boolean;
  progress: number;
  onTitleChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onAudioChange: (value: string) => void;
  onPublish: () => void;
  onChooseVideo: () => void;
  onClose: () => void;
}) {
  const focusField = (id: string) => document.getElementById(id)?.focus();
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ tag: string; posts: number }>>([]);
  const [tagsFocused, setTagsFocused] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const file = files[0] ?? null;
  const previewFile = files[previewIndex] ?? file;
  const previewUrl = previewUrls[previewIndex];
  const previewIsVideo = previewFile?.type.startsWith("video/") ?? false;
  const currentTag = tags.match(/(?:^|\s)#([^\s#]*)$/)?.[1] ?? "";

  useEffect(() => {
    const urls = files.map((item) => URL.createObjectURL(item));
    setPreviewUrls(urls);
    setPreviewIndex(0);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    if (!tagsFocused || !tags.includes("#")) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/loop/tags?q=${encodeURIComponent(currentTag)}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : []))
        .then((suggestions: Array<{ tag: string; posts: number }>) => setTagSuggestions(suggestions))
        .catch(() => setTagSuggestions([]));
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentTag, tags, tagsFocused]);

  const selectTag = (tag: string) => {
    const nextTags = tags.replace(/(?:^|\s)#([^\s#]*)$/, (match) => `${match.startsWith(" ") ? " " : ""}${tag} `);
    onTagsChange(nextTags.trimStart());
    setTagsFocused(false);
    window.setTimeout(() => focusField("loop-tags"), 0);
  };

  const startHashtag = () => {
    const nextTags = tags.trimEnd();
    onTagsChange(`${nextTags}${nextTags ? " " : ""}#`);
    window.setTimeout(() => focusField("loop-tags"), 0);
    setTagsFocused(true);
  };

  return (
    <section className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-left shadow-[0_24px_80px_rgba(33,24,92,0.2)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 text-slate-900">
        <button type="button" onClick={onClose} aria-label="Düzenlemeyi kapat" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2 text-sm font-extrabold"><img src="/loop-logo.svg" alt="Loop" className="h-7 w-7 rounded-lg object-cover" /><span>Loop oluştur</span></div>
        <button type="button" aria-label="Önizleme" className="flex items-center gap-2 rounded-full border border-indigo-100 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50"><Eye className="h-4 w-4" /><span className="hidden sm:inline">Önizleme</span></button>
      </div>
      {!file ? (
        <button type="button" onClick={onChooseVideo} className="m-5 flex w-[calc(100%-2.5rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 px-5 py-12 text-center text-indigo-700 transition-colors hover:bg-indigo-100">
          <Upload className="mb-3 h-8 w-8" />
          <strong className="text-sm">Fotoğraf veya video seç</strong>
          <span className="mt-1 text-xs text-slate-500">Birden fazla fotoğraf seçerek kaydırmalı Loop oluşturabilirsin</span>
        </button>
      ) : (
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-6">
            <div className="group relative aspect-video max-h-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner md:aspect-auto md:min-h-[20rem]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.2),transparent_58%)]" />
              {previewIsVideo ? (
                <video src={previewUrl} muted playsInline controls preload="metadata" className="relative z-10 h-full w-full object-contain" aria-label={`Loop video önizlemesi ${previewIndex + 1}`} />
              ) : (
                <img src={previewUrl} alt={`Loop fotoğraf önizlemesi ${previewIndex + 1}`} className="relative z-10 h-full w-full object-contain" />
              )}
              <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between">
                <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-700 shadow-sm">{previewIsVideo ? "Video önizlemesi" : "Fotoğraf önizlemesi"}</span>
                <span className="rounded-full bg-slate-950/70 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm">Loop</span>
              </div>
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2">
                <span className="max-w-[70%] truncate rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[10px] text-white backdrop-blur-sm">{previewFile?.name}</span>
                <button type="button" aria-label={previewIsVideo ? "Videoyu büyüt" : "Fotoğrafı büyüt"} className="pointer-events-auto rounded-full bg-white/95 p-2 text-slate-700 shadow transition-transform hover:scale-105"><Maximize2 className="h-4 w-4" /></button>
              </div>
              {files.length > 1 && (
                <div className="absolute inset-x-3 bottom-14 z-20 flex items-center justify-center gap-2 rounded-full bg-slate-950/65 px-3 py-2 backdrop-blur-sm" role="group" aria-label="Loop fotoğrafları">
                  {files.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      aria-label={`${index + 1}. Loop medyasını göster`}
                      aria-current={previewIndex === index ? "true" : undefined}
                      onClick={() => setPreviewIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${previewIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                    />
                  ))}
                  <span className="rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-bold text-white">{previewIndex + 1}/{files.length}</span>
                </div>
              )}
              <button type="button" onClick={onChooseVideo} className="absolute left-3 top-12 z-20 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100">Medyayı değiştir</button>
            </div>
            <div className="flex min-w-0 min-h-full flex-col">
              <label className="block"><span className="sr-only">Loop başlığı</span><input id="loop-title" value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Loop başlığını yaz" className="w-full border-0 border-b border-slate-200 px-1 py-3 text-lg font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500" autoFocus /></label>
              <label className="mt-3 block flex-1"><span className="sr-only">Loop açıklaması</span><textarea id="loop-caption" value={caption} onChange={(event) => onCaptionChange(event.target.value)} placeholder="Aklında ne var?" rows={5} maxLength={3000} className="h-full min-h-[11rem] w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 sm:px-4 sm:py-4 sm:text-base sm:leading-7" /></label>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400 sm:text-xs"><span>{caption.length}/3000</span><span className="hidden sm:inline">Uzun açıklamalar daha fazla görüntülenebilir</span></div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
                <button type="button" aria-label="Ses ekle" onClick={() => focusField("loop-audio")} className="rounded-xl p-3 text-indigo-700 hover:bg-white"><Mic className="h-5 w-5" /></button>
                <button type="button" aria-label="Hashtag ekle" onClick={startHashtag} className="rounded-xl p-3 text-indigo-700 hover:bg-white"><Hash className="h-5 w-5" /></button>
                <button type="button" aria-label="Kullanıcı etiketle" onClick={() => focusField("loop-caption")} className="rounded-xl p-3 text-indigo-700 hover:bg-white"><AtSign className="h-5 w-5" /></button>
                <button type="button" aria-label="Efekt ekle" className="rounded-xl p-3 text-indigo-700 hover:bg-white"><Sparkles className="h-5 w-5" /></button>
                <button type="button" aria-label="Daha fazla araç" className="ml-auto rounded-xl p-3 text-indigo-700 hover:bg-white"><MoreHorizontal className="h-5 w-5" /></button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="relative">
                  <input id="loop-tags" value={tags} onFocus={() => setTagsFocused(true)} onBlur={() => window.setTimeout(() => setTagsFocused(false), 150)} onKeyDown={(event) => { if (event.key === "Enter" && tagSuggestions[0]) { event.preventDefault(); selectTag(tagSuggestions[0].tag); } }} onChange={(event) => { onTagsChange(event.target.value); setTagsFocused(true); }} placeholder="#etiket ekle" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400" />
                  {tagsFocused && tags.includes("#") && tagSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                      {tagSuggestions.map((suggestion) => (
                        <button type="button" key={suggestion.tag} onMouseDown={(event) => event.preventDefault()} onClick={() => selectTag(suggestion.tag)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-indigo-50">
                          <span className="font-bold text-slate-800">{suggestion.tag}</span>
                          <span className="text-xs text-slate-400">{suggestion.posts.toLocaleString("tr-TR")} gönderi</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative"><Volume2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="loop-audio" value={audio} onChange={(event) => onAudioChange(event.target.value)} placeholder="Müzik / ses adı" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-indigo-400" /><span className="absolute -right-1 -top-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">Yakında</span></div>
              </div>
            </div>
          </div>
          <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
            {[{ icon: SlidersHorizontal, label: "İçerik açıklaması ve reklamlar", comingSoon: true }, { icon: MapPin, label: "Konum" }, { icon: LinkIcon, label: "Bağlantı ekle" }, { icon: Eye, label: "Bu Loop'u herkes görüntüleyebilir" }, { icon: MoreHorizontal, label: "Daha fazla seçenek" }].map(({ icon: Icon, label, comingSoon }) => <button type="button" key={label} className="flex w-full items-center gap-3 px-3 py-3 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 sm:px-4 sm:py-4 sm:text-sm"><Icon className="h-5 w-5 shrink-0 text-indigo-600" /><span>{label}</span>{comingSoon && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">Yakında</span>}<span className="ml-auto text-xl font-normal text-slate-400">›</span></button>)}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={uploading} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo-50 px-5 py-3 font-bold text-indigo-700 hover:bg-indigo-100"><Save className="h-5 w-5" /> Taslaklar</button><button type="button" disabled={uploading || !title.trim()} onClick={onPublish} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-5 py-3 font-black text-white shadow-lg shadow-indigo-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-5 w-5" />{uploading ? `Yükleniyor · ${progress}%` : "Paylaş"}</button></div>
          {uploading && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-500 transition-[width] duration-150" style={{ width: `${progress}%` }} /></div>}
        </div>
      )}
    </section>
  );
}
