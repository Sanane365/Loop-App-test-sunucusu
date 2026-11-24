import { Post, useLikePost, useUnlikePost, useRepostPost, useBookmarkPost, getListPostsQueryKey, useListComments, useCreateComment, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal, Music2, Plus, Repeat2, X, Smile, ImagePlus, Search, Pin, BookOpen, Film, Play, Pause, Volume2, VolumeX, Maximize2, PenLine, Feather, Archive, Eye, EyeOff, MessageCircleOff, Pencil, BarChart3, Trash2 } from "lucide-react";
import GifPicker from "@/components/shared/GifPicker";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";
import { getStoredVideoMuted, storeVideoMuted } from "@/lib/video-preferences";
import { revealVideoAfterFrame } from "@/lib/video-visibility";
import { getListStoriesQueryKey } from "@workspace/api-client-react";

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + " Mn";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + " B";
  return String(n);
}

function getPostMediaUrls(mediaUrl?: string | null): string[] {
  if (!mediaUrl) return [];
  try {
    const parsed = JSON.parse(mediaUrl);
    if (Array.isArray(parsed)) {
      const urls = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (urls.length > 0) return urls;
    }
  } catch {
    // Single-media URLs remain plain strings for backwards compatibility.
  }
  return [mediaUrl];
}

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi|ogg|ogv|3gp|mkv)(?:[?#]|$)/i.test(url);
}

function PostMediaImage({ src, alt, postId }: { src: string; alt: string; postId: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div role="img" aria-label={`${alt} yüklenemedi`} className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
        <ImagePlus className="h-8 w-8" />
        <span className="text-xs">Fotoğraf yüklenemedi</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      className="h-full w-full object-cover"
      onError={() => {
        console.error("Gönderi fotoğrafı yüklenemedi", { postId });
        setFailed(true);
      }}
    />
  );
}

function extractHashtags(content: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const cleaned = content.replace(/#(\w+)/g, (_, tag) => {
    tags.push(tag);
    return "";
  }).trim();
  return { text: cleaned, tags };
}

function renderTextWithHashtags(text: string) {
  return text.split(/(#\w+)/g).map((part, index) => {
    if (!part.startsWith("#") || !/^#\w+$/.test(part)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span
        key={`${part}-${index}`}
        className="inline-flex items-center rounded-full border border-[#7aa6ff]/25 bg-gradient-to-r from-[#ebf4ff] via-[#edf5ff] to-[#dfeeff] px-2 py-0.5 text-[11px] font-bold tracking-[-0.02em] text-[#3465d8] shadow-[0_0_0_1px_rgba(59,130,246,0.05),0_8px_18px_rgba(59,130,246,0.12)] align-middle dark:border-[#6585b8]/40 dark:from-[#192338] dark:via-[#1b2940] dark:to-[#1b3350] dark:text-[#a9caff] dark:shadow-[0_0_0_1px_rgba(104,154,240,0.08),0_6px_16px_rgba(0,0,0,0.25)]"
      >
        {part}
      </span>
    );
  });
}

function buildStorySharePreview({ kind, id, title, author }: { kind: "post" | "loop"; id: number; title: string; author: string }) {
  const payload = `story-share:${kind}:${id}`;
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const safeAuthor = author.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#140F2D"/>
          <stop offset="52%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#111827"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#bg)"/>
      <circle cx="640" cy="150" r="220" fill="rgba(255,255,255,0.12)"/>
      <circle cx="130" cy="820" r="260" fill="rgba(255,255,255,0.08)"/>
      <rect x="58" y="64" width="188" height="42" rx="21" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)"/>
      <text x="82" y="92" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="white">${kind === "post" ? "Gönderi" : "Loop"}</text>
      <text x="58" y="250" font-family="Arial, sans-serif" font-size="62" font-weight="900" fill="white">${safeTitle.slice(0, 28)}</text>
      <rect x="58" y="316" width="560" height="1" fill="rgba(255,255,255,0.25)"/>
      <text x="58" y="392" font-family="Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.8)">${safeAuthor}</text>
      <rect x="58" y="510" width="684" height="360" rx="30" fill="rgba(17,24,39,0.28)" stroke="rgba(255,255,255,0.22)"/>
      <text x="90" y="650" font-family="Arial, sans-serif" font-size="28" fill="white">${kind === "post" ? "Bu gönderi hikayede paylaşıldı" : "Bu loop hikayede paylaşıldı"}</text>
      <text x="90" y="700" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.75)">Dokunarak orijinal içeriği aç</text>
      <metadata>${payload}</metadata>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function decodeStoryShareMetadata(mediaUrl?: string | null): { kind: "post" | "loop"; id: number } | null {
  if (!mediaUrl || !mediaUrl.includes("story-share:")) return null;

  try {
    if (mediaUrl.startsWith("data:image/svg+xml")) {
      const decoded = decodeURIComponent(mediaUrl.replace(/^data:image\/svg\+xml(?:;charset=utf-8)?[,;]/i, ""));
      const match = decoded.match(/story-share:(post|loop):(\d+)/i);
      if (match) {
        return { kind: match[1].toLowerCase() as "post" | "loop", id: Number(match[2]) };
      }
    }

    const match = mediaUrl.match(/story-share:(post|loop):(\d+)/i);
    if (match) {
      return { kind: match[1].toLowerCase() as "post" | "loop", id: Number(match[2]) };
    }
  } catch {
    return null;
  }

  return null;
}

function TrailerMedia({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(getStoredVideoMuted);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          void video.play().catch(() => {
            video.muted = true;
            setMuted(true);
            void video.play().catch(() => {});
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [muted]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => {});
      });
    } else {
      video.pause();
    }
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = value * video.duration;
    setProgress(value);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    storeVideoMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    const player = playerRef.current;
    if (!player) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void player.requestFullscreen();
    }
  };

  return (
    <div ref={playerRef} className="group/player relative aspect-video overflow-hidden bg-[#0b0d10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={muted}
        preload="auto"
        className="loop-autoplay-video h-full w-full object-contain"
        onLoadStart={(event) => {
          setIsPlaying(false);
          delete event.currentTarget.dataset.playing;
        }}
        onPlaying={(event) => {
          setIsPlaying(true);
          revealVideoAfterFrame(event.currentTarget);
        }}
        onClick={togglePlayback}
        onTimeUpdate={event => {
          const video = event.currentTarget;
          setProgress(video.duration ? video.currentTime / video.duration : 0);
        }}
        aria-label={title}
      />
      {isPlaying && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/20 opacity-85" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent">
            <div className="absolute inset-x-3 bottom-2 h-0.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
              <input type="range" min="0" max="1" step="0.01" value={progress} onChange={event => seek(Number(event.target.value))} aria-label="Video ilerlemesi" className="absolute inset-0 h-3 w-full -translate-y-1 cursor-pointer opacity-0" />
            </div>
          </div>
          <div className="absolute right-3 top-3 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover/player:opacity-100 sm:focus-within:opacity-100">
            <button type="button" onClick={toggleMute} aria-label={muted ? "Videonun sesini aç" : "Videonun sesini kapat"} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 shadow-lg backdrop-blur-md transition hover:bg-black/55">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button type="button" onClick={toggleFullscreen} aria-label="Tam ekran" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 shadow-lg backdrop-blur-md transition hover:bg-black/55">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Çatlak Avatar — özgün geri paylaşım göstergesi ──────────────────────────
function SplitAvatar({
  leftSrc, leftFallback,
  rightSrc, rightFallback,
  size = "w-10 h-10",
}: {
  leftSrc: string; leftFallback: string;
  rightSrc: string; rightFallback: string;
  size?: string;
}) {
  return (
    <div className={`${size} relative rounded-full overflow-hidden flex-shrink-0 ring-2 ring-green-400/50`}>
      {/* Sol dilim — orijinal paylaşımcı */}
      <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 60% 100%, 0 100%)" }}>
        {leftSrc
          ? <img src={leftSrc} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">{leftFallback}</div>}
      </div>
      {/* Sağ dilim — geri paylaşan */}
      <div className="absolute inset-0" style={{ clipPath: "polygon(64% 0, 100% 0, 100% 100%, 40% 100%)" }}>
        {rightSrc
          ? <img src={rightSrc} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full bg-violet-500/20 flex items-center justify-center font-bold text-violet-500 text-sm">{rightFallback}</div>}
      </div>
      {/* Çatlak çizgisi — diagonal glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          clipPath: "polygon(58% 0, 66% 0, 42% 100%, 34% 100%)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(134,239,172,0.7) 100%)",
        }}
      />
    </div>
  );
}

// ── Instagram-style draggable comment bottom sheet ─────────────────────────
function CommentBottomSheet({
  postId,
  postOwnerId,
  commentCount,
  isOpen,
  onClose,
}: {
  postId: number;
  postOwnerId: number;
  commentCount: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [commentLikes, setCommentLikes] = useState<Record<number, { liked: boolean; count: number }>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [pinnedCommentIds, setPinnedCommentIds] = useState<Record<number, boolean>>({});
  const isPostOwner = !!user && user.id === postOwnerId;
  // Yorum görseli
  const [commentMediaUrl, setCommentMediaUrl] = useState<string | null>(null);
  const [commentMediaUploading, setCommentMediaUploading] = useState(false);
  const commentMediaRef = useRef<HTMLInputElement>(null);
  // GIF panel
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const handleCommentMediaSelect = async (file: File) => {
    setCommentMediaUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error();
      const { url } = await r.json();
      setCommentMediaUrl(url);
    } catch {
      // ignore
    }
    setCommentMediaUploading(false);
  };

  const handlePinComment = async (commentId: number, currentlyPinned: boolean) => {
    setPinnedCommentIds(prev => ({ ...prev, [commentId]: !currentlyPinned }));
    try {
      const r = await fetch(`/api/posts/${postId}/comments/${commentId}/pin`, { method: "POST" });
      if (!r.ok) throw new Error();
      const { pinned } = await r.json();
      setPinnedCommentIds(prev => ({ ...prev, [commentId]: pinned }));
    } catch {
      setPinnedCommentIds(prev => ({ ...prev, [commentId]: currentlyPinned })); // rollback
    }
  };
  const [dragOffset, setDragOffset] = useState(0);
  const [visible, setVisible] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: comments, isLoading: commentsLoading } = useListComments(postId, {
    query: { enabled: isOpen, queryKey: getListCommentsQueryKey(postId) }
  });
  const createCommentMutation = useCreateComment();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Animate in
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    setDragOffset(Math.max(0, dy));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (dragOffset > 120) {
      onClose();
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
    startYRef.current = null;
  };

  const handleAddComment = () => {
    if (!newComment.trim() && !commentMediaUrl) return;
    createCommentMutation.mutate(
      { postId, data: { content: newComment, replyToId: replyingToId ?? undefined, mediaUrl: commentMediaUrl, mediaType: "image" } as any },
      {
        onSuccess: () => {
          setNewComment("");
          setReplyingToId(null);
          setCommentMediaUrl(null);
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        }
      }
    );
  };

  const handleReply = (comment: any) => {
    const prefix = `@${comment.user?.username ?? comment.userId} `;
    setNewComment(prefix);
    setReplyingToId(comment.id);
    setTimeout(() => {
      inputRef.current?.focus();
      const len = prefix.length;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  };

  const handleToggleCommentLike = async (comment: any) => {
    const prev = commentLikes[comment.id] ?? {
      liked: comment.isLiked ?? false,
      count: comment.likeCount ?? 0,
    };
    const next = { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) };
    setCommentLikes(s => ({ ...s, [comment.id]: next }));
    try {
      const method = prev.liked ? "DELETE" : "POST";
      await fetch(`/api/posts/${postId}/comments/${comment.id}/like`, { method });
    } catch {
      setCommentLikes(s => ({ ...s, [comment.id]: prev }));
    }
  };

  const isSliding = dragOffset > 0;

  return (
    <div
      className="fixed inset-0 z-[60]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[28px] flex flex-col"
        style={{
          maxHeight: "88vh",
          transform: `translateY(${isSliding ? dragOffset : visible ? 0 : "100%"}px)`,
          transition: isSliding ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle area — only this area triggers drag */}
        <div
          className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 pb-3 pt-1">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="font-bold text-[15px] leading-tight">Yorumlar</p>
            <p className="text-[12px] text-muted-foreground">{formatCount(commentCount)} yorum</p>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 mx-4" />

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 min-h-0">
          {commentsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : comments?.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">İlk yorumu sen yap!</p>
            </div>
          ) : (() => {
            // Yorum ağacını oluştur
            const allComments = (comments ?? []) as any[];
            // Sabitlenen yorumlar üstte
            const sortedAll = [...allComments].sort((a, b) => {
              const aPinned = pinnedCommentIds[a.id] ?? a.pinned ?? false;
              const bPinned = pinnedCommentIds[b.id] ?? b.pinned ?? false;
              if (aPinned && !bPinned) return -1;
              if (!aPinned && bPinned) return 1;
              return 0;
            });
            const topLevel = sortedAll.filter(c => !c.replyToId);
            const repliesByParent: Record<number, any[]> = {};
            sortedAll.forEach(c => {
              if (c.replyToId) {
                if (!repliesByParent[c.replyToId]) repliesByParent[c.replyToId] = [];
                repliesByParent[c.replyToId].push(c);
              }
            });

            const renderComment = (comment: any, isReply = false) => {
              const cl = commentLikes[comment.id] ?? { liked: comment.isLiked ?? false, count: comment.likeCount ?? 0 };
              return (
                <div key={comment.id} className={`flex gap-2.5 ${isReply ? "pl-0" : ""}`}>
                  <Link href={`/profile/${comment.userId}`} onClick={onClose}>
                    <Avatar className={`cursor-pointer flex-shrink-0 ${isReply ? "w-7 h-7" : "w-9 h-9"}`}>
                      <AvatarImage src={comment.user?.avatarUrl || ""} />
                      <AvatarFallback className={`font-bold bg-primary/10 text-primary ${isReply ? "text-[10px]" : "text-xs"}`}>
                        {comment.user?.displayName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <UserNameWithDecorations user={comment.user} className={`font-semibold text-foreground leading-tight ${isReply ? "text-[12px]" : "text-[13px]"}`} />
                          <span className="text-[11px] text-muted-foreground">
                            · {formatDistanceToNow(new Date(comment.createdAt), { locale: tr, addSuffix: true })}
                          </span>
                        </div>
                        {comment.content && (
                          <p className={`text-foreground leading-[1.45] break-words whitespace-pre-wrap ${isReply ? "text-[13px]" : "text-[14px]"}`}>
                            {comment.content}
                          </p>
                        )}
                        {comment.mediaUrl && (
                          <img
                            src={comment.mediaUrl}
                            alt=""
                            className="mt-1.5 max-w-[200px] rounded-xl object-cover border border-border cursor-pointer"
                            onClick={() => window.open(comment.mediaUrl, "_blank")}
                          />
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            onClick={() => handleReply(comment)}
                            className="text-[12px] text-muted-foreground font-medium hover:text-foreground transition-colors"
                          >
                            Yanıtla
                          </button>
                          {/* Sabitleme butonu — sadece gönderi sahibine görünür */}
                          {isPostOwner && !isReply && (
                            <button
                              onClick={() => {
                                const isPinned = pinnedCommentIds[comment.id] ?? comment.pinned ?? false;
                                handlePinComment(comment.id, isPinned);
                              }}
                              className={`flex items-center gap-0.5 text-[11px] font-medium transition-colors ${
                                (pinnedCommentIds[comment.id] ?? comment.pinned)
                                  ? "text-amber-500"
                                  : "text-muted-foreground hover:text-amber-400"
                              }`}
                            >
                              <Pin className={`w-3 h-3 ${(pinnedCommentIds[comment.id] ?? comment.pinned) ? "fill-amber-500" : ""}`} />
                              {(pinnedCommentIds[comment.id] ?? comment.pinned) ? "Sabitlendi" : "Sabitle"}
                            </button>
                          )}
                          {/* Sabitlenmiş rozeti — herkese görünür */}
                          {!isPostOwner && (pinnedCommentIds[comment.id] ?? comment.pinned) && (
                            <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-medium">
                              <Pin className="w-3 h-3 fill-amber-500" /> Sabitlendi
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleCommentLike(comment)}
                        className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-0.5 p-1"
                      >
                        <Heart className={`transition-colors ${isReply ? "w-3.5 h-3.5" : "w-4 h-4"} ${cl.liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                        {cl.count > 0 && <span className="text-[10px] text-muted-foreground">{formatCount(cl.count)}</span>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {topLevel.map(comment => {
                  const replies = repliesByParent[comment.id] ?? [];
                  const isExpanded = expandedReplies.has(comment.id);
                  return (
                    <div key={comment.id} className="space-y-0">
                      {renderComment(comment, false)}
                      {/* Yanıt görüntüle / gizle */}
                      {replies.length > 0 && (
                        <div className="ml-[46px] mt-1">
                          <button
                            onClick={() => setExpandedReplies(prev => {
                              const next = new Set(prev);
                              if (next.has(comment.id)) next.delete(comment.id);
                              else next.add(comment.id);
                              return next;
                            })}
                            className="flex items-center gap-2 text-[12px] text-primary font-medium py-1"
                          >
                            <span className="w-5 h-px bg-primary/40 inline-block" />
                            {isExpanded ? "Yanıtları gizle" : `${replies.length} yanıtı görüntüle`}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-3 pl-0 border-l-2 border-muted/60 ml-1 pl-3">
                              {replies.map(r => renderComment(r, true))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* GIF Panel */}
        {gifPanelOpen && (
          <GifPicker
            onSelect={(url) => { setCommentMediaUrl(url); setGifPanelOpen(false); }}
            onClose={() => setGifPanelOpen(false)}
          />
        )}

        {/* Input bar */}
        <div className="border-t border-border/60 px-3 py-3 flex items-center gap-2 bg-background relative">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {user?.displayName?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <input
            ref={commentMediaRef}
            type="file"
            accept="image/*,image/gif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCommentMediaSelect(f); e.target.value = ""; }}
          />
          {/* Plus button + popup */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setPlusMenuOpen(p => !p); setGifPanelOpen(false); }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${plusMenuOpen ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
            >
              <Plus className="w-5 h-5" />
            </button>
            {plusMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden z-20 min-w-[160px]">
                <button
                  onClick={() => { commentMediaRef.current?.click(); setPlusMenuOpen(false); }}
                  disabled={commentMediaUploading}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-sm"
                >
                  {commentMediaUploading
                    ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    : <ImagePlus className="w-4 h-4 text-muted-foreground" />}
                  <span>Fotoğraf</span>
                </button>
                <div className="h-px bg-border/60 mx-3" />
                <button
                  onClick={() => { setGifPanelOpen(p => !p); setPlusMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-sm"
                >
                  <span className="text-[13px] font-bold text-muted-foreground w-4 text-center leading-none">GIF</span>
                  <span>GIF</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col bg-muted/60 rounded-2xl px-4 py-2 border border-border/30 gap-1">
            {replyingToId && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-primary font-medium">Yanıt olarak</span>
                <button onClick={() => { setReplyingToId(null); setNewComment(""); }} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {commentMediaUrl && (
              <div className="relative w-fit mt-0.5">
                <img src={commentMediaUrl} alt="" className="max-h-24 max-w-[160px] rounded-lg object-cover border border-border" />
                <button
                  onClick={() => setCommentMediaUrl(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={commentMediaUrl ? "Açıklama ekle..." : "Yorumunuz..."}
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none h-6"
              onKeyDown={e => { if (e.key === "Enter") { handleAddComment(); } }}
              onFocus={() => setPlusMenuOpen(false)}
            />
          </div>
          <button
            onClick={handleAddComment}
            disabled={(!newComment.trim() && !commentMediaUrl) || createCommentMutation.isPending}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors shadow"
          >
            {createCommentMutation.isPending
              ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4 text-primary-foreground" />}
          </button>
        </div>

        {/* Safe area bottom padding */}
        <div className="h-safe-area-inset-bottom" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}

// ── DM Share Bottom Sheet ────────────────────────────────────────────────────
function ShareBottomSheet({
  postId,
  postUser,
  postContent,
  mediaUrl,
  mediaType,
  isOpen,
  onClose,
  onShared,
}: {
  postId: number;
  postUser?: string;
  postContent?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
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
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
      // Load recent conversations
      fetch("/api/dm/conversations", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setContacts(data.map((c: any) => c.user).filter(Boolean));
        })
        .catch(() => {});
    } else {
      setVisible(false);
      setSearchQuery("");
      setSearchResults([]);
      setSent(new Set());
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
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
      const snippet = (postContent || "Gönderi").slice(0, 60) || "Gönderi";
      const storyMediaUrl = mediaUrl || buildStorySharePreview({
        kind: "post",
        id: postId,
        title: snippet,
        author: postUser || "Kullanıcı",
      });
      const storyMediaType = mediaType === "video" ? "video" : "image";
      const decoratedUrl = `${storyMediaUrl}${storyMediaUrl.includes("?") ? "&" : "?"}story-share=post:${postId}`;

      const r = await fetch("/api/stories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: decoratedUrl, mediaType: storyMediaType }),
      });
      if (r.ok) {
        await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
        onShared?.();
        onClose();
        toast({ title: "Hikayene eklendi ✓" });
      } else {
        const d = await r.json().catch(() => null);
        toast({ title: "Hikayeye eklenemedi", description: d?.error || "Tekrar deneyin.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hikayeye eklenemedi", description: "Tekrar deneyin.", variant: "destructive" });
    }
  };

  const sendToDM = async (userId: number, displayName: string) => {
    if (sent.has(userId)) return;
    setSending(userId);
    try {
      // Use special prefix so DM renders it as a post share card
      const snippet = (postContent || "").slice(0, 80);
      const content = `__LOOP_POST_SHARE__:${postId}:${snippet}`;
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
      } else {
        const d = await r.json();
        toast({ title: "Gönderilemedi", description: d.error, variant: "destructive" });
      }
    } finally {
      setSending(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    setDragOffset(Math.max(0, dy));
  };
  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (dragOffset > 100) { onClose(); setDragOffset(0); }
    else setDragOffset(0);
    startYRef.current = null;
  };

  if (!isOpen) return null;

  const displayList = searchQuery.trim() ? searchResults : contacts;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} />
      <div
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[28px] flex flex-col"
        style={{
          maxHeight: "70vh",
          transform: `translateY(${dragOffset > 0 ? dragOffset : visible ? 0 : "100%"}px)`,
          transition: dragOffset > 0 ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 pb-3 pt-1">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
          <p className="absolute left-1/2 -translate-x-1/2 font-bold text-[15px]">Paylaş</p>
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
              <p className="text-[11px] text-violet-600/80 dark:text-violet-300/80">Gönderini hikaye olarak yayına al</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white">
              <Send className="h-4 w-4" />
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => doSearch(e.target.value)}
              placeholder="Kişi ara…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => doSearch("")} className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-border/60 mx-4" />

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {searching ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : displayList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "Kullanıcı bulunamadı" : "Henüz sohbet yok"}
            </div>
          ) : (
            <div className="space-y-1">
              {displayList.map((u: any) => {
                const isSent = sent.has(u.id);
                const isSending = sending === u.id;
                return (
                  <div key={u.id} className="flex items-center gap-3 py-2.5 px-1">
                    <Avatar className="w-11 h-11 flex-shrink-0">
                      <AvatarImage src={u.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {u.displayName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => sendToDM(u.id, u.displayName)}
                      disabled={isSent || isSending}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all
                        ${isSent
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                    >
                      {isSending ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : isSent ? "Gönderildi ✓" : "Gönder"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="h-safe-area-inset-bottom" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}

// Poll fields are returned by the API but not in the generated schema
type PostWithPoll = Post & {
  postType?: string | null;
  pollOptions?: string[] | null;
  pollVoteCounts?: number[] | null;
  myPollVote?: number | null;
  archived?: boolean;
  hideLikeCount?: boolean;
  hideRepostCount?: boolean;
  bookmarkCount?: number;
  hideBookmarkCount?: boolean;
  shareCount?: number;
  commentsDisabled?: boolean;
  pinnedProfile?: boolean;
};

function OwnerPostMenu({ post }: { post: PostWithPoll }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      });
    };
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    updatePosition();
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  if (!user || user.id !== post.userId) return null;

  const manage = async (action: string, content?: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/posts/${post.id}/manage`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, content }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "İşlem başarısız");
      if (action === "stats") {
        toast({ title: `Beğeni: ${data?.likes ?? 0} · Paylaşım: ${data?.reposts ?? 0} · Yorum: ${data?.comments ?? 0}` });
        setOpen(false);
        return;
      }
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ queryKey: getListPostsQueryKey() });
      setOpen(false);
      toast({ title: "İşlem tamamlandı" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "İşlem yapılamadı", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const edit = () => {
    const rawContent = post.content || "";
    const metadataMatch = rawContent.match(/^(\[\[(?:book-meta|column-style):.*?\]\])/);
    const metadata = metadataMatch?.[1] || "";
    const editableContent = rawContent.replace(/^\[\[book-meta:.*?\]\]/, "").replace(/^\[\[column-style:.*?\]\]/, "").trim();
    const nextContent = window.prompt("Paylaşım metnini düzenle", editableContent);
    if (nextContent !== null) {
      if (!nextContent.trim()) {
        toast({ title: "Metin boş bırakılamaz", variant: "destructive" });
        return;
      }
      void manage("edit", `${metadata}${nextContent.trim()}`);
    }
  };

  const deletePost = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Paylaşım silinemedi");
      await queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      setOpen(false);
      toast({ title: "Paylaşım silindi" });
    } catch (error) { toast({ title: error instanceof Error ? error.message : "Silme işlemi yapılamadı", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative">
      <button ref={buttonRef} type="button" onClick={event => { event.stopPropagation(); setOpen(value => !value); }} aria-label="Paylaşım seçenekleri" className="rounded-full p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-800"><MoreHorizontal className="h-5 w-5" /></button>
      {open && createPortal(<div ref={menuRef} style={{ top: menuPosition.top, left: menuPosition.left }} className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-2xl" onClick={event => event.stopPropagation()}>
        <button type="button" disabled={busy} onClick={deletePost} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" />Sil</button>
        <button type="button" disabled={busy} onClick={() => void manage("archive")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Archive className="h-4 w-4" />{post.archived ? "Arşivden çıkar" : "Arşivle"}</button>
        <button type="button" disabled={busy} onClick={() => void manage("hideLikes")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><EyeOff className="h-4 w-4" />{post.hideLikeCount ? "Beğeni sayısını göster" : "Beğeni sayısını gizle"}</button>
        <button type="button" disabled={busy} onClick={() => void manage("hideReposts")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><EyeOff className="h-4 w-4" />{post.hideRepostCount ? "Paylaşım sayısını göster" : "Paylaşım sayısını gizle"}</button>
        <button type="button" disabled={busy} onClick={() => void manage("hideBookmarks")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><EyeOff className="h-4 w-4" />{post.hideBookmarkCount ? "Kaydetme sayısını göster" : "Kaydetme sayısını gizle"}</button>
        <button type="button" disabled={busy} onClick={() => void manage("closeComments")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><MessageCircleOff className="h-4 w-4" />{post.commentsDisabled ? "Yorumları aç" : "Yorumları kapat"}</button>
        <button type="button" disabled={busy} onClick={edit} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" />Tekrar düzenle</button>
        <button type="button" disabled={busy} onClick={() => void manage("stats")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><BarChart3 className="h-4 w-4" />İstatistikleri gör</button>
        <button type="button" disabled={busy} onClick={() => void manage("pinProfile")} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pin className="h-4 w-4" />{post.pinnedProfile ? "Profil sabitlemesini kaldır" : "Profilimde sabitle"}</button>
      </div>, document.body)}
    </div>
  );
}

type ColumnStyle = { tone?: "ink" | "forest" | "wine"; weight?: "normal" | "medium" | "strong"; italic?: boolean; highlighted?: boolean };

function readColumnContent(content: string): { text: string; style: ColumnStyle } {
  const match = content.match(/^\[\[column-style:(.*?)\]\]/);
  if (!match) return { text: content, style: {} };
  try {
    return { text: content.slice(match[0].length), style: JSON.parse(match[1]) as ColumnStyle };
  } catch {
    return { text: content.slice(match[0].length), style: {} };
  }
}

function readBookContent(content: string): { title: string; author: string; text: string } {
  const match = content.match(/^\[\[book-meta:(.*?)\]\]/);
  if (match) {
    try {
      const meta = JSON.parse(match[1]) as { title?: string; author?: string; text?: string };
      return { title: meta.title || "Kitap paylaşımı", author: meta.author || "Yazar", text: meta.text || "" };
    } catch { /* fall through to legacy content */ }
  }
  return { title: content.replace(/^Kitap paylaşımı:\s*/i, "").trim() || "Kitap paylaşımı", author: "Yazar", text: "" };
}

export function PostCard({ post: postRaw, onViewRecorded }: { post: Post; onViewRecorded?: (postId: number, viewCount: number) => void }) {
  const post = postRaw as PostWithPoll;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPostOwner = Number(user?.id) === Number(post.userId);

  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const doubleTapEnabled = localStorage.getItem("loop-setting-doubleTap") !== "false";
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [isReposted, setIsReposted] = useState(post.isReposted ?? false);
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarkCount ?? 0);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [viewCount, setViewCount] = useState((post as PostWithPoll & { viewCount?: number }).viewCount ?? 0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isBookExpanded, setIsBookExpanded] = useState(false);
  const viewRecordedRef = useRef(false);
  const onViewRecordedRef = useRef(onViewRecorded);
  const isVideoPost = /video/i.test(String(post.mediaType ?? "")) || /\.(mp4|webm|mov|m4v|avi)(?:\?|$)/i.test(String(post.mediaUrl ?? ""));

  useEffect(() => {
    onViewRecordedRef.current = onViewRecorded;
  }, [onViewRecorded]);

  const recordPostView = useCallback(() => {
    if (!user?.id || !post.id || viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    void fetch(`/api/posts/${post.id}/view`, { method: "POST", credentials: "include" })
      .then(response => {
        if (!response.ok) throw new Error("Gönderi görüntülenmesi kaydedilemedi");
        return response.json();
      })
      .then(data => {
        if (typeof data?.viewCount !== "number") throw new Error("Gönderi görüntülenme yanıtı geçersiz");
        setViewCount(current => Math.max(current, data.viewCount));
        onViewRecordedRef.current?.(post.id, data.viewCount);
      })
      .catch(error => {
        viewRecordedRef.current = false;
        console.error(error);
      });
  }, [post.id, user?.id]);

  useEffect(() => {
    viewRecordedRef.current = false;
    if (user?.id && post.id && !isVideoPost) recordPostView();
  }, [isVideoPost, post.id, recordPostView, user?.id]);

  // Poll state
  const [myPollVote, setMyPollVote] = useState<number | null>(post.myPollVote ?? null);
  const [pollVoteCounts, setPollVoteCounts] = useState<number[]>(post.pollVoteCounts ?? []);
  const [isVoting, setIsVoting] = useState(false);

  const handlePollVote = async (optionIndex: number) => {
    if (myPollVote !== null || isVoting) return;
    setIsVoting(true);
    // Optimistic update
    const prev = { myPollVote, pollVoteCounts: [...pollVoteCounts] };
    const newCounts = [...pollVoteCounts];
    newCounts[optionIndex] = (newCounts[optionIndex] ?? 0) + 1;
    setMyPollVote(optionIndex);
    setPollVoteCounts(newCounts);
    try {
      const res = await fetch(`/api/posts/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Vote failed");
      const updated = await res.json() as PostWithPoll;
      setMyPollVote(updated.myPollVote ?? optionIndex);
      setPollVoteCounts(updated.pollVoteCounts ?? newCounts);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch {
      // Rollback
      setMyPollVote(prev.myPollVote);
      setPollVoteCounts(prev.pollVoteCounts);
      toast({ title: "Oy gönderilemedi", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();
  const repostMutation = useRepostPost();
  const bookmarkMutation = useBookmarkPost();

  const hasMedia = !!(post.mediaUrl);
  const postMediaUrls = getPostMediaUrls(post.mediaUrl);
  const backgroundUrl = (post as any).backgroundUrl ?? null;
  const showRepostCount = isPostOwner || post.hideRepostCount !== true;
  const { text: postText, tags } = extractHashtags(post.content || "");

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      unlikeMutation.mutate({ postId: post.id }, {
        onError: () => { setIsLiked(true); setLikeCount(prev => prev + 1); },
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      });
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      likeMutation.mutate({ postId: post.id }, {
        onError: () => { setIsLiked(false); setLikeCount(prev => prev - 1); },
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      });
    }
  };

  const handleDoubleTap = () => {
    if (doubleTapEnabled && !isLiked) handleLike();
  };

  const handleRepost = () => {
    const wasReposted = isReposted;
    setIsReposted(!wasReposted);
    setRepostCount(prev => wasReposted ? prev - 1 : prev + 1);
    fetch(`/api/posts/${post.id}/repost`, { method: wasReposted ? "DELETE" : "POST", credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error();
        toast({ title: wasReposted ? "Paylaşım geri alındı" : "Yeniden paylaşıldı ✓" });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      })
      .catch(() => {
        setIsReposted(wasReposted);
        setRepostCount(prev => wasReposted ? prev + 1 : prev - 1);
      });
  };

  const handleBookmark = () => {
    setIsBookmarked(prev => !prev);
    bookmarkMutation.mutate({ postId: post.id }, {
      onError: () => setIsBookmarked(prev => !prev),
      onSuccess: () => {
        setBookmarkCount(prev => isBookmarked ? Math.max(0, prev - 1) : prev + 1);
        toast({ title: isBookmarked ? "Kaydedilenlerden çıkarıldı" : "Kaydedildi" });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  const handleCommentsClick = () => {
    if (post.commentsDisabled) {
      toast({ title: "Yorumlar kapalı", description: "İçerik üreticisi yorumları kapattı." });
      return;
    }
    setIsCommentsOpen(true);
  };

  if (post.postType === "book") {
    const book = readBookContent(post.content || "");
    const bookTextLimit = 280;
    const hasMoreBookText = book.text.length > bookTextLimit;
    const visibleBookText = isBookExpanded ? book.text : book.text.slice(0, bookTextLimit);
    return (
      <>
        <article onDoubleClick={handleDoubleTap} className="post-effect-card mx-4 mb-4 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
          <div className="flex items-center gap-3 border-b border-amber-900/10 px-4 py-3 sm:px-5">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="h-10 w-10" /> : <Avatar className="h-10 w-10 border border-white shadow-sm"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback>{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${post.userId}`} className="block truncate text-sm font-semibold text-slate-900 hover:underline"><UserNameWithDecorations user={post.user} /></Link>
              <p className="truncate text-xs text-slate-500">@{post.user?.username || "kullanıcı"} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })} · kitap paylaştı</p>
            </div>
            <OwnerPostMenu post={post} />
          </div>
          <div className="flow-root p-4 sm:p-5">
            <div className="float-left mb-3 mr-4 h-44 w-28 overflow-hidden rounded-lg bg-slate-100 shadow-[5px_6px_0_rgba(120,53,15,0.12)] sm:mr-5 sm:h-52 sm:w-36">
              {post.mediaUrl ? <img src={post.mediaUrl} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-amber-800/50"><BookOpen className="h-9 w-9" /><span className="text-[10px] font-semibold">Kapak yok</span></div>}
            </div>
            <div className="min-w-0 py-1 break-words">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700/70"><BookOpen className="h-3.5 w-3.5" /> Kitap paylaşımı</div>
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-base font-semibold leading-6 text-slate-900 sm:text-lg">{book.title}</p>
              <p className="mt-2 text-xs font-medium text-amber-800/75">{book.author}</p>
              {book.text && <div className="mt-4"><p className="whitespace-pre-wrap break-words text-sm font-normal leading-6 text-slate-600">{visibleBookText}{hasMoreBookText && !isBookExpanded ? "..." : ""}</p>{hasMoreBookText && <button type="button" onClick={() => setIsBookExpanded(value => !value)} className="mt-2 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline">{isBookExpanded ? "Kısalt" : "Devamını oku"}</button>}</div>}
            </div>
            <div className="clear-both" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between border-t border-amber-900/10 px-4 py-2.5 text-slate-500 sm:px-5">
            <button onClick={handleLike} className="flex items-center gap-1.5 text-xs transition hover:text-rose-500"><Heart className={`h-4 w-4 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`} />{post.hideLikeCount ? null : formatCount(likeCount)}</button>
            <button onClick={handleCommentsClick} className={`flex items-center gap-1.5 text-xs transition hover:text-slate-900 ${post.commentsDisabled ? "cursor-not-allowed text-slate-300" : ""}`}><MessageCircle className="h-4 w-4" />{formatCount(post.commentCount)}</button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs transition hover:text-emerald-600 ${isReposted ? "text-emerald-600" : "text-slate-500"}`} data-testid={`post-repost-${post.id}`}><Repeat2 className="h-4 w-4" />{showRepostCount && <span>{formatCount(repostCount)}</span>}</button>
            <button onClick={handleBookmark} aria-label="Kitabı kaydet" className="flex items-center gap-1.5 transition hover:text-amber-700"><Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-amber-500 text-amber-500" : ""}`} />{!post.hideBookmarkCount && formatCount(bookmarkCount)}</button>
            <button onClick={() => setIsShareOpen(true)} aria-label="Kitabı paylaş" className="flex items-center gap-1.5 transition hover:text-slate-900"><Send className="h-4 w-4" />{formatCount(shareCount)}</button>
          </div>
        </article>
        <CommentBottomSheet postId={post.id} postOwnerId={post.userId} commentCount={post.commentCount} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
        <ShareBottomSheet postId={post.id} postUser={post.user?.username} postContent={post.content || ""} mediaUrl={post.mediaUrl} mediaType={post.mediaType} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setShareCount(value => value + 1)} />
      </>
    );
  }

  if (post.postType === "trailer") {
    const trailerTitle = postText.replace(/^Fragman paylaşımı:\s*/i, "").trim() || "Yeni fragman";
    return (
      <>
        <article onDoubleClick={handleDoubleTap} className="post-effect-card post-effect-trailer mx-4 mb-4 overflow-hidden rounded-2xl border border-sky-200/70 bg-slate-950 shadow-sm">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="h-10 w-10" /> : <Avatar className="h-10 w-10 border border-white/20"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback className="bg-sky-500 text-white">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="min-w-0 flex-1"><Link href={`/profile/${post.userId}`} className="block truncate text-sm font-semibold text-white hover:underline"><UserNameWithDecorations user={post.user} /></Link><p className="truncate text-xs text-slate-400">@{post.user?.username || "kullanıcı"} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })} · fragman paylaştı</p></div>
            <OwnerPostMenu post={post} />
          </div>
          <div className="relative aspect-video bg-black">
            {post.mediaUrl ? post.mediaType === "video" ? <TrailerMedia src={post.mediaUrl} title={`${trailerTitle} fragmanı`} /> : <img src={post.mediaUrl} alt={`${trailerTitle} fragmanı`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-slate-500"><Film className="h-10 w-10" /></div>}
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200"><Film className="h-3.5 w-3.5" /> Fragman</div>
          </div>
          <div className="px-4 pb-3 pt-4 sm:px-5"><p className="whitespace-pre-wrap break-words text-sm font-normal leading-6 text-slate-200">{trailerTitle}</p></div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-slate-400 sm:px-5">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition hover:text-rose-400 ${isLiked ? "text-rose-400" : ""}`}><Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />{post.hideLikeCount ? null : formatCount(likeCount)}</button>
            <button onClick={handleCommentsClick} className={`flex items-center gap-1.5 text-xs transition hover:text-white ${post.commentsDisabled ? "cursor-not-allowed text-slate-600" : ""}`}><MessageCircle className="h-4 w-4" />{formatCount(post.commentCount)}</button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs transition hover:text-emerald-400 ${isReposted ? "text-emerald-400" : ""}`}><Repeat2 className="h-4 w-4" />{showRepostCount && <span>{formatCount(repostCount)}</span>}</button>
            <button onClick={handleBookmark} aria-label="Fragmanı kaydet" className={`flex items-center gap-1.5 transition hover:text-sky-300 ${isBookmarked ? "text-sky-300" : ""}`}><Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />{!post.hideBookmarkCount && formatCount(bookmarkCount)}</button>
            <button onClick={() => setIsShareOpen(true)} aria-label="Fragmanı paylaş" className="flex items-center gap-1.5 transition hover:text-white"><Send className="h-4 w-4" />{formatCount(shareCount)}</button>
          </div>
        </article>
        <CommentBottomSheet postId={post.id} postOwnerId={post.userId} commentCount={post.commentCount} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
        <ShareBottomSheet postId={post.id} postUser={post.user?.username} postContent={post.content || ""} mediaUrl={post.mediaUrl} mediaType={post.mediaType} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setShareCount(value => value + 1)} />
      </>
    );
  }

  if (post.postType === "column") {
    const column = readColumnContent(post.content || "");
    const toneClass = column.style.tone === "forest" ? "text-emerald-950" : column.style.tone === "wine" ? "text-rose-950" : "text-slate-800";
    const accentClass = column.style.tone === "forest" ? "bg-emerald-700" : column.style.tone === "wine" ? "bg-rose-800" : "bg-slate-800";
    const weightClass = column.style.weight === "strong" ? "font-semibold" : column.style.weight === "medium" ? "font-medium" : "font-normal";
    return (
      <>
        <article onDoubleClick={handleDoubleTap} className="post-effect-card mx-4 mb-5 overflow-hidden rounded-[1.5rem] border border-[#ead8ab] bg-gradient-to-br from-[#fffdf8] via-[#fffaf0] to-[#f3e2b9] shadow-[0_20px_48px_rgba(120,83,30,0.14)]">
          <div className="h-1.5 bg-gradient-to-r from-[#8f641e] via-[#f8dda0] to-[#a97525]" />
          <div className="flex items-center justify-between border-b border-[#ead8ab]/70 bg-white/40 px-5 py-4 text-stone-800 sm:px-7">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-500"><Feather className="h-4 w-4 text-[#b8862f]" /> Köşe yazısı</div>
            <span className="font-serif text-[15px] italic tracking-wide text-[#9a742d]">Loop editoryal yazısı</span>
          </div>
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="h-9 w-9" /> : <Avatar className="h-9 w-9 border border-slate-200"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback className="bg-slate-100 text-slate-700">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="min-w-0 flex-1"><Link href={`/profile/${post.userId}`} className="block truncate text-sm font-medium text-slate-900 hover:underline"><UserNameWithDecorations user={post.user} /></Link><p className="truncate text-xs text-slate-500">@{post.user?.username || "kullanıcı"} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}</p></div>
            <OwnerPostMenu post={post} />
          </div>
          <div className="relative mx-4 my-4 overflow-hidden rounded-xl border border-[#ead8ab]/70 bg-white/55 sm:mx-6 sm:my-6">
            <div className={`absolute inset-y-0 left-0 w-1 ${column.style.tone === "ink" ? "bg-gradient-to-b from-[#b8862f] to-[#ead18d]" : accentClass}`} />
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="mb-6 flex items-end justify-between gap-4"><span className="font-serif text-4xl leading-none text-[#c9a455]">“</span><span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#a58449]">Kişisel not</span></div>
              <p className={`whitespace-pre-wrap break-words font-serif text-[16px] leading-8 ${toneClass} ${weightClass} ${column.style.italic ? "italic" : ""} ${column.style.highlighted ? "rounded-md bg-amber-100/80 px-2 py-1" : ""}`}>{column.text}</p>
              <div className="mt-7 flex items-center gap-3"><div className={`h-1 w-8 rounded-full ${accentClass}`} /><UserNameWithDecorations user={post.user} fallback="Yazar" className="text-[10px] uppercase tracking-[0.18em] text-slate-400" /></div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#ead8ab]/70 bg-white/35 px-5 py-3 text-stone-500 sm:px-7">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition hover:text-rose-500 ${isLiked ? "text-rose-500" : ""}`}><Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />{post.hideLikeCount ? null : formatCount(likeCount)}</button>
            <button onClick={handleCommentsClick} className={`flex items-center gap-1.5 text-xs transition hover:text-slate-900 ${post.commentsDisabled ? "cursor-not-allowed text-stone-300" : ""}`}><MessageCircle className="h-4 w-4" />{formatCount(post.commentCount)}</button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs transition hover:text-emerald-600 ${isReposted ? "text-emerald-600" : ""}`}><Repeat2 className="h-4 w-4" />{showRepostCount && <span>{formatCount(repostCount)}</span>}</button>
            <button onClick={handleBookmark} aria-label="Köşe yazısını kaydet" className={`flex items-center gap-1.5 transition hover:text-slate-900 ${isBookmarked ? "text-slate-900" : ""}`}><Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />{!post.hideBookmarkCount && formatCount(bookmarkCount)}</button>
            <button onClick={() => setIsShareOpen(true)} aria-label="Köşe yazısını paylaş" className="flex items-center gap-1.5 transition hover:text-slate-900"><Send className="h-4 w-4" />{formatCount(shareCount)}</button>
          </div>
        </article>
        <CommentBottomSheet postId={post.id} postOwnerId={post.userId} commentCount={post.commentCount} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
        <ShareBottomSheet postId={post.id} postUser={post.user?.username} postContent={post.content || ""} mediaUrl={post.mediaUrl} mediaType={post.mediaType} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setShareCount(value => value + 1)} />
      </>
    );
  }

  if (post.postType === "micro") {
    return (
      <>
        <article onDoubleClick={handleDoubleTap} className="post-effect-card mx-4 mb-4 overflow-hidden rounded-[1.35rem] border border-teal-200/80 bg-gradient-to-br from-[#f5fffc] via-white to-[#e5f3ef] shadow-[0_14px_30px_rgba(13,94,85,0.10)]">
          <div className="flex items-center gap-3 border-b border-teal-100/80 px-5 py-4 sm:px-6">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="h-9 w-9" /> : <Avatar className="h-9 w-9 border border-teal-100"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback className="bg-teal-50 text-teal-800">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="min-w-0 flex-1"><Link href={`/profile/${post.userId}`} className="block truncate text-sm font-medium text-slate-800 hover:underline"><UserNameWithDecorations user={post.user} /></Link><p className="truncate text-xs text-slate-500">@{post.user?.username || "kullanıcı"} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}</p></div>
            <span className="rounded-full border border-teal-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800">Mikro öykü</span>
            <OwnerPostMenu post={post} />
          </div>
          <div className="px-6 py-7 sm:px-9 sm:py-8">
            <div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-teal-400" /><span className="font-serif text-sm italic text-teal-700">Kısa bir an</span><span className="h-px flex-1 bg-teal-100" /></div>
            <p className="whitespace-pre-wrap break-words font-serif text-[17px] font-normal leading-8 text-slate-800">{postText}</p>
          </div>
          <div className="flex items-center justify-between border-t border-teal-100/80 bg-white/45 px-5 py-3 text-slate-500 sm:px-6">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition hover:text-rose-500 ${isLiked ? "text-rose-500" : ""}`}><Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />{post.hideLikeCount ? null : formatCount(likeCount)}</button>
            <button onClick={handleCommentsClick} className={`flex items-center gap-1.5 text-xs transition hover:text-slate-900 ${post.commentsDisabled ? "cursor-not-allowed text-teal-300" : ""}`}><MessageCircle className="h-4 w-4" />{formatCount(post.commentCount)}</button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs transition hover:text-emerald-600 ${isReposted ? "text-emerald-600" : ""}`}><Repeat2 className="h-4 w-4" />{showRepostCount && <span>{formatCount(repostCount)}</span>}</button>
            <button onClick={handleBookmark} aria-label="Mikro öyküyü kaydet" className={`flex items-center gap-1.5 transition hover:text-teal-700 ${isBookmarked ? "text-teal-700" : ""}`}><Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />{!post.hideBookmarkCount && formatCount(bookmarkCount)}</button>
            <button onClick={() => setIsShareOpen(true)} aria-label="Mikro öyküyü paylaş" className="flex items-center gap-1.5 transition hover:text-slate-900"><Send className="h-4 w-4" />{formatCount(shareCount)}</button>
          </div>
        </article>
        <CommentBottomSheet postId={post.id} postOwnerId={post.userId} commentCount={post.commentCount} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
        <ShareBottomSheet postId={post.id} postUser={post.user?.username} postContent={post.content || ""} mediaUrl={post.mediaUrl} mediaType={post.mediaType} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setShareCount(value => value + 1)} />
      </>
    );
  }

  if (hasMedia) {
    return (
      <>
        <article onDoubleClick={handleDoubleTap} className="mx-4 mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="h-10 w-10" /> : <Avatar className="h-10 w-10 border border-border"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback>{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${post.userId}`} className="block truncate text-sm font-semibold hover:underline"><UserNameWithDecorations user={post.user} /></Link>
              <p className="truncate text-xs text-muted-foreground">@{post.user?.username || "kullanıcı"} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}</p>
            </div>
            <OwnerPostMenu post={post} />
          </div>

          <div className="relative border-y border-border/70 bg-muted/20">
            <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth p-2" style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
              {postMediaUrls.map((url, index) => {
                const isVideo = post.mediaType === "video" || isVideoMediaUrl(url);
                return (
                <div key={`${url}-${index}`} className={`relative w-full basis-full shrink-0 snap-center overflow-hidden rounded-xl bg-muted ${isVideo ? "aspect-video" : "aspect-[4/5] sm:aspect-video"}`}>
                  {isVideo ? (
                    <TrailerMedia src={url} title={`Gönderi videosu ${index + 1}`} />
                  ) : (
                    <PostMediaImage src={url} alt={`Gönderi fotoğrafı ${index + 1}`} postId={post.id} />
                  )}
                  {postMediaUrls.length > 1 && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">{index + 1}/{postMediaUrls.length}</span>}
                </div>
                );
              })}
            </div>
            {postMediaUrls.length > 1 && <p className="pb-2 text-center text-[10px] text-muted-foreground">Yana kaydır</p>}
          </div>

          {(postText || tags.length > 0) && (
            <div className="px-4 pb-3 pt-4 sm:px-5">
              {postText && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{renderTextWithHashtags(postText)}</p>}
              {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map(tag => <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">#{tag}</span>)}</div>}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-muted-foreground sm:px-5">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition hover:text-rose-500 ${isLiked ? "text-rose-500" : ""}`}><Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />{post.hideLikeCount ? null : formatCount(likeCount)}</button>
            <button onClick={handleCommentsClick} className="flex items-center gap-1.5 text-xs transition hover:text-foreground"><MessageCircle className="h-4 w-4" />{formatCount(post.commentCount)}</button>
            <button onClick={handleRepost} className={`flex items-center gap-1.5 text-xs transition hover:text-emerald-600 ${isReposted ? "text-emerald-600" : ""}`}><Repeat2 className="h-4 w-4" />{showRepostCount && formatCount(repostCount)}</button>
            <button onClick={handleBookmark} className="flex items-center gap-1.5 text-xs transition hover:text-primary"><Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-primary text-primary" : ""}`} />{!post.hideBookmarkCount && formatCount(bookmarkCount)}</button>
            <button onClick={() => setIsShareOpen(true)} className="flex items-center gap-1.5 text-xs transition hover:text-foreground"><Send className="h-4 w-4" />{formatCount(shareCount)}</button>
          </div>
        </article>
        <CommentBottomSheet postId={post.id} postOwnerId={post.userId} commentCount={post.commentCount} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
        <ShareBottomSheet postId={post.id} postUser={post.user?.username} postContent={post.content || ""} mediaUrl={postMediaUrls[0]} mediaType={post.mediaType} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onShared={() => setShareCount(value => value + 1)} />
      </>
    );
  }

  if (hasMedia) {
    // Full-bleed media card (TikTok style)
    return (
      <>
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden relative bg-black" style={{ minHeight: 420 }}>
          {/* Media */}
          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl!}
              className="loop-autoplay-video w-full object-cover"
              style={{ maxHeight: 520 }}
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
              onTimeUpdate={event => {
                const video = event.currentTarget;
                if (video.duration > 0 && video.currentTime / video.duration >= 0.8) recordPostView();
              }}
            />
          ) : (
            <img
              src={post.mediaUrl!}
              alt="Post"
              className="w-full object-cover"
              style={{ maxHeight: 520 }}
            />
          )}

          {/* Top overlay: user info */}
          <div className="absolute top-0 left-0 right-12 p-3 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent">
            <Link href={`/profile/${post.userId}`}>
              {isReposted && user ? <SplitAvatar leftSrc={post.user?.avatarUrl || ""} leftFallback={post.user?.displayName?.charAt(0) || "U"} rightSrc={user.avatarUrl || ""} rightFallback={user.displayName?.charAt(0) || "U"} size="w-9 h-9" /> : <Avatar className="w-9 h-9 border border-white/30"><AvatarImage src={post.user?.avatarUrl || ""} /><AvatarFallback className="text-white bg-primary text-sm">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>}
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${post.userId}`}>
                <UserNameWithDecorations user={post.user} className="text-white font-semibold text-sm leading-tight truncate" />
              </Link>
              <p className="text-white/60 text-xs">
                @{post.user?.username} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}
              </p>
            </div>
            <OwnerPostMenu post={post} />
          </div>

          {/* Right side: action buttons */}
          <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
            {/* Follow button on avatar */}
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={post.user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary text-white text-sm">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-background">
                <Plus className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Like */}
            <button onClick={handleLike} className="flex flex-col items-center gap-0.5" data-testid={`post-like-${post.id}`}>
              <Heart className={`w-7 h-7 drop-shadow-lg ${isLiked ? "fill-red-500 text-red-500" : "text-white"}`} />
              {(isPostOwner || !post.hideLikeCount) && <span className="text-white text-xs font-medium drop-shadow">{formatCount(likeCount)}</span>}
            </button>

            {/* Comment */}
            <button
              onClick={handleCommentsClick}
              data-testid={`post-comment-${post.id}`}
              className={`flex flex-col items-center gap-0.5 ${post.commentsDisabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
              <span className="text-white text-xs font-medium drop-shadow">{formatCount(post.commentCount)}</span>
            </button>

            {/* Share/Repost */}
            <button onClick={handleRepost} className="flex flex-col items-center gap-0.5" data-testid={`post-repost-${post.id}`}>
              <Repeat2 className={`w-7 h-7 drop-shadow-lg ${isReposted ? "text-green-400" : "text-white"}`} />
              {showRepostCount && <span className="text-white text-xs font-medium drop-shadow">{formatCount(repostCount)}</span>}
            </button>

            {/* Bookmark */}
            <button onClick={handleBookmark} className="flex flex-col items-center gap-0.5" data-testid={`post-bookmark-${post.id}`}>
              <Bookmark className={`w-7 h-7 drop-shadow-lg ${isBookmarked ? "fill-primary text-primary" : "text-white"}`} />
              {!post.hideBookmarkCount && <span className="text-white text-xs font-medium drop-shadow">{formatCount(bookmarkCount)}</span>}
            </button>

            {/* DM Share — yanyana kaydet ile */}
            <button onClick={() => setIsShareOpen(true)} className="flex flex-col items-center gap-0.5">
              <Send className="w-7 h-7 text-white drop-shadow-lg" />
              <span className="text-white text-xs font-medium drop-shadow">{formatCount(shareCount)}</span>
            </button>
          </div>

          {/* Bottom overlay: text, hashtags, music */}
          <div className="absolute bottom-0 left-0 right-14 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            {postText && (
              <p className="text-white text-sm font-medium mb-1.5 line-clamp-2">{postText}</p>
            )}
            {tags.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-[#6fa7ff]/25 bg-[#0b1424]/55 px-1.5 py-0.5 text-[11px] font-semibold tracking-[-0.02em] text-[#87b7ff] shadow-[0_0_18px_rgba(88,146,255,0.18)]"
                  >
                    #{tag}
                  </span>
                ))}
                {tags.length > 2 && <span className="text-white/60 text-xs">+</span>}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Music2 className="w-3 h-3 text-white/70 flex-shrink-0" />
              <span className="text-white/70 text-xs truncate">Loop müzik</span>
            </div>
          </div>

          {/* Progress bar at very bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full w-1/3 bg-primary rounded-full" />
          </div>
        </div>

        <CommentBottomSheet
          postId={post.id}
          postOwnerId={post.userId}
          commentCount={post.commentCount}
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
        />
        <ShareBottomSheet
          postId={post.id}
          postUser={post.user?.username}
          postContent={post.content || ""}
          mediaUrl={post.mediaUrl}
          mediaType={post.mediaType}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          onShared={() => setShareCount(value => value + 1)}
        />
      </>
    );
  }

  // Text-only card
  return (
    <>
      <div className="post-effect-card mx-4 mb-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {backgroundUrl && (
          <div className="relative h-24 overflow-hidden border-b border-border/60">
            <img src={backgroundUrl} alt="Gönderi kapağı" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
          </div>
        )}

        <div className="p-4">
          <div className="mb-3 flex items-center gap-3">
            {isReposted && user ? (
              <SplitAvatar
                leftSrc={post.user?.avatarUrl || ""}
                leftFallback={post.user?.displayName?.charAt(0) || "U"}
                rightSrc={user.avatarUrl || ""}
                rightFallback={user.displayName?.charAt(0) || "U"}
                size="w-10 h-10"
              />
            ) : (
              <Link href={`/profile/${post.userId}`}>
                <Avatar className="w-10 h-10 border border-border cursor-pointer">
                  <AvatarImage src={post.user?.avatarUrl || ""} />
                  <AvatarFallback>{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${post.userId}`} className="block truncate text-sm font-semibold hover:underline">
                <UserNameWithDecorations user={post.user} />
              </Link>
              <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {isReposted && <><Repeat2 className="h-3 w-3 flex-shrink-0 text-green-500" /><span className="text-[10px] font-medium text-green-500">Sen paylaştın ·</span></>}
                @{post.user?.username} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}
              </span>
            </div>
            <OwnerPostMenu post={post} />
          </div>

          <div className="text-sm leading-6 whitespace-pre-wrap break-words text-foreground">
            {renderTextWithHashtags(post.content || "")}
          </div>
        </div>

        {post.postType === "poll" && post.pollOptions && post.pollOptions.length > 0 && (() => {
          const totalVotes = pollVoteCounts.reduce((s, c) => s + (c ?? 0), 0);
          const hasVoted = myPollVote !== null;
          return (
            <div className="px-4 pb-3">
              <div className="mb-3 flex flex-col gap-2">
                {post.pollOptions.map((option, i) => {
                  const count = pollVoteCounts[i] ?? 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isSelected = myPollVote === i;
                  return (
                    <button
                      key={i}
                      disabled={hasVoted || isVoting}
                      onClick={() => handlePollVote(i)}
                      className={`relative w-full overflow-hidden rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors
                        ${isSelected
                          ? "border-primary text-primary"
                          : hasVoted
                            ? "border-border/60 text-muted-foreground"
                            : "border-border hover:border-primary hover:text-primary"
                        }
                        disabled:cursor-default`}
                    >
                      {hasVoted && (
                        <span
                          className={`absolute inset-0 rounded-xl transition-all duration-500 ${isSelected ? "bg-primary/15" : "bg-muted/60"}`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <span className="relative flex items-center justify-between gap-2">
                        <span className="truncate">{option}</span>
                        {hasVoted && (
                          <span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                            %{pct}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="pl-1 text-xs text-muted-foreground">{totalVotes} oy</p>
            </div>
          );
        })()}

        <div className="flex items-center gap-5 border-t border-border/50 px-4 py-2.5 text-muted-foreground">
          <button
            className={`flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${post.commentsDisabled ? "cursor-not-allowed opacity-40" : ""}`}
            onClick={handleCommentsClick}
            data-testid={`post-comment-${post.id}`}
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.commentCount}</span>
          </button>

          <button onClick={handleRepost} className={`flex items-center gap-1.5 text-sm transition-colors hover:text-green-500 ${isReposted ? "text-green-500" : ""}`} data-testid={`post-repost-${post.id}`}>
            <Repeat2 className="h-5 w-5" />
            {showRepostCount && <span>{repostCount}</span>}
          </button>

          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors hover:text-red-500 ${isLiked ? "text-red-500" : ""}`} data-testid={`post-like-${post.id}`}>
            <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
            {!post.hideLikeCount && <span>{likeCount}</span>}
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={handleBookmark} className={`flex items-center gap-1.5 text-sm transition-colors hover:text-primary ${isBookmarked ? "text-primary" : ""}`} data-testid={`post-bookmark-${post.id}`}>
              <Bookmark className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`} />
            </button>
            <button onClick={() => setIsShareOpen(true)} className="flex items-center gap-1.5 text-sm transition-colors hover:text-primary">
              <Send className="h-5 w-5" />
              <span>{formatCount(shareCount)}</span>
            </button>
          </div>
        </div>
      </div>

      <CommentBottomSheet
        postId={post.id}
        postOwnerId={post.userId}
        commentCount={post.commentCount}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />
      <ShareBottomSheet
        postId={post.id}
        postUser={post.user?.username}
        postContent={post.content || ""}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onShared={() => setShareCount(value => value + 1)}
      />
    </>
  );
}
