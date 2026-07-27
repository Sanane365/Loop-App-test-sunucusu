import { useParams } from "wouter";
import {
  useGetUser, useListPosts, useFollowUser, useUnfollowUser,
  getGetUserQueryKey, getGetMeQueryKey, getListPostsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus, Pencil, MessageCircle, Plus, MapPin, Calendar,
  CheckCircle2, BadgeCheck, Music2, Heart, Play, ChevronDown,
  LayoutGrid, Clapperboard, Send,
} from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Tab = "posts" | "reels" | "liked";

// Decorative story highlights
const HIGHLIGHTS = [
  { label: "geceler", gradient: "from-violet-900 to-purple-600" },
  { label: "müzik", gradient: "from-purple-700 to-fuchsia-500" },
  { label: "ben", gradient: "from-indigo-800 to-violet-600" },
  { label: "favorilerim", gradient: "from-violet-600 to-pink-500" },
  { label: "anılar", gradient: "from-purple-900 to-indigo-700" },
];

const HIGHLIGHT_ICONS = ["🌙", "🎵", "🪞", "💜", "✨"];

export default function Profile() {
  const params = useParams();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  const isMe = !params.userId || params.userId === "me" || parseInt(params.userId) === me?.id;
  const targetUserId = isMe ? me?.id : parseInt(params.userId || "0");

  const { data: profile, isLoading: profileLoading } = useGetUser(targetUserId || 0, {
    query: { queryKey: getGetUserQueryKey(targetUserId || 0), enabled: !!targetUserId },
  });

  const { data: posts, isLoading: postsLoading } = useListPosts(
    { userId: targetUserId },
    { query: { queryKey: getListPostsQueryKey({ userId: targetUserId }), enabled: !!targetUserId && activeTab === "posts" } }
  );

  const [mediaPosts, setMediaPosts] = useState<any[] | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<any[] | null>(null);
  const [likedLoading, setLikedLoading] = useState(false);

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "reels" && mediaPosts === null && !mediaLoading) {
      setMediaLoading(true);
      try {
        const r = await fetch(`/api/posts?userId=${targetUserId}&mediaOnly=true`);
        setMediaPosts(await r.json());
      } catch { setMediaPosts([]); }
      finally { setMediaLoading(false); }
    }
    if (tab === "liked" && likedPosts === null && !likedLoading && isMe) {
      setLikedLoading(true);
      try {
        const r = await fetch("/api/posts?liked=true");
        setLikedPosts(await r.json());
      } catch { setLikedPosts([]); }
      finally { setLikedLoading(false); }
    }
  };

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
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profile.id) }),
      });
    } else {
      followMutation.mutate({ userId: profile.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profile.id) }),
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
    } finally { setSaving(false); }
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
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-44 bg-muted rounded-3xl" />
          <div className="flex gap-4 -mt-10 pl-2">
            <div className="w-28 h-28 rounded-full bg-muted border-4 border-background" />
            <div className="pt-12 space-y-2 flex-1">
              <div className="h-5 w-28 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          </div>
          <div className="h-24 bg-muted rounded-2xl" />
          <div className="h-16 bg-muted rounded-2xl" />
          <div className="h-14 bg-muted rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Kullanıcı bulunamadı</div></AppLayout>;
  }

  const bannerUrl = (profile as any).bannerUrl as string | null | undefined;
  const postCount = (profile as any).postCount ?? 0;

  const currentPosts = activeTab === "posts" ? posts : activeTab === "reels" ? mediaPosts : likedPosts;
  const currentLoading = activeTab === "posts" ? postsLoading : activeTab === "reels" ? mediaLoading : likedLoading;

  return (
    <AppLayout>
      <div className="pb-24 bg-background">

        {/* ── Banner ── */}
        <div className="px-4 pt-4">
          <div className="relative h-44 w-full rounded-3xl overflow-hidden">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Kapak" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-900 via-purple-600 to-fuchsia-400" />
            )}
            {/* Subtle vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
            {isMe && (
              <>
                <input ref={bannerInputRef} type="file" accept="image/*,video/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }} />
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs font-semibold bg-black/40 backdrop-blur-sm text-white px-3 py-1.5 rounded-full hover:bg-black/60 transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Kapak
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Avatar + Name ── */}
        <div className="px-4 mt-3">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0 -mt-14">
              <div className="w-28 h-28 rounded-full border-[3px] border-background shadow-xl overflow-hidden bg-muted">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-violet-400/30 flex items-center justify-center">
                    <span className="text-4xl font-black text-primary">{profile.displayName.charAt(0)}</span>
                  </div>
                )}
              </div>
              {isMe && (
                <>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-1 right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow-md hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-primary-foreground" />
                  </button>
                </>
              )}
            </div>

            {/* Name info */}
            <div className="flex-1 pb-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black">{profile.displayName}</h1>
                <BadgeCheck className="w-5 h-5 text-primary fill-primary/20" />
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> İstanbul, Türkiye
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 21 Kasım
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bio card ── */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl p-4 relative shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-primary text-xl font-black leading-none">"</span>
                <span className="text-sm font-bold text-primary">Biyografi</span>
              </div>
              {profile.bio ? (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Biyografi henüz eklenmemiş...</p>
              )}
            </div>
            {isMe && (
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors flex-shrink-0"
              >
                <Pencil className="w-3 h-3 text-primary" />
                Düzenle
              </button>
            )}
          </div>
        </div>

        {/* ── Now Playing card ── */}
        <div className="mx-4 mt-3 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-0">
            {/* Album art */}
            <div className="relative w-24 h-24 flex-shrink-0 bg-gradient-to-br from-purple-900 to-violet-600">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </div>
              </div>
              {/* Vinyl record accent */}
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/60" />
              </div>
            </div>

            {/* Song info */}
            <div className="flex-1 px-3 py-3 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Music2 className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">ŞU AN DİNLENİYOR</span>
              </div>
              <p className="font-bold text-base truncate">God is a woman</p>
              <p className="text-sm text-muted-foreground truncate">Ariana Grande</p>
              {/* Waveform */}
              <div className="flex gap-0.5 items-center h-5 mt-2">
                {Array(22).fill(0).map((_, i) => (
                  <div key={i}
                    className="w-0.5 rounded-full bg-primary animate-pulse"
                    style={{ height: `${25 + Math.sin(i * 0.7) * 60}%`, animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Heart */}
            <div className="pr-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary fill-primary/30" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { value: profile.followerCount, label: "Takipçi", icon: "👥" },
              { value: profile.followingCount, label: "Takip", icon: "👥" },
              { value: postCount, label: "Gönderi", icon: "⊞" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center py-4 gap-1">
                <span className="text-2xl font-black text-primary">{stat.value}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{stat.icon}</span>
                  <span>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mx-4 mt-3 flex gap-2">
          {isMe ? (
            <button
              onClick={openEdit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Pencil className="w-4 h-4" />
              Profili Düzenle
            </button>
          ) : (
            <>
              {/* Takip Et */}
              <button
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors shadow-md ${
                  profile.isFollowing
                    ? "bg-muted border border-border text-foreground hover:bg-muted/80"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {profile.isFollowing ? "Takiptesin" : "Takip Et"}
              </button>

              {/* Mesaj */}
              <button
                onClick={() => setLocation(`/dm/${profile.id}`)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
              >
                <Send className="w-4 h-4" />
                Mesaj
              </button>

              {/* Dropdown */}
              <button className="w-12 flex items-center justify-center rounded-2xl border border-border hover:bg-muted transition-colors">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
        </div>

        {/* ── Anonymous Q&A card ── */}
        <div className="mx-4 mt-3 bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🎭</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Anonim sorun mu var?</p>
            <p className="text-xs text-muted-foreground">Hadi, içini dök. Burada yargı yok.</p>
          </div>
          <button className="text-primary text-sm font-bold flex-shrink-0 hover:text-primary/80 transition-colors">
            Soru Sor
          </button>
        </div>

        {/* ── Story Highlights ── */}
        <div className="mt-5 px-4">
          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
            {HIGHLIGHTS.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${h.gradient} flex items-center justify-center shadow-lg border-2 border-background`}>
                  <span className="text-2xl">{HIGHLIGHT_ICONS[i]}</span>
                </div>
                <span className="text-[11px] text-foreground/70 font-medium">{h.label}</span>
              </div>
            ))}
            {/* Add new */}
            {isMe && (
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <button className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </button>
                <span className="text-[11px] text-muted-foreground font-medium">Yeni</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-5 mx-4 flex border-b border-border">
          {[
            { id: "posts" as Tab, label: "Gönderiler", icon: <LayoutGrid className="w-4 h-4" /> },
            { id: "reels" as Tab, label: "Reels", icon: <Clapperboard className="w-4 h-4" /> },
            { id: "liked" as Tab, label: "Beğeniler", icon: <Heart className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Posts grid ── */}
        <div className="mt-1">
          {currentLoading ? (
            <div className="grid grid-cols-3 gap-0.5 px-4 pt-2">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !currentPosts || currentPosts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                {activeTab === "posts" && <LayoutGrid className="w-7 h-7 opacity-40" />}
                {activeTab === "reels" && <Clapperboard className="w-7 h-7 opacity-40" />}
                {activeTab === "liked" && <Heart className="w-7 h-7 opacity-40" />}
              </div>
              <p className="font-medium">
                {activeTab === "posts" && "Henüz gönderi yok"}
                {activeTab === "reels" && "Henüz reel paylaşımı yok"}
                {activeTab === "liked" && "Henüz beğenilen gönderi yok"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {currentPosts.map((post: any) => (
                <div key={post.id} className="relative aspect-square overflow-hidden bg-muted group">
                  {post.mediaUrl ? (
                    post.mediaType === "video" ? (
                      <video src={post.mediaUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    /* Text-only post */
                    <div className="w-full h-full bg-gradient-to-br from-violet-900/80 to-purple-700/60 flex items-center justify-center p-3">
                      <p className="text-white text-xs text-center font-medium line-clamp-4 leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <span className="text-white text-xs font-bold flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-white" /> {post.likeCount ?? 0}
                    </span>
                    <span className="text-white text-xs font-bold flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 fill-white" /> {post.commentCount ?? 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Profili Düzenle</DialogTitle>
            <DialogDescription>Ad, biyografi ve fotoğraflarını güncelle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Görünen Ad</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Adın" maxLength={60} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Biyografi</label>
              <Textarea
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Kendinden bahset..."
                className="resize-none rounded-xl"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{editBio.length}/200</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving || !editName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
