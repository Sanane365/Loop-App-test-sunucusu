import { useState } from "react";
import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StoryRow } from "@/components/shared/StoryRow";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, TrendingUp, MapPin, Leaf, Sparkles, SlidersHorizontal, Pencil, BarChart2, AlignLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type FilterType = "trend" | "takipte" | "yeni" | "bulten" | "sana-ozel";

const filters: { id: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "trend", label: "Trend", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-primary" },
  { id: "takipte", label: "Takipte", icon: <MapPin className="w-3.5 h-3.5" />, color: "text-orange-500" },
  { id: "yeni", label: "Yeni", icon: <Leaf className="w-3.5 h-3.5" />, color: "text-green-500" },
  { id: "bulten", label: "Bülten", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-purple-500" },
  { id: "sana-ozel", label: "Sana Özel", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-blue-500" },
];

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("trend");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const { data: allPosts, isLoading } = useListPosts(undefined, {
    query: { queryKey: getListPostsQueryKey() }
  });

  const { data: bulletinPosts, isLoading: bulletinLoading } = useListPosts(
    { postType: "bulletin" },
    { query: { queryKey: getListPostsQueryKey({ postType: "bulletin" }), enabled: activeFilter === "bulten" } }
  );

  const posts = activeFilter === "bulten" ? bulletinPosts : allPosts;
  const loading = activeFilter === "bulten" ? bulletinLoading : isLoading;

  return (
    <div className="min-h-screen bg-secondary/50 pb-16">
      <Header />
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
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="mx-4 mb-4 h-80 bg-card animate-pulse rounded-2xl border border-border" />
              ))
            ) : posts?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="font-medium">Henüz gönderi yok</p>
                {activeFilter === "bulten" && (
                  <p className="text-sm mt-1">İlk bülten gönderisini paylaş!</p>
                )}
              </div>
            ) : (
              posts?.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Bülten FAB */}
      {activeFilter === "bulten" && (
        <button
          onClick={() => setLocation("/create?type=bulletin")}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-purple-600 text-white shadow-xl flex items-center justify-center z-40 hover:bg-purple-700 transition-colors active:scale-95"
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
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Bülten</p>
                  <p className="text-xs text-muted-foreground">Twitter tarzı kısa metin & fotoğraf</p>
                </div>
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

      <BottomNav />
    </div>
  );
}
