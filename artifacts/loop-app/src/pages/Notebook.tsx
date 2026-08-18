import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowRight, BookOpen, Bookmark, ChevronDown, ChevronUp, Eye, Globe2, Heart, Home, MapPin, MoreVertical, Pen, Search, Sparkles, Star, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { useEffect, useRef } from "react";
import { useSearch, Link } from "wouter";
import { PostCard } from "@/components/shared/PostCard";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const librarySummary = {
  title: "Loop Kitaplık",
  subtitle: "Kitap yazma ve okuma deneyimini tek bir profesyonel panelde birleştirin.",
  stats: [
    { label: "Aktif Proje", value: "Derin Mesafe" },
    { label: "Tamamlanan Bölümler", value: "8/12" },
    { label: "Okuma Süresi", value: "15 saat" },
  ],
};

const performanceInsights = [
  { label: "Haftalık Okuma", value: "9.4K", progress: 82 },
  { label: "Beğeni Artışı", value: "+18%", progress: 64 },
  { label: "Yeni Aboneler", value: "+320", progress: 71 },
  { label: "Ortalama Süre", value: "14 dk", progress: 56 },
];

type LaunchStatus = "Devam ediyor" | "Planlandı" | "Hazır";

type LaunchPipelineItem = {
  title: string;
  description: string;
  status: LaunchStatus;
};

const launchPipeline: LaunchPipelineItem[] = [
  { title: "Bölüm 9 taslağı", description: "Bitiş sahnelerini tamamla ve akışı sıkılaştır.", status: "Devam ediyor" },
  { title: "Kapak revizesi", description: "Formalite koleksiyonuna uygun tipografi seç.", status: "Planlandı" },
  { title: "OK okunma listesi", description: "Okuyucu notlarını toparla ve yeni öneriler ekle.", status: "Hazır" },
];


const rankings = [
  { rank: 1, title: "Beklenen Kaos", reads: "4.8K" },
  { rank: 2, title: "Ölüm İksiri", reads: "3.2K" },
  { rank: 3, title: "Yıldızların Altında", reads: "5.7K" },
];

const libraryCategories = [
  { name: "Roman", count: 24 },
  { name: "Polisiye", count: 18 },
  { name: "Fantastik", count: 12 },
  { name: "Kişisel Gelişim", count: 9 },
];






const featuredAuthors = [
  { name: "Hülya_Aslıkc", role: "Yerel yazar", bio: "Gözle görülmeyeni kalemle çiziyorum. Yarım kalan kitapların ve yeni başlangıçların yazarı.", genre: "Romantizm", stories: "10", followers: "9.1K", city: "İstanbul", accent: "from-fuchsia-950 via-slate-900 to-cyan-950", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80" },
  { name: "İrem Uslu", role: "Yerel yazar", bio: "Duygusal karşılaşmaları ve ikinci şansları sade, güçlü karakterlerle anlatıyor.", genre: "Romantizm", stories: "8", followers: "7.4K", city: "İzmir", accent: "from-amber-950 via-slate-900 to-rose-950", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=80" },
  { name: "Uygar Y.", role: "Yerel yazar", bio: "Büyüme sancılarını, dostluğu ve hayata tutunma hikâyelerini yazıyor.", genre: "Genç Yetişkin", stories: "12", followers: "6.8K", city: "Ankara", accent: "from-blue-950 via-slate-900 to-violet-950", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80" },
  { name: "Ece Y.", role: "Yerel yazar", bio: "Gökyüzü, eski haritalar ve başka dünyalar arasında yeni yollar açıyor.", genre: "Fantastik", stories: "6", followers: "5.2K", city: "Antalya", accent: "from-emerald-950 via-slate-900 to-sky-950", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80" },
  { name: "Deniz K.", role: "Yerel yazar", bio: "Sessiz mekânların içindeki sırları ve beklenmedik dönüşleri keşfediyor.", genre: "Gerilim", stories: "10", followers: "4.7K", city: "Bursa", accent: "from-red-950 via-slate-900 to-orange-950", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80" },
];

const loopUniverses = [
  { title: "Geceye Kalanlar", description: "Sessiz şehirlerde saklanan sırların, yarım kalmış cümlelerin ve cesur başlangıçların evreni.", mood: "Gizemli · Duygusal", stories: "128 öykü", color: "from-indigo-950 via-slate-900 to-cyan-950", author: "Hülya_Aslıkc", authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=80"] },
  { title: "Kayıp Haritalar", description: "Her yolculuğun yeni bir kapı açtığı, keşif ve maceranın hiç bitmediği geniş bir dünya.", mood: "Macera · Keşif", stories: "94 öykü", color: "from-emerald-950 via-slate-900 to-teal-950", author: "Arda S.", authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=700&q=80"] },
  { title: "Kalbin Kıyısı", description: "İkinci şanslara, eski mektuplara ve birbirini yeniden bulan kalplere ayrılmış sıcak bir evren.", mood: "Romantik · Sıcak", stories: "216 öykü", color: "from-rose-950 via-slate-900 to-orange-950", author: "İrem Uslu", authorAvatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=700&q=80"] },
  { title: "Başka Bir Gökyüzü", description: "Kuralların değiştiği, yıldızların yol gösterdiği ve hayal gücünün sınır tanımadığı dünya.", mood: "Fantastik · Sonsuz", stories: "76 öykü", color: "from-violet-950 via-slate-900 to-fuchsia-950", author: "Ece Y.", authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=700&q=80"] },
];



const loopUniversesFull = loopUniverses;


export default function WriteBook() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"books" | "users">("books");
  const [showStats, setShowStats] = useState(true);
  const [showStudioDetails, setShowStudioDetails] = useState(false);
  const [showStudio, setShowStudio] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [premiumIndex, setPremiumIndex] = useState(0);
  const [currentTab, setCurrentTab] = useState("books");
  // Auto-advance and touch/swipe controls for premium area
  const premiumAreaRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const pausedUntilRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const PAUSE_AFTER_MANUAL_MS = 10000;
  const PAUSE_AFTER_BACK_SWIPE_MS = 20000;
  const [showPerformance, setShowPerformance] = useState(true);
  const [shelfCategory, setShelfCategory] = useState("Tümü");
  const [selectedUniverse, setSelectedUniverse] = useState<(typeof loopUniverses)[number] | null>(null);
  const [libraryView, setLibraryView] = useState<"shelves" | "new" | "liked">("shelves");
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [catSearchMode, setCatSearchMode] = useState<"books" | "authors">("books");
  const universePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyCarouselRef = useRef<HTMLDivElement>(null);

  // ── Gerçek yayınlanan kitaplar — localStorage'dan doğrudan oku ──────
  const _published: Array<{
    id: string; title: string; cover?: string | null;
    genres?: string[]; wordCount?: number; chapters?: unknown[];
    synopsis?: string; updatedAt: string;
  }> = (() => {
    try {
      const raw = localStorage.getItem("loop_drafts_v1");
      if (!raw) return [];
      return (JSON.parse(raw) as any[])
        .filter((d: any) => d.status === "published")
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch { return []; }
  })();

  // Tür → yayınlanan kitap sayısı (gerçek sayaç)
  const _genreCount: Record<string, number> = {};
  for (const book of _published) {
    for (const g of (book.genres ?? [])) {
      _genreCount[g] = (_genreCount[g] ?? 0) + 1;
    }
  }

  // Kategori listesi — sayılar gerçek veriden geliyor
  const allCategories = [
    { name: "Romantizm",    count: _genreCount["Romantizm"]    ?? 0, icon: "💕" },
    { name: "Fantastik",    count: _genreCount["Fantastik"]    ?? 0, icon: "✨" },
    { name: "Gerilim",      count: _genreCount["Gerilim"]      ?? 0, icon: "😰" },
    { name: "Bilim Kurgu",  count: _genreCount["Bilim Kurgu"]  ?? 0, icon: "🚀" },
    { name: "Tarih",        count: _genreCount["Tarih"]        ?? 0, icon: "🏛️" },
    { name: "Gizem",        count: _genreCount["Gizem"]        ?? 0, icon: "🔍" },
    { name: "Macera",       count: _genreCount["Macera"]       ?? 0, icon: "🗺️" },
    { name: "Korku",        count: _genreCount["Korku"]        ?? 0, icon: "👻" },
    { name: "Komedi",       count: _genreCount["Komedi"]       ?? 0, icon: "😂" },
    { name: "Drama",        count: _genreCount["Drama"]        ?? 0, icon: "🎭" },
    { name: "Şiir",         count: _genreCount["Şiir"]         ?? 0, icon: "🖋️" },
    { name: "Deneme",       count: _genreCount["Deneme"]       ?? 0, icon: "✍️" },
  ];

  const startUniversePress = (universe: (typeof loopUniverses)[number]) => {
    universePressTimer.current = setTimeout(() => setSelectedUniverse(universe), 550);
  };

  const cancelUniversePress = () => {
    if (universePressTimer.current) {
      clearTimeout(universePressTimer.current);
      universePressTimer.current = null;
    }
  };

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "categories") {
      setCurrentTab("categories");
    } else if (tab === "library") {
      setCurrentTab("library");
    } else {
      setCurrentTab("books");
    }
  }, [search]);

  // Scroll listener removed — thumbnail strip now uses click-based navigation only.

  const selectStory = (index: number) => {
    const card = storyCarouselRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setSelectedStoryIndex(index);
  };

  const selectPremium = (index: number) => {
    setPremiumIndex(index);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  const prevPremium = () => {
    setPremiumIndex((prev) => (prev - 1 + Math.max(_published.length, 1)) % Math.max(_published.length, 1));
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_BACK_SWIPE_MS;
  };

  const nextPremium = () => {
    setPremiumIndex((prev) => (prev + 1) % Math.max(_published.length, 1));
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  useEffect(() => {
    const startAutoAdvance = () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = window.setInterval(() => {
        if (Date.now() < pausedUntilRef.current) return;
        setPremiumIndex((prev) => (prev + 1) % Math.max(_published.length, 1));
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
        setPremiumIndex((prev) => (prev + 1) % Math.max(_published.length, 1));
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
  }, []);


  // Taslaklar (yayınlanmamış çalışmalar)
  const _drafts: typeof _published = (() => {
    try {
      const raw = localStorage.getItem("loop_drafts_v1");
      if (!raw) return [];
      return (JSON.parse(raw) as any[])
        .filter((d: any) => d.status !== "published")
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch { return []; }
  })();

  // _published kitaplarını türe göre grupla
  const _publishedByGenre: Record<string, typeof _published> = {};
  for (const book of _published) {
    for (const g of (book.genres ?? [])) {
      if (!_publishedByGenre[g]) _publishedByGenre[g] = [];
      _publishedByGenre[g].push(book);
    }
  }
  const _publishedShelfRows = Object.entries(_publishedByGenre).map(([genre, books]) => ({
    title: genre,
    subtitle: `${genre} türündeki yayınlarınız`,
    books,
  }));

  const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredCollection = _published.filter((book) => {
    if (!query || searchMode === "users") return true;
    return [book.title, ...(book.genres ?? []), book.synopsis ?? ""].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  const filteredUsers = featuredAuthors.filter((user) => {
    if (!query) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  // Categories tab — independent search (gerçek yayınlanan kitaplar üzerinden)
  const catQuery = catSearchQuery.trim().toLocaleLowerCase("tr-TR");
  const catFilteredBooks = _published.filter((book) => {
    if (!catQuery) return true;
    return [book.title, ...(book.genres ?? []), book.synopsis ?? ""].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });
  const catFilteredAuthors = featuredAuthors.filter((user) => {
    if (!catQuery) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });

  const visibleShelfRows = shelfCategory === "Tümü"
    ? _publishedShelfRows
    : _publishedShelfRows.filter((row) => row.title === shelfCategory);

  return (
    <AppLayout>
      {currentTab === "categories" ? (
        <div className="writebook-page min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 py-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 overflow-x-hidden">
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
                        <Link key={book.id} href={`/kitap/${book.id}`}>
                          <div className="flex items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 hover:border-violet-200 hover:bg-violet-50/50 transition cursor-pointer">
                            <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg shadow-sm bg-slate-200">
                              {book.cover
                                ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                                : <div className="flex h-full w-full items-center justify-center text-xl">📖</div>
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate">{book.title}</p>
                              <p className="text-xs text-slate-500 truncate">{(book.genres ?? [])[0] ?? "—"} · {(book.wordCount ?? 0).toLocaleString("tr")} kelime</p>
                            </div>
                            <span className="ml-auto flex-shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{(book.genres ?? [])[0] ?? "—"}</span>
                          </div>
                        </Link>
                      ))}
                      {catFilteredBooks.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">"{catSearchQuery}" için kitap bulunamadı.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catFilteredAuthors.slice(0, 6).map((author) => (
                        <div key={author.name} className="flex items-center gap-3 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 hover:border-violet-200 hover:bg-violet-50/50 transition">
                          <img src={author.avatar} alt={author.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{author.name}</p>
                            <p className="text-xs text-slate-500 truncate">{author.genre} · {author.city}</p>
                          </div>
                          <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{author.followers}</span>
                        </div>
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
                <button
                  key={category.name}
                  type="button"
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
                </button>
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
                {_publishedShelfRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-slate-400 text-sm font-medium">Henüz yayınlanan kitap yok</p>
                    <Link href="/notebook/calismalari" className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/25">
                      Çalışmalarım <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  _publishedShelfRows.map((row) => (
                    <section key={row.title}>
                      <div className="mb-4 flex items-end justify-between">
                        <div>
                          <h2 className="text-base font-bold text-white">{row.title}</h2>
                          <p className="text-xs text-slate-500 mt-0.5">{row.subtitle}</p>
                        </div>
                        <button className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition">Tümü →</button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory" style={{scrollbarWidth:"none"}}>
                        {row.books.map((book) => (
                          <Link key={book.id} href={`/kitap/${book.id}`}>
                            <div className="group flex-shrink-0 snap-start w-32 sm:w-36 cursor-pointer">
                              <div className="relative h-48 sm:h-52 w-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-[1.03]">
                                {book.cover
                                  ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                                  : <div className="flex h-full w-full items-center justify-center bg-violet-900/50 text-4xl">📖</div>
                                }
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                <span className="absolute bottom-2 left-2 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[9px] font-semibold text-white/90 uppercase tracking-wide">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                              </div>
                              <p className="mt-2 text-xs font-semibold text-slate-200 line-clamp-2 leading-tight">{book.title || "Başlıksız"}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}

            {/* YENİ EKLEDİKLERİM */}
            {libraryView === "new" && (
              <div className="pt-4">
                {_published.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-slate-400 text-sm font-medium">Henüz yayınlanan kitap yok</p>
                    <Link href="/notebook/calismalari" className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/25">
                      Çalışmalarım <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {_published.map((book, idx) => (
                      <Link key={book.id} href={`/kitap/${book.id}`}>
                        <div className="group cursor-pointer">
                          <div className="relative overflow-hidden rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.03]">
                            {book.cover
                              ? <img src={book.cover} alt={book.title} className="h-44 sm:h-52 w-full object-cover" />
                              : <div className="flex h-44 sm:h-52 w-full items-center justify-center bg-violet-900/50 text-4xl">📖</div>
                            }
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{book.title || "Başlıksız"}</p>
                            </div>
                            <div className="absolute top-2 right-2">
                              <span className="rounded-full bg-violet-500/80 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between px-0.5">
                            <p className="text-[10px] text-slate-500">
                              {idx === 0 ? "Bugün" : idx < 3 ? "Dün" : idx < 6 ? "3 gün önce" : "Bu hafta"}
                            </p>
                            <Bookmark className="h-3.5 w-3.5 text-slate-600" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BEĞENDİKLERİM */}
            {libraryView === "liked" && (
              <div className="pt-4 space-y-3">
                {_published.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Heart className="mx-auto h-8 w-8 text-slate-600 mb-3" />
                    <p className="text-slate-400 text-sm font-medium">Henüz yayınlanan kitap yok</p>
                  </div>
                ) : (
                  _published.map((book) => (
                    <Link key={book.id} href={`/kitap/${book.id}`}>
                      <div className="group flex items-center gap-4 rounded-2xl bg-white/5 border border-white/8 px-4 py-3 hover:bg-white/8 transition-all duration-200 cursor-pointer">
                        <div className="relative flex-shrink-0 h-16 w-12 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)] bg-violet-900/50">
                          {book.cover
                            ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                            : <div className="flex h-full w-full items-center justify-center text-xl">📖</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-white line-clamp-1">{book.title || "Başlıksız"}</p>
                          <p className="text-xs text-slate-400 mt-0.5"><span className="text-violet-400">{(book.genres ?? [])[0] ?? "Kitap"}</span></p>
                          {book.synopsis ? (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{book.synopsis}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
                          <span className="text-[10px] text-slate-500">{(book.wordCount ?? 0).toLocaleString("tr")} kelime</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
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
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">Derin Mesafe</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 p-4 sm:p-5 ring-1 ring-sky-400/30 backdrop-blur hover:ring-sky-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-sky-200 font-semibold">✍️ Toplam Kelime</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">42.8K</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10 p-4 sm:p-5 ring-1 ring-fuchsia-400/30 backdrop-blur hover:ring-fuchsia-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-fuchsia-200 font-semibold">⚡ Okuma Hızı</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">2.1K / gün</p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-gradient-to-r from-white/10 to-white/5 p-3 sm:p-5 text-slate-100 backdrop-blur">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">✨ 7 yeni öneri</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">🎬 3 canlı</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">📊 2 akış</span>
                  </div>
                </div>
                </>}
              </div>

              {showStudioDetails && showStats && <div className="writebook-panel rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-white/15 via-white/10 to-white/5 p-4 sm:p-6 lg:p-8 shadow-[0_30px_60px_rgba(15,23,42,0.25)] backdrop-blur-2xl hover:border-white/30 transition">
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
                      <p className="mt-2 sm:mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-violet-400 to-violet-300 bg-clip-text text-transparent">12</p>
                    </div>
                    <div className="text-3xl sm:text-4xl lg:text-5xl text-violet-500/50">📖</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4 sm:mb-6">Dijital vitrinde öne çıkan yayınlar.</p>
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 px-5 py-4 border border-violet-400/30 hover:border-violet-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-violet-200 font-semibold">📈 Haftalık Etkileşim</p>
                      <p className="mt-3 text-2xl font-bold text-white">8.3K</p>
                      <p className="text-xs text-violet-200/70 mt-2">+12% geçen haftaya göre</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 px-5 py-4 border border-sky-400/30 hover:border-sky-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-sky-200 font-semibold">⭐ Yeni Favoriler</p>
                      <p className="mt-3 text-2xl font-bold text-white">24</p>
                      <p className="text-xs text-sky-200/70 mt-2">Bu haftaki yeni eklenenler</p>
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
          {_published.length > 0 && (
          <section className="relative overflow-hidden rounded-[2rem] shadow-[0_32px_100px_rgba(0,0,0,0.35)]">
            {/* Blurred backdrop */}
            <div className="absolute inset-0 -z-0 overflow-hidden">
              {_published.map((story, index) => story.cover ? (
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
                  <p className="text-[9px] uppercase tracking-[0.35em] text-amber-300/80 font-semibold">Yayınlanan Kitaplar</p>
                  <h2 className="text-sm font-bold text-white leading-tight">Öne Çıkan Hikayeler</h2>
                </div>
              </div>
              <Link href="/notebook/calismalari" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/15 hover:text-white">
                Tümü <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Active story — hero */}
            <div className="relative z-10 px-5 pt-5 sm:px-7">
              {(() => {
                const story = _published[selectedStoryIndex] ?? _published[0];
                if (!story) return null;
                return (
                  <div className="flex gap-4 sm:gap-6">
                    {/* Cover */}
                    <div className="relative flex-shrink-0 w-28 sm:w-36">
                      <div className="relative h-40 sm:h-52 w-full overflow-hidden rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] bg-violet-900/50">
                        {story.cover
                          ? <img src={story.cover} alt={story.title} className="h-full w-full object-cover transition-all duration-500" />
                          : <div className="flex h-full w-full items-center justify-center text-5xl">📖</div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                      <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow-lg">
                        #{selectedStoryIndex + 1}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 min-w-0 flex-col justify-between py-1">
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-full bg-violet-500/20 border border-violet-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wide">
                          {(story.genres ?? [])[0] ?? "Kitap"}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">{story.title || "Başlıksız"}</h3>
                        {story.synopsis && <p className="text-[11px] sm:text-xs text-slate-400 leading-5 line-clamp-3">{story.synopsis}</p>}
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">
                          <BookOpen className="h-3 w-3" /> {(story.chapters as unknown[])?.length ?? 0} bölüm
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-400/20 px-2.5 py-1 text-[10px] text-violet-300">
                          ✍️ {(story.wordCount ?? 0).toLocaleString("tr")} kelime
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
              {_published.map((story, index) => (
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
                  <div className="h-20 sm:h-24 w-full bg-violet-900/60 flex items-center justify-center">
                    {story.cover
                      ? <img src={story.cover} alt={story.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      : <span className="text-2xl">📖</span>
                    }
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {selectedStoryIndex === index && (
                    <div className="absolute bottom-1.5 left-0 right-0 px-1.5">
                      <p className="text-[8px] font-bold text-white/90 line-clamp-1 text-center">{story.title || "Başlıksız"}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Progress dots */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 pb-4">
              {_published.map((_, index) => (
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

          {_published.length > 0 && (() => {
            const safeIndex = premiumIndex % _published.length;
            const premium = _published[safeIndex];
            return (
              <section
                ref={premiumAreaRef}
                className="relative isolate overflow-hidden rounded-[2rem] text-white"
                style={{ boxShadow: "0 32px 110px rgba(120,53,15,0.28)" }}
              >
                {/* Backdrop — kapak görseli */}
                {_published.map((pb, i) => pb.cover ? (
                  <img
                    key={pb.id} src={pb.cover} alt="" aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      zIndex: -20,
                      transform: "scale(1.18)",
                      filter: "blur(24px)",
                      opacity: i === safeIndex ? 1 : 0,
                      transition: "opacity 0.85s ease",
                      willChange: "opacity",
                    }}
                  />
                ) : null)}
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/65 to-[#180d00]/90" />

                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.38em] text-amber-400/75">Yayınlanan Kitaplar</p>
                    <h2 className="mt-0.5 text-[17px] font-black tracking-tight leading-tight">Kitap Vitrini</h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-300/55 bg-amber-950/55 px-3 py-1.5 text-[11px] font-black text-amber-200 backdrop-blur">✦ Yayında</span>
                </div>

                {/* Cover + Info */}
                <div className="mt-3 flex gap-3 px-4">
                  <div
                    className="relative shrink-0 overflow-hidden rounded-2xl bg-violet-900/60"
                    style={{ width: 108, aspectRatio: "2/3", boxShadow: "0 14px 48px rgba(0,0,0,0.65)" }}
                  >
                    {_published.map((pb, i) => (
                      pb.cover
                        ? <img key={pb.id} src={pb.cover} alt={pb.title} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: i === safeIndex ? 1 : 0, transition: "opacity 0.65s ease" }} />
                        : null
                    ))}
                    {!premium.cover && <div className="flex h-full w-full items-center justify-center text-4xl">📖</div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                    <span className="absolute left-2 top-2 rounded-full border border-amber-300/65 bg-black/55 px-2 py-0.5 text-[10px] font-black text-amber-200 backdrop-blur">
                      #{safeIndex + 1}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-900/35 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                        {(premium.genres ?? [])[0] ?? "Kitap"}
                      </span>
                      <h3 className="mt-2 font-serif text-[22px] font-black leading-[1.15] text-white line-clamp-2">{premium.title || "Başlıksız"}</h3>
                      {premium.synopsis && <p className="mt-2 line-clamp-4 text-[11px] leading-[1.65] text-slate-300/90">{premium.synopsis}</p>}
                      <p className="mt-1.5 text-[10px] text-slate-400">{(premium.wordCount ?? 0).toLocaleString("tr")} kelime · {(premium.chapters as unknown[])?.length ?? 0} bölüm</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/kitap/${premium.id}`}
                        className="rounded-full px-4 py-2 text-[11px] font-black text-black transition active:scale-95"
                        style={{ background: "linear-gradient(135deg,#fcd34d,#f59e0b)" }}
                      >
                        Kitaba Git <ArrowRight className="ml-0.5 inline h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Thumbnail nav */}
                {_published.length > 1 && (
                  <div className="mt-3 flex gap-2 px-4 pb-4">
                    {_published.map((pb, i) => (
                      <button
                        key={pb.id}
                        type="button"
                        aria-label={`${pb.title || "Kitap"} kitabını göster`}
                        aria-current={i === safeIndex ? "true" : undefined}
                        onClick={() => selectPremium(i)}
                        className="relative flex-1 overflow-hidden rounded-xl transition-all duration-300 bg-violet-900/60"
                        style={{
                          height: 52,
                          border: i === safeIndex ? "2px solid #fcd34d" : "2px solid rgba(255,255,255,0.1)",
                          opacity: i === safeIndex ? 1 : 0.42,
                          boxShadow: i === safeIndex ? "0 0 14px rgba(252,211,77,0.35)" : "none",
                        }}
                      >
                        {pb.cover
                          ? <img src={pb.cover} alt={pb.title || "Kitap"} className="h-full w-full object-cover" />
                          : <div className="flex h-full w-full items-center justify-center text-lg">📖</div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <span className="absolute bottom-1 right-1.5 max-w-[52px] truncate text-[7px] font-semibold text-white/65">{pb.title || "Başlıksız"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {_published.length > 0 && (
          <section className="overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-violet-600">Yayınlanan kitapların</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Sizin İçin Önerdiğimiz</h2>
              </div>
              <Link href="/notebook/calismalari" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
                Tümünü gör <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {_published.map((book) => (
                <Link key={book.id} href={`/kitap/${book.id}`}>
                  <article className="group w-32 flex-none sm:w-40 cursor-pointer">
                    <div className="relative h-48 overflow-hidden rounded-xl bg-slate-200 shadow-md sm:h-60">
                      {book.cover
                        ? <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        : <div className="flex h-full w-full items-center justify-center text-4xl bg-violet-100">📖</div>
                      }
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 pt-10">
                        <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                      </div>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-bold text-slate-900 group-hover:text-violet-700">{book.title || "Başlıksız"}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{(book.chapters as unknown[])?.length ?? 0} bölüm</p>
                  </article>
                </Link>
              ))}
            </div>
          </section>
          )}

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
            {_published.length > 0 && (() => {
              const top = _published[0];
              return (
                <div className="mt-3 mx-4 relative overflow-hidden rounded-2xl" style={{ height: 130 }}>
                  {top.cover && <img src={top.cover} alt={top.title} className="absolute inset-0 h-full w-full object-cover scale-110" style={{ filter: "blur(2px)" }} />}
                  {!top.cover && <div className="absolute inset-0 bg-violet-950" />}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.2) 100%)" }} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[72px] font-black leading-none select-none" style={{ color: "rgba(255,255,255,0.06)" }}>1</span>
                  <div className="relative flex h-full items-center gap-3 px-3">
                    <div className="h-20 w-14 shrink-0 rounded-xl overflow-hidden shadow-lg ring-2 ring-amber-400/60 bg-violet-900/50 flex items-center justify-center">
                      {top.cover
                        ? <img src={top.cover} alt={top.title} className="h-full w-full object-cover" />
                        : <span className="text-2xl">📖</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-black">#1 Bu Hafta</span>
                      <h3 className="mt-1.5 text-[17px] font-black leading-tight text-white line-clamp-1">{top.title || "Başlıksız"}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-300/80"><span className="text-violet-300">{(top.genres ?? [])[0] ?? "Kitap"}</span></p>
                      <div className="mt-2 flex items-center gap-3">
                        <Link href={`/kitap/${top.id}`} className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition-colors">
                          Oku
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* #2–N horizontal scroll */}
            {_published.length > 1 && (
              <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto px-4 pb-4">
                {_published.slice(1).map((book, i) => (
                  <Link key={book.id} href={`/kitap/${book.id}`}>
                    <article className="group w-28 flex-none cursor-pointer">
                      <div className="relative h-40 overflow-hidden rounded-xl bg-violet-900/50 shadow-lg">
                        {book.cover
                          ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          : <div className="flex h-full w-full items-center justify-center text-3xl">📖</div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black shadow-lg" style={{ background: "rgba(109,40,217,0.85)", color: "#e9d5ff" }}>
                          {i + 2}
                        </span>
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="block text-[8px] font-semibold text-violet-300 uppercase tracking-wide truncate">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                        </div>
                      </div>
                      <h3 className="mt-1.5 truncate text-[12px] font-bold text-white/90 group-hover:text-violet-300 transition-colors">{book.title || "Başlıksız"}</h3>
                    </article>
                  </Link>
                ))}
              </div>
            )}
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
              {featuredAuthors.map((author, index) => (
                <article key={author.name} className={`relative w-[calc(100%-1rem)] flex-none overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${author.accent} p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.3)] sm:w-[34rem]`}>
                  <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[18px] border-white/10" />
                  <div className="pointer-events-none absolute bottom-20 left-1/3 h-px w-2/3 rotate-[-12deg] bg-white/20" />
                  <div className="relative flex items-center gap-5">
                    <div className="relative">
                      <img src={author.avatar} alt={`${author.name} profil fotoğrafı`} className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-xl" />
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
                <p className="mt-1 text-xs text-slate-400">karta basılı tut :)</p>
              </div>
              <Globe2 className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {loopUniverses.map((universe) => (
                <article key={universe.title} onPointerDown={() => startUniversePress(universe)} onPointerUp={cancelUniversePress} onPointerLeave={cancelUniversePress} onPointerCancel={cancelUniversePress} className={`group relative w-72 flex-none overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${universe.color} shadow-lg transition hover:-translate-y-1 hover:shadow-cyan-950/40 sm:w-80`}>
                  <div className="relative h-40 overflow-hidden sm:h-44">
                    <img src={universe.cover} alt={`${universe.title} evreni`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/30 p-1 pr-3 ring-1 ring-white/30 backdrop-blur-md">
                      <img src={universe.authorAvatar} alt={`${universe.author} profil fotoğrafı`} className="h-9 w-9 rounded-full object-cover opacity-90 ring-1 ring-white/70" />
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
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-white transition group-hover:text-cyan-200">Keşfet <ArrowRight className="h-3.5 w-3.5" /></button>
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
                  {_publishedShelfRows.map((row) => <option key={row.title} value={row.title}>{row.title}</option>)}
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
                      <Link key={book.id} href={`/kitap/${book.id}`}>
                        <article className="group w-28 flex-none sm:w-36 cursor-pointer">
                          <div className="relative h-40 overflow-hidden rounded-md bg-slate-300 shadow-[5px_6px_0_rgba(71,45,24,0.25)] sm:h-52">
                            {book.cover
                              ? <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                              : <div className="flex h-full w-full items-center justify-center text-4xl bg-violet-100">📖</div>
                            }
                            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                          </div>
                          <h4 className="mt-2 truncate text-xs font-bold text-slate-900 sm:text-sm">{book.title || "Başlıksız"}</h4>
                        </article>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {selectedUniverse && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedUniverse.title} medya alanı`}>
              <div className={`w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${selectedUniverse.color} p-4 text-white shadow-2xl sm:p-6`}>
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
                  <div className="relative h-28 overflow-hidden rounded-xl bg-black/30 sm:h-36">
                    <video className="h-full w-full object-cover" muted loop autoPlay playsInline src="https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">Video</span>
                  </div>
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
                  <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300 font-semibold">🗺️ Yayın Yol Haritası</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Lansman akışı</h3>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
                  Güncelle
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {launchPipeline.map((item) => {
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
                    <div key={item.title} className={`rounded-[1.25rem] border p-4 ${statusBg[item.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">{item.title}</h4>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusText[item.status]} border ${statusBg[item.status]}`}>{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-5">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section> : <button type="button" onClick={() => setShowPerformance(true)} className="flex w-full items-center justify-between rounded-[1.25rem] border border-violet-200/30 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            <span>Haftalık etkileşim trendleri</span>
            <span className="inline-flex items-center gap-2 text-violet-300">Alanı aç <ChevronDown className="h-4 w-4" /></span>
          </button>}

          <section className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-cyan-950/30 to-slate-950 p-4 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Okuma yolculuğun</p>
                <h2 className="mt-1 text-2xl font-black text-white">Devam Edenler</h2>
              </div>
              <button type="button" className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15">Tümünü gör</button>
            </div>
            <div className="scrollbar-hide mt-5 flex snap-x gap-5 overflow-x-auto pb-2">
              {_drafts.length === 0 ? (
                <div className="flex w-full flex-col items-center justify-center py-10 text-center">
                  <p className="text-slate-400 text-sm font-medium">Devam eden taslak yok</p>
                  <Link href="/notebook/calismalari" className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25">
                    Yeni kitap başlat <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : _drafts.map((book) => (
                <Link key={book.id} href={`/kitap/${book.id}/duzenle`}>
                  <article className="group min-w-[calc(100%-1rem)] snap-start overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl backdrop-blur sm:min-w-[34rem] sm:p-5 cursor-pointer">
                    <div className="flex gap-3 sm:gap-5">
                      <div className="relative flex h-40 w-28 shrink-0 items-center justify-center sm:h-52 sm:w-36">
                        <div className="relative h-full w-full overflow-hidden rounded-lg bg-violet-900/50 shadow-xl ring-1 ring-white/20">
                          {book.cover
                            ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                            : <div className="flex h-full w-full items-center justify-center text-5xl">📖</div>
                          }
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 self-end pb-1">
                        <span className="inline-flex rounded-full bg-cyan-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-200">Taslak · Devam ediyor</span>
                        <h3 className="mt-3 text-xl font-black text-white sm:text-2xl">{book.title || "Başlıksız"}</h3>
                        {book.synopsis && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{book.synopsis}</p>}
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-violet-400/60 px-3 py-1 font-bold text-violet-300">{(book.genres ?? [])[0] ?? "Kitap"}</span>
                          <span className="text-sm italic text-slate-400">{(book.chapters as unknown[])?.length ?? 0} bölüm · {(book.wordCount ?? 0).toLocaleString("tr")} kelime</span>
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[40%] rounded-full bg-gradient-to-r from-cyan-300 to-violet-400" /></div>
                        <button type="button" className="mt-4 text-base font-bold text-cyan-300 transition hover:text-white">Düzenlemeye devam et <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
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
                <div className="flex flex-wrap gap-6 justify-start items-end">
                  {_published.slice(0, 4).map((book) => (
                    <Link key={book.id} href={`/kitap/${book.id}`}>
                      <article className="relative group h-64 w-40 cursor-pointer transition-transform duration-300 hover:scale-105">
                        <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition-shadow duration-300 group-hover:shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
                          style={{ background: "rgba(109,40,217,0.15)" }}>
                          {book.cover
                            ? <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
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
