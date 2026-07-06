import { useState } from "react";
import { useListUsers, useGetTrending, useGetSuggestedUsers, useFollowUser, useUnfollowUser, getListUsersQueryKey, getGetTrendingQueryKey, getGetSuggestedUsersQueryKey, getGetSuggestedUsersUrl } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Search, UserCheck, UserPlus } from "lucide-react";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: users, isLoading: loadingUsers } = useListUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 1, queryKey: getListUsersQueryKey({ q: searchQuery }) } }
  );

  const { data: trending, isLoading: loadingTrending } = useGetTrending({ query: { queryKey: getGetTrendingQueryKey() } });
  const { data: suggested, isLoading: loadingSuggested } = useGetSuggestedUsers({ query: { queryKey: getGetSuggestedUsersQueryKey() } });

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  const handleFollow = (userId: number, isFollowing: boolean) => {
    if (isFollowing || followingIds.has(userId)) {
      unfollowMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    } else {
      followMutation.mutate({ userId }, {
        onSuccess: () => {
          setFollowingIds((prev) => new Set(prev).add(userId));
          queryClient.invalidateQueries({ queryKey: getGetSuggestedUsersQueryKey() });
        },
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 pb-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            placeholder="Kişileri ara..."
            className="pl-10 rounded-full bg-card border-border h-12 text-base"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-explore-search"
          />
        </div>

        {searchQuery.length > 1 ? (
          <div className="space-y-3">
            <h2 className="text-base font-bold px-1 text-muted-foreground uppercase tracking-wider text-xs">
              Arama Sonuçları
            </h2>
            {loadingUsers ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
              ))
            ) : users?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card rounded-2xl border border-border">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>"{searchQuery}" için sonuç bulunamadı</p>
              </div>
            ) : (
              users?.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={user.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground">
                    {(user as any).followerCount ?? 0} takipçi
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <h2 className="text-xs font-bold px-1 text-muted-foreground uppercase tracking-wider">
                Seni Tanıyabilecekler
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {loadingSuggested ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="w-36 h-48 bg-card rounded-2xl animate-pulse flex-shrink-0 border border-border" />
                  ))
                ) : suggested?.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">Öneri bulunamadı</p>
                ) : (
                  suggested?.map((user) => {
                    const isFollowed = followingIds.has(user.id) || (user as any).isFollowing;
                    return (
                      <div
                        key={user.id}
                        className="w-36 flex-shrink-0 bg-card border border-border rounded-2xl flex flex-col items-center gap-3 p-4 text-center hover:border-primary/30 transition-colors"
                      >
                        <Link href={`/profile/${user.id}`}>
                          <Avatar className="w-16 h-16 cursor-pointer">
                            <AvatarImage src={user.avatarUrl || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                              {user.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="w-full min-w-0">
                          <p className="font-semibold text-sm truncate">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(user as any).followerCount ?? 0} takipçi
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isFollowed ? "outline" : "default"}
                          className="w-full rounded-full h-8 text-xs font-semibold gap-1"
                          onClick={() => handleFollow(user.id, !!isFollowed)}
                          disabled={followMutation.isPending || unfollowMutation.isPending}
                        >
                          {isFollowed ? (
                            <><UserCheck className="w-3 h-3" /> Takiptesin</>
                          ) : (
                            <><UserPlus className="w-3 h-3" /> Takip Et</>
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold px-1 text-muted-foreground uppercase tracking-wider">
                Trend Gönderiler
              </h2>
              <div className="space-y-4">
                {loadingTrending ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-40 bg-card rounded-xl animate-pulse border border-border" />
                  ))
                ) : trending?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-card rounded-2xl border border-border">
                    Henüz trend gönderi yok
                  </div>
                ) : (
                  trending?.map((post) => <PostCard key={post.id} post={post} />)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
