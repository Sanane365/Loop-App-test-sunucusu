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
    try { await fetch(`/api/stories/${storyId}/view`, { method: "POST" }); } catch {}
  };

  return (
    <>
      <div className="flex items-stretch gap-2 overflow-x-auto px-3 py-3 hide-scrollbar">

        {/* ── Hikaye Ekle card ── */}
        <Link href="/create?type=story" className="flex flex-col items-center flex-shrink-0 group">
          <div
            className="w-[82px] h-[144px] overflow-hidden relative"
            style={{ borderRadius: "18px", background: "hsl(var(--background))", border: "1.5px solid hsl(var(--primary) / 0.25)" }}
          >
            {/* + işareti ortada */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ borderRadius: "50%", border: "2px dashed hsl(var(--primary))", background: "hsl(var(--primary) / 0.07)" }}
              >
                <Plus className="w-5 h-5 text-primary" />
              </div>
            </div>

            {/* Profil avatarı — sol alt */}
            {user && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                <div
                  className="w-6 h-6 overflow-hidden border-2 flex-shrink-0"
                  style={{ borderRadius: "50%", borderColor: "hsl(var(--primary))" }}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/20 text-[9px] font-bold text-primary">
                      {user.displayName?.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-1.5 text-center">
            <span className="text-[11px] font-semibold text-foreground leading-tight block">Hikaye Ekle</span>
            <div className="h-[2px] bg-primary rounded-full mt-0.5 mx-1" />
          </div>
        </Link>

        {/* ── Hikaye kartları ── */}
        {!isLoading && userStories?.map((us, idx) => {
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
              className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
            >
              <div
                className="w-[82px] h-[144px] overflow-hidden relative"
                style={{
                  borderRadius: "18px",
                  border: us.hasUnviewed
                    ? "2.5px solid hsl(var(--primary))"
                    : "1.5px solid hsl(var(--border))",
                }}
              >
                {/* Arka plan */}
                {latestStory?.mediaUrl ? (
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

                {/* Üst progress bar */}
                {us.hasUnviewed && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 h-[2.5px] bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-primary rounded-full" />
                  </div>
                )}

                {/* Sol alt: avatar + isim */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <div
                    className={`w-6 h-6 overflow-hidden border-2 mb-0.5 ${us.hasUnviewed ? "border-primary" : "border-white/60"}`}
                    style={{ borderRadius: "50%" }}
                  >
                    <Avatar className="w-full h-full">
                      <AvatarImage src={us.user.avatarUrl || ""} />
                      <AvatarFallback className="text-[9px] bg-primary/30">{us.user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <p className="text-white text-[10px] font-semibold leading-tight truncate">{us.user.username}</p>
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
