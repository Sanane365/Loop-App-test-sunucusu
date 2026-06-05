import { useState } from "react";
import { useListUsers, useGetTrending, useGetSuggestedUsers, getListUsersQueryKey, getGetTrendingQueryKey, getGetSuggestedUsersQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Use debounced search query in a real app, but for now just pass it directly if > 2 chars
  const { data: users, isLoading: loadingUsers } = useListUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 2, queryKey: getListUsersQueryKey({ q: searchQuery }) } }
  );

  const { data: trending, isLoading: loadingTrending } = useGetTrending({ query: { queryKey: getGetTrendingQueryKey() } });
  const { data: suggested, isLoading: loadingSuggested } = useGetSuggestedUsers({ query: { queryKey: getGetSuggestedUsersQueryKey() } });

  return (
    <AppLayout>
      <div className="p-4 space-y-6 pb-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Kişileri veya etiketleri ara..." 
            className="pl-10 rounded-full bg-card border-border h-12 text-base"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-explore-search"
          />
        </div>

        {searchQuery.length > 2 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold px-1">Arama Sonuçları</h2>
            {loadingUsers ? (
              <div className="text-center p-4">Aranıyor...</div>
            ) : users?.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground">Sonuç bulunamadı</div>
            ) : (
              <div className="space-y-3">
                {users?.map(user => (
                  <Link key={user.id} href={`/profile/${user.id}`} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatarUrl || ""} />
                      <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{user.displayName}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <h2 className="text-lg font-bold px-1">Önerilen Kişiler</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                {loadingSuggested ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="w-32 h-40 bg-card rounded-xl animate-pulse flex-shrink-0" />)
                ) : (
                  suggested?.map(user => (
                    <div key={user.id} className="w-32 flex-shrink-0 bg-card p-4 rounded-xl border border-border flex flex-col items-center gap-2 text-center">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={user.avatarUrl || ""} />
                        <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm truncate w-24">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate w-24">@{user.username}</p>
                      </div>
                      <Button variant="secondary" size="sm" className="w-full rounded-full h-8 mt-1 text-xs font-semibold">
                        Takip Et
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold px-1">Trend Gönderiler</h2>
              <div className="space-y-4">
                {loadingTrending ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-64 bg-card rounded-xl animate-pulse" />)
                ) : (
                  trending?.map(post => <PostCard key={post.id} post={post} />)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
