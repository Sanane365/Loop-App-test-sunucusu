import { useState } from "react";
import { useListStories, getListStoriesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import { StoryViewer } from "./StoryViewer";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

export function StoryRow() {
  const { data: userStories, isLoading } = useListStories({ query: { queryKey: getListStoriesQueryKey() } });
  const { user } = useAuth();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);

  const handleStoryClick = (index: number) => {
    setViewerGroupIdx(index);
    setViewerOpen(true);
  };

  const handleStoryView = async (storyId: number) => {
    try {
      await fetch(`/api/stories/${storyId}/view`, { method: "POST" });
    } catch {}
  };

  return (
    <>
      <div className="flex items-stretch gap-2 overflow-x-auto px-3 py-3 hide-scrollbar">
        {/* Hikaye Ekle card */}
        <Link
          href="/create?type=story"
          className="flex flex-col items-center flex-shrink-0 group"
        >
          <div className="w-[76px] h-[140px] rounded-2xl bg-white dark:bg-muted/80 border border-primary/20 flex items-center justify-center relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-full border-[2.5px] border-dashed border-primary flex items-center justify-center bg-primary/5 relative z-10">
              <Plus className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="mt-1.5 text-center">
            <span className="text-[11px] font-semibold text-foreground leading-tight block">Hikaye Ekle</span>
            <div className="h-[2px] bg-primary rounded-full mt-0.5 mx-1" />
          </div>
        </Link>

        {/* Story cards */}
        {!isLoading && userStories?.map((us, idx) => {
          const latestStory = us.stories?.[0];
          const timeAgo = latestStory
            ? formatDistanceToNow(new Date(latestStory.createdAt), { locale: tr, addSuffix: false })
                .replace("yaklaşık ", "")
                .replace(" dakika", "d")
                .replace(" saat", "s")
                .replace(" gün", "g")
                .replace(" ay", "ay")
            : "";

          return (
            <button
              key={us.user.id}
              onClick={() => handleStoryClick(idx)}
              className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
            >
              <div className="w-[76px] h-[140px] rounded-2xl overflow-hidden relative shadow-sm" style={{ border: us.hasUnviewed ? '2px solid hsl(var(--primary))' : '2px solid transparent' }}>
                {/* Background image - story media or avatar */}
                {latestStory?.mediaUrl ? (
                  latestStory.mediaType === "video" ? (
                    <video
                      src={latestStory.mediaUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={latestStory.mediaUrl}
                      alt={us.user.username}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/40 to-violet-600/60 flex items-center justify-center">
                    {us.user.avatarUrl ? (
                      <img src={us.user.avatarUrl} alt={us.user.username} className="w-full h-full object-cover" />
                    ) : (
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="text-lg bg-primary/20">{us.user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                {/* Gradient overlay at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                {/* Progress bar at top */}
                {us.hasUnviewed && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 h-[2.5px] bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-primary rounded-full" />
                  </div>
                )}

                {/* User info at bottom */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <div className={`w-7 h-7 rounded-full overflow-hidden border-2 mb-0.5 mx-auto ${us.hasUnviewed ? 'border-primary' : 'border-white/60'}`}>
                    <Avatar className="w-full h-full">
                      <AvatarImage src={us.user.avatarUrl || ""} />
                      <AvatarFallback className="text-[9px] bg-primary/30">{us.user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <p className="text-white text-[10px] font-semibold leading-tight truncate text-center">{us.user.username}</p>
                  {timeAgo && <p className="text-white/70 text-[9px] leading-tight text-center">{timeAgo}</p>}
                </div>
              </div>
            </button>
          );
        })}

        {isLoading && Array(4).fill(0).map((_, i) => (
          <div key={i} className="w-[76px] h-[140px] rounded-2xl bg-muted animate-pulse flex-shrink-0" />
        ))}
      </div>

      {viewerOpen && userStories && userStories.length > 0 && (
        <StoryViewer
          groups={userStories as any}
          startGroupIndex={viewerGroupIdx}
          onClose={() => setViewerOpen(false)}
          onView={handleStoryView}
        />
      )}
    </>
  );
}
