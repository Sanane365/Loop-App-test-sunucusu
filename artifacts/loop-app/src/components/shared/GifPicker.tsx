import { useState, useMemo, useRef } from "react";
import { X, Search } from "lucide-react";
import {
  GIF_CATEGORIES,
  gifUrl,
  gifPreview,
  searchGifs,
  type GifItem,
} from "@/data/gif-kit";

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: Props) {
  const [activeCat, setActiveCat] = useState(GIF_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const displayGifs = useMemo<GifItem[]>(() => {
    if (query.trim()) return searchGifs(query, 60);
    const cat = GIF_CATEGORIES.find((c) => c.id === activeCat);
    return cat?.gifs ?? [];
  }, [query, activeCat]);

  const handleError = (id: string) =>
    setFailed((prev) => new Set(prev).add(id));

  const visibleGifs = displayGifs.filter((g) => !failed.has(g.id));

  return (
    <div className="border-t border-border bg-background flex flex-col" style={{ maxHeight: 340 }}>
      {/* Header: search + close */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="GIF ara…"
            autoFocus
            className="w-full h-8 pl-8 pr-3 rounded-full text-sm bg-muted/60 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
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
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto flex-shrink-0 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {GIF_CATEGORIES.map((cat) => (
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
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {visibleGifs.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">
            {query ? "Sonuç bulunamadı" : "Yükleniyor…"}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {visibleGifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gifUrl(gif.id))}
                className="aspect-square rounded-xl overflow-hidden bg-muted hover:opacity-80 active:scale-95 transition-all"
              >
                <img
                  src={gifPreview(gif.id)}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleError(gif.id)}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[9px] text-muted-foreground text-right px-3 pb-1.5 flex-shrink-0">
        Giphy tarafından desteklenmektedir
      </p>
    </div>
  );
}
