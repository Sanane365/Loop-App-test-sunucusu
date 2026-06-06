import { useParams } from "wouter";
import { useGetUser, useListPosts, useFollowUser, useUnfollowUser, getGetUserQueryKey, getGetMeQueryKey, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { PostCard } from "@/components/shared/PostCard";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Pencil, MessageCircle, Shield } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Profile() {
  const params = useParams();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const isMe = !params.userId || params.userId === "me" || parseInt(params.userId) === me?.id;
  const targetUserId = isMe ? me?.id : parseInt(params.userId || "0");

  const { data: profile, isLoading: profileLoading } = useGetUser(targetUserId || 0, {
    query: { queryKey: getGetUserQueryKey(targetUserId || 0), enabled: !!targetUserId }
  });

  const { data: posts, isLoading: postsLoading } = useListPosts(
    { userId: targetUserId },
    { query: { queryKey: getListPostsQueryKey({ userId: targetUserId }), enabled: !!targetUserId } }
  );

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const openEdit = () => {
    setEditName(profile?.displayName ?? "");
    setEditBio(profile?.bio ?? "");
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName, bio: editBio }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setEditOpen(false);
      toast({ title: "Profil güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Profil güncellenemedi.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profil fotoğrafı güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Fotoğraf yüklenemedi.", variant: "destructive" });
    }
  };

  const handleBannerUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/users/me/banner", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      toast({ title: "Kapak fotoğrafı güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Kapak fotoğrafı yüklenemedi.", variant: "destructive" });
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

  const bannerUrl = (profile as any).bannerUrl as string | null | undefined;

  return (
    <AppLayout>
      <div className="pb-20">
        <div className="bg-card border-b border-border">
          <div className="relative h-36 w-full overflow-hidden">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Kapak" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/20 to-accent/50" />
            )}
            {isMe && (
              <>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }}
                />
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs font-medium bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-background transition-colors shadow-sm"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Kapak
                </button>
              </>
            )}
          </div>

          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-card bg-card">
                  <AvatarImage src={profile.avatarUrl || ""} />
                  <AvatarFallback className="text-3xl">{profile.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                {isMe && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-card shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                    </button>
                  </>
                )}
              </div>

              {isMe ? (
                <Button variant="outline" className="rounded-full font-semibold gap-1.5" onClick={openEdit}>
                  <Pencil className="w-3.5 h-3.5" />
                  Profili Düzenle
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleFollowToggle}
                    variant={profile.isFollowing ? "outline" : "default"}
                    className="rounded-full font-semibold px-5"
                  >
                    {profile.isFollowing ? "Takibi Bırak" : "Takip Et"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setLocation(`/dm/${profile.id}`)}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Profili Düzenle</DialogTitle>
            <DialogDescription>Ad, biyografi ve fotoğraflarını güncelle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Görünen Ad</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Adın"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Biyografi</label>
              <Textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Kendinden bahset..."
                className="resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{editBio.length}/200</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={saving}>
                İptal
              </Button>
              <Button className="flex-1" onClick={handleSaveProfile} disabled={saving || !editName.trim()}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
