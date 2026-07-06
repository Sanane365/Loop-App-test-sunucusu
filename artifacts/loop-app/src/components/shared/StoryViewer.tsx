import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface Story {
  id: number;
  mediaUrl: string;
  mediaType: string;
  createdAt: string;
  user: { id: number; displayName: string; username: string; avatarUrl?: string | null };
}

interface StoryGroup {
  user: { id: number; displayName: string; username: string; avatarUrl?: string | null };
  stories: Story[];
}

interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  onView?: (storyId: number) => void;
}

const STORY_DURATION = 5000;

export function StoryViewer({ groups, startGroupIndex, onClose, onView }: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [storyIdx, groupIdx]);

  useEffect(() => {
    if (!currentStory) return;
    if (onView) onView(currentStory.id);

    setProgress(0);
    startTimeRef.current = Date.now();

    if (progressRef.current) clearInterval(progressRef.current);

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(progressRef.current!);
        goNext();
      }
    }, 50);

    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [groupIdx, storyIdx]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
      <div
        className="relative w-full max-w-sm h-full max-h-[100dvh] md:max-h-[90vh] md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* User header */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2">
          <Avatar className="w-9 h-9 border-2 border-white/70">
            <AvatarImage src={currentGroup.user.avatarUrl || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {currentGroup.user.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm drop-shadow">{currentGroup.user.displayName}</p>
            <p className="text-white/70 text-xs drop-shadow">
              {formatDistanceToNow(new Date(currentStory.createdAt), { locale: tr, addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media */}
        <div className="w-full h-full bg-black flex items-center justify-center">
          {currentStory.mediaType === "video" ? (
            <video
              key={currentStory.id}
              src={currentStory.mediaUrl}
              autoPlay
              muted={false}
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              key={currentStory.id}
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 w-1/3 h-full z-10"
          onClick={goPrev}
          aria-label="Önceki"
        />
        <button
          className="absolute right-0 top-0 w-1/3 h-full z-10"
          onClick={goNext}
          aria-label="Sonraki"
        />

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
