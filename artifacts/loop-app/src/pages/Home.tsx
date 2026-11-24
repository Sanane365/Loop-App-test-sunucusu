import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { useListPosts, getListPostsQueryKey, useListStories, getListStoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { revealVideoAfterFrame } from "@/lib/video-visibility";
import { StoryRow } from "@/components/shared/StoryRow";
import { PostCard } from "@/components/shared/PostCard";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, TrendingUp, UserCheck, Leaf, Sparkles, SlidersHorizontal, Pencil, BarChart2, AlignLeft, Bot, Send, ChevronRight, MessageCircle, X, BookOpen, Play, Heart, Share2, Bookmark, MoreHorizontal, Music2, UserPlus, Search, Volume2, VolumeX, Hash } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { splitVideoForStories } from "@/lib/storyVideo";
import { useLanguage } from "@/hooks/use-language";

type FilterType = "trend" | "takipte" | "yeni" | "bulten" | "sana-ozel" | "anonim-sorular" | "kitaplar";

type HomeMiniLoop = {
  id: number;
  title: string;
  creator: string;
  username?: string;
  tag: string;
  views: number;
  cover: string;
  avatar: string;
  video: string;
  audio?: string;
  mediaType?: "video" | "image";
  badge?: string | null;
  badgeAssetUrl?: string | null;
  badgeLabel?: string | null;
  isFollowing?: boolean;
};

const formatLoopViews = (value: number | string | undefined) => {
  if (typeof value === "number") {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
    return String(value);
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return "New";
};

const rotateMiniLoops = (loops: HomeMiniLoop[], slot: number) => {
  if (loops.length < 2) return loops;
  const offset = (slot * 3) % loops.length;
  return [...loops.slice(offset), ...loops.slice(0, offset)];
};

const resolveLoopMediaType = (loop: { mediaType?: string; mediaUrl?: string }) => {
  if (loop.mediaType === "video" || loop.mediaType === "image") {
    return loop.mediaType;
  }
  return /\.(mp4|webm|mov|m4v|avi)(?:\?|$)/i.test(loop.mediaUrl || "") ? "video" : "image";
};

const hasHashtag = (post: { content?: string | null; tags?: unknown }) => {
  const content = post.content ?? "";
  const tags = Array.isArray(post.tags) ? post.tags.join(" ") : String(post.tags ?? "");
  return /#[\p{L}\p{N}_]+/u.test(content) || /#[\p{L}\p{N}_]+/u.test(tags);
};

const filters: { id: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "trend",         label: "Trend",           icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-primary"      },
  { id: "takipte",       label: "Takipte",          icon: <UserCheck className="w-3.5 h-3.5" />,   color: "text-orange-500"   },
  { id: "yeni",          label: "Gündem",           icon: <Leaf className="w-3.5 h-3.5" />,        color: "text-green-500"    },
  { id: "bulten",        label: "Bülten",           icon: <Sparkles className="w-3.5 h-3.5 text-primary" />,    color: "text-primary"   },
  { id: "sana-ozel",     label: "Sana Özel",        icon: <Sparkles className="w-3.5 h-3.5" />,    color: "text-blue-500"     },
  { id: "anonim-sorular",label: "Anonim Sorular",   icon: <Bot className="w-3.5 h-3.5" />,         color: "text-violet-500"   },
  { id: "kitaplar",      label: "Kitaplar",          icon: <BookOpen className="w-3.5 h-3.5" />,    color: "text-cyan-500"     },
];

const formatRealCounter = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return String(value);
};

type LoopPhotoDetail = {
  id: number;
  title?: string;
  reactions: Array<{ emoji: string; user?: { id: number; displayName?: string | null; avatarUrl?: string | null } | null }>;
  replies: Array<{ content: string; user?: { id: number; displayName?: string | null; avatarUrl?: string | null } | null; createdAt: string }>;
};

function LoopCommentBottomSheet({
  loop,
  detail,
  isOpen,
  onClose,
  onSubmit,
  commentText,
  setCommentText,
  submittingComment,
}: {
  loop: HomeMiniLoop;
  detail?: LoopPhotoDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  commentText: string;
  setCommentText: (value: string) => void;
  submittingComment: boolean;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    startYRef.current = event.touches[0]?.clientY ?? null;
    draggingRef.current = true;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!draggingRef.current || startYRef.current === null) return;
    setDragOffset(Math.max(0, (event.touches[0]?.clientY ?? startYRef.current) - startYRef.current));
  };

  const handleTouchEnd = () => {
    draggingRef.current = false;
    if (dragOffset > 120) onClose();
    setDragOffset(0);
    startYRef.current = null;
  };

  if (!isOpen) return null;

  const replies = detail?.replies ?? [];

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] flex-col rounded-t-[28px] bg-background"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: draggingRef.current ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex cursor-grab select-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="text-[15px] font-bold leading-tight">Yorumlar</p>
            <p className="text-[12px] text-muted-foreground">{replies.length} yorum</p>
          </div>
          <div className="h-8 w-8" />
        </div>

        <div className="h-px bg-border/60 mx-4" />

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {replies.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <MessageCircle className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">İlk yorumu sen yap!</p>
            </div>
          ) : (
            replies.map((reply, idx) => (
              <div key={`${reply.content}-${reply.user?.displayName ?? "anon"}-${idx}`} className="flex gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(reply.user?.displayName || "K").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold text-foreground">{reply.user?.displayName || "Kullanıcı"}</span>
                    <span className="text-[11px] text-muted-foreground">· {new Date(reply.createdAt || Date.now()).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className="text-[14px] leading-[1.45] text-foreground break-words whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2 py-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              placeholder="Yorum yaz..."
              className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={!commentText.trim() || submittingComment}
              onClick={() => void onSubmit()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              {submittingComment ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopShareBottomSheet({
  loop,
  isOpen,
  onClose,
  onShared,
}: {
  loop: HomeMiniLoop;
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      setSearchQuery("");
      setSearchResults([]);
      setSent(new Set());
      return;
    }

    requestAnimationFrame(() => setVisible(true));
    fetch("/api/dm/conversations", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setContacts(data.map((c: any) => c.user).filter(Boolean));
      })
      .catch(() => {});
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await r.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  }, []);

  const shareToStory = async () => {
    try {
      const snippet = (loop.title || "Loop").slice(0, 60) || "Loop";
      const storyMediaUrl = (loop.video || loop.cover || (() => {
        const title = snippet.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
            <defs>
              <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="#100d18"/>
                <stop offset="60%" stop-color="#7c3aed"/>
                <stop offset="100%" stop-color="#111827"/>
              </linearGradient>
            </defs>
            <rect width="800" height="1000" fill="url(#bg)"/>
            <text x="58" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="white">Loop</text>
            <text x="58" y="260" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="white">${title.slice(0, 28)}</text>
            <text x="58" y="390" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.8)">${loop.creator || "Kullanıcı"}</text>
            <rect x="58" y="520" width="684" height="320" rx="30" fill="rgba(17,24,39,0.3)" stroke="rgba(255,255,255,0.24)"/>
            <text x="90" y="650" font-family="Arial, sans-serif" font-size="28" fill="white">Bu loop hikayede paylaşıldı</text>
            <text x="90" y="700" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.75)">Dokunarak orijinal içeriği aç</text>
          </svg>
        `;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      })());
      const storyMediaType = loop.mediaType === "video" || /(mp4|webm|mov|m4v|avi)/i.test(String(loop.video || "")) ? "video" : "image";
      const decoratedUrl = `${storyMediaUrl}${storyMediaUrl.includes("?") ? "&" : "?"}story-share=loop:${loop.id}`;

      const storyFiles = storyMediaType === "video" ? await splitVideoForStories(decoratedUrl) : [null];
      let allOk = true;
      for (const storyFile of storyFiles) {
        let mediaUrl = decoratedUrl;
        if (storyFile) {
          const formData = new FormData();
          formData.append("file", storyFile);
          const upload = await fetch("/api/stories/upload", { method: "POST", body: formData });
          if (!upload.ok) { allOk = false; break; }
          const uploadedUrl = (await upload.json()).url as string;
          mediaUrl = `${uploadedUrl}${uploadedUrl.includes("?") ? "&" : "?"}story-share=loop:${loop.id}`;
        }
        const r = await fetch("/api/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaUrl, mediaType: storyMediaType }) });
        if (!r.ok) { allOk = false; break; }
      }
      if (allOk) {
        await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
        onShared?.();
        onClose();
        toast({ title: "Hikayene eklendi ✓" });
      } else {
        toast({ title: "Hikayeye eklenemedi", description: "Tekrar deneyin.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hikayeye eklenemedi", description: "Tekrar deneyin.", variant: "destructive" });
    }
  };

  const sendToDM = async (userId: number, displayName: string) => {
    if (sent.has(userId)) return;
    setSending(userId);
    try {
      const snippet = (loop.title || "Loop").slice(0, 80);
      const content = `__LOOP_POST_SHARE__:${loop.id}:${snippet}`;
      const r = await fetch(`/api/dm/${userId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        setSent(prev => new Set([...prev, userId]));
        onShared?.();
        toast({ title: `${displayName}'e gönderildi ✓` });
        onClose();
      } else {
        const d = await r.json();
        toast({ title: "Gönderilemedi", description: d.error, variant: "destructive" });
      }
    } finally {
      setSending(null);
    }
  };

  if (!isOpen) return null;

  const displayList = searchQuery.trim() ? searchResults : contacts;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} />
      <div
        className="absolute bottom-0 left-0 right-0 flex max-h-[70vh] flex-col rounded-t-[28px] bg-background"
        style={{
          transform: `translateY(${visible ? 0 : "100%"}px)`,
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center pt-2.5 pb-1">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="relative flex items-center justify-between px-4 pb-3 pt-1">
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
          <p className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold">Paylaş</p>
          <div className="w-8" />
        </div>

        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => void shareToStory()}
            className="flex w-full items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-left transition hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/30 dark:hover:bg-violet-900/30"
          >
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-200">Hikayede paylaş</p>
              <p className="text-[11px] text-violet-600/80 dark:text-violet-300/80">Bu loopu hikaye olarak yayına al</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white">
              <Share2 className="h-4 w-4" />
            </div>
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => void doSearch(event.target.value)}
              placeholder="Kişi ara"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {searching ? (
            <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : displayList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kişi bulunamadı.</p>
          ) : (
            displayList.map((person: any) => {
              const userId = Number(person.id ?? person.userId ?? 0);
              const displayName = person.displayName || person.username || person.name || "Kullanıcı";
              if (!userId) return null;
              return (
                <button
                  key={userId}
                  type="button"
                  disabled={sending === userId || sent.has(userId)}
                  onClick={() => void sendToDM(userId, displayName)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 text-left transition hover:bg-muted disabled:opacity-60"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={person.avatarUrl || person.avatar || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">@{person.username || "kullanici"}</p>
                  </div>
                  <span className="text-[11px] font-medium text-primary">
                    {sent.has(userId) ? "Gönderildi" : sending === userId ? "Gönderiliyor..." : "Gönder"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function LoopFeatureCard({
  loop,
  onOpen,
  detail,
  onRefreshDetail,
}: {
  loop: HomeMiniLoop;
  onOpen: (loop: HomeMiniLoop) => void;
  detail?: LoopPhotoDetail | null;
  onRefreshDetail: (loopId: number) => Promise<void>;
}) {
  const mediaIsVideo = loop.mediaType === "video";
  const audioLabel = loop.audio?.trim();
  const avatarInitial = (loop.creator || "U").trim().charAt(0).toUpperCase();
  const tagLabels = [...new Set(
    String(loop.tag || "")
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#+/, ""))
      .filter(Boolean)
      .map((tag) => `#${tag}`),
  )];
  const isVerified = Boolean(loop.badge || loop.badgeAssetUrl || loop.badgeLabel);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("loop-explore-sound-enabled") === "false";
    } catch {
      return false;
    }
  });
  const [videoProgress, setVideoProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaIsVideo) return;
    video.muted = muted;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          void video.play().catch(() => {
            if (!video.muted) {
              video.muted = true;
              void video.play().catch(() => {});
            }
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.55, 1] },
    );
    observer.observe(video);
    const timer = window.setInterval(() => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setVideoProgress(Math.max(0, Math.min(100, (video.currentTime / video.duration) * 100)));
      }
    }, 50);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      video.pause();
    };
  }, [mediaIsVideo, muted]);

  const likeCount = detail ? detail.reactions.length : 0;
  const commentCount = detail ? detail.replies.length : 0;

  const handleLike = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/loop/photos/${loop.id}/react`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "❤️" }),
      });
      if (response.ok) {
        setIsLiked(v => !v);
        await onRefreshDetail(loop.id);
      }
    } catch {
      // silent
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/loop/photos/${loop.id}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (response.ok) {
        setCommentText("");
        setCommentOpen(true);
        await onRefreshDetail(loop.id);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <>
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          onOpen(loop);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(loop);
          }
        }}
        role="button"
        tabIndex={0}
        className="group relative mx-auto block w-full max-w-[430px] cursor-pointer overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#0a0d13] text-left shadow-[0_25px_80px_rgba(16,18,28,0.42)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(111,76,255,0.22)] focus-visible:ring-2 focus-visible:ring-violet-400/80"
      >
        <div className="relative aspect-[9/12] overflow-hidden rounded-[30px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,98,255,0.28),_rgba(10,13,19,0.1)_28%,_rgba(10,13,19,0.82)_100%)]" />
          {mediaIsVideo ? (
            <video
              ref={videoRef}
              src={loop.video}
              className="loop-autoplay-video h-full w-full object-cover"
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
              onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
              onLoadedMetadata={(event) => { event.currentTarget.currentTime = 0; setVideoProgress(0); }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                const progress = video.duration ? (video.currentTime / video.duration) * 100 : 0;
                setVideoProgress(progress);
              }}
              onEnded={() => {
                setVideoProgress(0);
              }}
            />
          ) : (
            <img src={loop.cover || loop.video} alt={loop.title} className="h-full w-full object-cover" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#02050b]/95 via-[#030712]/25 to-[#030712]/20" />

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              {loop.avatar ? (
                <img src={loop.avatar} alt={loop.creator} className="h-11 w-11 rounded-full border border-white/20 object-cover shadow-[0_0_16px_rgba(255,255,255,0.12)]" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[13px] font-black text-white">
                  {avatarInitial}
                </div>
              )}

              <div className="min-w-0 text-left">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[18px] font-black leading-none text-white">
                    <UserNameWithDecorations
                      user={{ displayName: loop.creator, username: loop.username, badge: loop.badge, badgeAssetUrl: loop.badgeAssetUrl, badgeLabel: loop.badgeLabel }}
                      className="text-white"
                      showLabel={Boolean(loop.badgeLabel)}
                    />
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-[11px] font-medium text-white/70">@{(loop.username || loop.creator).toLowerCase().replace(/\s+/g, "")} • 4 saat önce</p>
                  {loop.isFollowing && (
                    <span className="rounded-full border border-violet-200/25 bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-violet-100">
                      Takip ediliyor
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-4">
            <button
              type="button"
              onClick={handleLike}
              className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm"
              aria-label="Beğen"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${isLiked ? "bg-pink-500/80 text-white" : "bg-[#f5f5f5]/10 text-white"}`}>
                <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              </div>
              <span className="text-[12px] font-bold text-white/80">{formatRealCounter(likeCount)}</span>
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setCommentOpen(v => !v);
              }}
              className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm"
              aria-label="Yorumları aç"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f5]/10 text-white backdrop-blur-sm">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="text-[12px] font-bold text-white/80">{formatRealCounter(commentCount)}</span>
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShareOpen(true);
              }}
              className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm"
              aria-label="Paylaş"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f5]/10 text-white backdrop-blur-sm">
                <Send className="h-5 w-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsBookmarked(v => !v);
              }}
              className="flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-white backdrop-blur-sm"
              aria-label="Kaydet"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${isBookmarked ? "bg-amber-400/80 text-slate-900" : "bg-[#f5f5f5]/10 text-white"}`}>
                <Bookmark className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`} />
              </div>
            </button>

          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(loop);
              }}
              className="block w-full text-left"
              aria-label={loop.title}
            >
              <div className="mb-3 text-left">
                <p className="text-[24px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[28px]">{loop.title}</p>
              </div>

              {tagLabels.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {tagLabels.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {audioLabel && audioLabel.toLowerCase() !== "orijinal ses" && (
                <div className="flex items-center gap-2 rounded-t-xl border-t border-white/10 bg-transparent pt-2 text-[13px] font-medium text-white/80">
                  <Music2 className="h-4 w-4 text-violet-300" />
                  <span className="truncate">{audioLabel}</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
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
                  className="relative block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20"
                >
                  <span className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.55)]" style={{ width: `${videoProgress}%` }} />
                </button>
                <button
                  type="button"
                  aria-label={muted ? "Loop sesini aç" : "Loop sesini kapat"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMuted(value => {
                      const next = !value;
                      try { localStorage.setItem("loop-explore-sound-enabled", String(!next)); } catch {}
                      return next;
                    });
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </button>
          </div>
        </div>
      </div>

      <LoopCommentBottomSheet
        loop={loop}
        detail={detail}
        isOpen={commentOpen}
        onClose={() => setCommentOpen(false)}
        onSubmit={handleCommentSubmit}
        commentText={commentText}
        setCommentText={setCommentText}
        submittingComment={submittingComment}
      />

      <LoopShareBottomSheet
        loop={loop}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={() => setShareOpen(false)}
      />
    </>
  );
}

function MiniLoopCard({ loop, onOpen }: { loop: HomeMiniLoop; onOpen: (loop: HomeMiniLoop) => void }) {
  const mediaIsVideo = loop.mediaType === "video";
  const audioLabel = loop.audio?.trim();
  const avatarInitial = (loop.creator || "U").trim().charAt(0).toUpperCase();
  const isVerified = Boolean(loop.badgeAssetUrl || loop.badgeLabel);

  return (
    <button
      type="button"
      onClick={() => onOpen(loop)}
      className="instagram-mini-loop-card group relative w-[132px] shrink-0 overflow-hidden rounded-[20px] border border-violet-300/20 bg-[#130f1f] shadow-[0_12px_28px_rgba(120,80,213,0.16)] transition-transform hover:-translate-y-0.5"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 via-transparent to-fuchsia-500/20" />
      {mediaIsVideo ? (
        <video
          src={loop.video}
          className="loop-autoplay-video h-[192px] w-full object-cover opacity-95"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
          onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
        />
      ) : (
        <img src={loop.cover || loop.video} alt={loop.title} className="h-[192px] w-full object-cover opacity-95" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090611]/90 via-[#090611]/10 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
        <span className="rounded-full border border-white/15 bg-black/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-violet-100/90">
          Loop
        </span>
        <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
          {formatLoopViews(loop.views)}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="mb-1.5 line-clamp-2 text-left text-[13px] font-black leading-tight text-white drop-shadow-lg">{loop.title}</p>
        {audioLabel && audioLabel.toLowerCase() !== "orijinal ses" && (
          <div className="mb-1.5 flex items-center gap-1 text-left text-[9px] font-medium text-violet-100/80">
            <Music2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{audioLabel}</span>
          </div>
        )}
        <div className="mb-1.5 flex items-center gap-1.5">
          {loop.avatar ? (
            <img src={loop.avatar} alt={loop.creator} className="h-7 w-7 rounded-full border border-white/20 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-black text-white">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="block min-w-0 max-w-full text-[11px] font-bold text-white">
                <UserNameWithDecorations
                  user={{ displayName: loop.creator, username: loop.username, badgeAssetUrl: loop.badgeAssetUrl, badgeLabel: loop.badgeLabel }}
                  className="w-full min-w-0 text-white"
                  showLabel={Boolean(loop.badgeLabel)}
                />
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="truncate text-[9px] text-violet-100/75">{loop.tag}</p>
              {loop.isFollowing && (
                <span className="rounded-full border border-violet-200/20 bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-100">
                  Takip ediliyor
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const { data: storyGroups } = useListStories({
    query: { queryKey: getListStoriesQueryKey(), refetchOnMount: "always" },
  });
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<FilterType>("trend");
  const localizedFilters = filters.map(filter => ({
    ...filter,
    label: {
      trend: t("trend"), takipte: t("following"), yeni: t("news"), bulten: t("bulletin"),
      "sana-ozel": t("forYou"), "anonim-sorular": t("anonymous"), kitaplar: t("books"),
    }[filter.id],
  }));
  const [gundemTagQuery, setGundemTagQuery] = useState("");
  const { user } = useAuth();
  const hasOwnStory = storyGroups?.some((group) => group.user.id === user?.id && group.hasUnviewed) ?? false;
  const [, setLocation] = useLocation();
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const { toast } = useToast();
  const selectedTag = (() => {
    const query = new URLSearchParams(window.location.search);
    const value = query.get("tag") ?? "";
    return value.replace(/^#/, "").trim().toLowerCase();
  })();

  useEffect(() => {
    if (!selectedTag) return;
    setActiveFilter("yeni");
    setGundemTagQuery(selectedTag);
  }, [selectedTag]);

  // DM'den gelen ?post=ID → post yüklenince o karta scroll yap
  const scrollPostIdRef = useRef<number | null>(
    (() => { const p = new URLSearchParams(window.location.search).get("post"); return p ? parseInt(p) : null; })()
  );
  const [directPost, setDirectPost] = useState<any | null>(null);

  // ── Anonim Sorular ──
  const [publicQuestions, setPublicQuestions] = useState<any[]>([]);
  const [myQuestions, setMyQuestions]         = useState<any[]>([]);
  const [qLoading, setQLoading]               = useState(false);
  const [answeringId, setAnsweringId]         = useState<number | null>(null);
  const [answerText, setAnswerText]           = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  // Yorumlar
  const [openCommentsId, setOpenCommentsId]   = useState<number | null>(null);
  const [commentsByQ, setCommentsByQ]         = useState<Record<number, any[]>>({});
  const [newComment, setNewComment]           = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [pollQuestionId, setPollQuestionId] = useState<number | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const addQuestionPoll = (questionId: number) => {
    if (!pollQuestion.trim() || pollOptions.some(option => !option.trim())) return;
    const all = (() => { try { return JSON.parse(localStorage.getItem("loop_question_polls_v1") || "{}"); } catch { return {}; } })();
    all[questionId] = { question: pollQuestion.trim(), options: pollOptions.map(option => option.trim()), votes: pollOptions.map(() => 0) };
    localStorage.setItem("loop_question_polls_v1", JSON.stringify(all));
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollQuestionId(null);
  };

  const getQuestionPoll = (questionId: number) => {
    try { return JSON.parse(localStorage.getItem("loop_question_polls_v1") || "{}")[questionId] as { question: string; options: string[]; votes: number[] } | undefined; } catch { return undefined; }
  };

  const loadComments = async (questionId: number) => {
    try {
      const r = await fetch(`/api/questions/${questionId}/comments`);
      const data = await r.json();
      setCommentsByQ(prev => ({ ...prev, [questionId]: Array.isArray(data) ? data : [] }));
    } catch { setCommentsByQ(prev => ({ ...prev, [questionId]: [] })); }
  };

  const toggleComments = async (questionId: number) => {
    if (openCommentsId === questionId) { setOpenCommentsId(null); return; }
    setOpenCommentsId(questionId);
    if (!commentsByQ[questionId]) await loadComments(questionId);
  };

  const submitComment = async (questionId: number) => {
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (r.ok) {
        setNewComment("");
        await loadComments(questionId);
      } else { toast({ title: "Hata", variant: "destructive" }); }
    } finally { setCommentSubmitting(false); }
  };

  const loadQuestions = async () => {
    setQLoading(true);
    try {
      const [pubRes, myRes] = await Promise.all([
        fetch("/api/questions/public", { credentials: "include" }),
        fetch("/api/users/me/questions", { credentials: "include" }),
      ]);
      const pubData = await pubRes.json();
      const myData  = await myRes.json();
      setPublicQuestions(Array.isArray(pubData) ? pubData : []);
      setMyQuestions(Array.isArray(myData) ? myData : []);
    } catch { /* sessiz */ }
    finally { setQLoading(false); }
  };

  useEffect(() => {
    if (activeFilter === "anonim-sorular") loadQuestions();
  }, [activeFilter]);

  const submitAnswer = async (questionId: number) => {
    if (!answerText.trim()) return;
    setSubmittingAnswer(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (r.ok) {
        toast({ title: "Yanıtın yayınlandı 💜" });
        setAnsweringId(null);
        setAnswerText("");
        loadQuestions();
      } else {
        toast({ title: "Hata", variant: "destructive" });
      }
    } finally { setSubmittingAnswer(false); }
  };

  const [miniLoops, setMiniLoops] = useState<HomeMiniLoop[]>([]);
  const [selectedLoop, setSelectedLoop] = useState<HomeMiniLoop | null>(null);
  const [loopViewerOpen, setLoopViewerOpen] = useState(false);
  const [loopDetails, setLoopDetails] = useState<Record<number, LoopPhotoDetail>>({});

  const refreshMiniLoopViews = async () => {
    const response = await fetch("/api/loop/photos", { cache: "no-store", credentials: "include" });
    if (!response.ok) throw new Error("Loop görüntülenmeleri yenilenemedi");
    const loops = await response.json();
    if (!Array.isArray(loops)) throw new Error("Loop görüntülenme yanıtı geçersiz");
    const viewsById = new Map<number, number>(
      loops.map((loop: { id: number; views: number }) => [Number(loop.id), Number(loop.views) || 0]),
    );
    setMiniLoops(current => current.map(loop => ({
      ...loop,
      views: Math.max(loop.views, viewsById.get(loop.id) ?? loop.views),
    })));
    setSelectedLoop(current => current ? {
      ...current,
      views: Math.max(current.views, viewsById.get(current.id) ?? current.views),
    } : current);
  };

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshMiniLoopViews().catch(error => console.error(error));
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const refreshLoopDetail = async (loopId: number) => {
    try {
      const response = await fetch(`/api/loop/photos/${loopId}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) return;
      const detail = await response.json();
      setLoopDetails(prev => ({ ...prev, [loopId]: detail }));
    } catch {
      // silent
    }
  };

  const openLoopViewer = (loop: HomeMiniLoop) => {
    setLocation(`/loops?loop=${loop.id}`);
    setSelectedLoop(loop);
    setLoopViewerOpen(false);
  };

  useEffect(() => {
    let cancelled = false;

    const loadMiniLoops = async () => {
      try {
        const res = await fetch("/api/loop/photos", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        const mapped = data
          .map((loop: any) => {
            const senderName = loop.sender?.displayName || loop.sender?.username || "Kullanıcı";
            const resolvedMediaType = resolveLoopMediaType(loop);

            return {
              id: Number(loop.id),
              title: loop.title || "Yeni Loop",
              creator: senderName,
              username: loop.sender?.username || loop.sender?.displayName || "",
              tag: (loop.tags || "#loop").trim() || "#loop",
              views: Number(loop.views) || 0,
              cover: loop.mediaUrl || loop.cover || "",
              avatar: loop.sender?.avatarUrl || "",
              video: loop.mediaUrl || "",
              audio: typeof loop.audio === "string" ? loop.audio.trim() : "",
              mediaType: resolvedMediaType as "video" | "image",
              badge: loop.sender?.badge || null,
              badgeAssetUrl: loop.sender?.badgeAssetUrl || null,
              badgeLabel: loop.sender?.badgeLabel || null,
              isFollowing: Boolean(loop.sender?.isFollowing),
            };
          })
          .sort((a, b) => Number(b.mediaType === "video") - Number(a.mediaType === "video") || b.id - a.id);

        const finalLoops = mapped
          .filter(loop => loop.video || loop.cover)
          .sort(() => Math.random() - 0.5)
          .slice(0, 8);
        setMiniLoops(current => finalLoops.map(loop => ({
          ...loop,
          views: Math.max(loop.views, current.find(existing => existing.id === loop.id)?.views ?? 0),
        })));

        await Promise.all(finalLoops.slice(0, 4).map(async (loop) => {
          await refreshLoopDetail(loop.id);
        }));
      } catch {
        setMiniLoops([]);
      }
    };

    void loadMiniLoops();
    return () => { cancelled = true; };
  }, []);

  const { data: allPosts, isLoading } = useListPosts(undefined, {
    query: { queryKey: getListPostsQueryKey() }
  });
  const [rankedFeedPosts, setRankedFeedPosts] = useState<any[] | null>(null);
  const [rankedFeedLoading, setRankedFeedLoading] = useState(false);
  const [rankedFeedError, setRankedFeedError] = useState("");
  const [rankedFeedPage, setRankedFeedPage] = useState(1);
  const [rankedFeedHasMore, setRankedFeedHasMore] = useState(false);
  const [rankedFeedSeed, setRankedFeedSeed] = useState("");
  const rankedFeedLoadLock = useRef(false);
  const rankedFeedSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFilter !== "trend" && activeFilter !== "sana-ozel") {
      setRankedFeedPosts(null);
      setRankedFeedLoading(false);
      setRankedFeedError("");
      setRankedFeedPage(1);
      setRankedFeedHasMore(false);
      return;
    }

    let cancelled = false;
    const mode = activeFilter === "trend" ? "trending" : "for-you";
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    rankedFeedLoadLock.current = false;
    setRankedFeedPosts(null);
    setRankedFeedLoading(true);
    setRankedFeedError("");
    setRankedFeedPage(1);
    setRankedFeedHasMore(false);
    setRankedFeedSeed(seed);
    fetch(`/api/posts/recommendations?mode=${mode}&page=1&seed=${encodeURIComponent(seed)}`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        const data: unknown = await response.json();
        if (!response.ok) {
          const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Akış yüklenemedi";
          throw new Error(message);
        }
        if (!Array.isArray(data)) throw new Error("Akış yanıtı geçersiz");
        return data;
      })
      .then(data => {
        if (!cancelled) {
          setRankedFeedPosts(data);
          setRankedFeedHasMore(data.length === 10);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setRankedFeedError(error instanceof Error ? error.message : "Kişiselleştirilmiş akış yüklenemedi");
          setRankedFeedHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setRankedFeedLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeFilter, user?.id]);

  const loadMoreRankedPosts = useCallback(async () => {
    if (!rankedFeedHasMore || rankedFeedLoading || rankedFeedLoadLock.current || (activeFilter !== "trend" && activeFilter !== "sana-ozel")) return;
    rankedFeedLoadLock.current = true;
    setRankedFeedLoading(true);
    setRankedFeedError("");
    const nextPage = rankedFeedPage + 1;
    const mode = activeFilter === "trend" ? "trending" : "for-you";
    try {
      const response = await fetch(`/api/posts/recommendations?mode=${mode}&page=${nextPage}&seed=${encodeURIComponent(rankedFeedSeed)}`, { credentials: "include", cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Akış yüklenemedi";
        throw new Error(message);
      }
      if (!Array.isArray(data)) throw new Error("Akış yanıtı geçersiz");
      const incoming = data as any[];
      setRankedFeedPosts(current => {
        const existing = new Set((current ?? []).map(post => post.id));
        return [...(current ?? []), ...incoming.filter(post => !existing.has(post.id))];
      });
      setRankedFeedPage(nextPage);
      setRankedFeedHasMore(incoming.length === 10);
    } catch (error) {
      setRankedFeedError(error instanceof Error ? error.message : "Daha fazla gönderi yüklenemedi");
    } finally {
      rankedFeedLoadLock.current = false;
      setRankedFeedLoading(false);
    }
  }, [activeFilter, rankedFeedHasMore, rankedFeedLoading, rankedFeedPage, rankedFeedSeed]);

  const { data: followingPosts, isLoading: followingLoading } = useListPosts(
    { following: true },
    { query: { queryKey: getListPostsQueryKey({ following: true }), enabled: activeFilter === "takipte" && Boolean(user) } }
  );

  const { data: bulletinPosts, isLoading: bulletinLoading } = useListPosts(
    { postType: "bulletin" },
    { query: { queryKey: getListPostsQueryKey({ postType: "bulletin" }), enabled: activeFilter === "bulten" } }
  );

  const { data: bookPosts, isLoading: bookLoading } = useListPosts(
    { postType: "book,trailer,column,micro" },
    { query: { queryKey: getListPostsQueryKey({ postType: "book,trailer,column,micro" } as any), enabled: activeFilter === "kitaplar" } }
  );

  const isRankedFeed = activeFilter === "trend" || activeFilter === "sana-ozel";
  const basePosts = activeFilter === "takipte"
    ? followingPosts
    : activeFilter === "bulten" ? bulletinPosts
      : activeFilter === "kitaplar" ? bookPosts
        : isRankedFeed ? rankedFeedPosts ?? allPosts : allPosts;
  const resolvedBasePosts = activeFilter !== "takipte" && directPost && !basePosts?.some((post) => post.id === directPost.id)
    ? [directPost, ...(basePosts ?? [])]
    : basePosts;
  const hashtagPosts = activeFilter === "yeni" ? resolvedBasePosts?.filter(hasHashtag) : resolvedBasePosts;
  const activeTag = (gundemTagQuery.trim() || selectedTag).replace(/^#/, "").trim().toLowerCase();
  const posts = activeTag
    ? hashtagPosts?.filter((post) => {
        const tags = Array.isArray((post as any)?.tags)
          ? (post as any).tags.join(" ")
          : String((post as any)?.tags ?? "");
        const matches: string[] = `${post.content ?? ""} ${tags}`.match(/#[\p{L}\p{N}_]+/gu) ?? [];
        return matches.some((tag) => tag.slice(1).toLowerCase() === activeTag);
      })
    : hashtagPosts;
  const loading = activeFilter === "takipte"
    ? followingLoading
    : activeFilter === "bulten" ? bulletinLoading
      : activeFilter === "kitaplar" ? bookLoading
        : isRankedFeed ? rankedFeedLoading && rankedFeedPosts === null : isLoading;

  useEffect(() => {
    const sentinel = rankedFeedSentinelRef.current;
    if (!sentinel || !isRankedFeed || !rankedFeedHasMore || loading || rankedFeedLoading || rankedFeedError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMoreRankedPosts();
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isRankedFeed, rankedFeedHasMore, loading, rankedFeedLoading, rankedFeedError, loadMoreRankedPosts]);

  useEffect(() => {
    const targetId = scrollPostIdRef.current;
    if (!targetId || loading || !allPosts || allPosts.some((post) => post.id === targetId)) return;
    let cancelled = false;
    fetch(`/api/posts/${targetId}`, { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((post) => {
        if (!cancelled && post?.id === targetId) setDirectPost(post);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allPosts, loading]);

  // DM'den gelen ?post=ID — postlar yüklenince o karta scroll et, sonra URL'i temizle
  useEffect(() => {
    const targetId = scrollPostIdRef.current;
    if (!targetId || loading || !posts?.length) return;
    const el = document.getElementById(`post-card-${targetId}`);
    if (!el) return;
    // Biraz gecikme: layout tamamlanmış olsun
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid hsl(var(--primary))";
      el.style.borderRadius = "12px";
      setTimeout(() => { el.style.outline = ""; el.style.borderRadius = ""; }, 1800);
    }, 200);
    // URL'den post param'ını temizle (geri gidince tekrar scroll etmesin)
    scrollPostIdRef.current = null;
    window.history.replaceState({}, "", "/");
  }, [loading, posts]);

  return (
    <div className="min-h-screen bg-secondary/50 pb-16">
      <Header />
      <main className="max-w-screen-md mx-auto min-h-[calc(100vh-3.5rem-4rem)]">
        <div className="pb-4">

          {/* Post creation bar */}
          <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            <Link href="/profile/me" className="flex-shrink-0">
              <Avatar data-story-user-id={user?.id} className={`w-10 h-10 border border-border ${hasOwnStory ? "story-avatar-ring" : ""}`}>
                <AvatarImage src={user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user?.displayName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <button className="flex-1 text-left" onClick={() => setTypePickerOpen(true)}>
              <div className="bg-muted/60 rounded-full px-4 py-2.5 text-sm text-muted-foreground">
                Neler paylaşmak istersin?
              </div>
            </button>
            <button onClick={() => setTypePickerOpen(true)}>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
            </button>
          </div>

          {/* Stories row */}
          <div className="bg-background border-b border-border">
            <StoryRow />
          </div>

          {/* Filter tabs */}
          <div className="bg-background border-b border-border px-4 py-2 flex min-w-0 items-center gap-2 overflow-x-auto hide-scrollbar">
            <div className="flex min-w-max items-center gap-2">
            {localizedFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all ${
                  activeFilter === f.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={activeFilter === f.id ? "text-primary" : f.color}>
                  {f.icon}
                </span>
                {f.label}
              </button>
            ))}
            <button className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground p-1.5">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            </div>
          </div>

          {/* ── Anonim Sorular Feed ── */}
          {activeFilter === "anonim-sorular" ? (
            <div className="pt-2 px-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Anonim Sorular</p>
                    <p className="text-xs text-muted-foreground">Yanıtlanan sorular ve gelen kutunuz</p>
                  </div>
                </div>
              </div>

              {/* My inbox unanswered */}
              {myQuestions.filter((q: any) => !q.answer_text).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📬 Sana Gelen</p>
                  <div className="space-y-2">
                    {myQuestions.filter((q: any) => !q.answer_text).map((q: any) => (
                      <div key={q.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        {/* Top gradient bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400" />
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-3.5 h-3.5 text-violet-500" />
                            </div>
                            <span className="text-xs font-medium text-violet-500">Anonim Soru</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {new Date(q.created_at).toLocaleDateString("tr-TR", { day:"numeric", month:"short" })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold leading-snug mb-3">"{q.question_text}"</p>

                          {answeringId === q.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={answerText}
                                onChange={e => setAnswerText(e.target.value)}
                                placeholder="Yanıtını yaz..."
                                className="resize-none rounded-2xl text-sm"
                                rows={3}
                                maxLength={500}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                                  className="flex-1 py-2 rounded-2xl border border-border text-xs font-semibold hover:bg-muted"
                                >
                                  İptal
                                </button>
                                <button
                                  onClick={() => submitAnswer(q.id)}
                                  disabled={!answerText.trim() || submittingAnswer}
                                  className="flex-1 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  {submittingAnswer ? "Gönderiliyor…" : "Yanıtla"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAnsweringId(q.id); setAnswerText(""); }}
                              className="w-full py-2.5 rounded-2xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Yanıtla
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Answered questions (mine + public) */}
              {(() => {
                const myAnswered = myQuestions.filter((q: any) => q.answer_text);
                // Merge: kendi yanıtladıkları + public feed (dedup by id)
                const ids = new Set(myAnswered.map((q: any) => q.id));
                const combined = [...myAnswered, ...publicQuestions.filter((q: any) => !ids.has(q.id))];
                combined.sort((a, b) => new Date(b.answered_at || b.created_at).getTime() - new Date(a.answered_at || a.created_at).getTime());
                if (combined.length === 0 && !qLoading) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">💬 Yanıtlananlar</p>
                    <div className="space-y-3">
                      {qLoading ? (
                        Array(3).fill(0).map((_, i) => (
                          <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />
                        ))
                      ) : combined.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">Henüz yanıtlanmış soru yok</p>
                      ) : combined.map((q: any) => (
                        <div key={q.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400" />
                          <div className="p-4">
                            {/* Who it was asked to */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3 h-3 text-violet-500" />
                              </div>
                              <span className="text-xs text-muted-foreground">Anonim soru →</span>
                              <Link href={`/profile/${q.username}`} className="flex items-center gap-1.5 group">
                                {q.avatar_url ? (
                                  <img src={q.avatar_url} className="w-5 h-5 rounded-full object-cover border border-border" alt={q.display_name} />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                                    {q.display_name?.charAt(0)}
                                  </div>
                                )}
                                <span className="text-xs font-semibold group-hover:text-primary transition-colors">{q.display_name}</span>
                              </Link>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {q.answered_at ? new Date(q.answered_at).toLocaleDateString("tr-TR", { day:"numeric", month:"short" }) : ""}
                              </span>
                            </div>

                            {/* Question */}
                            <div className="bg-muted/50 rounded-2xl px-3.5 py-2.5 mb-2">
                              <p className="text-sm font-medium leading-snug">"{q.question_text}"</p>
                            </div>

                            {/* Answer */}
                            <div className="flex gap-2 items-start mb-2">
                              <div className="flex-shrink-0 mt-0.5">
                                {q.avatar_url ? (
                                  <img src={q.avatar_url} className="w-6 h-6 rounded-full object-cover border border-border" alt={q.display_name} />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {q.display_name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 bg-primary/5 border border-primary/10 rounded-2xl px-3 py-2">
                                <p className="text-xs font-semibold text-primary mb-0.5">{q.display_name}</p>
                                <p className="text-sm leading-snug">{q.answer_text}</p>
                              </div>
                            </div>

                            {/* Yorum butonu */}
                            <button
                              onClick={() => toggleComments(q.id)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-8 mt-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {commentsByQ[q.id]?.length
                                ? `${commentsByQ[q.id].length} yorum`
                                : "Yorum yap"}
                              {openCommentsId === q.id && <span className="text-[10px]">▲</span>}
                              {openCommentsId !== q.id && <span className="text-[10px]">▼</span>}
                            </button>

                            {/* Yorum bölümü */}
                            {openCommentsId === q.id && (
                              <div className="mt-3 ml-8 space-y-2">
                                {user?.id === q.user_id && (
                                  <div>
                                    <button onClick={() => setPollQuestionId(pollQuestionId === q.id ? null : q.id)} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary"><BarChart2 className="w-3.5 h-3.5" /> Anket ekle</button>
                                    {pollQuestionId === q.id && <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 space-y-1.5"><input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Anket sorusu" className="w-full rounded-lg bg-background px-2.5 py-2 text-xs outline-none" />{pollOptions.map((option, index) => <input key={index} value={option} onChange={e => setPollOptions(values => values.map((value, itemIndex) => itemIndex === index ? e.target.value : value))} placeholder={`Seçenek ${index + 1}`} className="w-full rounded-lg bg-background px-2.5 py-2 text-xs outline-none" />)}<button onClick={() => addQuestionPoll(q.id)} disabled={!pollQuestion.trim() || pollOptions.some(option => !option.trim())} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40">Anketi yayınla</button></div>}
                                  </div>
                                )}
                                {getQuestionPoll(q.id) && <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5"><p className="text-xs font-bold">{getQuestionPoll(q.id)?.question}</p><div className="mt-2 space-y-1.5">{getQuestionPoll(q.id)?.options.map((option: string, index: number) => <div key={option} className="flex items-center justify-between rounded-lg bg-background/70 px-2.5 py-2 text-[11px]"><span>{option}</span><span className="text-muted-foreground">{getQuestionPoll(q.id)?.votes[index] ?? 0}</span></div>)}</div></div>}
                                {/* Mevcut yorumlar */}
                                {(commentsByQ[q.id] || []).map((c: any) => (
                                  <div key={c.id} className="flex gap-2 items-start">
                                    <div className="w-5 h-5 rounded-full bg-muted flex-shrink-0 overflow-hidden mt-0.5">
                                      {c.avatar_url
                                        ? <img src={c.avatar_url} className="w-full h-full object-cover" alt={c.display_name} />
                                        : <span className="w-full h-full flex items-center justify-center text-[8px] font-bold">{c.display_name?.charAt(0)}</span>}
                                    </div>
                                    <div className="flex-1 bg-muted/60 rounded-xl px-2.5 py-1.5">
                                      <p className="text-[10px] font-semibold mb-0.5">{c.display_name}</p>
                                      <p className="text-xs leading-snug">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                                {/* Yeni yorum input */}
                                <div className="flex gap-2 items-center">
                                  <input
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(q.id); } }}
                                    placeholder="Yorum yaz…"
                                    className="flex-1 px-3 py-1.5 rounded-full bg-muted/60 text-xs border border-transparent focus:border-primary/30 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => submitComment(q.id)}
                                    disabled={!newComment.trim() || commentSubmitting}
                                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                                  >
                                    <Send className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Empty state */}
              {!qLoading && myQuestions.length === 0 && publicQuestions.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-3xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-8 h-8 text-violet-500" />
                  </div>
                  <p className="font-bold text-base mb-1">Henüz soru yok</p>
                  <p className="text-sm text-muted-foreground">Profiline anonim soru gönderilince burada görünür</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Normal Posts Feed ── */
            <div className="pt-3">
              {activeFilter === "sana-ozel" && (
                <p className="mx-4 mb-3 text-[11px] leading-5 text-muted-foreground">
                  Akış; ilgi duyduğun konulara, takip ettiklerine ve etkileşimlerine göre şekillenir.
                </p>
              )}
              {rankedFeedError && isRankedFeed && (
                <p role="alert" className="mx-4 mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {rankedFeedError}{rankedFeedPosts === null ? " · Şu an genel gönderiler gösteriliyor." : ""}
                  {rankedFeedPosts !== null && rankedFeedHasMore && <button type="button" onClick={() => void loadMoreRankedPosts()} className="ml-2 font-bold underline">Yeniden dene</button>}
                </p>
              )}
              {activeFilter === "yeni" && (
                <>
                <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="search"
                    value={gundemTagQuery}
                    onChange={(event) => setGundemTagQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && activeTag) setLocation(`/?tag=${encodeURIComponent(activeTag)}`);
                    }}
                    placeholder="Gündemde hashtag ara"
                    aria-label="Gündemde hashtag ara"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {gundemTagQuery && (
                    <button type="button" onClick={() => { setGundemTagQuery(""); if (selectedTag) setLocation("/"); }} aria-label="Hashtag aramasını temizle" className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {activeTag && (
                  <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-2xl border border-violet-400/20 bg-[linear-gradient(100deg,rgba(124,58,237,0.1),rgba(217,70,239,0.04))] px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Hash className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-500">Konu akışı</p>
                        <p className="truncate text-sm font-extrabold text-foreground">#{activeTag}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setGundemTagQuery(""); setLocation("/"); }} className="shrink-0 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground">
                      Tüm gündem
                    </button>
                  </div>
                )}
                </>
              )}
              {activeFilter === "trend" && !selectedTag && miniLoops.length > 0 && (
                <div className="instagram-loop-section border-b border-border bg-background px-4 pb-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20">
                          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Mini loop</p>
                          <p className="text-sm font-black text-foreground">Loop'lar</p>
                        </div>
                      </div>
                      <button type="button" className="text-xs font-semibold text-violet-500">Tümü</button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
                      {rotateMiniLoops(miniLoops, 0).map(loop => (
                        <MiniLoopCard key={loop.id} loop={loop} onOpen={openLoopViewer} />
                      ))}
                    </div>
                  </div>

                  <div className="instagram-featured-wrap mt-4">
                    <LoopFeatureCard
                      loop={rotateMiniLoops(miniLoops, 0)[0]}
                      onOpen={openLoopViewer}
                      detail={loopDetails[rotateMiniLoops(miniLoops, 0)[0].id]}
                      onRefreshDetail={refreshLoopDetail}
                    />
                  </div>
                </div>
              )}

              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="mx-4 mb-4 h-80 bg-card animate-pulse rounded-2xl border border-border" />
                ))
              ) : posts?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="font-medium">{activeTag ? `#${activeTag} konusu için henüz gönderi yok` : "Henüz gönderi yok"}</p>
                  {activeFilter === "bulten" && (
                    <p className="text-sm mt-1">İlk bülten gönderisini paylaş!</p>
                  )}
                </div>
              ) : (
                <div className="instagram-feed">
                  {posts?.map((post, index) => (
                    <Fragment key={post.id}>
                      <div id={`post-card-${post.id}`}>
                        <PostCard post={post} />
                      </div>
                      {(index + 1) % 30 === 0 && miniLoops.length > 0 && (
                        <div className="border-y border-border bg-background px-4 py-4">
                          <div className="mb-2 flex items-center gap-2">
                            <Play className="h-4 w-4 text-violet-500" />
                            <p className="text-xs font-black text-foreground">Mini Loop</p>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
                            {rotateMiniLoops(miniLoops, Math.floor((index + 1) / 30)).map(loop => (
                              <MiniLoopCard key={`feed-mini-${loop.id}`} loop={loop} onOpen={openLoopViewer} />
                            ))}
                          </div>
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              )}
              {isRankedFeed && rankedFeedHasMore && posts && posts.length > 0 && (
                <div ref={rankedFeedSentinelRef} className="flex min-h-16 items-center justify-center py-4 text-xs text-muted-foreground" aria-live="polite">
                  {rankedFeedLoading ? "Daha fazla gönderi yükleniyor…" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bülten FAB */}
      {activeFilter === "bulten" && (
        <button
          onClick={() => setLocation("/create?type=bulletin")}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all hover:brightness-110 active:scale-95"
        >
          <Pencil className="w-6 h-6" />
        </button>
      )}

      {/* Type picker modal */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="max-w-xs rounded-3xl p-0 overflow-hidden">
          <div className="px-4 py-5">
            <h2 className="text-base font-bold mb-4 text-center">Ne paylaşmak istersin?</h2>
            <div className="space-y-2">
              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <AlignLeft className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Gönderi</p>
                  <p className="text-xs text-muted-foreground">Fotoğraf, video veya metin paylaş</p>
                </div>
              </button>

              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create?type=bulletin"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Pencil className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Bülten</p>
                  <p className="text-xs text-muted-foreground">Twitter tarzı kısa metin & fotoğraf</p>
                </div>
              </button>
              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create?type=book"); }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted"
              >
                <BookOpen className="h-5 w-5 text-cyan-500" />
                <div><p className="font-semibold text-sm">Kitaplar</p><p className="text-xs text-muted-foreground">Kitap alanında paylaş</p></div>
              </button>

              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create?type=poll"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Anket</p>
                  <p className="text-xs text-muted-foreground">Seçeneklerle oylama başlat</p>
                </div>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={loopViewerOpen} onOpenChange={(open) => {
        setLoopViewerOpen(open);
        if (!open) setSelectedLoop(null);
      }}>
        <DialogContent className="max-w-md overflow-hidden rounded-[30px] border-0 bg-transparent p-0 shadow-none">
          {selectedLoop ? (
            <div className="relative overflow-hidden rounded-[30px] border border-violet-400/20 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
              <button
                type="button"
                onClick={() => { setLoopViewerOpen(false); setSelectedLoop(null); }}
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
                aria-label="Loop kapat"
              >
                <X className="h-4 w-4" />
              </button>

              {selectedLoop.mediaType === "video" ? (
                <video
                  src={selectedLoop.video}
                  className="loop-autoplay-video h-[72vh] w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                  preload="auto"
                  onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
                  onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
                  onClick={(event) => {
                    const video = event.currentTarget;
                    if (video.paused) void video.play().catch(() => {});
                    else video.pause();
                  }}
                />
              ) : (
                <img src={selectedLoop.cover || selectedLoop.video} alt={selectedLoop.title} className="h-[72vh] w-full object-cover" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090611] via-[#090611]/70 to-transparent p-4">
                <div className="mb-3 flex items-center gap-2">
                  <img src={selectedLoop.avatar} alt={selectedLoop.creator} className="h-9 w-9 rounded-full border border-white/20 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{selectedLoop.creator}</p>
                    <p className="truncate text-[10px] text-violet-100/80">{selectedLoop.tag}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-black/35 px-2 py-1 text-[10px] font-semibold text-white/90">
                    {formatLoopViews(selectedLoop.views)}
                  </span>
                </div>

                <h3 className="text-lg font-black text-white">{selectedLoop.title}</h3>
                <p className="mt-1 max-w-[28rem] text-sm text-white/75">{selectedLoop.tag}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
