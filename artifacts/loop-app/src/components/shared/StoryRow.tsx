import { useState } from "react";
import { useListStories, getListStoriesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import { StoryViewer } from "./StoryViewer";
import { UserNameWithDecorations } from "./UserNameWithDecorations";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { markStoryViewed } from "./StoryNavigation";

export function StoryRow() {
  const queryClient = useQueryClient();
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
      await markStoryViewed(queryClient, storyId);
    } catch (error) {
      console.error("Hikaye görüntüleme durumu kaydedilemedi", error);
    }
  };


  return (
    <>
      <div className="flex items-stretch gap-2 overflow-x-auto px-3 py-3 hide-scrollbar">

        {/* ── Hikaye Ekle card ── */}
        <Link href="/create?type=story" className="flex flex-col items-center flex-shrink-0 group">
          <div
            className="w-[82px] h-[144px] overflow-hidden relative"
            style={{ borderRadius: "18px", border: "1.5px solid hsl(var(--primary) / 0.35)" }}
          >
            {/* Bulanık avatar arka plan */}
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "blur(6px) brightness(0.45)", transform: "scale(1.1)" }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.4) 0%, hsl(260 60% 35%/0.7) 100%)" }}
              />
            )}

            {/* Alt gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            {/* Ortada + çemberi */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ marginBottom: 22 }}>
              <div
                className="w-11 h-11 flex items-center justify-center bg-primary shadow-lg"
                style={{ borderRadius: "50%" }}
              >
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>

            {/* Alt: Loopla çağrısı */}
            <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center">
              <span className="text-white text-[11px] font-bold drop-shadow-sm leading-tight">Loopla</span>
              <span className="mt-0.5 text-white/75 text-[8px] font-light leading-tight">yeni bir an paylaş</span>
            </div>
          </div>
          {/* Alt ince çizgi */}
          <div className="mt-1.5 w-10 h-[2px] bg-primary rounded-full" />
        </Link>

        {/* ── Hikaye kartları ── */}
        {!isLoading && userStories?.map((us, idx) => {
          const isOwnStory = us.user.id === user?.id;
          const latestStory = us.stories?.[0];
          const timeAgo = latestStory
            ? formatDistanceToNow(new Date(latestStory.createdAt), { locale: tr, addSuffix: false })
                .replace("yaklaşık ", "").replace(" dakika", "d").replace(" saat", "s")
                .replace(" gün", "g").replace(" ay", "ay")
            : "";

          return (
            <button
              key={us.user.id}
              onClick={() => handleStoryClick(idx)}
              aria-label={`${us.user.displayName} hikayesini aç`}
              className={`${us.hasUnviewed ? "story-card-premium-ring" : "story-viewed-card"} ${!isOwnStory && us.hasUnviewed ? "story-midnight-orbit" : ""} group flex flex-col items-center flex-shrink-0 rounded-[20px] p-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
            >
              <div
                className="story-card-premium-content relative h-[144px] w-[82px] overflow-hidden rounded-[18px] bg-[#050817] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
              >
                {/* Arka plan */}
                {us.user.storyPreviewUrl ? (
                  <img src={us.user.storyPreviewUrl} alt={`${us.user.username} hikaye ön izleme kapağı`} className="w-full h-full object-cover" />
                ) : latestStory?.mediaUrl ? (
                  latestStory.mediaType === "video" ? (
                    <video src={latestStory.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={latestStory.mediaUrl} alt={us.user.username} className="w-full h-full object-cover" />
                  )
                ) : us.user.avatarUrl ? (
                  <img src={us.user.avatarUrl} alt={us.user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/40 to-violet-600/60" />
                )}

                {/* Alt gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                {us.hasUnviewed && <div className="story-card-sheen absolute inset-0 pointer-events-none" />}

                {/* Sol alt: avatar + isim */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <div
                    className={`w-6 h-6 overflow-hidden border-2 mb-0.5 ${us.hasUnviewed ? "story-highlight-avatar-ring" : "border-white/60"}`}
                    style={{ borderRadius: "50%" }}
                  >
                    <Avatar className="w-full h-full">
                      <AvatarImage src={us.user.avatarUrl || ""} />
                      <AvatarFallback className="text-[9px] bg-primary/30">{us.user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <UserNameWithDecorations user={us.user} fallback="Kullanıcı" showLabel className="max-w-full text-white text-[10px] font-semibold leading-tight truncate [&>img]:h-3 [&>img]:w-3" />
                  {timeAgo && <p className="text-white/70 text-[9px] leading-tight">{timeAgo}</p>}
                </div>
              </div>
            </button>
          );
        })}

        {isLoading && Array(4).fill(0).map((_, i) => (
          <div key={i} className="w-[82px] h-[144px] bg-muted animate-pulse flex-shrink-0" style={{ borderRadius: "18px" }} />
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
