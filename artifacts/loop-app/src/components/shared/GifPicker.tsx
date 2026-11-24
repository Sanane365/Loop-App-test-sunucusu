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
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const queryRef = useRef("");
  const activeCatRef = useRef("trending");

  const fetchGifs = useCallback(async (q: string, tag: string | null, append = false) => {
    const currentRequestId = ++requestIdRef.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!append) {
      offsetRef.current = 0;
      setGifs([]);
      setFailed(new Set());
    }

    if (append) loadingMoreRef.current = true;
    setLoading(true);
    setError(false);

    try {
      let url: string;
      const nextOffset = append ? offsetRef.current + 28 : 0;

      if (q.trim()) {
        url = `/api/gif/search?q=${encodeURIComponent(q.trim())}&limit=28&offset=${nextOffset}`;
      } else if (tag) {
        url = `/api/gif/category/${encodeURIComponent(tag)}?limit=28&offset=${nextOffset}`;
      } else {
        url = `/api/gif/trending?limit=28&offset=${nextOffset}`;
      }

      const res = await fetch(url, {
        signal: abortRef.current.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const data: GifResult[] = await res.json();
      if (currentRequestId !== requestIdRef.current) return;

      offsetRef.current = append ? offsetRef.current + data.length : 0;

      setGifs(current => {
        if (!append) return data;
        const existingIds = new Set(current.map(gif => gif.id));
        return [...current, ...data.filter(gif => !existingIds.has(gif.id))];
      });
      setFailed(new Set());
    } catch (e: any) {
      if (currentRequestId === requestIdRef.current && e.name !== "AbortError") setError(true);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        loadingMoreRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setGifs([]);
      setError(false);
      setFailed(new Set());
      offsetRef.current = 0;
      return;
    }

    debounceRef.current = setTimeout(() => {
      void fetchGifs(query, null);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGifs]);

  useEffect(() => {
    queryRef.current = query;
    activeCatRef.current = activeCat;
  }, [activeCat, query]);

  useEffect(() => {
    void fetchGifs("", null);
    const refresh = window.setInterval(() => {
      if (!queryRef.current.trim() && activeCatRef.current === "trending") void fetchGifs("", null);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(refresh);
  }, [fetchGifs]);

  const handleError = (id: string) => setFailed(prev => new Set(prev).add(id));

  const visibleGifs = gifs.filter(gif => !failed.has(gif.id));

  const loadCategory = (categoryId: string) => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    setActiveCat(categoryId);
    setQuery("");
    setError(false);
    offsetRef.current = 0;
    setGifs([]);
    void fetchGifs("", category?.tag ?? null);
  };

  return (
    <div
      className="border-t border-border bg-background flex flex-col"
      style={{ height: 340 }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
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

      {!query.trim() && (
        <div
          className="flex gap-1 px-3 pb-2 overflow-x-auto flex-shrink-0"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => loadCategory(cat.id)}
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

      <div
        className="flex-1 overflow-y-auto px-3 pb-3 min-h-0"
        onScroll={event => {
          const element = event.currentTarget;
          if (
            element.scrollHeight - element.scrollTop - element.clientHeight < 120 &&
            !loading &&
            !loadingMoreRef.current &&
            visibleGifs.length >= 20
          ) {
            const category = CATEGORIES.find(c => c.id === activeCat);
            void fetchGifs(query, query.trim() ? null : category?.tag ?? null, true);
          }
        }}
      >
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-muted-foreground">GIF yüklenemedi</p>
            <button
              type="button"
              onClick={() => {
                const category = CATEGORIES.find(c => c.id === activeCat);
                void fetchGifs(query, query.trim() ? null : category?.tag ?? null);
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Tekrar dene
            </button>
          </div>
        ) : visibleGifs.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">
              {query.trim() ? `"${query}" için sonuç bulunamadı` : "Kategori seçin veya GIF ara…"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {visibleGifs.map(gif => (
              <button
                key={gif.id}
                type="button"
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
            {loading && visibleGifs.length > 0 && (
              <div className="col-span-4 flex justify-center py-1">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground text-right px-3 pb-1.5 flex-shrink-0 opacity-60">
        Giphy
      </p>
    </div>
  );
}
