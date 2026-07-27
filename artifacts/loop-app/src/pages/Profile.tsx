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
  LayoutGrid, Clapperboard, Send, Video,
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
        <div className="animate-pulse">
          <div className="h-52 bg-muted" />
          <div className="px-4">
            <div className="flex items-end gap-4 -mt-16">
              <div className="w-32 h-32 rounded-full bg-muted border-[5px] border-background flex-shrink-0" />
              <div className="w-14 h-14 rounded-full bg-muted mb-1" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-7 w-36 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted rounded" />
            </div>
            <div className="mt-4 h-24 bg-muted rounded-2xl" />
          </div>
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

        {/* ── Banner — full-width, supports photo & video ── */}
        <div className="relative w-full overflow-hidden" style={{ height: "220px" }}>
          {bannerUrl ? (
            /* detect video by extension */
            /\.(mp4|webm|mov|ogg)(\?|$)/i.test(bannerUrl) ? (
              <video
                src={bannerUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img src={bannerUrl} alt="Kapak" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-950 via-purple-700 to-fuchsia-500" />
          )}

          {/* Bottom fade so avatar blends in */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 pointer-events-none" />

          {/* Upload button — top right corner */}
          {isMe && (
            <>
              <input ref={bannerInputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }} />
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/35 transition-colors shadow-md"
                title="Kapak fotoğrafı veya video yükle"
              >
                <Video className="w-4 h-4 text-white" />
              </button>
            </>
          )}
        </div>

        {/* ── Avatar row: overlaps banner bottom ── */}
        <div className="px-5 flex items-end gap-4 -mt-16 mb-1">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-32 h-32 rounded-full border-[5px] border-background shadow-2xl overflow-hidden bg-muted">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-violet-400/30 flex items-center justify-center">
                  <span className="text-5xl font-black text-primary">{profile.displayName.charAt(0)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Large "+" button — separate, below-right of avatar */}
          {isMe && (
            <>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-xl hover:bg-primary/90 active:scale-95 transition-all border-[3px] border-background mb-1"
              >
                <Plus className="w-7 h-7 text-primary-foreground stroke-[2.5]" />
              </button>
            </>
          )}
        </div>

        {/* ── Name section — fully below avatar ── */}
        <div className="px-5 mt-3 space-y-1.5">
          {/* Display name + verified */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{profile.displayName}</h1>
            {/* Paper-plane verified icon like screenshot */}
            <Send className="w-5 h-5 text-primary fill-primary/20 -rotate-12" />
          </div>

          {/* Username */}
          <p className="text-[15px] text-muted-foreground">@{profile.username}</p>

          {/* Location + date */}
          <div className="flex items-center gap-5 text-[13px] text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary/70" />
              İstanbul, Türkiye
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary/70" />
              21 Kasım
            </span>
          </div>
        </div>

        {/* ── Bio card ── */}
        <div className="mx-4 mt-5 rounded-2xl overflow-hidden shadow-sm"
          style={{ background: "color-mix(in srgb, hsl(var(--primary)) 7%, hsl(var(--card)))", border: "1px solid color-mix(in srgb, hsl(var(--primary)) 15%, transparent)" }}>
          <div className="flex items-start gap-3 p-4">
            {/* Large styled quotation marks */}
            <div className="flex-shrink-0 mt-0.5">
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 22V13.4C0 10.2667 0.666667 7.6 2 5.4C3.4 3.13333 5.4 1.26667 8 -0.200001L10 2.6C8.33333 3.66667 7.06667 4.86667 6.2 6.2C5.33333 7.53333 4.93333 9.13333 5 11H10V22H0ZM18 22V13.4C18 10.2667 18.6667 7.6 20 5.4C21.4 3.13333 23.4 1.26667 26 -0.200001L28 2.6C26.3333 3.66667 25.0667 4.86667 24.2 6.2C23.3333 7.53333 22.9333 9.13333 23 11H28V22H18Z"
                  fill="hsl(var(--primary))" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary mb-1.5">Biyografi</p>
              {profile.bio ? (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Henüz biyografi eklenmemiş...</p>
              )}
            </div>

            {/* Circular pencil button */}
            {isMe && (
              <button
                onClick={openEdit}
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors mt-0.5"
                style={{ background: "color-mix(in srgb, hsl(var(--muted)) 80%, transparent)", border: "1px solid hsl(var(--border))" }}
              >
                <Pencil className="w-4 h-4 text-primary/80" />
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
