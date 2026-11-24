import { useEffect, useState } from "react";
import { ArrowLeft, Archive as ArchiveIcon, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type StoryArchiveItem = { id: number; mediaUrl: string; mediaType: string; storyText?: string | null; createdAt: string };
type InstantArchiveItem = { id: number; mediaUrl: string; mediaType: string; createdAt: string };
type Highlight = { label: string; imageUrl?: string; likes?: number };
type ArchiveTab = "stories" | "instant" | "highlights";

function getMemoryCaption(createdAt: string) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "Bir Loop anısı";
  const now = new Date();
  const memoryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = Math.max(0, Math.floor((today - memoryDay) / 86_400_000));
  const dateLabel = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  if (date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && date.getFullYear() < now.getFullYear()) {
    return `Tarihte bugün · ${dateLabel}`;
  }
  if (daysAgo === 0) return `Bugünün anısı · ${dateLabel}`;
  if (daysAgo === 1) return `Daha dün gibi · ${dateLabel}`;
  if (daysAgo < 365) return `${daysAgo} gün önce · Anılara dön · ${dateLabel}`;
  const yearsAgo = now.getFullYear() - date.getFullYear();
  if (date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) {
    return `${yearsAgo} yıl önce bugün · ${dateLabel}`;
  }
  return `${yearsAgo} yıl önce · Bir Loop anısı · ${dateLabel}`;
}

export default function Archive() {
  const [, setLocation] = useLocation();
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>("stories");
  const [archivedStories, setArchivedStories] = useState<StoryArchiveItem[]>([]);
  const [archivedInstantShares, setArchivedInstantShares] = useState<InstantArchiveItem[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");

  useEffect(() => {
    try {
      const storedHighlights = JSON.parse(localStorage.getItem("loop_highlights") || "[]");
      setHighlights(Array.isArray(storedHighlights) ? storedHighlights : []);
    } catch {
      setHighlights([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setArchiveLoading(true);
    setArchiveError("");
    Promise.all([
      fetch("/api/stories/archive", { credentials: "include", cache: "no-store" }),
      fetch("/api/dm/instant-shares/archive", { credentials: "include", cache: "no-store" }),
    ]).then(async ([storiesResponse, instantResponse]) => {
      if (!storiesResponse.ok || !instantResponse.ok) throw new Error("Arşivler yüklenemedi");
      const [stories, instantShares] = await Promise.all([storiesResponse.json(), instantResponse.json()]);
      if (!cancelled) {
        setArchivedStories(Array.isArray(stories) ? stories : []);
        setArchivedInstantShares(Array.isArray(instantShares) ? instantShares : []);
      }
    }).catch(error => {
      if (!cancelled) setArchiveError(error instanceof Error ? error.message : "Arşivler yüklenemedi");
    }).finally(() => {
      if (!cancelled) setArchiveLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const removeFromArchive = async (id: number) => {
    const endpoint = `/api/dm/instant-shares/${id}/archive`;
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Arşiv güncellenemedi");
      setArchivedInstantShares(current => current.filter(item => item.id !== id));
      toast.success("Arşivden çıkarıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arşiv güncellenemedi");
    }
  };

  const deleteFromArchive = async (kind: "story" | "instant", id: number) => {
    const description = kind === "story" ? "Bu arşivlenmiş hikaye" : "Bu DM anlık paylaşımı";
    if (!window.confirm(`${description} kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    const endpoint = kind === "story" ? `/api/stories/${id}/archive` : `/api/dm/instant-shares/${id}/archive`;
    try {
      const response = await fetch(endpoint, { method: "DELETE", credentials: "include" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Arşiv kaydı silinemedi");
      if (kind === "story") setArchivedStories(current => current.filter(item => item.id !== id));
      else setArchivedInstantShares(current => current.filter(item => item.id !== id));
      toast.success("Arşivden kalıcı olarak silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arşiv kaydı silinemedi");
    }
  };

  const tabs: Array<{ id: ArchiveTab; label: string }> = [
    { id: "stories", label: "Hikayeler" },
    { id: "instant", label: "DM anlık paylaşımları" },
    { id: "highlights", label: "Öne çıkanlar" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button type="button" onClick={() => setLocation("/settings")} aria-label="Ayarlara dön" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <ArchiveIcon className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Arşiv</h1>
            <p className="text-xs text-muted-foreground">Eski paylaşımların ve anıların</p>
          </div>
        </div>
      </header>

      <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background px-4 py-3" aria-label="Arşiv kategorileri">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setArchiveTab(tab.id)} aria-pressed={archiveTab === tab.id} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${archiveTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {archiveLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Arşiv yükleniyor…</p>
          : archiveError ? <p role="alert" className="py-8 text-center text-sm text-destructive">{archiveError}</p>
          : archiveTab === "stories" ? (archivedStories.length ? <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{archivedStories.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {item.mediaType?.startsWith("video") ? <video src={item.mediaUrl} className="aspect-square w-full object-cover" controls /> : <img src={item.mediaUrl} alt={item.storyText || "Arşivlenmiş hikaye"} className="aspect-square w-full object-cover" />}
            <p className="truncate px-3 pt-3 text-sm font-medium">{item.storyText || "Bir Loop anısı"}</p>
            <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">{getMemoryCaption(item.createdAt)}</p>
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
              <button type="button" onClick={() => void deleteFromArchive("story", item.id)} aria-label="Hikayeyi arşivden kalıcı sil" className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </article>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">Henüz arşivlenmiş hikaye yok.</p>)
          : archiveTab === "instant" ? (archivedInstantShares.length ? <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{archivedInstantShares.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <img src={item.mediaUrl} alt="Arşivlenmiş DM anlık paylaşımı" className="aspect-square w-full object-cover" />
            <p className="px-3 pt-3 text-sm font-medium">Bir DM anısı</p>
            <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">{getMemoryCaption(item.createdAt)}</p>
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
              <button type="button" onClick={() => void removeFromArchive(item.id)} className="text-xs font-semibold text-primary">Arşivden çıkar</button>
              <button type="button" onClick={() => void deleteFromArchive("instant", item.id)} aria-label="Anlık paylaşımı arşivden kalıcı sil" className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </article>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">Henüz arşivlenmiş DM anlık paylaşımı yok.</p>)
          : highlights.length ? <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{highlights.map((item, index) => <article key={`${item.label}-${index}`} className="overflow-hidden rounded-xl border border-border bg-card">{item.imageUrl ? <img src={item.imageUrl} alt={item.label} className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-muted text-2xl">✦</div>}<p className="truncate p-3 text-sm font-semibold">{item.label}</p></article>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">Henüz arşivlenmiş öne çıkan yok.</p>}
      </main>
    </div>
  );
}
