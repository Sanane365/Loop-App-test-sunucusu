import { useListStories, getListStoriesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { Link } from "wouter";

export function StoryRow() {
  const { data: userStories, isLoading } = useListStories({ query: { queryKey: getListStoriesQueryKey() } });

  return (
    <div className="flex items-center gap-4 overflow-x-auto p-4 hide-scrollbar border-b border-border bg-card/50">
      <Link href="/create?type=story" className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted flex items-center justify-center bg-card relative">
          <Avatar className="w-14 h-14">
            <AvatarFallback><Plus className="w-6 h-6 text-muted-foreground" /></AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background">
            <Plus className="w-3 h-3" />
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-medium">Hikaye Ekle</span>
      </Link>

      {!isLoading && userStories?.map((us) => (
        <button key={us.user.id} className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`p-0.5 rounded-full ${us.hasUnviewed ? 'bg-gradient-to-tr from-primary to-accent' : 'bg-muted'}`}>
            <Avatar className="w-14 h-14 border-2 border-background">
              <AvatarImage src={us.user.avatarUrl || ""} />
              <AvatarFallback>{us.user.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs text-foreground font-medium w-16 truncate text-center">{us.user.username}</span>
        </button>
      ))}
    </div>
  );
}
