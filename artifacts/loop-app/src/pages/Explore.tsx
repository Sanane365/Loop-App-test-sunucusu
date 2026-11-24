import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useListUsers,
  useGetTrending,
  useGetSuggestedUsers,
  useFollowUser,
  useUnfollowUser,
  getListUsersQueryKey,
  getGetTrendingQueryKey,
  getGetSuggestedUsersQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Flame, Heart, TrendingUp, MessageCircle, UserPlus, UserCheck, X, BookOpen, CalendarRange, ArrowLeft, Volume2, VolumeX, Send, Bookmark, Hash } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/shared/PostCard";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useQueryClient } from "@tanstack/react-query";
import { revealVideoAfterFrame } from "@/lib/video-visibility";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

type CategoryId = "kesfet" | "gundem" | "begeni" | "yukselenler" | "kitaplar" | "haftalik";

const normalizeLoopMediaUrl = (value: unknown) => {
  const mediaUrl = String(value || "");
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("/api/uploads/")) return mediaUrl;
  if (mediaUrl.startsWith("/uploads/")) return `/api${mediaUrl}`;
  return mediaUrl;
};

const EXPLORE_LOOP_SOUND_KEY = "loop-explore-sound-enabled";

const isLoopItem = (item: { sourceId?: number | null }) =>
  typeof item.sourceId === "number" && item.sourceId > 0;

const categories: { id: CategoryId; label: string; icon: React.ReactNode; title: string; desc: string }[] = [
  {
    id: "kesfet",
    label: "Keşfet",
    icon: <Search className="w-4 h-4" />,
    title: "Keşfet",
    desc: "İlgi alanlarına ve etkileşimlerine göre öne çıkan içerikleri keşfet.",
  },
  {
    id: "gundem",
    label: "Gündem",
    icon: <Flame className="w-4 h-4" />,
    title: "Gündemdeki Gönderiler",
    desc: "Güncelliği ve etkileşim ivmesi artan konuşmaları keşfet.",
  },
  {
    id: "begeni",
    label: "En Beğenilenler",
    icon: <Heart className="w-4 h-4" />,
    title: "En Beğenilenler",
    desc: "En çok beğeni alan içerikler burada sıralanıyor.",
  },
  {
    id: "yukselenler",
    label: "Yeni Yükselenler",
    icon: <TrendingUp className="w-4 h-4" />,
    title: "Yeni Yükselenler",
    desc: "Son 24 saatte hızla yükselen içerikler ve yaratıcılar.",
  },
  {
    id: "kitaplar",
    label: "Kitaplar",
    icon: <BookOpen className="w-4 h-4" />,
    title: "Kitaplar",
    desc: "Yayınlanan kitap önerileri ve içerik akışı burada toplanıyor.",
  },
  {
    id: "haftalik",
    label: "Haftalık Sıralama",
    icon: <CalendarRange className="w-4 h-4" />,
    title: "Haftalık Sıralama",
    desc: "Hafta içindeki en güçlü performans gösteren içerikler öne çıkıyor.",
  },
];

const getExplorePostTypeLabel = (post: { postType?: string; sourceId?: number | null; mediaType?: string }) => {
  if (isLoopItem(post)) return "Loop";
  switch (post.postType) {
    case "micro": return "Mikro kurgu";
    case "book": return "Kitap";
    case "trailer": return "Fragman";
    case "column": return "Köşe yazısı";
    case "bulletin": return "Bülten";
    case "poll": return "Anket";
    default: return post.mediaType && /video/i.test(post.mediaType) ? "Video" : "Gönderi";
  }
};

const getExplorePostText = (content: string, postType?: string) => {
  if (postType === "column") {
    const meta = content.match(/^\[\[column-style:.*?\]\]/s);
    return meta ? content.slice(meta[0].length).trim() : content;
  }
  if (postType === "book") {
    const meta = content.match(/^\[\[book-meta:(.*?)\]\]/s);
    if (meta) {
      try {
        const book = JSON.parse(meta[1]) as { title?: string; text?: string };
        return [book.title, book.text].filter(Boolean).join("\n");
      } catch {
        return content.slice(meta[0].length).trim();
      }
    }
  }
  return content;
};

function ExploreLoopCard({ loop, onOpen }: { loop: any; onOpen: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousVideoTimeRef = useRef(0);
  const interactionKey = `loop-interactions:${loop.id}`;
  const [isVisible, setIsVisible] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(EXPLORE_LOOP_SOUND_KEY) === "false";
    } catch {
      return false;
    }
  });
  const [videoProgress, setVideoProgress] = useState(0);
  const [liked, setLiked] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(interactionKey) || "null") as { liked?: boolean } | null;
      return typeof loop.liked === "boolean" ? loop.liked : Boolean(saved?.liked);
    } catch {
      return Boolean(loop.liked);
    }
  });
  const [likeCount, setLikeCount] = useState(Number(loop.likeCount ?? 0));
  const [saved, setSaved] = useState(() => {
    try {
      return Boolean((JSON.parse(localStorage.getItem(interactionKey) || "null") as { saved?: boolean } | null)?.saved);
    } catch {
      return false;
    }
  });
  const [commentCount] = useState(Number(loop.commentCount ?? 0));

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.55 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (isVisible) {
      void video.play().catch(() => {
        if (!muted) {
          video.muted = true;
          setMuted(true);
          void video.play().catch(() => {});
        }
      });
    }
    else video.pause();
  }, [isVisible, muted]);

  useEffect(() => {
    const updateProgress = () => {
      const video = videoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        const wrapped = previousVideoTimeRef.current > video.currentTime + 0.05;
        const isAtEnd = video.currentTime >= video.duration - 0.03;
        const progress = wrapped ? 0 : isAtEnd ? 100 : (video.currentTime / video.duration) * 100;
        setVideoProgress(Math.max(0, Math.min(100, progress)));
        previousVideoTimeRef.current = video.currentTime;
      }
    };
    const timer = window.setInterval(updateProgress, 50);
    return () => window.clearInterval(timer);
  }, [isVisible]);

  useEffect(() => {
    try {
      const current = JSON.parse(localStorage.getItem(interactionKey) || "{}") as Record<string, unknown>;
      localStorage.setItem(interactionKey, JSON.stringify({ ...current, liked, saved, likes: likeCount, comments: commentCount }));
    } catch {
      // Interaction state remains available for the current session.
    }
  }, [commentCount, interactionKey, likeCount, liked, saved]);

  const handleLike = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!loop.sourceId) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((value) => Math.max(0, value + (nextLiked ? 1 : -1)));
    try {
      const response = await fetch(`/api/loop/photos/${loop.sourceId}/react`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "❤️" }),
      });
      if (!response.ok) {
        setLiked(!nextLiked);
        setLikeCount((value) => Math.max(0, value + (nextLiked ? -1 : 1)));
      }
    } catch {
      setLiked(!nextLiked);
      setLikeCount((value) => Math.max(0, value + (nextLiked ? -1 : 1)));
    }
  };

  return (
    <article
      ref={cardRef}
      onPointerDown={() => {
        const video = videoRef.current;
        if (!video || muted) return;
        video.muted = false;
        void video.play().catch(() => {});
      }}
      onClick={onOpen}
      className="explore-loop-featured-card group relative mx-4 w-auto max-w-none cursor-pointer overflow-hidden rounded-2xl border border-violet-400/20 bg-[#0a0d13] text-white shadow-[0_20px_60px_rgba(16,18,28,0.34)] sm:rounded-[24px]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black sm:rounded-[24px]">
          <video
            ref={videoRef}
            src={loop.mediaUrl}
            className="loop-autoplay-video h-full w-full object-cover"
            muted={muted}
            loop
            playsInline
            preload={isVisible ? "auto" : "none"}
            onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
            onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
            onLoadedMetadata={(event) => {
              setVideoProgress(0);
              event.currentTarget.currentTime = 0;
            }}
            onDurationChange={() => setVideoProgress(0)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              const progress = Number.isFinite(video.duration) && video.duration > 0
                ? Math.max(0, Math.min(1, video.currentTime / video.duration))
                : 0;
              previousVideoTimeRef.current = video.currentTime;
              setVideoProgress(progress * 100);
            }}
            onEnded={() => setVideoProgress(0)}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,98,255,0.28),_rgba(10,13,19,0.1)_28%,_rgba(10,13,19,0.82)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#02050b]/95 via-[#030712]/25 to-[#030712]/20" />
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              {loop.user?.avatarUrl ? <img src={loop.user.avatarUrl} alt="" className="h-11 w-11 rounded-full border border-white/20 object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-black">{(loop.user?.displayName || "L").charAt(0).toUpperCase()}</div>}
              <div className="min-w-0">
                <UserNameWithDecorations user={loop.user} className="text-[18px] font-black text-white" showLabel={Boolean(loop.user?.badgeLabel)} />
                <p className="mt-1 truncate text-[11px] font-medium text-white/70">Loop paylaşımı</p>
              </div>
            </div>
            <span className="rounded-full border border-violet-200/25 bg-violet-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-100 backdrop-blur-md">Loop</span>
          </div>
          <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-4">
            <button type="button" onClick={handleLike} aria-label={liked ? "Beğeniyi geri al" : "Beğen"} className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${liked ? "bg-purple-500/25" : "bg-white/10"}`}><Heart className={`h-5 w-5 ${liked ? "fill-purple-500 text-purple-500" : ""}`} /></span>
              <span className="text-[12px] font-bold text-white/80">{likeCount}</span>
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label="Yorumları aç" className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><MessageCircle className="h-5 w-5" /></span>
              <span className="text-[12px] font-bold text-white/80">{commentCount}</span>
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label="Paylaş" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-sm"><Send className="h-5 w-5" /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); setSaved(value => !value); }} aria-label={saved ? "Kaydetmeyi kaldır" : "Kaydet"} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-sm"><Bookmark className={`h-5 w-5 ${saved ? "fill-amber-400 text-amber-400" : ""}`} /></button>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
            <p className="text-[24px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[28px]">{loop.content || "Yeni Loop"}</p>
            <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">#{String(loop.tags || "loop").replace(/^#/, "").split(/[\s,]+/)[0] || "loop"}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">#keşfet</span>
            </div>
            {loop.audio && String(loop.audio).toLowerCase() !== "orijinal ses" && <p className="border-t border-white/10 pt-2 text-[13px] font-medium text-white/80">{loop.audio}</p>}
            <div className="mt-3 flex items-end justify-between gap-3">
              <button
                type="button"
                aria-label="Videoda konum seç"
                onClick={(event) => {
                  event.stopPropagation();
                  const video = videoRef.current;
                  if (!video?.duration) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                  video.currentTime = progress * video.duration;
                  setVideoProgress(progress * 100);
                }}
                className="group/seek relative block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20"
              >
                <span className="absolute inset-y-0 left-0 block rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-white shadow-[0_0_12px_rgba(168,85,247,0.9)]" style={{ width: `${videoProgress}%` }} />
                <span className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-opacity group-hover/seek:opacity-100" style={{ left: `${videoProgress}%` }} />
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); setMuted(value => { const next = !value; try { localStorage.setItem(EXPLORE_LOOP_SOUND_KEY, String(!next)); } catch {} return next; }); }} aria-label={muted ? "Loop sesini aç" : "Loop sesini kapat"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
    </article>
  );
}

export default function Explore() {
  const { t } = useLanguage();
  const localizedCategories = categories.map(category => ({ ...category, label: ({ kesfet: t("exploreTopics"), gundem: t("trendingPosts"), begeni: t("mostLiked"), yukselenler: t("rising"), kitaplar: t("books"), haftalik: t("weekly") }[category.id]) }));
  const [searchQuery, setSearchQuery] = useState("");
  const [gundemSearchQuery, setGundemSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("kesfet");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [suggestedDismissed, setSuggestedDismissed] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: users, isLoading: loadingUsers } = useListUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 1, queryKey: getListUsersQueryKey({ q: searchQuery }) } }
  );

  const { data: trending, isLoading: loadingTrending } = useGetTrending({
    query: { queryKey: getGetTrendingQueryKey() },
  });
  const [additionalTrending, setAdditionalTrending] = useState<any[]>([]);
  const [trendingPage, setTrendingPage] = useState(1);
  const [trendingHasMore, setTrendingHasMore] = useState(false);
  const [loadingMoreTrending, setLoadingMoreTrending] = useState(false);
  const [trendingLoadError, setTrendingLoadError] = useState("");
  const trendingLoadLock = useRef(false);
  const trendingSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAdditionalTrending([]);
    setTrendingPage(1);
    setTrendingHasMore((trending?.length ?? 0) === 20);
    setTrendingLoadError("");
    trendingLoadLock.current = false;
  }, [trending]);

  const loadMoreTrending = useCallback(async () => {
    if (!trendingHasMore || loadingMoreTrending || trendingLoadLock.current) return;
    trendingLoadLock.current = true;
    setLoadingMoreTrending(true);
    setTrendingLoadError("");
    const nextPage = trendingPage + 1;
    try {
      const response = await fetch(`/api/explore/trending?page=${nextPage}`, { credentials: "include", cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "İçerikler yüklenemedi";
        throw new Error(message);
      }
      if (!Array.isArray(data)) throw new Error("İçerik yanıtı geçersiz");
      const incoming = data as any[];
      setAdditionalTrending(current => {
        const existing = new Set([...(trending ?? []), ...current].map(post => post.id));
        return [...current, ...incoming.filter(post => !existing.has(post.id))];
      });
      setTrendingPage(nextPage);
      setTrendingHasMore(incoming.length === 20);
    } catch (error) {
      setTrendingLoadError(error instanceof Error ? error.message : "Daha fazla içerik yüklenemedi");
    } finally {
      trendingLoadLock.current = false;
      setLoadingMoreTrending(false);
    }
  }, [loadingMoreTrending, trending, trendingHasMore, trendingPage]);

  const rankedTrending = useMemo(() => [...(trending ?? []), ...additionalTrending], [additionalTrending, trending]);

  useEffect(() => {
    const sentinel = trendingSentinelRef.current;
    if (!sentinel || loadingTrending || loadingMoreTrending || !trendingHasMore || trendingLoadError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMoreTrending();
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingMoreTrending, loadingTrending, loadMoreTrending, trendingHasMore, trendingLoadError]);

  const { data: suggested } = useGetSuggestedUsers({
    query: { queryKey: getGetSuggestedUsersQueryKey() },
  });

  const [loopDiscoverItems, setLoopDiscoverItems] = useState<any[]>([]);
  const [bookCatalog, setBookCatalog] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadLoops = async () => {
      try {
        const response = await fetch("/api/loop/photos", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const photos = (await response.json()) as Array<any>;
        if (cancelled) return;

        const mapped = photos
          .filter((photo) => {
            const mediaUrl = String(photo?.mediaUrl ?? "");
            return photo?.mediaType === "video" || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(mediaUrl);
          })
          .map((photo) => ({
            id: 1000000 + Number(photo.id ?? 0),
            sourceId: Number(photo.id ?? 0),
            userId: Number(photo.sender?.id ?? 0),
            user: {
              id: photo.sender?.id,
              displayName: photo.sender?.displayName || photo.sender?.username || "Loop kullanıcısı",
              avatarUrl: photo.sender?.avatarUrl || "",
              badgeAssetUrl: photo.sender?.badgeAssetUrl,
              emblemAssetUrl: photo.sender?.emblemAssetUrl,
              badgeLabel: photo.sender?.badgeLabel,
            },
            content: photo.title || photo.caption || photo.tags || "Yeni loop",
            tags: photo.tags || "loop",
            audio: photo.audio || "Orijinal ses",
            mediaUrl: normalizeLoopMediaUrl(photo.mediaUrl),
            mediaType: photo.mediaType || "video",
            likeCount: Number(photo.likeCount ?? photo.likes ?? 0),
            liked: Boolean(photo.liked),
            commentCount: Number(photo.commentCount ?? photo.comments ?? 0),
            createdAt: photo.createdAt || new Date().toISOString(),
          }));

        setLoopDiscoverItems(mapped);
      } catch {
        setLoopDiscoverItems([]);
      }
    };

    void loadLoops();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBooks = async () => {
      try {
        const response = await fetch("/api/books", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const books = (await response.json()) as Array<any>;
        if (cancelled) return;
        setBookCatalog(Array.isArray(books) ? books : []);
      } catch {
        if (!cancelled) setBookCatalog([]);
      }
    };

    void loadBooks();
    return () => {
      cancelled = true;
    };
  }, []);

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((me: { id?: number } | null) => {
        if (cancelled || !me?.id) return;
        return fetch(`/api/users/${me.id}/following`, { credentials: "include", cache: "no-store" });
      })
      .then((response) => response?.ok ? response.json() : [])
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setFollowingIds(new Set(data.map((followedUser: { id: number }) => followedUser.id)));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const handleFollow = (userId: number, isFollowing: boolean) => {
    if (isFollowing || followingIds.has(userId)) {
      unfollowMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    } else {
      followMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds(prev => new Set(prev).add(userId));
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    }
  };

  const activeCat = categories.find(c => c.id === activeCategory)!;
  const isDiscoverMode = activeCategory === "kesfet";
  const isLikedGridMode = activeCategory === "begeni";
  const isRisingGridMode = activeCategory === "yukselenler";
  const isBooksMode = activeCategory === "kitaplar";
  const isWeeklyMode = activeCategory === "haftalik";
  const compactNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(".0", "")}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
    return String(value);
  };

  const getTrendLabel = (tag: string) => {
    const normalized = tag.toLowerCase();
    const sportKeywords = ["futbol", "spor", "basketbol", "tenis", "maç", "gol", "lig", "transfer", "takim", "takım", "nba", "uefa", "champions", "galatasaray", "fenerbahce", "bjk", "gs", "mma", "kupa", "hakem"];
    const economyKeywords = ["ekonomi", "borsa", "dolar", "euro", "altın", "altin", "kripto", "yatirim", "para", "enflasyon", "bank", "finans"];
    const cultureKeywords = ["müzik", "muzik", "film", "dizi", "sinema", "kitap", "sanat", "kültür", "kultur", "oyun", "yazar", "album", "şarkı", "sarki"];
    const techKeywords = ["teknoloji", "yapayzeka", "ai", "software", "mobil", "ios", "android", "girişim", "girisim", "startup", "uygulama", "programlama", "siber"];
    const politicsKeywords = ["siyaset", "politik", "anket", "seçim", "secim", "hükümet", "hukümet", "bakan", "başbakan", "basbakan", "cumhurbaşkanı", "cumhurbaskani", "parti"];

    if (sportKeywords.some(keyword => normalized.includes(keyword))) return "Spor";
    if (economyKeywords.some(keyword => normalized.includes(keyword))) return "Ekonomi";
    if (cultureKeywords.some(keyword => normalized.includes(keyword))) return "Kültür";
    if (techKeywords.some(keyword => normalized.includes(keyword))) return "Teknoloji";
    if (politicsKeywords.some(keyword => normalized.includes(keyword))) return "Politika";
    return "Gündem";
  };

  const trendingTags = useMemo(() => {
    const tagCounts = new Map<string, number>();

    for (const post of rankedTrending) {
      const rawTags = Array.isArray((post as any)?.tags)
        ? (post as any).tags.join(" ")
        : String((post as any)?.tags ?? "");
      const rawText = `${post.content ?? ""} ${rawTags}`;
      const matches = rawText.match(/#[\p{L}\p{N}_]+/gu) ?? [];
      const uniqueTags = new Set<string>();

      for (const match of matches) {
        const normalized = match.slice(1).toLowerCase();
        if (normalized) uniqueTags.add(normalized);
      }

      for (const tag of uniqueTags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [rankedTrending]);

  const visibleTrendingTags = useMemo(() => {
    const query = gundemSearchQuery.replace(/^#/, "").trim().toLowerCase();
    const matching = query ? trendingTags.filter(({ tag }) => tag.includes(query)) : trendingTags;
    return matching.slice(0, 8);
  }, [gundemSearchQuery, trendingTags]);

  const handleTagClick = (tag: string) => {
    setLocation(`/?tag=${encodeURIComponent(tag)}`);
  };

  const handleExploreCardClick = (post: { id: number; sourceId?: number | null; mediaType?: string | null; mediaUrl?: string | null }) => {
    const isVideo = Boolean(post.mediaType && /video/i.test(post.mediaType)) || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(String(post.mediaUrl ?? ""));
    if (isVideo && isLoopItem(post)) setLocation(`/loops?loop=${post.sourceId}`);
    else setSelectedPostId(post.id);
  };

  const discoverItems = useMemo(() => {
    const rankedPosts = rankedTrending;
    const combined: any[] = [];
    for (let index = 0; index < rankedPosts.length; index += 4) {
      combined.push(...rankedPosts.slice(index, index + 4));
      if (loopDiscoverItems[index / 4]) combined.push(loopDiscoverItems[index / 4]);
    }
    combined.push(...loopDiscoverItems.slice(Math.ceil(rankedPosts.length / 4)));
    return combined;
  }, [rankedTrending, loopDiscoverItems]);

  const popularItems = useMemo(() => {
    const combined = [...rankedTrending, ...loopDiscoverItems];
    return [...combined].sort((a, b) => {
      const scoreA = Number(a.likeCount ?? 0) + Number(a.commentCount ?? 0) * 2;
      const scoreB = Number(b.likeCount ?? 0) + Number(b.commentCount ?? 0) * 2;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [rankedTrending, loopDiscoverItems]);

  const risingItems = useMemo(() => {
    const combined = [...rankedTrending, ...loopDiscoverItems];
    return [...combined].sort((a, b) => {
      const aDate = new Date(a.createdAt ?? 0).getTime();
      const bDate = new Date(b.createdAt ?? 0).getTime();
      const aScore = Number(a.likeCount ?? 0) + Number(a.commentCount ?? 0) * 2 + (Date.now() - aDate) / 1000000;
      const bScore = Number(b.likeCount ?? 0) + Number(b.commentCount ?? 0) * 2 + (Date.now() - bDate) / 1000000;
      return bScore - aScore;
    });
  }, [rankedTrending, loopDiscoverItems]);

  const activeGridItems = activeCategory === "begeni" ? popularItems : activeCategory === "yukselenler" ? risingItems : discoverItems;

  useEffect(() => {
    if (selectedPostId === null) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`explore-item-${selectedPostId}`)?.scrollIntoView({ behavior: "auto", block: "center" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [selectedPostId]);

  const weeklyRanking = useMemo(() => {
    const combined = [...rankedTrending, ...loopDiscoverItems];
    return [...combined]
      .sort((a, b) => {
        const aScore = Number(a.likeCount ?? 0) + Number(a.commentCount ?? 0) * 2 + Number(a.createdAt ? 1 : 0);
        const bScore = Number(b.likeCount ?? 0) + Number(b.commentCount ?? 0) * 2 + Number(b.createdAt ? 1 : 0);
        return bScore - aScore;
      })
      .slice(0, 8);
  }, [rankedTrending, loopDiscoverItems]);

  const booksForExplore = useMemo(() => {
    return [...bookCatalog]
      .filter((book) => book && (book.title || book.cover || book.subtitle || book.synopsis))
      .map((book) => ({
        id: String(book.id ?? book._id ?? Math.random().toString(36).slice(2)),
        title: book.title || "Başlıksız Kitap",
        subtitle: book.subtitle || book.synopsis || "Yeni yayın",
        cover: String(book.cover || "").trim(),
        authorName: book.author?.displayName || book.authorName || "Yazar",
        authorUsername: book.author?.username || book.authorUsername || "yazar",
        isPremium: Boolean(book.isPremiumAuthor || book.premium || book.author?.isPremiumAuthor),
        likes: Number(book.rating?.likeCount ?? book.likeCount ?? 0),
        chapters: Number(book.chapterCount ?? book.chapters?.length ?? 0),
        genre: Array.isArray(book.genres) && book.genres.length > 0 ? book.genres[0] : "Edebiyat",
      }))
      .sort((a, b) => b.likes - a.likes);
  }, [bookCatalog]);

  const premiumBooks = booksForExplore.filter((book) => book.isPremium);
  const regularBooks = booksForExplore.filter((book) => !book.isPremium);

  const sortedPosts = rankedTrending;

  return (
    <AppLayout>
      <div className="pb-20">
        {/* Search bar */}
        <div className="px-2.5 pt-3 pb-2 bg-background sticky top-14 z-30 border-b border-border">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4b5563] w-5 h-5" />
              <input
                type="text"
                placeholder="Ara"
                className="w-full pl-12 pr-4 py-2.5 rounded-[1.25rem] bg-[#f2f2f4] border border-[#e7e7ea] text-base text-foreground placeholder:text-[#5f6368] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-testid="input-explore-search"
              />
            </div>
            <button
              type="button"
              aria-label="Daha fazla seçenek"
              className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[#f2f2f4] border border-[#e7e7ea] text-[#4b5563] hover:bg-[#eaeaec] transition-colors shadow-[0_1px_0_rgba(15,23,42,0.04)]"
            >
              <span className="text-lg leading-none">•••</span>
            </button>
          </div>
        </div>

        {searchQuery.length > 1 ? (
          /* Search results */
          <div className="px-4 pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Arama Sonuçları
            </p>
            {loadingUsers ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))
            ) : users?.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
                <Search className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">"{searchQuery}" için sonuç bulunamadı</p>
              </div>
            ) : (
              users?.map(user => (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors"
                >
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <button
                    onClick={e => { e.preventDefault(); handleFollow(user.id, followingIds.has(user.id)); }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      followingIds.has(user.id)
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {followingIds.has(user.id) ? (
                      <><UserCheck className="w-3.5 h-3.5" /> Takiptesin</>
                    ) : (
                      <><UserPlus className="w-3.5 h-3.5" /> Takip Et</>
                    )}
                  </button>
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            {/* ── Tanıyabileceğin Kişiler — Üstte ── */}
            {!suggestedDismissed && suggested && suggested.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Tanıyabileceğin Kişiler
                  </p>
                  <button
                    onClick={() => setSuggestedDismissed(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {suggested.map(user => {
                    const isFollowed = followingIds.has(user.id) || (user as any).isFollowing;
                    return (
                      <div
                        key={user.id}
                        className="w-36 flex-shrink-0 bg-card border border-border rounded-2xl flex flex-col items-center gap-3 p-4 text-center"
                      >
                        <Link href={`/profile/${user.id}`}>
                          <Avatar className="w-14 h-14 cursor-pointer">
                            <AvatarImage src={user.avatarUrl || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                              {user.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="w-full min-w-0">
                          <p className="font-semibold text-sm truncate">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        </div>
                        <button
                          onClick={() => handleFollow(user.id, !!isFollowed)}
                          className={`w-full py-1.5 rounded-full text-xs font-semibold transition-all ${
                            isFollowed
                              ? "border border-border text-muted-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                          disabled={followMutation.isPending || unfollowMutation.isPending}
                        >
                          {isFollowed ? "Takiptesin" : "Takip Et"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category pills */}
            <div className="flex gap-2.5 overflow-x-auto px-4 py-3 hide-scrollbar">
              {localizedCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold flex-shrink-0 transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-foreground/10 dark:bg-foreground/10 text-foreground hover:bg-foreground/15"
                  }`}
                  style={activeCategory !== cat.id ? {
                    backgroundColor: "hsl(var(--foreground) / 0.1)"
                  } : {}}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>

            {(isDiscoverMode || isLikedGridMode || isRisingGridMode) ? (
              <div className="px-1 pb-8 pt-2">
                {loadingTrending ? (
                  <div className="grid grid-cols-3 gap-[2px]">
                    {Array(9).fill(0).map((_, i) => (
                      <div key={i} className="aspect-[4/5] animate-pulse rounded-[0.4rem] bg-muted" />
                    ))}
                  </div>
                ) : activeGridItems.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">Henüz içerik yok</div>
                ) : selectedPostId !== null ? (
                  <div className="instagram-feed explore-post-feed">
                    <button
                      type="button"
                      onClick={() => setSelectedPostId(null)}
                      className="sticky top-14 z-20 mx-2 flex items-center gap-2 rounded-xl bg-background/95 px-2 py-2 text-sm font-semibold text-muted-foreground backdrop-blur-md hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Keşfet
                    </button>
                    {activeGridItems.map((item) => {
                      const isVideo = Boolean(item.mediaType && /video/i.test(item.mediaType)) || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(String(item.mediaUrl ?? ""));
                      const isLoop = isLoopItem(item);
                      return (
                        <div key={item.id} id={`explore-item-${item.id}`}>
                          {isVideo && isLoop ? (
                            <ExploreLoopCard loop={item} onOpen={() => setLocation(`/loops?loop=${item.sourceId}`)} />
                          ) : (
                            <PostCard post={item} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-[2px]">
                    {activeGridItems.map((post) => {
                      const imageUrl = post.backgroundUrl || post.mediaUrl || "";
                      const isVideoItem = !post.backgroundUrl && (Boolean(post.mediaType && /video/i.test(post.mediaType)) || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(String(post.mediaUrl ?? "")));
                      const usesContentCard = ["micro", "column", "poll"].includes(post.postType);
                      const showMedia = Boolean(imageUrl) && (Boolean(post.backgroundUrl) || !usesContentCard);
                      const hasMedia = Boolean(imageUrl && !isVideoItem === false);
                      const accent = [
                        "linear-gradient(135deg, #f7d7c8 0%, #9e7aea 45%, #1f2937 100%)",
                        "linear-gradient(135deg, #dbeafe 0%, #a78bfa 30%, #0f172a 100%)",
                        "linear-gradient(135deg, #fef3c7 0%, #f9a8d4 38%, #1f2937 100%)",
                        "linear-gradient(135deg, #d1fae5 0%, #67e8f9 35%, #111827 100%)",
                        "linear-gradient(135deg, #f5d0fe 0%, #c084fc 38%, #111827 100%)",
                        "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 25%, #0f172a 100%)",
                      ][Math.abs(post.id) % 6];

                      const textPreview = getExplorePostText(post.content || "", post.postType).replace(/\s+/g, " ").trim() || "Yeni içerik";
                      const previewText = textPreview.length > 88 ? `${textPreview.slice(0, 85)}…` : textPreview;

                      return (
                        <Link
                          key={post.id}
                          href={isVideoItem && isLoopItem(post) ? `/loops?loop=${post.sourceId}` : "#"}
                          onClick={(event) => {
                            event.preventDefault();
                            handleExploreCardClick(post);
                          }}
                          className="group relative overflow-hidden rounded-[0.35rem] bg-card"
                        >
                          <div className="relative aspect-[4/5] overflow-hidden rounded-[0.35rem]">
                            {isVideoItem && showMedia ? (
                              <video
                                src={imageUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : showMedia ? (
                              <img
                                src={imageUrl}
                                alt={post.content || "Keşfet içeriği"}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[0.85rem] border border-white/10 bg-[radial-gradient(circle_at_top,#433d8b_0%,#1d2343_30%,#0b1220_70%,#070b14_100%)] p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_25px_rgba(15,23,42,0.28)]" style={{ background: accent }}>
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_32%,rgba(15,23,42,0.35)_100%)]" />
                                <div className="relative flex items-center justify-between gap-2 text-[7.5px] text-white/80">
                                  <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 backdrop-blur-sm">
                                    {post.user?.displayName?.split(" ")[0] || "Kullanıcı"}
                                  </span>
                                  <span className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/15 px-1 py-0.5 backdrop-blur-sm">
                                    <Heart className="w-2.5 h-2.5" />
                                    {compactNumber(post.likeCount)}
                                  </span>
                                </div>

                                <div className="relative mt-2 rounded-[0.8rem] border border-white/10 bg-black/15 p-2.5 backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                  <div className="mb-1.5 flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.18em] text-violet-200/90">
                                    <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                                    {getExplorePostTypeLabel(post)}
                                  </div>
                                  <p className="line-clamp-5 text-[10px] font-medium leading-[1.45] tracking-[-0.01em] text-white/95">
                                    {previewText}
                                  </p>
                                  {post.postType === "poll" && Array.isArray(post.pollOptions) && (
                                    <div className="mt-2 space-y-1">
                                      {(post.pollOptions as string[]).slice(0, 3).map((option, index) => (
                                        <div key={`${post.id}-poll-${index}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[8px] text-white/85">{option}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="relative mt-2 flex items-center justify-between text-[7px] text-white/75">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">{getExplorePostTypeLabel(post)}</span>
                                  <span className="flex items-center gap-0.5">
                                    <MessageCircle className="w-2.5 h-2.5" />
                                    {compactNumber(post.commentCount)}
                                  </span>
                                </div>
                              </div>
                            )}
                            {isVideoItem && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-sm">
                                  <span className="ml-0.5 text-[8px]">▶</span>
                                </div>
                              </div>
                            )}
                            {!isVideoItem && !showMedia && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                            )}
                            {showMedia && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                            )}
                            {showMedia && (
                              <div className="absolute left-1.5 right-1.5 top-1.5 flex items-center justify-between">
                                <div className="rounded-full bg-black/25 px-1.5 py-0.5 text-[7.5px] font-semibold text-white/90 backdrop-blur-sm">
                                  {post.user?.displayName?.split(" ")[0] || "Kullanıcı"}
                                </div>
                                <div className="flex items-center gap-0.5 rounded-full bg-black/25 px-1 py-0.5 text-[7.5px] font-medium text-white/90 backdrop-blur-sm">
                                  <Heart className="w-2.5 h-2.5" />
                                  {compactNumber(post.likeCount)}
                                </div>
                              </div>
                            )}
                            {showMedia && (
                              <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[7.5px] font-semibold text-white/90">{getExplorePostTypeLabel(post)}</p>
                                  {isLoopItem(post) && <p className="truncate text-[7.5px] font-medium text-white/75">{post.content || "Yeni Loop"}</p>}
                                </div>
                                <div className="flex items-center gap-0.5 rounded-full bg-black/20 px-1 py-0.5 text-[7.5px] text-white/90 backdrop-blur-sm">
                                  <MessageCircle className="w-2.5 h-2.5" />
                                  {compactNumber(post.commentCount)}
                                </div>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeCategory === "gundem" ? (
              <div className="px-4 pb-8 pt-3">
                <section className="relative mb-4 overflow-hidden rounded-[1.6rem] border border-violet-300/20 bg-[linear-gradient(135deg,rgba(124,58,237,0.16),rgba(217,70,239,0.08)_55%,rgba(14,165,233,0.08))] p-4 shadow-[0_18px_55px_rgba(91,33,182,0.08)]">
                  <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-fuchsia-400/10 blur-3xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-500">
                        <Flame className="h-3.5 w-3.5" />
                        Loop Nabız
                      </div>
                      <h2 className="text-xl font-black tracking-tight text-foreground">Şu an konuşulanlar</h2>
                      <p className="mt-1 max-w-[25rem] text-xs leading-5 text-muted-foreground">Topluluğun paylaşımlarında öne çıkan konulara göz at, sohbete kendi sesini kat.</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-background/70 text-violet-500 shadow-sm">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </section>
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="search"
                    value={gundemSearchQuery}
                    onChange={(event) => setGundemSearchQuery(event.target.value)}
                    placeholder="Gündemde hashtag ara"
                    aria-label="Gündemde hashtag ara"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {gundemSearchQuery && (
                    <button type="button" onClick={() => setGundemSearchQuery("")} aria-label="Hashtag aramasını temizle" className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {loadingTrending ? (
                    Array(6).fill(0).map((_, idx) => (
                      <div key={idx} className="animate-pulse rounded-2xl border border-border bg-card p-3">
                        <div className="mb-2 h-2.5 w-24 rounded bg-muted" />
                        <div className="h-7 w-40 rounded bg-muted" />
                      </div>
                    ))
                  ) : visibleTrendingTags.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-muted-foreground">
                      <Hash className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      <p className="text-sm font-semibold">{gundemSearchQuery.trim() ? "Bu hashtag ile eşleşen gündem yok" : "Henüz gündem etiketi yok"}</p>
                      <p className="mt-1 text-xs">Yeni etiketler paylaşımlarla burada görünür.</p>
                    </div>
                  ) : (
                    visibleTrendingTags.map(({ tag, count }, index) => {
                      const label = getTrendLabel(tag);

                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagClick(tag)}
                          className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border bg-card/80 px-3 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-violet-500/[0.035] hover:shadow-[0_14px_34px_rgba(99,102,241,0.1)]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-[12px] font-black ${index === 0 ? "border-orange-400/20 bg-orange-500/10 text-orange-500" : "border-violet-400/15 bg-violet-500/[0.08] text-violet-500"}`}>
                              {index === 0 ? <Flame className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{label}</p>
                                {index === 0 && <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-orange-500">Öne çıkan</span>}
                              </div>
                              <p className="mt-1 truncate text-[17px] font-bold tracking-[-0.035em] text-foreground">
                                #{tag}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-black tabular-nums text-foreground">{compactNumber(count)}</span>
                            <span className="text-[9px] font-medium text-muted-foreground">gönderi</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : isBooksMode ? (
              <div className="px-4 pb-8 pt-3">
                <div className="space-y-5">
                  {premiumBooks.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Premium kitaplar</p>
                        <span className="text-[11px] text-muted-foreground">{premiumBooks.length} özel seçim</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {premiumBooks.slice(0, 4).map((book) => (
                          <Link
                            key={book.id}
                            href={`/kitap/${book.id}`}
                            className="group relative overflow-hidden rounded-[1.5rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(109,40,217,0.12))] p-2.5 shadow-[0_16px_45px_rgba(251,191,36,0.1)]"
                          >
                            <div className="relative overflow-hidden rounded-[1.1rem] border border-white/10 bg-card">
                              {book.cover ? (
                                <img src={book.cover} alt={book.title} className="h-44 w-full object-cover transition duration-300 group-hover:scale-105" />
                              ) : (
                                <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-violet-500/20 to-amber-500/20 text-4xl text-violet-200">
                                  <BookOpen className="h-9 w-9" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                              <div className="absolute left-2 right-2 bottom-2">
                                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-300">Premium</p>
                                <h3 className="mt-1 text-sm font-black text-white line-clamp-2">{book.title}</h3>
                                <p className="mt-1 text-[10px] text-white/70">{book.authorName}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Kitaplar</p>
                      <span className="text-[11px] text-muted-foreground">{booksForExplore.length} eser</span>
                    </div>

                    {booksForExplore.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
                        Henüz yayınlanmış kitap yok.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {booksForExplore.map((book) => (
                          <Link
                            key={book.id}
                            href={`/kitap/${book.id}`}
                            className="group overflow-hidden rounded-[1.4rem] border border-border bg-card p-2.5 transition-all hover:border-violet-400/40 hover:shadow-[0_18px_40px_rgba(124,58,237,0.12)]"
                          >
                            <div className="overflow-hidden rounded-[1rem] border border-border bg-muted">
                              {book.cover ? (
                                <img src={book.cover} alt={book.title} className="h-40 w-full object-cover transition duration-300 group-hover:scale-105" />
                              ) : (
                                <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-violet-500/15 to-slate-500/10 text-4xl text-violet-200">
                                  <BookOpen className="h-8 w-8" />
                                </div>
                              )}
                            </div>
                            <div className="mt-2.5 min-w-0">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-300">
                                  {book.genre}
                                </span>
                                {book.isPremium && (
                                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-amber-300">
                                    Premium
                                  </span>
                                )}
                              </div>
                              <h3 className="line-clamp-2 text-sm font-black text-foreground">{book.title}</h3>
                              <p className="mt-1 truncate text-[10px] text-muted-foreground">{book.authorName}</p>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{book.chapters} bölüm</span>
                                <span>{book.likes} beğeni</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            ) : isWeeklyMode ? (
              <div className="px-4 pb-8 pt-3">
                <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#14131d_0%,#111827_32%,#0b1220_100%)] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.38)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-300">Haftalık sıralama</p>
                      <h2 className="mt-1 text-xl font-black text-white tracking-[-0.04em]">Bu hafta öne çıkan içerikler</h2>
                    </div>
                    <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-200">
                      7G
                    </div>
                  </div>

                  {weeklyRanking.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                      Bu hafta henüz sıralama yok.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weeklyRanking.map((item, index) => {
                        const isVideo = Boolean(item.mediaType && /video/i.test(item.mediaType)) || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(String(item.mediaUrl ?? ""));
                        const topColors = ["from-violet-500 to-purple-500", "from-cyan-500 to-sky-500", "from-amber-400 to-orange-500", "from-rose-500 to-pink-500"];

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleExploreCardClick(item)}
                            className="group flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/5 p-2.5 text-left transition-all hover:border-violet-400/40 hover:bg-white/8"
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${topColors[index % topColors.length]} text-lg font-black text-white shadow-lg`}>
                              #{index + 1}
                            </div>

                            <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800">
                              {item.mediaUrl ? (
                                isVideo ? (
                                  <video
                                    src={item.mediaUrl}
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                    className="loop-autoplay-video h-full w-full object-cover"
                                    onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
                                    onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
                                  />
                                ) : (
                                  <img src={item.mediaUrl} alt={item.content || "İçerik"} className="h-full w-full object-cover" />
                                )
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/20 to-slate-500/20 text-xs text-violet-200">
                                  <BookOpen className="h-4 w-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-200">
                                  {isVideo ? "Loop" : "Gönderi"}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {item.user?.displayName || "Kullanıcı"}
                                </span>
                              </div>
                              <p className="truncate text-sm font-semibold text-white">{item.content || "Yeni içerik"}</p>
                              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{compactNumber(Number(item.likeCount ?? 0))}</span>
                                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{compactNumber(Number(item.commentCount ?? 0))}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-4 mt-2 rounded-3xl bg-[#12121a] dark:bg-[#12121a] overflow-hidden" style={{ background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
                <div className="p-6 pb-4">
                  <p className="text-xs font-bold tracking-[0.2em] text-white/40 uppercase mb-2">K E Ş F E T</p>
                  <h1 className="text-3xl font-bold text-white leading-tight mb-4">{activeCat.title}</h1>
                  <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-white/70 text-sm mb-3">
                    Kategoriye göre filtrelenmiş içerikler
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{activeCat.desc}</p>
                </div>

                <div className="px-4 pb-6 space-y-3">
                  {loadingTrending ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="flex-1 h-4 bg-white/10 rounded" />
                      </div>
                    ))
                  ) : sortedPosts.length === 0 ? (
                    <div className="text-center py-10 text-white/40">
                      Henüz içerik yok
                    </div>
                  ) : (
                    sortedPosts.map((post, idx) => (
                      <Link
                        key={post.id}
                        href={`/profile/${post.userId}`}
                        className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-white/70 text-sm font-bold">#{idx + 1}</span>
                        </div>

                        <Avatar className="w-11 h-11 flex-shrink-0 border border-white/20">
                          <AvatarImage src={post.user?.avatarUrl || ""} />
                          <AvatarFallback className="bg-primary/30 text-white font-bold">
                            {post.user?.displayName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">{post.user?.displayName}</p>
                          {post.content && (
                            <p className="text-white/40 text-xs truncate mt-0.5">{post.content}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 text-white/60 text-sm">
                          <span className="flex items-center gap-1">
                            {post.likeCount}
                            <Heart className="w-3.5 h-3.5" />
                          </span>
                          <span className="flex items-center gap-1">
                            {post.commentCount}
                            <MessageCircle className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {!isBooksMode && trendingHasMore && (
          <div ref={trendingSentinelRef} className="flex min-h-16 items-center justify-center px-4 py-4 text-xs text-muted-foreground" aria-live="polite">
            {loadingMoreTrending && "Daha fazla içerik yükleniyor…"}
            {trendingLoadError && <span role="alert">{trendingLoadError} <button type="button" onClick={() => void loadMoreTrending()} className="font-bold underline">Yeniden dene</button></span>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
