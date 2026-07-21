import { useState } from "react";
import {
  useListUsers,
  useGetTrending,
  useGetSuggestedUsers,
  useFollowUser,
  useUnfollowUser,
  getListUsersQueryKey,
  getGetTrendingQueryKey,
  getGetSuggestedUsersQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Flame, Heart, TrendingUp, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

type CategoryId = "gundem" | "begeni" | "yukselenler";

const categories: { id: CategoryId; label: string; icon: React.ReactNode; title: string; desc: string }[] = [
  {
    id: "gundem",
    label: "Gündemdeki Gönderiler",
    icon: <Flame className="w-4 h-4" />,
    title: "Gündemdeki Gönderiler",
    desc: "Soldaki kategoriye tıkla, sağda alt alta sıralanan keşif kartlarını görüntüle.",
  },
  {
    id: "begeni",
    label: "En Beğenilenler",
    icon: <Heart className="w-4 h-4" />,
    title: "En Beğenilenler",
    desc: "En çok beğeni alan gönderiler burada listeleniyor.",
  },
  {
    id: "yukselenler",
    label: "Yeni Yükselenler",
    icon: <TrendingUp className="w-4 h-4" />,
    title: "Yeni Yükselenler",
    desc: "Son 24 saatte hızla yükselen içerikler.",
  },
];

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("gundem");
  const queryClient = useQueryClient();

  const { data: users, isLoading: loadingUsers } = useListUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 1, queryKey: getListUsersQueryKey({ q: searchQuery }) } }
  );

  const { data: trending, isLoading: loadingTrending } = useGetTrending({
    query: { queryKey: getGetTrendingQueryKey() },
  });

  const { data: suggested } = useGetSuggestedUsers({
    query: { queryKey: getGetSuggestedUsersQueryKey() },
  });

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  const handleFollow = (userId: number, isFollowing: boolean) => {
    if (isFollowing || followingIds.has(userId)) {
      unfollowMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    } else {
      followMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds(prev => new Set(prev).add(userId));
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    }
  };

  const activeCat = categories.find(c => c.id === activeCategory)!;

  // Sort trending posts based on category
  const sortedPosts = trending ? [...trending].sort((a, b) => {
    if (activeCategory === "begeni") return b.likeCount - a.likeCount;
    if (activeCategory === "yukselenler") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return b.likeCount + b.commentCount - (a.likeCount + a.commentCount);
  }) : [];

  return (
    <AppLayout>
      <div className="pb-20">
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 bg-background sticky top-14 z-30 border-b border-border">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Gönderi, kullanıcı veya etiket ara..."
              className="w-full pl-12 pr-4 py-3 rounded-full bg-muted/70 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-explore-search"
            />
          </div>
        </div>

        {searchQuery.length > 1 ? (
          /* Search results */
          <div className="px-4 pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Arama Sonuçları
            </p>
            {loadingUsers ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-2xl border border-border animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))
            ) : users?.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
                <Search className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">"{searchQuery}" için sonuç bulunamadı</p>
              </div>
            ) : (
              users?.map(user => (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors"
                >
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <button
                    onClick={e => { e.preventDefault(); handleFollow(user.id, followingIds.has(user.id)); }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      followingIds.has(user.id)
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {followingIds.has(user.id) ? (
                      <><UserCheck className="w-3.5 h-3.5" /> Takiptesin</>
                    ) : (
                      <><UserPlus className="w-3.5 h-3.5" /> Takip Et</>
                    )}
                  </button>
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Category pills */}
            <div className="flex gap-2.5 overflow-x-auto px-4 py-3 hide-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold flex-shrink-0 transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-foreground/10 dark:bg-foreground/10 text-foreground hover:bg-foreground/15"
                  }`}
                  style={activeCategory !== cat.id ? {
                    backgroundColor: "hsl(var(--foreground) / 0.1)"
                  } : {}}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Main dark card */}
            <div className="mx-4 mt-2 rounded-3xl bg-[#12121a] dark:bg-[#12121a] overflow-hidden" style={{ background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
              <div className="p-6 pb-4">
                {/* Label */}
                <p className="text-xs font-bold tracking-[0.2em] text-white/40 uppercase mb-2">K E Ş F E T</p>
                {/* Title */}
                <h1 className="text-3xl font-bold text-white leading-tight mb-4">{activeCat.title}</h1>
                {/* Pill */}
                <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-white/70 text-sm mb-3">
                  Kategoriye göre filtrelenmiş içerikler
                </div>
                {/* Description */}
                <p className="text-white/50 text-sm leading-relaxed">{activeCat.desc}</p>
              </div>

              {/* Ranked list */}
              <div className="px-4 pb-6 space-y-3">
                {loadingTrending ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                      <div className="flex-1 h-4 bg-white/10 rounded" />
                    </div>
                  ))
                ) : sortedPosts.length === 0 ? (
                  <div className="text-center py-10 text-white/40">
                    Henüz içerik yok
                  </div>
                ) : (
                  sortedPosts.map((post, idx) => (
                    <Link
                      key={post.id}
                      href={`/profile/${post.userId}`}
                      className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors"
                    >
                      {/* Rank badge */}
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-white/70 text-sm font-bold">#{idx + 1}</span>
                      </div>

                      {/* Avatar */}
                      <Avatar className="w-11 h-11 flex-shrink-0 border border-white/20">
                        <AvatarImage src={post.user?.avatarUrl || ""} />
                        <AvatarFallback className="bg-primary/30 text-white font-bold">
                          {post.user?.displayName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{post.user?.displayName}</p>
                        {post.content && (
                          <p className="text-white/40 text-xs truncate mt-0.5">{post.content}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 flex-shrink-0 text-white/60 text-sm">
                        <span className="flex items-center gap-1">
                          {post.likeCount}
                          <Heart className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex items-center gap-1">
                          {post.commentCount}
                          <MessageCircle className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Suggested users */}
            {suggested && suggested.length > 0 && (
              <div className="px-4 mt-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Tanıyabileceğin Kişiler
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {suggested.map(user => {
                    const isFollowed = followingIds.has(user.id) || (user as any).isFollowing;
                    return (
                      <div
                        key={user.id}
                        className="w-36 flex-shrink-0 bg-card border border-border rounded-2xl flex flex-col items-center gap-3 p-4 text-center"
                      >
                        <Link href={`/profile/${user.id}`}>
                          <Avatar className="w-14 h-14 cursor-pointer">
                            <AvatarImage src={user.avatarUrl || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                              {user.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="w-full min-w-0">
                          <p className="font-semibold text-sm truncate">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        </div>
                        <button
                          onClick={() => handleFollow(user.id, !!isFollowed)}
                          className={`w-full py-1.5 rounded-full text-xs font-semibold transition-all ${
                            isFollowed
                              ? "border border-border text-muted-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                          disabled={followMutation.isPending || unfollowMutation.isPending}
                        >
                          {isFollowed ? "Takiptesin" : "Takip Et"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
