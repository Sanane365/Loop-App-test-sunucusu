import { useState } from "react";
import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StoryRow } from "@/components/shared/StoryRow";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, TrendingUp, MapPin, Leaf, Sparkles, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

type FeedType = "akis" | "takipte";
type FilterType = "trend" | "yakin" | "yeni" | "sana-ozel";

const filters: { id: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "trend", label: "Trend", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-primary" },
  { id: "yakin", label: "Yakın", icon: <MapPin className="w-3.5 h-3.5" />, color: "text-orange-500" },
  { id: "yeni", label: "Yeni", icon: <Leaf className="w-3.5 h-3.5" />, color: "text-green-500" },
  { id: "sana-ozel", label: "Sana Özel", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-blue-500" },
];

export default function Home() {
  const [feedType, setFeedType] = useState<FeedType>("akis");
  const [activeFilter, setActiveFilter] = useState<FilterType>("trend");
  const { user } = useAuth();

  const { data: posts, isLoading } = useListPosts(undefined, {
    query: { queryKey: getListPostsQueryKey() }
  });

  return (
    <div className="min-h-screen bg-secondary/50 pb-16">
      <Header feedType={feedType} onFeedChange={setFeedType} />
      <main className="max-w-screen-md mx-auto min-h-[calc(100vh-3.5rem-4rem)]">
        <div className="pb-4">

          {/* Post creation bar */}
          <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            <Link href="/profile/me" className="flex-shrink-0">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user?.displayName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Link href="/create" className="flex-1">
              <div className="bg-muted/60 rounded-full px-4 py-2.5 text-sm text-muted-foreground">
                Neler paylaşmak istersin?
              </div>
            </Link>
            <Link href="/create">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
            </Link>
          </div>

          {/* Stories row */}
          <div className="bg-background border-b border-border">
            <StoryRow />
          </div>

          {/* Filter tabs */}
          <div className="bg-background border-b border-border px-4 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {filters.map(f => (
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

          {/* Posts feed */}
          <div className="pt-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="mx-4 mb-4 h-80 bg-card animate-pulse rounded-2xl border border-border" />
              ))
            ) : posts?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="font-medium">Henüz gönderi yok</p>
                <p className="text-sm mt-1">İlk gönderiyi paylaş!</p>
              </div>
            ) : (
              posts?.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
