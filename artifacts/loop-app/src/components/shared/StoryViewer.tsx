import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Send, Eye, MessageCircle, Pin, Music2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";

interface Story {
  id: number;
  mediaUrl: string;
  mediaType?: string;
  storyText?: string | null;
  storyTextColor?: string | null;
  storyTextBackground?: "none" | "solid" | "white" | "translucent" | null;
  createdAt: string;
  user?: { id: number; displayName: string; username: string; avatarUrl?: string | null };
}

interface StoryGroup {
  user: { id: number; displayName: string; username: string; avatarUrl?: string | null; badgeAssetUrl?: string | null; emblemAssetUrl?: string | null; badgeLabel?: string | null };
  stories: Story[];
}

interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  startStoryIndex?: number;
  onClose: () => void;
  onView?: (storyId: number) => void;
}

const IMAGE_STORY_DURATION = 5000;
const EMOJI_REACTIONS = ["❤️", "😂", "😮", "🙌", "🔥", "😍", "👏", "💯"];

function isVideoStory(mediaType?: string | null) {
  return mediaType?.toLowerCase().startsWith("video") ?? false;
}

function decodeStoryShareMetadata(mediaUrl?: string | null): { kind: "post" | "loop"; id: number } | null {
  if (!mediaUrl) return null;

  try {
    const direct = mediaUrl.match(/[?&]story-share=(post|loop):(\d+)/i);
    if (direct) {
      return { kind: direct[1].toLowerCase() as "post" | "loop", id: Number(direct[2]) };
    }

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

// Module-level cache — component unmount/remount'tan bağımsız kalır.
// key: storyId → pinned reply dizisi
const _pinnedCache: Record<number, any[]> = {};

export function StoryViewer({ groups, startGroupIndex, startStoryIndex = 0, onClose, onView }: StoryViewerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(startStoryIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedAtRef = useRef<number>(0);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);

  // Story owner replies panel
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  // Pinned replies per story — module-level cache'den başlatılır; unmount/remount'a dirençli
  const [pinnedByStory, setPinnedByStory] = useState<Record<number, any[]>>(() => ({ ..._pinnedCache }));

  // Story owner viewers panel
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [watermarkOffset, setWatermarkOffset] = useState({ right: 8, bottom: 72 });
  const [sharedStoryMeta, setSharedStoryMeta] = useState<{ kind: "post" | "loop"; title: string; audio?: string | null; mediaUrl?: string; mediaType?: string; user?: { id?: number; displayName?: string; username?: string; avatarUrl?: string | null; badgeAssetUrl?: string | null; emblemAssetUrl?: string | null; badgeLabel?: string | null } | null } | null>(null);
  const [loopWatermark, setLoopWatermark] = useState({ watermarkUrl: "/loop-logo.svg", mimeType: "image/svg+xml", text: "", size: 1 });

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];
  const isOwnStory = !!user && currentGroup?.user?.id === user.id;
  const activePinnedReplies = currentStory
    ? (pinnedByStory[currentStory.id] ?? []).filter((r: any) => {
        const replyStoryId = Number(r.storyId ?? r.highlightId ?? r.story_id ?? currentStory.id);
        return replyStoryId === currentStory.id && (r.pinned === true || r.is_pinned === true);
      }).slice(0, 2)
    : [];
  useEffect(() => {
    fetch("/api/branding/watermark", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.watermarkUrl) setLoopWatermark({ watermarkUrl: data.watermarkUrl, mimeType: data.mimeType || "image/svg+xml", text: data.text ?? "", size: Number(data.size ?? 1) || 1 });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const share = currentStory ? decodeStoryShareMetadata(currentStory.mediaUrl) : null;
    if (!share) {
      setSharedStoryMeta(null);
      return;
    }

    let active = true;
    const endpoint = share.kind === "post" ? `/api/posts/${share.id}` : `/api/loop/photos/${share.id}`;

    fetch(endpoint, { credentials: "include", cache: "no-store" })
      .then(async (response): Promise<void> => {
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        const resolvedMediaUrl = share.kind === "post" ? (data?.mediaUrl || currentStory.mediaUrl) : (data?.mediaUrl || currentStory.mediaUrl);
        const resolvedMediaType = share.kind === "post" ? (data?.mediaType || currentStory.mediaType) : (data?.mediaType || currentStory.mediaType);
        const resolvedUser = share.kind === "post" ? data?.user : data?.sender;
        const sourceTitle = share.kind === "post" ? (data?.content || "Gönderi") : (data?.title || "Loop");

        setSharedStoryMeta({
          kind: share.kind,
          title: sourceTitle,
          audio: share.kind === "loop" ? data?.audio : null,
          mediaUrl: resolvedMediaUrl,
          mediaType: resolvedMediaType,
          user: resolvedUser || currentGroup?.user,
        });
      })
      .catch((): void => {
        if (!active) {
          return;
        }

        setSharedStoryMeta({
          kind: share.kind,
          title: share.kind === "post" ? "Gönderi" : "Loop",
          audio: null,
          mediaUrl: currentStory.mediaUrl,
          mediaType: currentStory.mediaType,
          user: currentGroup?.user,
        });
      });

    return () => { active = false; };
  }, [currentStory?.id, currentStory?.mediaUrl, currentStory?.mediaType, currentGroup?.user]);

  const handleSharedStoryOpen = useCallback(() => {
    const share = currentStory ? decodeStoryShareMetadata(currentStory.mediaUrl) : null;
    if (!share) return;
    onClose();
    setLocation(share.kind === "post" ? `/?post=${share.id}` : `/loops?loop=${share.id}`);
  }, [currentStory, onClose, setLocation]);

  const togglePlayback = useCallback(() => {
    if (!isVideoStory(currentStory?.mediaType)) return;
    setPaused((current) => !current);
  }, [currentStory?.mediaType]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => {});
  }, [paused, currentStory?.id, sharedStoryMeta?.mediaUrl]);

  useEffect(() => {
    const video = storyVideoRef.current;
    const container = video?.parentElement;
    if (!video || !container) return;

    const updateWatermarkOffset = () => {
      const videoRect = video.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setWatermarkOffset({
        right: Math.round(containerRect.right - videoRect.right - 56),
        bottom: Math.max(154, Math.round(containerRect.bottom - videoRect.bottom + 154)),
      });
    };

    updateWatermarkOffset();
    const observer = new ResizeObserver(updateWatermarkOffset);
    observer.observe(video);
    observer.observe(container);
    window.addEventListener("resize", updateWatermarkOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWatermarkOffset);
    };
  }, [currentStory?.id, sharedStoryMeta?.mediaUrl]);

  // Lock the page behind the full-screen story viewer without losing scroll position.
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };
    document.body.classList.add("story-viewer-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      document.body.classList.remove("story-viewer-open");
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Hikaye değiştiğinde sabitlenmiş yanıtları public endpoint'ten yükle + cache'e yaz
  // (tüm kullanıcılar için — owner olmak gerekmez)
  useEffect(() => {
    if (!currentStory) return;
    const sid = currentStory.id;
    fetch(`/api/stories/${sid}/pinned-replies`)
      .then(r => r.ok ? r.json() : null)
      .then((arr: any[]) => {
        if (!Array.isArray(arr)) return;
        _pinnedCache[sid] = arr;
        setPinnedByStory(prev => ({ ...prev, [sid]: arr }));
      })
      .catch(() => {});
  }, [currentStory?.id]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
      setPaused(false);
      setShowReplies(false);
      setShowViewers(false);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
      setPaused(false);
      setShowReplies(false);
      setShowViewers(false);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
      setPaused(false);
      setShowReplies(false);
      setShowViewers(false);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
      setProgress(0);
      setPaused(false);
      setShowReplies(false);
      setShowViewers(false);
    }
  }, [storyIdx, groupIdx]);

  // Progress timer
  useEffect(() => {
    if (!currentStory || paused) return;
    if (onView) onView(currentStory.id);

    if (isVideoStory(currentStory.mediaType)) return;

    startTimeRef.current = Date.now() - (pausedAtRef.current || 0);
    pausedAtRef.current = 0;

    if (progressRef.current) clearInterval(progressRef.current);

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min((elapsed / IMAGE_STORY_DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(progressRef.current!);
        goNext();
      }
    }, 50);

    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [groupIdx, storyIdx, paused]);

  // Pause when input is focused
  const handleInputFocus = () => {
    if (!paused) {
      pausedAtRef.current = Date.now() - startTimeRef.current;
      setPaused(true);
    }
  };
  const handleInputBlur = () => {
    if (paused && !showReplies && !showViewers) setPaused(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Send reply
  const sendReply = async (content: string, isEmoji = false) => {
    if (!currentStory || !content.trim()) return;
    setReplySending(true);
    try {
      const r = await fetch(`/api/stories/${currentStory.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), isEmoji }),
      });
      if (r.ok) {
        if (isEmoji) {
          setSentEmoji(content);
          setTimeout(() => setSentEmoji(null), 2000);
        } else {
          setReplyText("");
          toast({ title: "Yanıt gönderildi 💌" });
        }
        setPaused(false);
      } else {
        const data = await r.json();
        toast({ title: "Hata", description: data.error, variant: "destructive" });
      }
    } finally {
      setReplySending(false);
    }
  };

  // Load replies (story owner)
  const loadReplies = async () => {
    if (!currentStory) return;
    setRepliesLoading(true);
    try {
      const r = await fetch(`/api/stories/${currentStory.id}/replies`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setReplies(arr);
      // pinnedByStory: sadece bu hikaye parçasına ait sabitler
      setPinnedByStory(prev => ({ ...prev, [currentStory.id]: arr.filter((r: any) => r.pinned) }));
    } finally {
      setRepliesLoading(false);
    }
  };

  const togglePin = async (replyId: number) => {
    if (!currentStory) return;
    const storyId = currentStory.id;
    try {
      const r = await fetch(`/api/stories/${storyId}/replies/${replyId}/pin`, { method: "POST" });
      if (r.ok) {
        const updated = await r.json();
        setReplies(prev => prev.map(rep => rep.id === replyId ? { ...rep, pinned: updated.pinned } : rep));
        setPinnedByStory(prev => {
          const current = prev[storyId] ?? [];
          let next: any[];
          if (updated.pinned) {
            const rep = replies.find(x => x.id === replyId);
            next = rep ? [...current.filter(x => x.id !== replyId), { ...rep, pinned: true }] : current;
          } else {
            next = current.filter(x => x.id !== replyId);
          }
          _pinnedCache[storyId] = next; // module cache güncelle
          return { ...prev, [storyId]: next };
        });
      }
    } catch { /* sessiz */ }
  };

  const toggleReplies = async () => {
    if (!showReplies) {
      setPaused(true);
      setShowViewers(false);
      setShowReplies(true);
      await loadReplies();
    } else {
      setShowReplies(false);
      setPaused(false);
    }
  };

  // Load viewers (story owner)
  const loadViewers = async () => {
    if (!currentStory) return;
    setViewersLoading(true);
    try {
      const r = await fetch(`/api/stories/${currentStory.id}/viewers`);
      const data = await r.json();
      setViewers(Array.isArray(data) ? data : []);
    } finally {
      setViewersLoading(false);
    }
  };

  const toggleViewers = async () => {
    if (!showViewers) {
      setPaused(true);
      setShowReplies(false);
      setShowViewers(true);
      await loadViewers();
    } else {
      setShowViewers(false);
      setPaused(false);
    }
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
      {/* Main story container */}
      <div
        className="relative w-full max-w-sm h-full max-h-[100dvh] md:max-h-[90vh] md:rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                  background: "linear-gradient(90deg, #a855f7, #7c3aed, #c026d3)",
                  boxShadow: i === storyIdx ? "0 0 8px 2px #a855f7aa" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* User header */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => { onClose(); setLocation(`/profile/${currentGroup.user.id}`); }}
            className="flex-shrink-0 focus:outline-none"
          >
            <Avatar className="w-9 h-9 border-2 border-white/70">
              <AvatarImage src={currentGroup.user.avatarUrl || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {currentGroup.user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>
          <button
            onClick={() => { onClose(); setLocation(`/profile/${currentGroup.user.id}`); }}
            className="flex-1 min-w-0 text-left"
          >
            <UserNameWithDecorations user={currentGroup.user} showLabel className="text-white font-semibold text-sm drop-shadow [&>img]:h-4 [&>img]:w-4" />
            <p className="text-white/70 text-xs drop-shadow">
              {formatDistanceToNow(new Date(currentStory.createdAt), { locale: tr, addSuffix: true })}
            </p>
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media */}
        <div
          className="w-full h-full bg-black flex items-center justify-center relative select-none"
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
        >
          {(() => {
            const share = decodeStoryShareMetadata(currentStory.mediaUrl);
            const mediaUrl = share ? (sharedStoryMeta?.mediaUrl || currentStory.mediaUrl) : currentStory.mediaUrl;
            const mediaType = share ? (sharedStoryMeta?.mediaType || currentStory.mediaType) : currentStory.mediaType;

            if (isVideoStory(mediaType)) {
              return (
                <video
                  ref={storyVideoRef}
                  key={`${currentStory.id}-${mediaUrl}`}
                  src={mediaUrl}
                  autoPlay
                  muted={false}
                  playsInline
                  controls={false}
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={togglePlayback}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (Number.isFinite(video.duration) && video.duration > 0) {
                      setProgress(Math.min((video.currentTime / video.duration) * 100, 100));
                    }
                  }}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (Number.isFinite(video.duration) && video.duration > 0) {
                      setProgress(Math.min((video.currentTime / video.duration) * 100, 100));
                    }
                  }}
                  onEnded={() => {
                    setProgress(100);
                    goNext();
                  }}
                  className="w-full h-full object-contain"
                />
              );
            }

            return (
              <img
                key={`${currentStory.id}-${mediaUrl}`}
                src={mediaUrl}
                alt="Story"
                className="w-full h-full object-contain"
              />
            );
          })()}

          {currentStory.storyText && isVideoStory(currentStory.mediaType) && decodeStoryShareMetadata(currentStory.mediaUrl)?.kind !== "loop" && (
            <div
              className="pointer-events-none absolute left-1/2 top-[38%] z-10 max-w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[0.35em] px-[0.55em] py-[0.35em] text-center text-[clamp(1.1rem,5vw,2rem)] font-bold leading-tight drop-shadow-lg"
              style={{
                color: currentStory.storyTextBackground === "white" ? "#111111" : currentStory.storyTextColor || "#ffffff",
                backgroundColor: currentStory.storyTextBackground === "solid" ? "rgba(0,0,0,.88)" : currentStory.storyTextBackground === "white" ? "rgba(255,255,255,.94)" : currentStory.storyTextBackground === "translucent" ? "rgba(0,0,0,.52)" : "transparent",
              }}
            >
              {currentStory.storyText}
            </div>
          )}

          {decodeStoryShareMetadata(currentStory.mediaUrl) && sharedStoryMeta && (
            <div className="pointer-events-none absolute left-5 top-20 z-20 max-w-[calc(100%-2.5rem)] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/80 bg-black/20 shadow-lg">
                  {sharedStoryMeta.user?.avatarUrl ? (
                    <img src={sharedStoryMeta.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/90">{(sharedStoryMeta.user?.displayName || sharedStoryMeta.user?.username || "U").charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <UserNameWithDecorations user={sharedStoryMeta.user} showLabel className="max-w-full truncate text-[13px] font-bold text-white [&>img]:h-4 [&>img]:w-4" />
                  <p className="mt-1 flex max-w-full items-center gap-1 text-[10px] text-white/75">
                    <Music2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{sharedStoryMeta.audio || "Orijinal ses"}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {decodeStoryShareMetadata(currentStory.mediaUrl)?.kind === "loop" && (
            <div
              className="pointer-events-none absolute z-20 flex items-end gap-1.5 opacity-90 drop-shadow-[0_1px_5px_rgba(0,0,0,0.75)]"
              style={{ right: `${watermarkOffset.right}px`, bottom: `${watermarkOffset.bottom}px` }}
            >
              {loopWatermark.text && <span className="text-[10px] font-black tracking-[0.08em] text-white/90">{loopWatermark.text}</span>}
              {loopWatermark.mimeType.startsWith("video/") ? (
                <video
                  src={loopWatermark.watermarkUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  className="rounded-md object-contain"
                  style={{ width: `${Math.max(40, Math.round(110 * (loopWatermark.size || 1)))}px`, height: `${Math.max(18, Math.round(30 * (loopWatermark.size || 1)))}px` }}
                />
              ) : (
                <img
                  src={loopWatermark.watermarkUrl}
                  alt="Loops"
                  className="rounded-md object-contain"
                  style={{ width: `${Math.max(40, Math.round(110 * (loopWatermark.size || 1)))}px`, height: `${Math.max(18, Math.round(30 * (loopWatermark.size || 1)))}px` }}
                />
              )}
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 w-1/3 z-10"
          style={{ height: "calc(100% - 100px)" }}
          onClick={goPrev}
          aria-label="Önceki"
        />
        <button
          className="absolute right-0 top-0 w-1/3 z-10"
          style={{ height: "calc(100% - 100px)" }}
          onClick={goNext}
          aria-label="Sonraki"
        />

        {/* Sent emoji animation */}
        {sentEmoji && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-hidden="true">
            <div className="story-reaction-burst relative flex h-36 w-36 items-center justify-center">
              <span className="story-reaction-ring absolute inset-4 rounded-full border border-white/50" />
              <span className="story-reaction-glow absolute h-20 w-20 rounded-full bg-white/20 blur-xl" />
              <span className="story-reaction-spark story-reaction-spark-1 absolute h-2 w-2 rounded-full bg-white" />
              <span className="story-reaction-spark story-reaction-spark-2 absolute h-1.5 w-1.5 rounded-full bg-yellow-200" />
              <span className="story-reaction-spark story-reaction-spark-3 absolute h-2 w-2 rounded-full bg-pink-200" />
              <span className="story-reaction-spark story-reaction-spark-4 absolute h-1.5 w-1.5 rounded-full bg-cyan-200" />
              <span className="story-reaction-emoji relative text-7xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]">{sentEmoji}</span>
            </div>
          </div>
        )}

        {/* ── Bottom bar ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-safe">
          {/* Others' stories: emoji reactions + text reply */}
          {!isOwnStory && (
            <div className="pb-4 px-3">
              <div className="flex gap-2 justify-center mb-2">
                {EMOJI_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReply(emoji, true)}
                    disabled={replySending}
                    className="text-xl hover:scale-125 active:scale-110 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(replyText); } }}
                  placeholder={`@${currentGroup.user.username}'e yanıt ver…`}
                  className="flex-1 bg-transparent text-white placeholder:text-white/50 text-sm focus:outline-none"
                />
                <button
                  onClick={() => sendReply(replyText)}
                  disabled={!replyText.trim() || replySending}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-primary disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Own stories: İzleyenleri Gör (left) + Yanıtları Gör (right) */}
          {isOwnStory && (
            <div className="flex items-center justify-between gap-2 px-3 pb-6 pt-2">
              <button
                onClick={toggleViewers}
                className="flex items-center gap-1 px-2.5 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-white/25 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                İzleyenler
              </button>
              <button
                onClick={toggleReplies}
                className="flex items-center gap-1 px-2.5 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-white/25 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Yanıtlar
              </button>
            </div>
          )}
        </div>

        {/* ── Viewers panel (story owner) — slides from left ── */}
        {isOwnStory && showViewers && (
          <div
            className="absolute left-0 top-0 bottom-0 z-30 flex flex-col"
            style={{ width: "min(280px, 85%)", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)" }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <p className="text-white font-semibold text-sm">İzleyenler</p>
              <button onClick={() => { setShowViewers(false); setPaused(false); }}>
                <X className="w-5 h-5 text-white/70 hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {viewersLoading ? (
                <p className="text-white/50 text-sm text-center py-8">Yükleniyor…</p>
              ) : viewers.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl mb-2">👁</p>
                  <p className="text-white/50 text-sm">Henüz kimse izlemedi</p>
                </div>
              ) : viewers.map((v: any) => (
                <button key={v.id} onClick={() => { onClose(); setLocation(`/profile/${v.id}`); }} className="flex gap-2.5 items-center w-full text-left hover:bg-white/5 rounded-xl px-1 py-1 transition-colors">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                    {v.avatarUrl
                      ? <img src={v.avatarUrl} className="w-full h-full object-cover" alt={v.displayName} />
                      : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{v.displayName?.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{v.displayName}</p>
                    <p className="text-white/50 text-[11px]">@{v.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Pinned replies overlay — yalnızca aktif story için görünür ── */}
        {currentStory && activePinnedReplies.length > 0 && !showReplies && !showViewers && (
          <div className="absolute bottom-20 right-3 z-20 flex flex-col gap-2 items-end pointer-events-none">
            {activePinnedReplies.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-[190px]">
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-white/20">
                  {r.avatar_url
                    ? <img src={r.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold">{r.display_name?.charAt(0)}</span>}
                </div>
                <div className={`flex-1 min-w-0 ${r.is_emoji ? "text-xl" : "text-white text-xs truncate"}`}>
                  {r.content}
                </div>
                <Pin className="w-3 h-3 text-amber-400 flex-shrink-0 fill-amber-400" />
              </div>
            ))}
          </div>
        )}

        {/* ── Replies panel (story owner) — slides from right ── */}
        {isOwnStory && showReplies && (
          <div
            className="absolute right-0 top-0 bottom-0 z-30 flex flex-col"
            style={{ width: "min(280px, 85%)", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)" }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <p className="text-white font-semibold text-sm">Hikaye Yanıtları</p>
              <button onClick={() => { setShowReplies(false); setPaused(false); }}>
                <X className="w-5 h-5 text-white/70 hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {repliesLoading ? (
                <p className="text-white/50 text-sm text-center py-8">Yükleniyor…</p>
              ) : replies.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl mb-2">💌</p>
                  <p className="text-white/50 text-sm">Henüz yanıt yok</p>
                </div>
              ) : replies.map((r: any) => (
                <div key={r.id} className="flex gap-2 items-start">
                  <button onClick={() => { onClose(); setLocation(`/profile/${r.from_user_id}`); }} className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10">
                      {r.avatar_url
                        ? <img src={r.avatar_url} className="w-full h-full object-cover" alt={r.display_name} />
                        : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{r.display_name?.charAt(0)}</span>}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[10px] font-medium mb-0.5">@{r.username}</p>
                    <div className={`inline-block rounded-2xl px-3 py-1.5 ${r.is_emoji ? "bg-transparent text-3xl" : "bg-white/15 text-white text-sm"}`}>
                      {r.content}
                    </div>
                  </div>
                  {/* Öne Çıkart butonu */}
                  <button
                    onClick={() => togglePin(r.id)}
                    className={`flex-shrink-0 mt-1 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                      r.pinned ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white"
                    }`}
                    title={r.pinned ? "Sabitlemeden kaldır" : "Öne çıkart"}
                  >
                    <Pin className={`w-3.5 h-3.5 ${r.pinned ? "fill-amber-300" : ""}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arrow hints on desktop */}
        {groupIdx > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-[-48px] top-1/2 -translate-y-1/2 w-10 h-10 hidden md:flex items-center justify-center text-white bg-white/20 rounded-full hover:bg-white/30 transition-colors z-20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {groupIdx < groups.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-[-48px] top-1/2 -translate-y-1/2 w-10 h-10 hidden md:flex items-center justify-center text-white bg-white/20 rounded-full hover:bg-white/30 transition-colors z-20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
