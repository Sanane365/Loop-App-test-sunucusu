import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Loader2, RefreshCw } from "lucide-react";

interface GifResult {
  id: string;
  url: string;
  preview: string;
  tags: string[];
}

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { id: "trending", label: "Trend", emoji: "🔥", tag: null },
  { id: "güldüm", label: "Komik", emoji: "😂", tag: "güldüm" },
  { id: "alkış", label: "Alkış", emoji: "👏", tag: "alkış" },
  { id: "dans", label: "Dans", emoji: "💃", tag: "dans" },
  { id: "aşk", label: "Aşk", emoji: "❤️", tag: "aşk" },
  { id: "şaşırdım", label: "Şaşkın", emoji: "🤯", tag: "şaşırdım" },
  { id: "sinirli", label: "Sinirli", emoji: "😠", tag: "sinirli" },
  { id: "üzgün", label: "Üzgün", emoji: "😢", tag: "üzgün" },
  { id: "evet", label: "Evet", emoji: "👍", tag: "evet" },
  { id: "hayır", label: "Hayır", emoji: "👎", tag: "hayır" },
  { id: "kedi", label: "Kedi", emoji: "🐱", tag: "kedi" },
  { id: "köpek", label: "Köpek", emoji: "🐶", tag: "köpek" },
  { id: "harika", label: "Harika", emoji: "✨", tag: "harika" },
  { id: "düşünüyor", label: "Hmm", emoji: "🤔", tag: "düşünüyor" },
  { id: "bekliyorum", label: "Bekliyorum", emoji: "⏳", tag: "bekliyorum" },
];

export default function GifPicker({ onSelect, onClose }: Props) {
  const [activeCat, setActiveCat] = useState("trending");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchGifs = useCallback(async (q: string, tag: string | null) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(false);

    try {
      let url: string;
      if (q.trim()) {
        url = `/api/gif/search?q=${encodeURIComponent(q.trim())}&limit=28`;
      } else if (tag) {
        url = `/api/gif/category/${encodeURIComponent(tag)}?limit=28`;
      } else {
        url = `/api/gif/trending?limit=28`;
      }

      const res = await fetch(url, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: GifResult[] = await res.json();
      setGifs(data);
      setFailed(new Set()); // reset failed set on new results
    } catch (e: any) {
      if (e.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // When category changes
  useEffect(() => {
    if (query.trim()) return; // search overrides category
    const cat = CATEGORIES.find(c => c.id === activeCat);
    fetchGifs("", cat?.tag ?? null);
  }, [activeCat, fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      const cat = CATEGORIES.find(c => c.id === activeCat);
      fetchGifs("", cat?.tag ?? null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchGifs(query, null);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGifs, activeCat]);

  const handleError = (id: string) =>
    setFailed(prev => new Set(prev).add(id));

  const visibleGifs = gifs.filter(g => !failed.has(g.id));

  return (
    <div
      className="border-t border-border bg-background flex flex-col"
      style={{ height: 340 }}
    >
      {/* Header: search + close */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="GIF ara…"
            autoFocus
            className="w-full h-8 pl-8 pr-8 rounded-full text-sm bg-muted/60 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : loading ? (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground animate-spin" />
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Category tabs — hidden when searching */}
      {!query.trim() && (
        <div
          className="flex gap-1 px-3 pb-2 overflow-x-auto flex-shrink-0"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeCat === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-muted-foreground">GIF yüklenemedi</p>
            <button
              onClick={() => {
                const cat = CATEGORIES.find(c => c.id === activeCat);
                fetchGifs(query, cat?.tag ?? null);
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Tekrar dene
            </button>
          </div>
        ) : visibleGifs.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">
              {query.trim() ? `"${query}" için sonuç bulunamadı` : "Yükleniyor…"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {visibleGifs.map(gif => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif.url)}
                className="aspect-square rounded-xl overflow-hidden bg-muted hover:opacity-80 active:scale-95 transition-all"
              >
                <img
                  src={gif.preview}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleError(gif.id)}
                />
              </button>
            ))}
            {/* Loading overlay when refreshing */}
            {loading && visibleGifs.length > 0 && (
              <div className="col-span-4 flex justify-center py-1">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[9px] text-muted-foreground text-right px-3 pb-1.5 flex-shrink-0 opacity-60">
        Giphy
      </p>
    </div>
  );
}
