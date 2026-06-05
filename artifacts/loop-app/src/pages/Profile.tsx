import { useParams } from "wouter";
import { useGetUser, useListPosts, useFollowUser, useUnfollowUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { PostCard } from "@/components/shared/PostCard";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Link as LinkIcon, MapPin } from "lucide-react";

export default function Profile() {
  const params = useParams();
  const { user: me } = useAuth();
  
  const isMe = !params.userId || params.userId === "me" || parseInt(params.userId) === me?.id;
  const targetUserId = isMe ? me?.id : parseInt(params.userId || "0");

  const { data: profile, isLoading: profileLoading } = useGetUser(targetUserId || 0, {
    query: { enabled: !!targetUserId }
  });

  const { data: posts, isLoading: postsLoading } = useListPosts(
    { userId: targetUserId }, 
    { query: { enabled: !!targetUserId } }
  );

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const queryClient = useQueryClient();

  const handleFollowToggle = () => {
    if (!profile) return;
    if (profile.isFollowing) {
      unfollowMutation.mutate({ userId: profile.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profile.id) })
      });
    } else {
      followMutation.mutate({ userId: profile.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profile.id) })
      });
    }
  };

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-6">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-24 h-24 rounded-full bg-card" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-32 bg-card rounded" />
              <div className="h-4 w-24 bg-card rounded" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Kullanıcı bulunamadı</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="pb-20">
        <div className="bg-card border-b border-border">
          <div className="h-32 bg-gradient-to-r from-primary/20 to-accent/50 w-full" />
          
          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <Avatar className="w-24 h-24 border-4 border-card bg-card">
                <AvatarImage src={profile.avatarUrl || ""} />
                <AvatarFallback className="text-3xl">{profile.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              
              {isMe ? (
                <Button variant="outline" className="rounded-full font-semibold">Profili Düzenle</Button>
              ) : (
                <Button 
                  onClick={handleFollowToggle}
                  variant={profile.isFollowing ? "outline" : "default"}
                  className="rounded-full font-semibold px-6"
                >
                  {profile.isFollowing ? "Takibi Bırak" : "Takip Et"}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h1 className="text-xl font-bold">{profile.displayName}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
              
              {profile.bio && (
                <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                <div className="flex gap-1 items-center">
                  <strong className="text-foreground">{profile.followingCount}</strong> Takip Edilen
                </div>
                <div className="flex gap-1 items-center">
                  <strong className="text-foreground">{profile.followerCount}</strong> Takipçi
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <h2 className="font-bold text-lg">Gönderiler</h2>
          {postsLoading ? (
            <div className="text-center p-4">Yükleniyor...</div>
          ) : posts?.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-card rounded-xl border border-border">
              Henüz gönderi yok
            </div>
          ) : (
            posts?.map(post => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>
    </AppLayout>
  );
}
