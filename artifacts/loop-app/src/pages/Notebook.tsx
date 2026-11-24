import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowRight, Bell, BookOpen, Bookmark, ChevronDown, ChevronUp, Eye, Globe2, GitBranch, Heart, Home, Images, ImagePlus, MapPin, MoreVertical, Pen, Play, Search, Sparkles, Star, Trash2, UserPlus, Users, Vote, X, Volume2, VolumeX } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useEffect, useRef } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { PostCard } from "@/components/shared/PostCard";
import { getListPostsQueryKey, useListPosts } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { BOOK_GENRES, GENRE_ICONS } from "@/data/genres";

const READING_PROGRESS_KEY = "loop_reading_progress_v3";
const LIBRARY_SAVED_KEY = "loop_library_saved_v1";
const LIBRARY_LIKED_KEY = "loop_library_liked_v1";
const LIBRARY_ENTRY_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

type LibraryEntry = { id: string; savedAt: string; book: Record<string, unknown> };

function readLibraryEntries(key: string): LibraryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

type InteractiveStory = {
  id: string;
  title: string;
  summary?: string;
  eventTitle: string;
  eventText: string;
  cover?: string;
  status?: "ongoing" | "completed";
  votes?: Record<string, number>;
  options: Array<{ id: string; label: string; nextStepId?: string | null }>;
  steps?: Array<{ id: string; title: string; text: string; options: Array<{ id: string; label: string; nextStepId?: string | null }> }>;
};

function normalizeMediaUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (url.startsWith("data:image/")) return url.replace(/\s+/g, "");
  return url;
}

function InteractiveShelf({ story }: { story: InteractiveStory }) {
  const steps = story.steps?.length ? story.steps : [{ id: "step-1", title: story.eventTitle, text: story.eventText, options: story.options }];
  const [stepId, setStepId] = useState(steps[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>(story.votes ?? {});
  const [customOption, setCustomOption] = useState("");
  const [voting, setVoting] = useState(false);
  const step = steps.find(item => item.id === stepId) ?? steps[0];

  const choose = async (option: { id: string; nextStepId?: string | null }) => {
    if (voting || selected === `${step.id}:${option.id}` || selected?.startsWith(`${step.id}:`)) return;
    const selectionKey = `${step.id}:${option.id}`;
    setSelected(selectionKey);
    setVoting(true);
    const response = await fetch(`/api/interactive-stories/${story.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: option.id, stepId: step.id }),
    }).catch(() => null);
    if (response?.ok || response?.status === 409) {
      const data = await response.json().catch(() => null);
      if (data?.votes) setVotes(data.votes);
    }
    setVoting(false);
    if (option.nextStepId && steps.some(item => item.id === option.nextStepId)) setStepId(option.nextStepId);
  };

  const addCustomOption = async () => {
    const label = customOption.trim();
    if (!label) return;
    const response = await fetch(`/api/interactive-stories/${story.id}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, stepId: step.id }),
    }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json().catch(() => null);
    if (data?.option) {
      step.options.push(data.option);
      setVotes(data.votes ?? votes);
      setCustomOption("");
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-950/50 via-slate-950 to-violet-950/50 shadow-[0_18px_55px_rgba(8,47,73,0.2)]">
      {story.cover && <button type="button" onClick={() => setReaderOpen(true)} className="block w-full"><img src={story.cover} alt={`${story.title} kapağı`} className="h-32 w-full object-cover opacity-80 transition hover:opacity-100" /></button>}
      <div className="p-4">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/75"><GitBranch className="h-3.5 w-3.5" /> Seçimli hikâye · {story.status === "completed" ? "Tamamlandı" : "Devam ediyor"}</div>
        <button type="button" onClick={() => setReaderOpen(true)} className="mt-1 text-left text-lg font-black text-white transition hover:text-cyan-200">{story.title}</button>
        {story.summary && <p className="mt-1 text-xs leading-5 text-slate-400">{story.summary}</p>}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200"><Vote className="h-3.5 w-3.5" />{step.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{step.text}</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {step.options.map((option, index) => <button key={option.id} type="button" onClick={() => void choose(option)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${selected === `${step.id}:${option.id}` ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40"}`}><span className="mr-2 text-cyan-300/70">{String.fromCharCode(65 + index)}</span>{option.label}<span className="float-right text-[10px] text-cyan-300/60">{votes[option.id] ?? 0}</span></button>)}
        </div>
        {selected && <p className="mt-3 text-[11px] font-semibold text-cyan-100/75">Seçimin kaydedildi.</p>}
        <button type="button" onClick={() => setReaderOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20"><BookOpen className="h-3.5 w-3.5" /> Hikâyeyi görüntüle ve oku <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {readerOpen && (
        <div className="fixed inset-0 z-50 bg-[#0d111b] text-white" role="dialog" aria-modal="true" aria-label={`${story.title} hikâye okuyucu`} onClick={() => setReaderOpen(false)}>
          <div className="flex h-full w-full flex-col overflow-hidden" onClick={event => event.stopPropagation()}>
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-12 sm:px-8">
              <div><p className="text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">Loop interaktif kitaplık</p><h2 className="mt-1 text-lg font-black">{story.title}</h2></div>
              <button type="button" onClick={() => setReaderOpen(false)} aria-label="Okuyucuyu kapat" className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white">Kapat</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-32 pt-8 sm:px-10 sm:pt-10">
              <div className="mx-auto max-w-2xl">
                {story.cover && <img src={story.cover} alt="" className="mb-7 h-48 w-full rounded-xl object-cover opacity-80 sm:h-64" />}
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">Bölüm {steps.findIndex(item => item.id === step.id) + 1} / {steps.length}</p>
                <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">{step.title}</h3>
                <p className="mt-5 whitespace-pre-wrap text-[15px] leading-8 text-slate-200 sm:text-base">{step.text}</p>
                <div className="mt-8 border-t border-white/10 pt-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-200">Kararını ver</p><div className="grid gap-2">{step.options.map((option, index) => <button key={option.id} type="button" onClick={() => void choose(option)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${selected === `${step.id}:${option.id}` ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40"}`}><span className="mr-2 text-cyan-300/70">{String.fromCharCode(65 + index)}.</span>{option.label}<span className="float-right text-xs text-cyan-300/60">{votes[option.id] ?? 0} oy</span></button>)}</div><div className="mt-4 flex gap-2"><input value={customOption} onChange={event => setCustomOption(event.target.value)} placeholder="Kendi seçeneğini ekle" maxLength={160} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50" /><button type="button" onClick={() => void addCustomOption()} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100">Ekle</button></div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

const librarySummary = {
  title: "Loop Kitaplık",
  subtitle: "Kitap yazma ve okuma deneyimini tek bir profesyonel panelde birleştirin.",
  stats: [
    { label: "Aktif Proje", value: "Derin Mesafe" },
    { label: "Tamamlanan Bölümler", value: "8/12" },
    { label: "Okuma Süresi", value: "15 saat" },
  ],
};

type PerformanceInsight = { label: string; value: string; progress: number };

function formatMetric(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return String(value);
}

type LaunchStatus = "Devam ediyor" | "Planlandı" | "Hazır";

type LaunchPipelineItem = {
  id: string;
  title: string;
  description: string;
  status: LaunchStatus;
  note?: string;
};

type LaunchNote = {
  id: string;
  text: string;
  createdAt: string;
};

const defaultLaunchPreparation: LaunchPipelineItem[] = [
  { id: "chapter-draft", title: "Bölüm taslağı", description: "Son bölümü tamamla, olay akışını sıkılaştır ve yayın öncesi son metin kontrolünü yap.", status: "Devam ediyor" },
  { id: "cover", title: "Kapak hazırlığı", description: "Kapak görselini, başlığı ve yazar bilgisini kontrol et; mobil ve masaüstü görünümünü doğrula.", status: "Planlandı" },
  { id: "ok-reading-list", title: "OK okuma listesi", description: "OK okuma listesine eklenmek için kitap bilgilerini ve kısa tanıtım metnini tamamla.", status: "Planlandı" },
  { id: "reader-comments", title: "Okuyucu yorumlarını gör", description: "Gelen okuyucu yorumlarını incele, yanıtlanması gerekenleri işaretle ve geri bildirimleri son okumaya taşı.", status: "Hazır" },
  { id: "launch-copy", title: "Tanıtım metni", description: "Kitabın atmosferini anlatan kısa duyuru metnini, etiketlerini ve paylaşım görselini hazırla.", status: "Planlandı" },
  { id: "final-check", title: "Son okuma ve yayın kontrolü", description: "Bölümler, kapak, görünürlük, kategori ve yayın tarihini kontrol ederek lansmana hazırla.", status: "Planlandı" },
];

const featuredAuthors = [
  { name: "Hülya_Aslıkc", role: "Yerel yazar", bio: "Gözle görülmeyeni kalemle çiziyorum. Yarım kalan kitapların ve yeni başlangıçların yazarı.", genre: "Romantizm", stories: "10", followers: "9.1K", city: "İstanbul", accent: "from-fuchsia-950 via-slate-900 to-cyan-950", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80" },
  { name: "İrem Uslu", role: "Yerel yazar", bio: "Duygusal karşılaşmaları ve ikinci şansları sade, güçlü karakterlerle anlatıyor.", genre: "Romantizm", stories: "8", followers: "7.4K", city: "İzmir", accent: "from-amber-950 via-slate-900 to-rose-950", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=80" },
  { name: "Uygar Y.", role: "Yerel yazar", bio: "Büyüme sancılarını, dostluğu ve hayata tutunma hikâyelerini yazıyor.", genre: "Genç Yetişkin", stories: "12", followers: "6.8K", city: "Ankara", accent: "from-blue-950 via-slate-900 to-violet-950", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80" },
  { name: "Ece Y.", role: "Yerel yazar", bio: "Gökyüzü, eski haritalar ve başka dünyalar arasında yeni yollar açıyor.", genre: "Fantastik", stories: "6", followers: "5.2K", city: "Antalya", accent: "from-emerald-950 via-slate-900 to-sky-950", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80" },
  { name: "Deniz K.", role: "Yerel yazar", bio: "Sessiz mekânların içindeki sırları ve beklenmedik dönüşleri keşfediyor.", genre: "Gerilim", stories: "10", followers: "4.7K", city: "Bursa", accent: "from-red-950 via-slate-900 to-orange-950", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80" },
];

type LoopUniverse = { id?: string; authorId?: number; title: string; description: string; mood: string; stories: string; color: string; author: string; authorAvatar?: string | null; cover: string; gallery: string[] };
const loopUniverses: LoopUniverse[] = [];

function TrailerPlayer({
  src,
  orientation = "horizontal",
  loop = false,
  onEnded,
}: {
  src: string;
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const playVideo = () => {
      if (!video.paused) return;
      void video.play().catch(() => {});
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        playVideo();
      } else {
        video.pause();
      }
    }, { threshold: 0 });
    observer.observe(video);
    video.addEventListener("canplay", playVideo);
    return () => {
      observer.disconnect();
      video.removeEventListener("canplay", playVideo);
    };
  }, []);

  const toggleSound = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    void video.play().catch(() => {});
  };

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full bg-black object-contain"
        muted
        autoPlay
        playsInline
        preload="auto"
        loop={loop}
        onEnded={onEnded}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? "Fragman sesini aç" : "Fragman sesini kapat"}
        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 active:scale-90"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AuthorBookRow({ title, books }: { title: string; books: Array<{ id: string; title?: string; cover?: string | null; author?: string; genre?: string; rating?: { likeCount?: number } }> }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300">{title}</p>
        <span className="text-[10px] text-slate-500">{books.length} kitap</span>
      </div>
      {books.length === 0 ? <p className="mt-3 text-xs text-slate-500">Bu alanda henüz kitap yok.</p> : (
        <div className="scrollbar-hide mt-3 flex flex-nowrap gap-3 overflow-x-auto pb-2">
          {books.map(book => (
            <Link key={book.id} href={`/kitap/${book.id}`} className="w-28 flex-none snap-start sm:w-32">
              <div className="h-40 overflow-hidden rounded-xl bg-white/10 shadow-lg sm:h-44">
                {book.cover ? <img src={book.cover} alt={book.title || "Kitap"} className="h-full w-full object-cover transition hover:scale-105" /> : <div className="flex h-full items-center justify-center text-3xl">📖</div>}
              </div>
              <p className="mt-2 truncate text-xs font-bold text-white">{book.title || "Başlıksız"}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{book.genre || "Kitap"} · {book.rating?.likeCount ?? 0} beğeni</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WriteBook() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const searchParams = new URLSearchParams(search);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"books" | "users">("books");
  const [showStats, setShowStats] = useState(true);
  const [showStudioDetails, setShowStudioDetails] = useState(false);
  const [showStudio, setShowStudio] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [premiumIndex, setPremiumIndex] = useState(0);
  const [activeTrailerIndex, setActiveTrailerIndex] = useState(0);
  const [showPremiumMedia, setShowPremiumMedia] = useState(false);
  const [galleryDraft, setGalleryDraft] = useState<Array<{ url: string; name: string }>>([]);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [launchPreparation, setLaunchPreparation] = useState<LaunchPipelineItem[]>(() => {
    try {
      const stored = localStorage.getItem("loop_launch_preparation_v1");
      return stored ? JSON.parse(stored) as LaunchPipelineItem[] : [];
    } catch {
      return [];
    }
  });
  const [launchNotes, setLaunchNotes] = useState<LaunchNote[]>(() => {
    try {
      const stored = localStorage.getItem("loop_launch_notes_v1");
      return stored ? JSON.parse(stored) as LaunchNote[] : [];
    } catch {
      return [];
    }
  });
  const [launchQuestion, setLaunchQuestion] = useState("");
  const [showLaunchPreparationForm, setShowLaunchPreparationForm] = useState(false);
  const [currentTab, setCurrentTab] = useState("books");
  const [flowFilter, setFlowFilter] = useState<"tumu" | "kitaplar" | "fragmanlar" | "kose-yazilari" | "mikro-oyku">("kitaplar");
  // Auto-advance and touch/swipe controls for premium area
  const premiumAreaRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const pausedUntilRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const PAUSE_AFTER_MANUAL_MS = 10000;
  const PAUSE_AFTER_BACK_SWIPE_MS = 20000;
  const [showPerformance, setShowPerformance] = useState(true);
  const [, refreshReadingProgress] = useState(0);
  const [shelfCategory, setShelfCategory] = useState("Tümü");
  const [selectedUniverse, setSelectedUniverse] = useState<LoopUniverse | null>(null);
  const [realUniverses, setRealUniverses] = useState<LoopUniverse[]>([]);
  const [liveLoopCount, setLiveLoopCount] = useState(0);
  const [latestLoop, setLatestLoop] = useState<{ title?: string; mediaUrl?: string; mediaType?: string } | null>(null);
  const [libraryView, setLibraryView] = useState<"shelves" | "new" | "liked">("shelves");
  const [, refreshLibrary] = useState(0);
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [catSearchMode, setCatSearchMode] = useState<"books" | "authors">("books");
  const universePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUniverses = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("loop_my_universes_v1") || "[]") as Array<Partial<LoopUniverse>>;
        const localUniverses = saved.filter(universe => universe.title && Array.isArray(universe.gallery)).map(universe => ({
          title: universe.title!,
          description: universe.description || "Loop evreni",
          mood: universe.mood || "Loop evreni",
          stories: universe.stories || "0 öykü",
          color: universe.color || "from-slate-950 via-slate-900 to-cyan-950",
          author: universe.author || (universe.authorId === user?.id ? user?.displayName || user?.username : "") || "Loop yazarı",
          authorAvatar: universe.authorAvatar || (universe.authorId === user?.id ? user?.avatarUrl : "") || "",
          cover: universe.cover || universe.gallery![0] || "",
          gallery: universe.gallery as string[],
        }));
        setRealUniverses(current => current.length > 0 ? current : localUniverses);
        fetch("/api/universes", { cache: "no-store" }).then(response => response.ok ? response.json() : []).then(async (remote: LoopUniverse[]) => {
          if (Array.isArray(remote) && remote.length > 0) {
            setRealUniverses(remote.map(universe => ({
              ...universe,
              cover: universe.cover || universe.gallery?.[0] || "",
              gallery: Array.isArray(universe.gallery) ? universe.gallery.filter(Boolean) : [],
            })));
            return;
          }
          if (localUniverses.length > 0 && !localStorage.getItem("loop_universes_migrated_v1")) {
            await Promise.all(localUniverses.map(universe => fetch("/api/universes", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(universe) })));
            localStorage.setItem("loop_universes_migrated_v1", "1");
          }
        }).catch(() => {});
      } catch {
        setRealUniverses([]);
      }
    };
    loadUniverses();
    const interval = window.setInterval(loadUniverses, 5000);
    window.addEventListener("storage", loadUniverses);
    window.addEventListener("loop-universes-updated", loadUniverses);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", loadUniverses);
      window.removeEventListener("loop-universes-updated", loadUniverses);
    };
  }, []);

  useEffect(() => {
    const loadLoopSummary = () => fetch("/api/loop/photos", { cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then((loops: Array<{ title?: string; mediaUrl?: string; mediaType?: string }>) => {
        setLiveLoopCount(loops.length);
        setLatestLoop(loops[0] ?? null);
      })
      .catch(() => {});
    void loadLoopSummary();
    const interval = window.setInterval(loadLoopSummary, 10000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: flowPosts, isLoading: flowPostsLoading } = useListPosts(undefined, {
    query: { queryKey: getListPostsQueryKey(), enabled: currentTab === "akis" },
  });
  const { data: flowBookPosts, isLoading: flowBookPostsLoading } = useListPosts(
    { postType: "book" },
    { query: { queryKey: getListPostsQueryKey({ postType: "book" } as any), enabled: currentTab === "akis" && flowFilter === "kitaplar" } },
  );
  const { data: flowTrailerPosts } = useListPosts(
    { postType: "trailer" } as any,
    { query: { queryKey: getListPostsQueryKey({ postType: "trailer" } as any), enabled: currentTab === "akis" && flowFilter === "fragmanlar" } },
  );
  const { data: flowColumnPosts } = useListPosts(
    { postType: "column" } as any,
    { query: { queryKey: getListPostsQueryKey({ postType: "column" } as any), enabled: currentTab === "akis" && flowFilter === "kose-yazilari" } },
  );
  const { data: flowMicroPosts } = useListPosts(
    { postType: "micro" } as any,
    { query: { queryKey: getListPostsQueryKey({ postType: "micro" } as any), enabled: currentTab === "akis" && flowFilter === "mikro-oyku" } },
  );

  useEffect(() => {
    const syncLibrary = () => {
      const cutoff = Date.now() - LIBRARY_ENTRY_MAX_AGE;
      const current = readLibraryEntries(LIBRARY_SAVED_KEY);
      const fresh = current.filter(entry => Date.parse(entry.savedAt) >= cutoff);
      if (fresh.length !== current.length) localStorage.setItem(LIBRARY_SAVED_KEY, JSON.stringify(fresh));
      refreshLibrary(value => value + 1);
    };
    syncLibrary();
    window.addEventListener("loop-library-updated", syncLibrary);
    const interval = window.setInterval(syncLibrary, 60 * 60 * 1000);
    return () => {
      window.removeEventListener("loop-library-updated", syncLibrary);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const loadLaunchPreparation = () => {
      try {
        const stored = localStorage.getItem("loop_launch_preparation_v1");
        setLaunchPreparation(stored ? JSON.parse(stored) as LaunchPipelineItem[] : []);
        const notes = localStorage.getItem("loop_launch_notes_v1");
        setLaunchNotes(notes ? JSON.parse(notes) as LaunchNote[] : []);
      } catch {
        setLaunchPreparation([]);
      }
    };
    const handleLaunchPreparationUpdate = () => loadLaunchPreparation();
    window.addEventListener("storage", handleLaunchPreparationUpdate);
    window.addEventListener("loop-launch-preparation-updated", handleLaunchPreparationUpdate);
    const interval = window.setInterval(loadLaunchPreparation, 5000);
    return () => {
      window.removeEventListener("storage", handleLaunchPreparationUpdate);
      window.removeEventListener("loop-launch-preparation-updated", handleLaunchPreparationUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const addLaunchPreparation = () => {
    const next = defaultLaunchPreparation.map(item => ({ ...item }));
    setLaunchPreparation(next);
    localStorage.setItem("loop_launch_preparation_v1", JSON.stringify(next));
    window.dispatchEvent(new Event("loop-launch-preparation-updated"));
    setShowLaunchPreparationForm(false);
  };

  const saveLaunchQuestion = () => {
    const text = launchQuestion.trim();
    if (!text) return;
    const next = [{ id: `${Date.now()}`, text, createdAt: new Date().toISOString() }, ...launchNotes];
    setLaunchNotes(next);
    localStorage.setItem("loop_launch_notes_v1", JSON.stringify(next));
    window.dispatchEvent(new Event("loop-launch-preparation-updated"));
    setLaunchQuestion("");
  };

  const updateLaunchItem = (id: string, changes: Partial<LaunchPipelineItem>) => {
    const next = launchPreparation.map(item => item.id === id ? { ...item, ...changes } : item);
    setLaunchPreparation(next);
    localStorage.setItem("loop_launch_preparation_v1", JSON.stringify(next));
    window.dispatchEvent(new Event("loop-launch-preparation-updated"));
  };

  const removeLaunchPreparation = () => {
    setLaunchPreparation([]);
    setLaunchNotes([]);
    localStorage.removeItem("loop_launch_preparation_v1");
    localStorage.removeItem("loop_launch_notes_v1");
    window.dispatchEvent(new Event("loop-launch-preparation-updated"));
  };

  useEffect(() => {
    const refresh = () => refreshReadingProgress(value => value + 1);
    window.addEventListener("loop-reading-progress", refresh);
    return () => window.removeEventListener("loop-reading-progress", refresh);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (showPremiumMedia) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showPremiumMedia]);

  // ── Gerçek yayınlanan kitaplar — ortak API + yerel geri dönüş ────────
  const [remotePublished, setRemotePublished] = useState<any[]>([]);
  const [remoteAuthors, setRemoteAuthors] = useState<any[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<any | null>(null);
  const [profileStats, setProfileStats] = useState({ followerCount: 0 });
  const [interactiveStories, setInteractiveStories] = useState<InteractiveStory[]>([]);
  const [authorBio, setAuthorBio] = useState("");

  useEffect(() => {
    const loadInteractiveStories = () => fetch("/api/interactive-stories", { cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => setInteractiveStories(Array.isArray(data) ? data : []))
      .catch(() => setInteractiveStories([]));
    void loadInteractiveStories();
    const interval = window.setInterval(loadInteractiveStories, 10000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadAuthors = () => fetch("/api/users", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => setRemoteAuthors(Array.isArray(data) ? data : []))
      .catch(() => setRemoteAuthors([]));
    void loadAuthors();
    const interval = window.setInterval(loadAuthors, 10000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadPublishedBooks = () => fetch("/api/books", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => {
        const books = Array.isArray(data) ? data : [];
        setRemotePublished(current => {
          const previousById = new Map(current.map(book => [book.id, book]));
          return books.map(book => ({
            ...previousById.get(book.id),
            ...book,
          }));
        });
        void Promise.all(books.filter((book: any) => book.isPremiumAuthor).map(async (book: any) => {
          try {
            const response = await fetch(`/api/books/${book.id}`, { credentials: "include", cache: "no-store" });
            return response.ok ? await response.json() : null;
          } catch { return null; }
        })).then(details => {
          const detailMap = new Map(details.filter(Boolean).map((book: any) => [book.id, book]));
          if (detailMap.size === 0) return;
          setRemotePublished(current => current.map(book => detailMap.get(book.id) ? { ...book, ...detailMap.get(book.id) } : book));
        });
      })
      .catch(() => setRemotePublished([]));
    void loadPublishedBooks();
    const interval = window.setInterval(() => { void loadPublishedBooks(); }, 10000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const loadProfileStats = () => fetch("/api/users/me/profile", { credentials: "include" })
      .then(response => response.ok ? response.json() : null)
      .then(profile => {
        setAuthorBio(profile?.authorBio ?? "");
        setProfileStats({ followerCount: Number(profile?.followerCount ?? 0) });
      })
      .catch(() => undefined);
    void loadProfileStats();
    const interval = window.setInterval(loadProfileStats, 10000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  const _published: Array<{
    id: string; title: string; cover?: string | null;
    trailers?: (string | null)[]; trailerOrientations?: ("horizontal" | "vertical")[]; isPremiumAuthor?: boolean;
    genres?: string[]; wordCount?: number; chapters?: unknown[];
    synopsis?: string; updatedAt: string; authorId?: number;
    chapterCount?: number;
    progressStatus?: "ongoing" | "completed";
    author?: { id?: number; displayName?: string; avatarUrl?: string | null } | null;
    viewCount?: number; rating?: { average?: number; likeCount?: number };
  }> = (() => {
    let local: any[] = [];
    try {
      const raw = localStorage.getItem("loop_drafts_v1");
      local = raw ? (JSON.parse(raw) as any[]).filter(d => d.status === "published") : [];
    } catch { /* use remote books */ }
    return [...remotePublished, ...local.filter(localBook => !remotePublished.some(remoteBook => remoteBook.id === localBook.id))]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  })();

  // Tür → yayınlanan kitap sayısı (gerçek sayaç)
  const _genreCount: Record<string, number> = {};
  for (const book of _published) {
    for (const g of (book.genres ?? [])) {
      _genreCount[g] = (_genreCount[g] ?? 0) + 1;
    }
  }

  // Kategori listesi kitap düzenleme alanındaki ortak tür listesinden gelir.
  const allCategories = BOOK_GENRES.map(name => ({
    name,
    count: _genreCount[name] ?? 0,
    icon: GENRE_ICONS[name] ?? "📚",
  }));

  // ── Gerçek veriden türetilmiş kitap koleksiyonları ─────────────────────────
  // genre + author alanları eklenerek JSX uyumu sağlanıyor
  const _mapped = _published.map((book) => ({
    ...book,
    cover: normalizeMediaUrl(book.cover),
    genre: (book.genres ?? [])[0] ?? "—",
    author: book.author?.displayName || (book.authorId === user?.id ? user?.displayName || user?.username : "") || "Yazar",
    authorAvatar: book.author?.avatarUrl ?? (book.authorId === user?.id ? user?.avatarUrl ?? "" : ""),
  }));

  const openPublishedBook = (bookId: unknown) => {
    const normalizedId = String(bookId ?? "").trim();
    if (!normalizedId) return;
    const target = `/kitap/${encodeURIComponent(normalizedId)}`;
    setLocation(target);
    // Horizontal scrolling can swallow a SPA click on touch devices; ensure the route still opens.
    window.setTimeout(() => {
      if (window.location.pathname !== target) window.location.assign(target);
    }, 80);
  };

  const myPublishedBooks = _published.filter(book => book.authorId === user?.id || book.author?.id === user?.id);
  const performanceInsights: PerformanceInsight[] = (() => {
    const views = myPublishedBooks.reduce((sum, book) => sum + Number(book.viewCount ?? 0), 0);
    const likes = myPublishedBooks.reduce((sum, book) => sum + Number(book.rating?.likeCount ?? 0), 0);
    const books = myPublishedBooks.length;
    const maxMetric = Math.max(views, likes, profileStats.followerCount, books, 1);
    return [
      { label: "Kitap görüntülenmesi", value: formatMetric(views), progress: Math.round((views / maxMetric) * 100) },
      { label: "Kitap beğenileri", value: formatMetric(likes), progress: Math.round((likes / maxMetric) * 100) },
      { label: "Takipçiler", value: formatMetric(profileStats.followerCount), progress: Math.round((profileStats.followerCount / maxMetric) * 100) },
      { label: "Yayınlanan kitap", value: formatMetric(books), progress: Math.round((books / maxMetric) * 100) },
    ];
  })();
  const trendAuthors = remoteAuthors
    .map(author => ({
      name: author.displayName || author.username || "Yazar",
      role: "Loop yazarı",
      bio: author.authorBio || author.bio || "Loop'ta hikâyelerini paylaşan yazar.",
      genre: _mapped.find(book => book.authorId === author.id)?.genre ?? "Yazar",
      stories: String(_mapped.filter(book => book.authorId === author.id).length),
      followers: String(author.followerCount ?? 0),
      city: "Loop",
      accent: "from-violet-950 via-slate-900 to-cyan-950",
      avatar: author.avatarUrl || "",
      followerCount: Number(author.followerCount ?? 0),
    }))
    .sort((a, b) => b.followerCount - a.followerCount || Number(b.stories) - Number(a.stories));

  const allAuthors = [
    ...remoteAuthors.map(author => ({
      id: author.id,
      name: author.displayName || author.username || "Yazar",
      username: author.username,
      role: "Loop yazarı",
      bio: author.authorBio || author.bio || "Loop'ta hikâyelerini paylaşan yazar.",
      genre: _mapped.find(book => book.authorId === author.id)?.genre ?? "Yazar",
      stories: String(_mapped.filter(book => book.authorId === author.id).length),
      followers: String(author.followerCount ?? 0),
      city: "Loop",
      avatar: author.avatarUrl || "",
    })),
    ...trendAuthors.filter(author => !remoteAuthors.some(item => (item.displayName || item.username) === author.name)),
  ];

  // Yayınlanmamış taslaklar — "Devam Edenler" bölümü için
  const _drafts = (() => {
    try {
      const raw = localStorage.getItem("loop_drafts_v1");
      const localDrafts = raw ? (JSON.parse(raw) as any[]) : [];
      const localOngoing = localDrafts
        .filter((d: any) => (d.progressStatus ?? "ongoing") === "ongoing")
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((b: any) => {
          const remoteBook = _published.find(book => book.id === b.id);
          return {
            ...b,
            cover: normalizeMediaUrl(b.cover || remoteBook?.cover),
            gallery: Array.isArray(b.favoriteImages) && b.favoriteImages.some(Boolean)
              ? b.favoriteImages
              : (Array.isArray(b.gallery) ? b.gallery : (Array.isArray((remoteBook as any)?.gallery) ? (remoteBook as any).gallery : [])),
            genre: (b.genres ?? [])[0] ?? "—",
            author: "Ben",
          };
        });
      const localIds = new Set(localOngoing.map(book => book.id));
      const remoteOngoing = _published
        .filter(book => (book.progressStatus ?? "ongoing") === "ongoing" && !localIds.has(book.id))
        .map(book => ({
          ...book,
          cover: normalizeMediaUrl(book.cover),
          gallery: Array.isArray((book as any).favoriteImages) && (book as any).favoriteImages.some(Boolean)
            ? (book as any).favoriteImages
            : (Array.isArray((book as any).gallery) ? (book as any).gallery : []),
          genre: (book.genres ?? [])[0] ?? "—",
          author: book.author?.displayName || "Yazar",
        }));
      return [...localOngoing, ...remoteOngoing];
    } catch { return [] as typeof _mapped; }
  })();

  // Türe göre gruplandırılmış raflar
  const _publishedShelfRows = Object.entries(
    _mapped.reduce((acc, book) => {
      const g = book.genre === "—" ? "Diğer" : book.genre;
      if (!acc[g]) acc[g] = [];
      acc[g].push(book);
      return acc;
    }, {} as Record<string, typeof _mapped>),
  ).map(([title, books]) => ({
    title,
    subtitle: `${title} türünde ${books.length} kitap`,
    books,
  }));

  // Eski sahte sabitlerin yerini alan gerçek veri koleksiyonları
  const featuredStories = _mapped.map((book) => ({
    id: book.id,
    title: book.title || "Başlıksız",
    author: book.author,
    authorAvatar: book.authorAvatar,
    genre: book.genre,
    cover: book.cover ?? "",
    description: book.synopsis ?? "",
    reads: (book.viewCount ?? 0).toLocaleString("tr-TR"),
    likes: (book.rating?.likeCount ?? 0).toLocaleString("tr-TR"),
    rating: (book as any).rating?.average > 0 ? `${(book as any).rating.average.toFixed(1)} / 10` : "— / 10",
  }));

  const premiumBooks = _mapped.filter(book => book.isPremiumAuthor).map((book, i) => ({
    id: book.id,
    title: book.title || "Başlıksız",
    author: book.author,
    authorAvatar: "" as string,
    label: "Yayında",
    description: book.synopsis ?? "",
    cover: book.cover ?? "",
    backdrop: book.cover ?? "",
    genre: book.genre,
    rank: `#${String(i + 1).padStart(2, "0")}`,
    trailers: (book.trailers ?? []).map(trailer => normalizeMediaUrl(trailer)).filter(Boolean),
    trailerOrientations: book.trailerOrientations ?? [],
    media: book.cover ? [book.cover] : [] as string[],
    gallery: Array.isArray((book as any).gallery) ? (book as any).gallery : [],
    authorId: book.authorId,
  }));

  let readingProgress: Record<string, number> = {};
  try {
    readingProgress = JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) || "{}");
  } catch {
    readingProgress = {};
  }

  const recommendedBooks = _mapped.map((book) => ({
    id: book.id,
    title: book.title || "Başlıksız",
    author: book.author,
    genre: book.genre,
    cover: book.cover ?? "",
    progress: `${readingProgress[book.id] ?? 0}%`,
  }));

  const trendingBooks = _mapped.map((book) => ({
    id: book.id,
    title: book.title || "Başlıksız",
    author: book.author,
    authorAvatar: book.authorAvatar,
    genre: book.genre,
    cover: book.cover ?? "",
    reads: (book.viewCount ?? 0).toLocaleString("tr-TR"),
    likes: (book.rating?.likeCount ?? 0).toLocaleString("tr-TR"),
    trendScore: (book.viewCount ?? 0) + (book.rating?.likeCount ?? 0) * 5,
  })).sort((a, b) => b.trendScore - a.trendScore);

  const shelfRows = _publishedShelfRows;

  const continuingBooks = _drafts.map((book) => ({
    id: book.id,
    title: book.title || "Başlıksız",
    description: (book as any).synopsis ?? "",
          chapters: `${(book as any).chapterCount ?? ((book as any).chapters as unknown[])?.length ?? 0} Bölüm`,
    status: book.progressStatus === "completed" ? "TAMAMLANDI" : "DEVAM EDİYOR",
    rank: book.genres?.[0] ?? "Yeni eser",
    progress: Math.min(100, Math.max(0, Math.round((((book as any).chapterCount ?? (book as any).chapters?.length ?? 0) / Math.max(1, 12)) * 100))),
    covers: (() => {
      const cover = normalizeMediaUrl((book as any).cover);
      const gallery = ((book as any).gallery ?? []).map((image: unknown) => normalizeMediaUrl(image)).filter(Boolean);
      if (!cover) return gallery.slice(0, 3) as string[];
      if (gallery.length >= 2) return [gallery[0], cover, gallery[1]] as string[];
      if (gallery.length === 1) return [gallery[0], cover] as string[];
      return [cover];
    })(),
  }));

  const libraryCollection = _mapped;
  const libraryEntryBooks = (key: string) => readLibraryEntries(key)
    .map(entry => {
      const remote = _mapped.find(book => book.id === entry.id);
      const book = remote ? { ...entry.book, ...remote } : entry.book;
      return {
        ...book,
        id: entry.id,
        title: String(book.title ?? "Başlıksız"),
        cover: normalizeMediaUrl(book.cover),
        author: typeof book.author === "string" ? book.author : "Yazar",
        genre: Array.isArray(book.genres) ? String(book.genres[0] ?? "Kitap") : "Kitap",
        description: String(book.description ?? book.synopsis ?? ""),
        reads: String(book.reads ?? book.viewCount ?? ""),
      };
    });
  const newLibraryBooks = libraryEntryBooks(LIBRARY_SAVED_KEY);
  const likedLibraryBooks = libraryEntryBooks(LIBRARY_LIKED_KEY);
  // ───────────────────────────────────────────────────────────────────────────

  const startUniversePress = (universe: LoopUniverse) => {
    universePressTimer.current = setTimeout(() => setSelectedUniverse(universe), 550);
  };

  const cancelUniversePress = () => {
    if (universePressTimer.current) {
      clearTimeout(universePressTimer.current);
      universePressTimer.current = null;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    const flow = params.get("flow");
    if (flow === "tumu" || flow === "fragmanlar" || flow === "kose-yazilari" || flow === "mikro-oyku" || flow === "kitaplar") {
      setFlowFilter(flow);
    }
    if (tab === "akis") {
      setCurrentTab("akis");
    } else if (tab === "categories") {
      setCurrentTab("categories");
    } else if (tab === "library") {
      setCurrentTab("library");
    } else {
      setCurrentTab("books");
    }
  }, [search]);

  const selectStory = (index: number) => {
    if (featuredStories.length === 0) return;
    const normalizedIndex = (index + featuredStories.length) % featuredStories.length;
    const card = storyCarouselRef.current?.children[normalizedIndex] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setSelectedStoryIndex(normalizedIndex);
  };

  const selectPremium = (index: number) => {
    setPremiumIndex(index);
    setActiveTrailerIndex(0);
    setShowPremiumMedia(false);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  const _pLen = Math.max(1, premiumBooks.length);

  const prevPremium = () => {
    setPremiumIndex((prev) => (prev - 1 + _pLen) % _pLen);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_BACK_SWIPE_MS;
  };

  const nextPremium = () => {
    setPremiumIndex((prev) => (prev + 1) % _pLen);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  useEffect(() => {
    const startAutoAdvance = () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = window.setInterval(() => {
        if (Date.now() < pausedUntilRef.current) return;
        setPremiumIndex((prev) => (prev + 1) % _pLen);
      }, 300000);
    };

    startAutoAdvance();

    const area = premiumAreaRef.current;
    if (!area) return () => {};

    const onPointerDown = (e: PointerEvent) => {
      touchStartXRef.current = e.clientX;
    };
    const onPointerUp = (e: PointerEvent) => {
      const startX = touchStartXRef.current;
      if (startX == null) return;
      const dx = e.clientX - startX;
      const THRESHOLD = 50;
      if (dx > THRESHOLD) {
        setPremiumIndex((prev) => Math.max(0, prev - 1));
        pausedUntilRef.current = Date.now() + PAUSE_AFTER_BACK_SWIPE_MS;
      } else if (dx < -THRESHOLD) {
        setPremiumIndex((prev) => (prev + 1) % _pLen);
        pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
      }
      touchStartXRef.current = null;
    };

    area.addEventListener("pointerdown", onPointerDown, { passive: true });
    area.addEventListener("pointerup", onPointerUp, { passive: true });

    return () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      area.removeEventListener("pointerdown", onPointerDown as any);
      area.removeEventListener("pointerup", onPointerUp as any);
    };
  }, [_pLen]);

  useEffect(() => {
    setActiveTrailerIndex(0);
  }, [premiumIndex]);

  const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredCollection = libraryCollection.filter((book) => {
    if (!query || searchMode === "users") return true;
    return [book.title, book.author, book.genre].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  const filteredUsers = featuredAuthors.filter((user) => {
    if (!query) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  // Categories tab — independent search
  const catQuery = catSearchQuery.trim().toLocaleLowerCase("tr-TR");
  const catFilteredBooks = libraryCollection.filter((book) => {
    if (!catQuery) return true;
    return [book.title, book.author, book.genre].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });
  const catFilteredAuthors = allAuthors.filter((user) => {
    if (!catQuery) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });

  const selectedAuthorBooks = selectedAuthor
    ? _mapped.filter(book => book.authorId === selectedAuthor.id || book.author === selectedAuthor.name)
    : [];
  const selectedAuthorPremiumBooks = selectedAuthorBooks.filter(book => book.isPremiumAuthor);
  const allBooksByLikes = [..._mapped].sort((a, b) => Number(b.rating?.likeCount ?? 0) - Number(a.rating?.likeCount ?? 0));

  // libraryShelves artık _publishedShelfRows ile aynı; ayrı hesaplamaya gerek yok

  const visibleShelfRows = shelfCategory === "Tümü"
    ? shelfRows
    : shelfRows.filter((row) => row.title === shelfCategory);

  const flowFilters = [
    ["tumu", "Tümü"], ["kitaplar", "Kitaplar"], ["fragmanlar", "Fragmanlar"],
    ["kose-yazilari", "Köşe Yazıları"], ["mikro-oyku", "Mikro Öykü"],
  ] as const;
  const visibleFlowPosts = flowFilter === "tumu"
    ? (flowPosts as any[] | undefined)?.filter(post => ["book", "trailer", "column", "micro"].includes(post.postType))
    : flowFilter === "kitaplar"
    ? flowBookPosts
    : flowFilter === "fragmanlar"
        ? flowTrailerPosts
        : flowFilter === "kose-yazilari"
          ? flowColumnPosts
          : flowMicroPosts;
  const newChapterBooks = _published
    .filter(book => (book.progressStatus ?? "ongoing") === "ongoing")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 200);

  return (
    <AppLayout>
      {currentTab === "akis" ? (
        <div className="min-h-screen overflow-x-hidden bg-white pb-24 text-slate-900">
          <div className="mx-auto w-full max-w-3xl">
            <header className="flex items-center justify-between px-5 pb-3 pt-6 sm:px-8">
              <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-200 shadow-sm">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profil" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-black text-slate-500">{(user?.displayName || user?.username || "L").slice(0, 1).toUpperCase()}</div>}
              </div>
              <button type="button" onClick={() => setFlowFilter("kitaplar")} className="flex items-center gap-1 text-[24px] font-black tracking-tight text-slate-950">Akış <ChevronDown className="h-5 w-5 text-slate-300" /></button>
              <div className="h-6 w-6" aria-hidden="true" />
            </header>
            <div className="px-5 sm:px-8">
              <div className="scrollbar-hide flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                {flowFilters.map(([id, label]) => {
                  const Icon = id === "tumu" ? Globe2 : id === "kitaplar" ? BookOpen : id === "fragmanlar" ? Play : id === "kose-yazilari" ? Pen : GitBranch;
                  return <button key={id} type="button" onClick={() => setFlowFilter(id)} className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold leading-tight transition-all sm:flex-1 sm:px-2 sm:text-xs ${flowFilter === id ? "bg-slate-950 text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)]" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}><Icon className="h-3.5 w-3.5" strokeWidth={flowFilter === id ? 2.4 : 1.8} />{label}</button>;
                })}
              </div>
            </div>
            <section className="relative mt-6 border-y border-slate-100 px-5 py-5 sm:px-8">
              <div className="rounded-2xl bg-gradient-to-r from-[#101a56] via-[#372080] to-[#11194f] p-[1px] shadow-[0_8px_28px_rgba(40,35,130,0.18)]">
                <div className="rounded-[15px] bg-white px-3 py-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#25206f]">Akışın yeni bölümleri</p><h2 className="mt-1 text-base font-black text-slate-950">Yeni Bölümler</h2></div>
                  {newChapterBooks.length === 0 ? <button type="button" onClick={() => setLocation("/notebook/calismalari")} className="mt-3 w-full rounded-xl border border-dashed border-[#34247f]/30 py-4 text-center text-xs font-semibold text-slate-500">Yeni bölüm yazmak için çalışmalarına git</button> : <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto pb-1">{newChapterBooks.map(book => { const chapterCount = book.chapterCount ?? (book.chapters as unknown[])?.length ?? 0; return <Link key={book.id} href={`/kitap/${encodeURIComponent(String(book.id))}`} className="group flex w-20 shrink-0 flex-col"><div className="h-24 overflow-hidden rounded-xl border border-[#27206f]/15 bg-slate-100 shadow-sm"><img src={normalizeMediaUrl(book.cover) || ""} alt={book.title} className="h-full w-full object-cover transition group-hover:scale-105" /></div><p className="mt-1.5 truncate text-[10px] font-bold text-slate-800">{book.title}</p><p className="text-[9px] text-[#30257c]">Bölüm {chapterCount}</p></Link>; })}</div>}
                </div>
              </div>
            </section>
            {flowPostsLoading || (flowFilter === "kitaplar" && flowBookPostsLoading) ? <p className="px-5 py-12 text-center text-sm text-slate-400">Akış yükleniyor...</p> : !visibleFlowPosts?.length ? <p className="mx-5 my-6 rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Bu alanda henüz paylaşım yok.</p> : <div className="divide-y divide-slate-100">{(visibleFlowPosts as any[]).map(post => <div key={post.id} className="px-4 py-4 sm:px-8"><PostCard post={post} /></div>)}</div>}
          </div>
        </div>
      ) : currentTab === "categories" ? (
        <div className="writebook-page min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 py-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 overflow-x-hidden">
            {selectedAuthor && (
              <section className="mb-8 overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="flex items-center gap-4">
                    {selectedAuthor.avatar ? <img src={selectedAuthor.avatar} alt={selectedAuthor.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-violet-300/60" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500 text-2xl font-black">{selectedAuthor.name.slice(0, 1).toUpperCase()}</div>}
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300">Yazar kartı</p>
                      <h2 className="mt-1 text-2xl font-black">{selectedAuthor.name}</h2>
                      <p className="mt-1 text-xs text-slate-400">{selectedAuthor.role} · {selectedAuthor.followers} takipçi · {selectedAuthor.stories} kitap</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedAuthor(null)} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10">Yazar görünümünü kapat</button>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{selectedAuthor.bio}</p>

                <div className="mt-6 space-y-7">
                  <AuthorBookRow title={`${selectedAuthor.name} tarafından yazılan kitaplar`} books={selectedAuthorBooks} />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">AI destekli seçimli hikâyeler</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {interactiveStories.slice(0, 4).map(story => <div key={story.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4"><p className="font-bold text-white">{story.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{story.summary || story.eventTitle}</p></div>)}
                      {interactiveStories.length === 0 && <p className="text-xs text-slate-500">Henüz AI destekli seçimli hikâye yok.</p>}
                    </div>
                  </div>
                  <AuthorBookRow title="Premium yazarlardan hikâyeler" books={selectedAuthorPremiumBooks.length ? selectedAuthorPremiumBooks : _mapped.filter(book => book.isPremiumAuthor).slice(0, 6)} />
                  <AuthorBookRow title="Tüm kitaplar · en çok beğenilenden en aza" books={allBooksByLikes.slice(0, 12)} />
                </div>
              </section>
            )}
            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.35em] text-violet-600 font-semibold">📚 Loop Kitaplık</p>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-950">Tüm Kategoriler</h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl">Milyonlarca kitap arasında keşfet. Kategorilerimiz arasında dolaş ve seni çeken türleri bul.</p>
            </div>

            {/* ── Bağımsız arama ── */}
            <div className="mb-8 rounded-[1.75rem] bg-white shadow-[0_8px_32px_rgba(109,40,217,0.08)] border border-violet-100 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center flex-1 min-w-0 gap-2 rounded-[1.25rem] bg-slate-50 border border-slate-200 px-3 py-2.5 focus-within:border-violet-400 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] transition-all">
                  <Search className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <input
                    type="search"
                    placeholder={catSearchMode === "books" ? "Kitap veya yazar…" : "Yazar adı veya tür…"}
                    value={catSearchQuery}
                    onChange={(e) => setCatSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                  {catSearchQuery && (
                    <button type="button" onClick={() => setCatSearchQuery("")} className="text-slate-400 hover:text-slate-600 transition flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex rounded-[1.25rem] bg-slate-100 p-1 gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatSearchMode("books")}
                    className={`rounded-[1rem] px-3 py-2 text-xs sm:text-sm font-semibold transition ${catSearchMode === "books" ? "bg-violet-700 text-white shadow" : "text-slate-600 hover:bg-slate-200"}`}
                  >Kitap</button>
                  <button
                    type="button"
                    onClick={() => setCatSearchMode("authors")}
                    className={`rounded-[1rem] px-3 py-2 text-xs sm:text-sm font-semibold transition ${catSearchMode === "authors" ? "bg-violet-700 text-white shadow" : "text-slate-600 hover:bg-slate-200"}`}
                  >Yazar</button>
                </div>
              </div>

              {catSearchQuery ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {catSearchMode === "books" ? "Kitap sonuçları" : "Yazar sonuçları"}
                    </p>
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      {catSearchMode === "books" ? `${catFilteredBooks.length} adet` : `${catFilteredAuthors.length} adet`}
                    </span>
                  </div>

                  {catSearchMode === "books" ? (
                    <div className="grid gap-2">
                      {catFilteredBooks.slice(0, 8).map((book) => (
                        <Link key={book.id} href={`/kitap/${book.id}`} className="flex items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 hover:border-violet-200 hover:bg-violet-50/50 transition">
                          <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg shadow-sm">
                            {book.cover ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-violet-100 flex items-center justify-center text-2xl">📖</div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{book.title}</p>
                            <p className="text-xs text-slate-500 truncate">{book.author} · {book.genre}</p>
                          </div>
                          <span className="ml-auto flex-shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{book.genre}</span>
                        </Link>
                      ))}
                      {catFilteredBooks.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">"{catSearchQuery}" için kitap bulunamadı.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catFilteredAuthors.slice(0, 6).map((author) => (
                        <button key={author.name} type="button" onClick={() => setSelectedAuthor(author)} className="flex items-center gap-3 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 text-left hover:border-violet-200 hover:bg-violet-50/50 transition">
                          <img src={author.avatar} alt={author.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{author.name}</p>
                            <p className="text-xs text-slate-500 truncate">{author.genre} · {author.city}</p>
                          </div>
                          <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{author.followers}</span>
                        </button>
                      ))}
                      {catFilteredAuthors.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500 col-span-2">"{catSearchQuery}" için yazar bulunamadı.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Kitap adı, yazar veya tür girerek ara.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {allCategories.map((category) => (
                <Link
                  key={category.name}
                  href={`/kitaplar?genre=${encodeURIComponent(category.name)}`}
                  className="group relative overflow-hidden rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 hover:border-violet-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-100/0 via-violet-100/0 to-violet-100/0 group-hover:from-violet-100/40 group-hover:to-violet-100/20 transition-all duration-300" />
                  
                  <div className="relative z-10 flex flex-col items-center text-center gap-3">
                    <div className="text-3xl sm:text-4xl">{category.icon}</div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">{category.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{category.count} kitap</p>
                    </div>
                  </div>

                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-violet-600 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 rounded-[2rem] bg-gradient-to-r from-violet-600 to-violet-700 p-8 sm:p-12 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold">Kendi kategorini oluştur</h2>
              <p className="mt-3 text-violet-100 max-w-xl">Favori kitaplarını gruplandır ve özel koleksiyonlar yarat. Arkadaşlarınla paylaş ve merak ettiklerine yardımcı ol.</p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-violet-700 font-semibold px-6 py-3 hover:bg-violet-50 transition-colors">
                Kategori Oluştur
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : currentTab === "library" ? (
        <div className="writebook-page min-h-screen bg-[#0f0f13]">
          {/* ── Hero ── */}
          <div className="relative overflow-hidden px-4 pt-8 pb-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/60 via-[#0f0f13] to-indigo-950/40" />
            <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-indigo-600/10 blur-3xl" />
            <div className="relative mx-auto max-w-6xl">
              <p className="text-[10px] uppercase tracking-[0.4em] text-violet-400 font-semibold">📚 Kitaplığım</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-white">Kişisel Koleksiyon</h1>
              <p className="mt-1 text-sm text-slate-400 max-w-md">Okuduğun, beğendiğin ve koleksiyonuna eklediğin her kitap burada.</p>

              {/* Kitaplar keşif linki */}
              <Link href="/kitaplar"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-400/30 px-4 py-2.5 text-[13px] font-bold text-violet-300 transition-all hover:bg-violet-500/30">
                <BookOpen className="h-4 w-4" /> Yayınlanan Kitaplara Gözat →
              </Link>

              {/* Stat chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: "Yayında kitap", value: `${_published.length}` },
                  { label: "Tür", value: `${Object.keys(_genreCount).length}` },
                  { label: "Toplam kelime", value: _published.reduce((s,b)=>s+(b.wordCount??0),0) > 999 ? `${(_published.reduce((s,b)=>s+(b.wordCount??0),0)/1000).toFixed(1)}B` : `${_published.reduce((s,b)=>s+(b.wordCount??0),0)}` },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-4 py-2 backdrop-blur-sm">
                    <span className="text-base font-bold text-white">{s.value}</span>
                    <span className="text-xs text-slate-400">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div className="mt-6 flex gap-1 rounded-[1.25rem] bg-white/6 border border-white/10 p-1 w-fit">
                {([ ["shelves","Raflar"], ["new","Yeni Eklediklerim"], ["liked","Beğendiklerim"] ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLibraryView(v)}
                    className={`rounded-[1rem] px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                      libraryView === v
                        ? "bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">

            {/* RAFLAR */}
            {libraryView === "shelves" && (
              <div className="space-y-10 pt-4">
                {shelfRows.map((row) => (
                  <section key={row.title}>
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-base font-bold text-white">{row.title}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{row.subtitle}</p>
                      </div>
                      <button className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition">Tümü →</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory" style={{scrollbarWidth:"none"}}>
                      {row.books.map((book, idx) => (
                        <div key={idx} onClick={() => setLocation(`/kitap/${book.id}`)} className="group flex-shrink-0 snap-start w-32 sm:w-36 cursor-pointer">
                          <div className="relative h-48 sm:h-52 w-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-[1.03]">
                            {book.cover ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-violet-900/40 flex items-center justify-center text-3xl">📖</div>}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <span className="absolute bottom-2 left-2 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[9px] font-semibold text-white/90 uppercase tracking-wide">{book.genre}</span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-200 line-clamp-2 leading-tight">{book.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{book.author}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* YENİ EKLEDİKLERİM */}
            {libraryView === "new" && (
              <div className="pt-4">
                {newLibraryBooks.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Henüz kitap kaydetmedin.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {newLibraryBooks.map((book, idx) => (
                    <div key={idx} onClick={() => setLocation(`/kitap/${book.id}`)} className="group cursor-pointer">
                      <div className="relative overflow-hidden rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.03]">
                        {book.cover ? <img src={book.cover} alt={book.title} className="h-44 sm:h-52 w-full object-cover" /> : <div className="h-44 sm:h-52 w-full bg-violet-900/40 flex items-center justify-center text-3xl">📖</div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{book.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-300">{book.author}</p>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className="rounded-full bg-violet-500/80 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">{book.genre}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between px-0.5">
                        <p className="text-[10px] text-slate-500">
                          {idx === 0 ? "Bugün" : idx < 3 ? "Dün" : idx < 6 ? "3 gün önce" : "Bu hafta"}
                        </p>
                        <button className="text-slate-600 hover:text-red-400 transition">
                          <Bookmark className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            )}

            {/* BEĞENDİKLERİM */}
            {libraryView === "liked" && (
              <div className="pt-4 space-y-3">
                {likedLibraryBooks.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Henüz beğendiğin kitap yok.</p> : likedLibraryBooks.map((book, idx) => (
                  <div key={idx} onClick={() => setLocation(`/kitap/${book.id}`)} className="group flex items-center gap-4 rounded-2xl bg-white/5 border border-white/8 px-4 py-3 hover:bg-white/8 transition-all duration-200 cursor-pointer">
                    <div className="relative flex-shrink-0 h-16 w-12 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                      <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white line-clamp-1">{book.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{book.author} · <span className="text-violet-400">{book.genre}</span></p>
                      {"description" in book && book.description ? (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{book.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
                      {"reads" in book && book.reads ? (
                        <span className="text-[10px] text-slate-500">{book.reads} okuma</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="writebook-page min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          {showStudio ? <header className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] lg:rounded-[3rem] bg-slate-950 px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12 text-white shadow-[0_45px_140px_rgba(15,23,42,0.24)]">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute left-0 bottom-0 h-52 w-52 -translate-x-1/4 translate-y-1/4 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <button type="button" onClick={() => setShowStudio(false)} aria-label="Kitaplık alanını kapat" className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
            <div className={`writebook-columns relative grid gap-6 sm:gap-8 lg:gap-10 ${showStats ? "xl:grid-cols-[1.45fr_0.95fr]" : "xl:grid-cols-1"} xl:items-center`}>
              <div className="max-w-3xl space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-200/75 ring-1 ring-white/10">
                  <BookOpen className="h-3 sm:h-4 w-3 sm:w-4 text-white" />
                  Loop Kitaplık Stüdyosu
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-semibold tracking-tight">İstatistiklerini Loop diye gör</h1>
                    <button
                      type="button"
                      onClick={() => setShowStats((visible) => !visible)}
                      aria-expanded={showStats}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      <span>İstatistikler</span>
                      {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 sm:mt-4 max-w-xl text-sm sm:text-base lg:text-lg leading-6 sm:leading-8 text-slate-300">{librarySummary.subtitle}</p>
                </div>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-4">
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition shadow-lg hover:shadow-xl whitespace-nowrap">
                    Yeni kitap başlat
                    <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" />
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition whitespace-nowrap">
                    Rapor
                    <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" />
                  </button>
                  <button type="button" onClick={() => setShowStudioDetails((visible) => !visible)} aria-expanded={showStudioDetails} className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-300/40 bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30">
                    {showStudioDetails ? "Daha az" : "Daha fazla"}
                    {showStudioDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                {showStudioDetails && <>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 p-4 sm:p-5 ring-1 ring-violet-400/30 backdrop-blur hover:ring-violet-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-200 font-semibold">📖 Aktif Proje</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">{myPublishedBooks[0]?.title || "Aktif proje yok"}</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 p-4 sm:p-5 ring-1 ring-sky-400/30 backdrop-blur hover:ring-sky-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-sky-200 font-semibold">✍️ Toplam Kelime</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">{formatMetric(myPublishedBooks.reduce((sum, book) => sum + Number(book.wordCount ?? 0), 0))}</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10 p-4 sm:p-5 ring-1 ring-fuchsia-400/30 backdrop-blur hover:ring-fuchsia-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-fuchsia-200 font-semibold">⚡ Okuma Hızı</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">{formatMetric(myPublishedBooks.reduce((sum, book) => sum + Number(book.viewCount ?? 0), 0))} / toplam</p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-gradient-to-r from-white/10 to-white/5 p-3 sm:p-5 text-slate-100 backdrop-blur">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">✨ {trendingBooks.length} öneri</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">🎬 {liveLoopCount} Loop</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">📊 {myPublishedBooks.length} yayın</span>
                  </div>
                </div>
                </>}
              </div>

              {false && <div className="writebook-panel rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-white/15 via-white/10 to-white/5 p-4 sm:p-6 lg:p-8 shadow-[0_30px_60px_rgba(15,23,42,0.25)] backdrop-blur-2xl hover:border-white/30 transition">
                <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6 sm:mb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-300 font-semibold">📊 Premium</p>
                    <p className="mt-2 sm:mt-3 text-lg sm:text-2xl lg:text-3xl font-bold text-white">Performans</p>
                  </div>
                  <span className="rounded-full bg-gradient-to-r from-violet-500/40 to-violet-600/30 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-200 backdrop-blur border border-violet-400/30">✨ Yeni</span>
                </div>
                <div className="rounded-[1.25rem] sm:rounded-[2rem] bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 sm:p-6 lg:p-8 text-white ring-1 ring-white/10 backdrop-blur">
                  <div className="flex items-start justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-300 font-semibold">📚 Yayınlar</p>
                      <p className="mt-2 sm:mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-violet-400 to-violet-300 bg-clip-text text-transparent">{myPublishedBooks.length}</p>
                    </div>
                    <div className="text-3xl sm:text-4xl lg:text-5xl text-violet-500/50">📖</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4 sm:mb-6">Dijital vitrinde öne çıkan yayınlar.</p>
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 px-5 py-4 border border-violet-400/30 hover:border-violet-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-violet-200 font-semibold">📈 Haftalık Etkileşim</p>
                      <p className="mt-3 text-2xl font-bold text-white">{formatMetric(myPublishedBooks.reduce((sum, book) => sum + Number(book.viewCount ?? 0) + Number(book.rating?.likeCount ?? 0), 0))}</p>
                      <p className="text-xs text-violet-200/70 mt-2">Kitaplarının toplam etkileşimi</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 px-5 py-4 border border-sky-400/30 hover:border-sky-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-sky-200 font-semibold">⭐ Yeni Favoriler</p>
                      <p className="mt-3 text-2xl font-bold text-white">{formatMetric(myPublishedBooks.reduce((sum, book) => sum + Number(book.rating?.likeCount ?? 0), 0))}</p>
                      <p className="text-xs text-sky-200/70 mt-2">Kitaplarının toplam beğenisi</p>
                    </div>
                  </div>
                </div>
              </div>}
            </div>
          </header> : <button type="button" onClick={() => setShowStudio(true)} className="flex w-full items-center justify-between rounded-[1.25rem] border border-violet-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-violet-300 hover:shadow-md">
            <span>İstatistiklerini Loop diye gör</span>
            <span className="inline-flex items-center gap-2 text-violet-700">Alanı aç <ChevronDown className="h-4 w-4" /></span>
          </button>}

          {/* ── Öne Çıkan Hikayeler ── */}
          {featuredStories.length === 0 ? (
            <section className="relative overflow-hidden rounded-[2rem] bg-[#0d0d12] px-6 py-10 text-center shadow-[0_32px_100px_rgba(0,0,0,0.35)]">
              <Sparkles className="mx-auto h-8 w-8 text-amber-400/40 mb-3" />
              <p className="text-sm font-semibold text-slate-400">Henüz yayınlanan kitap yok</p>
              <p className="text-xs text-slate-600 mt-1">Bir kitabı yayınladıktan sonra burada öne çıkan hikayeler bölümünde görünecek.</p>
            </section>
          ) : (
          <section className="relative overflow-hidden rounded-[2rem] shadow-[0_32px_100px_rgba(0,0,0,0.35)]">
            {/* Blurred backdrop — all images pre-rendered; only opacity changes, no src swap */}
            <div className="absolute inset-0 -z-0 overflow-hidden">
              {featuredStories.map((story, index) => story.cover ? (
                <img
                  key={index}
                  src={story.cover}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-2xl"
                  style={{
                    transform: "scale(1.2)",
                    opacity: selectedStoryIndex === index ? 0.3 : 0,
                    transition: "opacity 0.5s ease",
                    willChange: "opacity",
                  }}
                />
              ) : null)}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d12]/80 via-[#0d0d12]/70 to-[#0d0d12]/95" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 ring-1 ring-amber-400/40">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                </span>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.35em] text-amber-300/80 font-semibold">Loop Seçkisi</p>
                  <h2 className="text-sm font-bold text-white leading-tight">Öne Çıkan Hikayeler</h2>
                </div>
              </div>
            </div>

            {/* Active story — hero */}
            <div className="relative z-10 px-5 pt-5 sm:px-7">
              {(() => {
                const story = featuredStories[Math.min(selectedStoryIndex, featuredStories.length - 1)];
                if (!story) return null;
                return (
                  <div onClick={() => setLocation(`/kitap/${story.id}`)} className="flex cursor-pointer gap-4 sm:gap-6">
                    {/* Cover */}
                    <div className="relative flex-shrink-0 w-28 sm:w-36">
                      <div className="relative h-40 sm:h-52 w-full overflow-hidden rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                        {story.cover
                          ? <img src={story.cover} alt={story.title} className="h-full w-full object-cover transition-all duration-500" />
                          : <div className="h-full w-full bg-violet-900/40 flex items-center justify-center text-4xl">📖</div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                      {/* Rank badge */}
                      <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow-lg">
                        #{selectedStoryIndex + 1}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 min-w-0 flex-col justify-between py-1">
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-full bg-violet-500/20 border border-violet-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wide">
                          {story.genre}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">{story.title}</h3>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-5 line-clamp-3">{story.description || "—"}</p>
                      </div>

                      {/* Author row */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-6 w-6 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                          {story.authorAvatar
                            ? <img src={story.authorAvatar} alt={`${story.author} profil fotoğrafı`} className="h-full w-full object-cover" />
                            : story.author.slice(0, 1).toUpperCase()
                          }
                        </div>
                        <span className="text-xs text-slate-400 truncate">{story.author}</span>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">
                          <Eye className="h-3 w-3" /> {story.reads}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-400/20 px-2.5 py-1 text-[10px] text-rose-300">
                          <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> {story.likes}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {story.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Thumbnail strip */}
            <div
              ref={storyCarouselRef}
              className="relative z-10 mt-5 flex gap-2.5 overflow-x-auto px-5 pb-5 sm:px-7 sm:pb-6"
              style={{ scrollbarWidth: "none" }}
            >
              {featuredStories.map((story, index) => (
                <button
                  key={`thumb-${index}`}
                  type="button"
                  onClick={() => selectStory(index)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-xl transition-all duration-300 ${
                    selectedStoryIndex === index
                      ? "w-24 sm:w-28 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                      : "w-16 sm:w-20 opacity-50 hover:opacity-80 ring-1 ring-white/10"
                  }`}
                >
                  {story.cover
                    ? <img src={story.cover} alt={story.title} className="h-20 sm:h-24 w-full object-cover transition duration-500 group-hover:scale-105" />
                    : <div className="h-20 sm:h-24 w-full bg-violet-900/40 flex items-center justify-center text-xl">📖</div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {selectedStoryIndex === index && (
                    <div className="absolute bottom-1.5 left-0 right-0 px-1.5">
                      <p className="text-[8px] font-bold text-white/90 line-clamp-1 text-center">{story.title}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Progress dots */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 pb-4">
              {featuredStories.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  type="button"
                  onClick={() => selectStory(index)}
                  className={`rounded-full transition-all duration-300 ${
                    selectedStoryIndex === index
                      ? "w-6 h-1.5 bg-amber-400"
                      : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          </section>
          )}

          {premiumBooks.length === 0 ? (
            <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#180d00] px-6 py-10 text-center text-white">
              <p className="text-sm font-semibold text-amber-300/60">Henüz yayınlanan kitap yok</p>
              <p className="text-xs text-slate-600 mt-1">Bir kitap yayınladıktan sonra burada vitrin alanında görünecek.</p>
            </section>
          ) : (() => {
            const premium = premiumBooks[Math.min(premiumIndex, premiumBooks.length - 1)];
            return (
              <section
                ref={premiumAreaRef}
                className="relative isolate overflow-hidden rounded-[2rem] text-white"
                style={{ boxShadow: "0 32px 110px rgba(120,53,15,0.28)" }}
              >
                {/* ── Stacked cinematic backdrops (opacity only, no src swap) ── */}
                {premiumBooks.map((pb, i) => pb.backdrop ? (
                  <img
                    key={`backdrop-${i}`} src={pb.backdrop} alt="" aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      zIndex: -20,
                      transform: "scale(1.18)",
                      filter: "blur(24px)",
                      opacity: i === premiumIndex ? 1 : 0,
                      transition: "opacity 0.85s ease",
                      willChange: "opacity",
                    }}
                  />
                ) : null)}
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/65 to-[#180d00]/90" />

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 pt-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.38em] text-amber-400/75">Loop Seçkisi · Özel Salon</p>
                    <h2 className="mt-0.5 text-[17px] font-black tracking-tight leading-tight">Premium Yazarlardan Kitaplar</h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-300/55 bg-amber-950/55 px-3 py-1.5 text-[11px] font-black text-amber-200 backdrop-blur">✦ Pro</span>
                </div>

                {/* ── Cover + Info row ─────────────────────────────────────── */}
                <div className="mt-3 flex gap-3 px-4">
                  {/* Left: stacked covers */}
                  <div
                    className="relative shrink-0 overflow-hidden rounded-2xl"
                    style={{ width: 108, aspectRatio: "2/3", boxShadow: "0 14px 48px rgba(0,0,0,0.65)" }}
                      onClick={() => setLocation(`/kitap/${premium.id}`)}
                  >
                    {premiumBooks.map((pb, i) => (
                      <img
                        key={pb.cover} src={pb.cover} alt={pb.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        style={{ opacity: i === premiumIndex ? 1 : 0, transition: "opacity 0.65s ease" }}
                      />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                    <span className="absolute left-2 top-2 rounded-full border border-amber-300/65 bg-black/55 px-2 py-0.5 text-[10px] font-black text-amber-200 backdrop-blur">
                      {premium.rank}
                    </span>
                    <div
                      className="absolute bottom-2 left-1/2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 ring-1 ring-white/20 backdrop-blur"
                      style={{ transform: "translateX(-50%)", whiteSpace: "nowrap" }}
                    >
                      <img src={premium.authorAvatar} alt={premium.author} className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-amber-300/70" />
                      <span className="max-w-[58px] truncate text-[9px] font-bold text-white/90">{premium.author}</span>
                    </div>
                  </div>

                  {/* Right: info */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-900/35 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                        Premium Yazar
                      </span>
                      <h3 className="mt-2 font-serif text-[22px] font-black leading-[1.15] text-white line-clamp-2">{premium.title}</h3>
                      <p className="mt-1 text-[10px] font-semibold tracking-wide text-amber-200/65">{premium.genre}</p>
                      <p className="mt-2 line-clamp-4 text-[11px] leading-[1.65] text-slate-300/90">{premium.description}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLocation(`/kitap/${premium.id}`)}
                        className="rounded-full px-4 py-2 text-[11px] font-black text-black transition active:scale-95"
                        style={{ background: "linear-gradient(135deg,#fcd34d,#f59e0b)" }}
                      >
                        Kitaba Git <ArrowRight className="ml-0.5 inline h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGalleryDraft(premium.gallery.length ? premium.gallery : (premium.cover ? [{ url: premium.cover, name: "Kapak" }] : []));
                          setShowPremiumMedia(true);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-bold text-amber-100 backdrop-blur transition hover:bg-white/18 active:scale-95"
                        aria-label="Kitap görsellerini aç"
                      >
                        <span className="flex -space-x-1.5">
                          <span className="h-3.5 w-3.5 rounded bg-white/30 ring-1 ring-white/50" />
                          <span className="h-3.5 w-3.5 -rotate-6 rounded bg-amber-200/70 ring-1 ring-white/60" />
                        </span>
                        Görseller
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Trailer strip (video varsa) / Kapak sinema strip (yoksa) ── */}
                <div
                  className="mt-3 grid grid-cols-3 gap-2 px-4"
                  style={{ touchAction: "pan-y" }}
                  onPointerDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                >
                  {premium.trailers.length > 0 ? (
                    premium.trailers.map((trailer, ti) => {
                      const isActive = ti === activeTrailerIndex;
                      const orientation = premium.trailerOrientations?.[ti] ?? "horizontal";
                      return (
                        <div
                          key={`${premium.title}-${ti}`}
                          aria-label={`${premium.title} fragman ${ti + 1}`}
                          onClick={() => setActiveTrailerIndex(ti)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setActiveTrailerIndex(ti); }}
                          className={`group/tr relative overflow-hidden rounded-xl border transition-all duration-700 ease-in-out ${isActive ? "col-span-2 scale-100 border-amber-300/65 shadow-[0_0_22px_rgba(251,191,36,0.18)]" : "scale-[0.96] border-white/10 opacity-50 hover:opacity-75"}`}
                          style={isActive
                            ? { width: "85%", aspectRatio: orientation === "vertical" ? "4 / 5" : "16 / 9" }
                            : { height: 56 }}
                        >
                          {isActive
                            ? <TrailerPlayer
                                key={`${premium.title}-v${ti}`}
                                src={trailer}
                                orientation={orientation}
                                loop={premium.trailers.length === 1}
                                onEnded={() => setActiveTrailerIndex((ti + 1) % premium.trailers.length)}
                              />
                            : <img src={premium.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover/tr:scale-110" />
                          }
                          <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          {isActive
                            ? <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[9px] font-bold text-amber-200"><Play className="h-2.5 w-2.5 fill-current" /> Oynuyor</span>
                            : <span className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white/60 opacity-0 transition group-hover/tr:opacity-100">Fragman {ti + 1}</span>
                          }
                        </div>
                      );
                    })
                  ) : (
                    // Kapak görselini 3 sinematik panele böl (kapak yoksa gradient placeholder)
                    <>
                      {/* Panel 1 — geniş, ana görünüm */}
                      <div className="col-span-2 relative overflow-hidden rounded-xl border border-amber-300/40 shadow-[0_0_18px_rgba(251,191,36,0.12)]" style={{ height: 96 }}>
                        {premium.cover
                          ? <img src={premium.cover} alt={premium.title} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 20%" }} />
                          : <div className="absolute inset-0 bg-gradient-to-br from-amber-900/60 via-orange-950/80 to-black" />
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[9px] font-bold text-amber-200">
                          <BookOpen className="h-2.5 w-2.5" /> {premium.title}
                        </span>
                      </div>
                      {/* Panel 2 — dar, orta pozisyon */}
                      <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ height: 96, opacity: 0.6 }}>
                        {premium.cover
                          ? <img src={premium.cover} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-125" style={{ objectPosition: "center 70%" }} />
                          : <div className="absolute inset-0 bg-gradient-to-b from-amber-800/40 to-black/80" />
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <span className="absolute bottom-1 left-1.5 text-[8px] font-semibold text-amber-300/70">{premium.genre}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Book thumbnail nav (kapak görselleriyle) ─────────────── */}
                <div className="mt-3 flex gap-2 px-4 pb-4">
                  {premiumBooks.map((pb, i) => (
                    <button
                      key={pb.id}
                      type="button"
                      aria-label={`${pb.title} kitabını göster`}
                      aria-current={i === premiumIndex ? "true" : undefined}
                      onPointerDown={event => event.stopPropagation()}
                      onClick={event => { event.stopPropagation(); selectPremium(i); }}
                      className="relative flex-1 overflow-hidden rounded-xl transition-all duration-300"
                      style={{
                        height: 52,
                        border: i === premiumIndex ? "2px solid #fcd34d" : "2px solid rgba(255,255,255,0.1)",
                        opacity: i === premiumIndex ? 1 : 0.42,
                        boxShadow: i === premiumIndex ? "0 0 14px rgba(252,211,77,0.35)" : "none",
                      }}
                    >
                      <img src={pb.cover} alt={pb.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <span className="absolute bottom-1 left-1.5 text-[8px] font-black text-amber-300">{pb.rank}</span>
                      <span className="absolute bottom-1 right-1.5 max-w-[52px] truncate text-[7px] font-semibold text-white/65">{pb.title}</span>
                    </button>
                  ))}
                </div>

                {/* ── Media modal ──────────────────────────────────────────── */}
                {showPremiumMedia && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${premium.title} görselleri`}>
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-amber-200/30 bg-[#15100b] p-5 text-white shadow-2xl sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">{premium.author}</p>
                          <h3 className="mt-1 text-xl font-bold">{premium.title} görselleri</h3>
                        </div>
                        <button type="button" onClick={() => setShowPremiumMedia(false)} aria-label="Kapat" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                          {galleryDraft.map((image, index) => (
                            <div key={`${image.url}-${index}`} className="relative rounded-2xl border border-white/10 bg-white/5 p-2.5">
                              <img src={image.url} alt={image.name} className="h-36 w-full rounded-xl object-cover sm:h-48" />
                              <input value={image.name} onChange={event => setGalleryDraft(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none" maxLength={80} aria-label={`${index + 1}. görsel adı`} />
                              <button type="button" onClick={() => setGalleryDraft(items => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-rose-300" aria-label={`${image.name} görselini sil`}><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                          {galleryDraft.length < 5 && premium.authorId === user?.id && (
                            <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300/40 bg-amber-400/5 text-amber-200 sm:h-48">
                              <ImagePlus className="h-6 w-6" />
                              <span className="mt-2 text-xs font-bold">Görsel ekle</span>
                              <input type="file" accept="image/*" className="hidden" onChange={async event => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
                                setGalleryDraft(items => [...items, { url, name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) }]);
                                event.target.value = "";
                              }} />
                            </label>
                          )}
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                          <p className="text-[10px] text-slate-400">{galleryDraft.length}/5 görsel</p>
                          {premium.authorId === user?.id && <button type="button" disabled={gallerySaving} onClick={async () => {
                            setGallerySaving(true);
                            try {
                              const response = await fetch(`/api/books/${premium.id}/gallery`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ gallery: galleryDraft }) });
                              if (!response.ok) throw new Error("Görseller kaydedilemedi");
                              setShowPremiumMedia(false);
                            } finally { setGallerySaving(false); }
                          }} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-amber-950 disabled:opacity-50">{gallerySaving ? "Kaydediliyor..." : "Görselleri kaydet"}</button>}
                        </div>
                      </div>
                    </div>
                )}
              </section>
            );
          })()}

          <section className="overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-violet-600">Okuma rotan</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Sizin İçin Önerdiğimiz</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
                Tümünü gör <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {recommendedBooks.length === 0 && (
                <p className="text-sm text-slate-400 py-4">Henüz yayınlanan kitap yok.</p>
              )}
              {recommendedBooks.map((book) => (
                <article key={book.title} onClick={() => setLocation(`/kitap/${book.id}`)} className="group w-32 flex-none cursor-pointer sm:w-40">
                  <div className="relative h-48 overflow-hidden rounded-xl bg-slate-200 shadow-md sm:h-60">
                    {book.cover
                      ? <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      : <div className="h-full w-full bg-violet-100 flex items-center justify-center text-3xl">📖</div>
                    }
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 pt-10">
                      <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{book.genre}</span>
                    </div>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-bold text-slate-900 group-hover:text-violet-700">{book.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{book.author}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: book.progress }} /></div>
                    <span className="text-[10px] font-semibold text-violet-700">{book.progress}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[2rem] text-white" style={{ background: "linear-gradient(145deg,#0f0c1a 0%,#12102a 55%,#1a0f2e 100%)", boxShadow: "0 24px 80px rgba(109,40,217,0.18)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-0">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.38em] text-violet-400/75">Bu Haftanın Seçkisi</p>
                <h2 className="mt-0.5 text-[17px] font-black tracking-tight leading-tight flex items-center gap-2">
                  Trend Olanlar
                  <span className="text-base">🔥</span>
                </h2>
              </div>
              <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-[10px] font-bold text-violet-300">↗ Yükselişte</span>
            </div>

            {/* #1 hero card */}
            {trendingBooks.length === 0 ? (
              <div className="mt-3 mx-4 rounded-2xl bg-white/5 py-8 text-center">
                <p className="text-sm text-slate-400">Henüz yayınlanan kitap yok</p>
              </div>
            ) : (() => {
              const top = trendingBooks[0];
              return (
                <Link href={`/kitap/${encodeURIComponent(String(top.id))}`} className="mt-3 mx-4 block w-[calc(100%-2rem)] relative cursor-pointer touch-manipulation overflow-hidden rounded-2xl text-left" style={{ height: 130 }}>
                  {top.cover
                    ? <img src={top.cover} alt={top.title} className="absolute inset-0 h-full w-full object-cover scale-110" style={{ filter: "blur(2px)" }} />
                    : <div className="absolute inset-0 bg-violet-900/60" />
                  }
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.2) 100%)" }} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[72px] font-black leading-none select-none" style={{ color: "rgba(255,255,255,0.06)" }}>1</span>
                  <div className="relative flex h-full items-center gap-3 px-3">
                    {top.cover
                      ? <img src={top.cover} alt={top.title} className="h-20 w-14 shrink-0 rounded-xl object-cover shadow-lg ring-2 ring-amber-400/60" />
                      : <div className="h-20 w-14 shrink-0 rounded-xl bg-violet-800/60 flex items-center justify-center text-2xl ring-2 ring-amber-400/60">📖</div>
                    }
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-black">#1 Bu Hafta</span>
                      <h3 className="mt-1.5 text-[17px] font-black leading-tight text-white line-clamp-1">{top.title}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-300/80">{top.author} · <span className="text-violet-300">{top.genre}</span></p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                          <Eye className="h-3 w-3" />{top.reads}
                        </span>
                        <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition-colors">
                          Oku
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })()}

            {/* #2–5 horizontal scroll */}
            <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto px-4 pb-4">
              {trendingBooks.slice(1).map((book, i) => (
                <Link key={book.id} href={`/kitap/${encodeURIComponent(String(book.id))}`} className="group w-28 flex-none cursor-pointer touch-manipulation text-left">
                  <div className="relative h-40 overflow-hidden rounded-xl bg-slate-800 shadow-lg">
                    {book.cover
                      ? <img src={book.cover} alt={book.title} className="pointer-events-none h-full w-full object-cover transition duration-500 group-hover:scale-106" />
                      : <div className="h-full w-full bg-violet-900/40 flex items-center justify-center text-2xl">📖</div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black shadow-lg" style={{ background: "rgba(109,40,217,0.85)", color: "#e9d5ff" }}>
                      {i + 2}
                    </span>
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="block text-[8px] font-semibold text-violet-300 uppercase tracking-wide truncate">{book.genre}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-300 font-bold">
                        <Eye className="h-2.5 w-2.5" />{book.reads}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-1.5 truncate text-[12px] font-bold text-white/90 group-hover:text-violet-300 transition-colors">{book.title}</h3>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">{book.author}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Loop topluluğu</p>
                <h2 className="mt-1 text-xl font-bold text-slate-400">Trend olan yerel yazarlar Türkiye</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-violet-300 hover:text-violet-700">
                Tümünü gör <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {trendAuthors.map((author, index) => (
                <article key={author.name} className={`relative w-[calc(100%-1rem)] flex-none overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${author.accent} p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.3)] sm:w-[34rem]`}>
                  <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[18px] border-white/10" />
                  <div className="pointer-events-none absolute bottom-20 left-1/3 h-px w-2/3 rotate-[-12deg] bg-white/20" />
                  <div className="relative flex items-center gap-5">
                    <div className="relative">
                      {author.avatar
                        ? <img src={author.avatar} alt={`${author.name} profil fotoğrafı`} className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-xl" />
                        : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-cyan-300 text-3xl font-black text-slate-950 ring-4 ring-white shadow-xl">{author.name.slice(0, 1).toUpperCase()}</div>}
                      <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950 shadow-lg">#{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-2xl font-black">{author.name}</h3>
                      <p className="mt-1 flex items-center gap-1 truncate text-sm font-medium text-slate-300"><MapPin className="h-3.5 w-3.5 shrink-0" /> {author.city} · {author.genre}</p>
                    </div>
                  </div>
                  <p className="relative mt-7 line-clamp-3 text-lg italic leading-8 text-slate-100">"{author.bio}"</p>
                  <div className="relative mt-7 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-center">
                    <div>
                      <p className="text-3xl font-black">{author.stories}</p>
                      <p className="mt-1 text-sm text-slate-300">Hikayeler</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black">{author.followers}</p>
                      <p className="mt-1 text-sm text-slate-300">Takipçiler</p>
                    </div>
                  </div>
                  <button type="button" className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"><UserPlus className="h-4 w-4" /> Takip et</button>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Loop anlatı haritası</p>
                <h2 className="mt-1 text-xl font-bold">Evrenlere Loop diye giriş yap</h2>
                <p className="mt-1 text-xs text-slate-400">{liveLoopCount > 0 ? `${liveLoopCount} gerçek zamanlı Loop yayında` : "Yeni Loop'lar burada görünecek"}</p>
              </div>
              <Globe2 className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {realUniverses.length === 0 ? (
                <div className="w-full rounded-2xl border border-dashed border-cyan-300/30 px-5 py-8 text-center"><p className="text-sm font-semibold text-slate-200">Henüz gerçek bir evren kartı yok.</p><p className="mt-1 text-xs text-slate-400">Evrenlerim alanından bir evren oluşturduğunda burada görünecek.</p><Link href="/notebook/calismalari" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-200">Evren oluştur <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              ) : realUniverses.map((universe) => (
                <article key={universe.title} onPointerDown={() => startUniversePress(universe)} onPointerUp={cancelUniversePress} onPointerLeave={cancelUniversePress} onPointerCancel={cancelUniversePress} className={`group relative w-72 flex-none overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${universe.color} shadow-lg transition hover:-translate-y-1 hover:shadow-cyan-950/40 sm:w-80`}>
                  <div className="relative h-40 overflow-hidden sm:h-44">
                    <img src={universe.cover} alt={`${universe.title} evreni`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {latestLoop?.mediaUrl && <span className="absolute bottom-3 left-4 rounded-full bg-cyan-400/90 px-2.5 py-1 text-[10px] font-black text-slate-950 shadow-lg">Son Loop: {latestLoop.title || "Yeni video"}</span>}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/30 p-1 pr-3 ring-1 ring-white/30 backdrop-blur-md">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-slate-950 ring-1 ring-white/70">
                        {universe.authorAvatar
                          ? <img src={universe.authorAvatar} alt={`${universe.author} profil fotoğrafı`} className="h-full w-full object-cover" />
                          : universe.author.slice(0, 1).toLocaleUpperCase("tr-TR")}
                      </span>
                      <span className="max-w-28 truncate text-[10px] font-semibold text-white/90">{universe.author}</span>
                    </div>
                    <span className="absolute right-4 top-4 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-slate-200 backdrop-blur">{universe.stories}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="relative text-xl font-black tracking-tight">{universe.title}</h3>
                    <p className="relative mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{universe.description}</p>
                  </div>
                  <div className="relative mx-5 flex items-center justify-between gap-3 border-t border-white/15 pb-5 pt-4">
                    <span className="text-xs font-semibold text-cyan-200">{universe.mood}</span>
                    <button type="button" onClick={() => setLocation("/kitaplar")} className="inline-flex items-center gap-1 text-xs font-bold text-white transition group-hover:text-cyan-200">Göz at <ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-[#efece7] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-300/70 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Loop kitap dolabı</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Raflardan keşfet</h2>
              </div>
              <div className="flex items-center gap-2">
                <select value={shelfCategory} onChange={(event) => setShelfCategory(event.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition hover:border-violet-300">
                  <option value="Tümü">Kategori seç</option>
                  {shelfRows.map((row) => <option key={row.title} value={row.title}>{row.title}</option>)}
                </select>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800">Tüm rafı gör <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-5 space-y-7">
              {visibleShelfRows.map((row) => (
                <div key={row.title}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{row.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{row.subtitle}</p>
                    </div>
                    <button type="button" className="shrink-0 text-xs font-bold text-slate-600 transition hover:text-violet-700">Daha fazla <ArrowRight className="inline h-3.5 w-3.5" /></button>
                  </div>
                  <div className="scrollbar-hide flex gap-4 overflow-x-auto border-b-[10px] border-amber-950/80 pb-3">
                    {row.books.map((book) => (
                      <article key={book.title} onClick={() => setLocation(`/kitap/${book.id}`)} className="group w-28 flex-none cursor-pointer sm:w-36">
                        <div className="relative h-40 overflow-hidden rounded-md bg-slate-300 shadow-[5px_6px_0_rgba(71,45,24,0.25)] sm:h-52">
                          {book.cover ? <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-violet-900/30 flex items-center justify-center text-3xl">📖</div>}
                          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{book.genre}</span>
                        </div>
                        <h4 className="mt-2 truncate text-xs font-bold text-slate-900 sm:text-sm">{book.title}</h4>
                        <p className="truncate text-[10px] text-slate-500 sm:text-xs">{book.author}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {interactiveStories.length > 0 && (
            <section className="overflow-hidden rounded-[1.5rem] bg-slate-950 p-4 text-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:p-6">
              <div className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Aİ destekli maceralara Loop diye dalış yap</p>
                  <h2 className="mt-1 text-xl font-black">Seçimlerinin neler yapabileceğini görmeye hazır mısın :)</h2>
                </div>
                <span className="text-[10px] text-slate-500">Okur kararlarıyla ilerler</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {interactiveStories.map(story => <InteractiveShelf key={story.id} story={story} />)}
              </div>
            </section>
          )}

          {selectedUniverse && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedUniverse.title} medya alanı`} onClick={() => setSelectedUniverse(null)}>
              <div onClick={(event) => event.stopPropagation()} className={`w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${selectedUniverse.color} p-4 text-white shadow-2xl sm:p-6`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">{selectedUniverse.author} evreninden</p>
                    <h2 className="mt-1 text-xl font-bold">{selectedUniverse.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedUniverse(null)} aria-label="Medya alanını kapat" className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedUniverse.gallery.map((image) => (
                    <img key={image} src={image} alt={`${selectedUniverse.title} evreninden kare`} className="h-28 w-full rounded-xl object-cover sm:h-36" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {showPerformance ? <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:p-6 lg:p-8">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-violet-300 font-semibold">📈 Performans Özeti</p>
                <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Haftalık etkileşim trendleri</h2>
                <p className="mt-2 text-sm text-slate-400">Kitaplığının son 7 gündeki hareketini tek bakışta gör.</p>
              </div>
              <button type="button" onClick={() => setShowPerformance(false)} aria-expanded={showPerformance} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                Kapat
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {performanceInsights.map((item, idx) => {
                const colors = ['from-violet-500 to-violet-700', 'from-sky-500 to-sky-700', 'from-fuchsia-500 to-fuchsia-700', 'from-amber-500 to-amber-700'];
                
                return (
                  <div key={item.label} className="rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur transition hover:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                      <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${colors[idx]}`} />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white sm:text-3xl">{item.value}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${colors[idx]}`} style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300 font-semibold">🗺️ Yayın hazırlık planı</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Lansman hazırlığı</h3>
                </div>
                {launchPreparation.length > 0 && <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowLaunchPreparationForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
                    Hazırlığı yenile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={removeLaunchPreparation} className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20">
                    Planı kaldır
                  </button>
                </div>}
              </div>
              {launchPreparation.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-violet-300/30 bg-violet-500/10 p-5 text-center">
                  <p className="text-sm font-bold text-white">Lansman yardımcısı henüz başlatılmadı.</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Sen sadece “Kapak hazır mı?” gibi sorularını sor. Yardımcı, unutmaman gereken bölüm taslağı, kapak, OK okuma listesi ve okuyucu yorumlarını burada tutar.</p>
                  <button type="button" onClick={addLaunchPreparation} className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-400">
                    Lansman yardımcısını başlat
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : <div className="grid gap-3 lg:grid-cols-3">
                {launchPreparation.map((item) => {
                  const statusColors: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'from-blue-500 to-blue-600',
                    'Planlandı': 'from-amber-500 to-amber-600',
                    'Hazır': 'from-emerald-500 to-emerald-600'
                  };
                  const statusBg: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'border-blue-400/30 bg-blue-500/10',
                    'Planlandı': 'border-amber-400/30 bg-amber-500/10',
                    'Hazır': 'border-emerald-400/30 bg-emerald-500/10'
                  };
                  const statusText: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'text-blue-300',
                    'Planlandı': 'text-amber-300',
                    'Hazır': 'text-emerald-300'
                  };
                  return (
                    <div key={item.id} className={`rounded-[1.25rem] border p-4 ${statusBg[item.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">{item.title}</h4>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusText[item.status]} border ${statusBg[item.status]}`}>{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-5">{item.description}</p>
                      <textarea
                        value={item.note ?? ""}
                        onChange={event => updateLaunchItem(item.id, { note: event.target.value })}
                        placeholder="Not al: ne yaptın, ne kaldı?"
                        rows={2}
                        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-600 focus:border-violet-300/50"
                      />
                      <button type="button" onClick={() => updateLaunchItem(item.id, { status: item.status === "Hazır" ? "Planlandı" : "Hazır" })} className="mt-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/10">
                        {item.status === "Hazır" ? "Tekrar açık işaretle" : "Yaptım, hazır"}
                      </button>
                    </div>
                  );
                })}
              </div>}
              {launchPreparation.length > 0 && (
                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Lansman yardımcısına not bırak</p>
                  <div className="mt-3 flex gap-2">
                    <input value={launchQuestion} onChange={event => setLaunchQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") saveLaunchQuestion(); }} placeholder="Örn. Kapak hazır mı, okuyucu yorumlarına bakıldı mı?" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50" />
                    <button type="button" onClick={saveLaunchQuestion} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">Not al</button>
                  </div>
                  {launchNotes.length > 0 && <div className="mt-3 space-y-2">{launchNotes.slice(0, 3).map(note => <div key={note.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300"><span className="mr-2 text-cyan-300">Not:</span>{note.text}</div>)}</div>}
                </div>
              )}
              {showLaunchPreparationForm && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
                  <div>
                    <p className="text-sm font-bold text-white">Ayrıntılı lansman planı hazır</p>
                    <p className="mt-1 text-xs text-slate-400">6 hazırlık adımı eklenerek bu alan gerçek zamanlı takip edilebilir hale gelecek.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowLaunchPreparationForm(false)} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10">Vazgeç</button>
                    <button type="button" onClick={addLaunchPreparation} className="rounded-full bg-violet-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-400">Planı ekle</button>
                  </div>
                </div>
              )}
            </div>
          </section> : <button type="button" onClick={() => setShowPerformance(true)} className="flex w-full items-center justify-between rounded-[1.25rem] border border-violet-200/30 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            <span>Haftalık etkileşim trendleri</span>
            <span className="inline-flex items-center gap-2 text-violet-300">Alanı aç <ChevronDown className="h-4 w-4" /></span>
          </button>}

          <section className="overflow-hidden rounded-[2rem] bg-[#f2eee8] p-4 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Yazar masan</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Yazılmaya devam edilen eserler</h2>
              </div>
              <Link href="/notebook/calismalari?tab=draft" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">Tümünü gör</Link>
            </div>
            {continuingBooks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-10 text-center">
                <p className="text-sm font-bold text-slate-700">Henüz devam eden bir eser yok</p>
                <Link href="/icerik-olustur" className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white">Yeni eser başlat</Link>
              </div>
            ) : (
            <div className="scrollbar-hide mt-5 flex snap-x gap-5 overflow-x-auto pb-2">
              {continuingBooks.map((book) => (
                <article
                  key={book.title}
                  role="link"
                  tabIndex={0}
                  onClick={() => setLocation(`/kitap/${book.id}`)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") setLocation(`/kitap/${book.id}`);
                  }}
                  className="group min-w-[calc(100%-1rem)] snap-start cursor-pointer overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_12px_35px_rgba(15,23,42,0.1)] transition hover:shadow-[0_18px_45px_rgba(15,23,42,0.16)] sm:min-w-[34rem] sm:p-5"
                >
                  <div className="flex flex-row items-center gap-3 sm:items-stretch sm:gap-6">
                    <div className="relative flex h-36 w-24 shrink-0 items-end justify-center overflow-hidden sm:h-64 sm:w-36">
                      {book.covers.map((cover, index) => (
                        <img key={cover} src={cover} alt={`${book.title} ${index + 1}. kapak`} className={`absolute rounded-lg object-cover shadow-xl ring-1 ring-slate-300 transition duration-300 group-hover:translate-y-[-3px] ${book.covers.length === 1 ? "left-1/2 h-36 w-24 -translate-x-1/2 sm:h-64 sm:w-36" : `w-16 sm:w-28 ${index === 0 ? "left-0 h-24 -rotate-6 sm:h-44" : index === 1 ? "left-4 z-10 h-32 sm:left-5 sm:h-52" : "right-0 h-24 rotate-6 sm:h-44"}`} `} />
                      ))}
                      {book.covers.length === 0 && <div className="flex h-36 w-24 items-center justify-center rounded-xl bg-slate-200 text-3xl sm:h-64 sm:w-36">📖</div>}
                    </div>
                    <div className="min-w-0 flex-1 self-end pb-1">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-violet-700">Yazmaya devam ediliyor</span>
                      <h3 className="mt-3 text-xl font-black text-slate-950 sm:text-2xl">{book.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{book.description || "Bu eserin cümleleri hâlâ yazılıyor."}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-sm italic text-slate-500">{book.chapters}</span>
                        <span className="rounded-full border border-emerald-400 px-3 py-1 font-bold text-emerald-700">{book.status}</span>
                        <span className="rounded-full border border-amber-400 px-3 py-1 font-bold text-amber-700">{book.rank}</span>
                      </div>
                      <div className="mt-4 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${book.progress}%` }} /></div><span className="text-[10px] font-bold text-slate-500">{book.progress}%</span></div>
                      <Link
                        href={`/kitap/${book.id}`}
                        onClick={event => event.stopPropagation()}
                        className="mt-4 inline-flex text-base font-bold text-violet-700 transition hover:text-slate-950"
                      >
                        Kitabı görüntüle <ArrowRight className="ml-1 inline h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            )}
          </section>

          <section className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Yayınlanan Kitaplar</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Son yayınlananlar</h3>
              </div>
              <Link href="/kitaplar" className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800">
                Tümü
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6">
              {_published.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">Henüz yayınlanan kitap yok</p>
                  <p className="text-slate-400/60 text-xs mt-1">Çalışmalarım → ⋯ → Yayınla</p>
                </div>
              ) : (
                <div className="flex min-w-0 min-h-[15rem] flex-nowrap snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 touch-pan-x">
                  {_published.map((book) => (
                    <Link key={book.id} href={`/kitap/${encodeURIComponent(String(book.id))}`} className="block flex-none snap-start cursor-pointer text-left touch-manipulation">
                      <article className="relative group h-48 w-32 cursor-pointer transition-transform duration-300 hover:-translate-y-1 sm:h-52 sm:w-36">
                        <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition-shadow duration-300 group-hover:shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
                          style={{ background: "rgba(109,40,217,0.15)" }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} className="pointer-events-none h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            : <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">📖</div>
                          }
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                            <div className="space-y-1">
                              <span className="inline-flex rounded-full bg-violet-500/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                                {(book.genres ?? [])[0] ?? "—"}
                              </span>
                              <h4 className="text-sm font-bold text-white line-clamp-2">{book.title || "Başlıksız"}</h4>
                              <p className="text-[10px] text-slate-300">{(book.chapters as unknown[])?.length ?? 0} bölüm · {(book.wordCount ?? 0).toLocaleString("tr")} kelime</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <h5 className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition">{book.title || "Başlıksız"}</h5>
                          <p className="text-xs text-slate-500 mt-0.5">{(book.genres ?? [])[0] ?? "—"}</p>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
        </div>
      )}
    </AppLayout>
  );
}
