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
  LayoutGrid, Clapperboard, Send, Video, X, Briefcase, Star, Bookmark, Repeat2,
} from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Tab = "posts" | "reels" | "bulletin" | "liked" | "reposted" | "saved";

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

  // Spotify now playing
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [spotifyInput, setSpotifyInput] = useState("");
  const [spotifySaving, setSpotifySaving] = useState(false);

  const extractSpotifyTrackId = (input: string): string | null => {
    // Handle full links: https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh
    const linkMatch = input.match(/track\/([A-Za-z0-9]+)/);
    if (linkMatch) return linkMatch[1]!;
    // Handle bare track IDs (22 chars alphanumeric)
    if (/^[A-Za-z0-9]{22}$/.test(input.trim())) return input.trim();
    return null;
  };

  const handleSaveSpotify = async () => {
    const trackId = extractSpotifyTrackId(spotifyInput);
    if (!trackId) {
      toast({ title: "Geçersiz link", description: "Spotify şarkı linkini veya track ID'sini gir.", variant: "destructive" });
      return;
    }
    setSpotifySaving(true);
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyTrackId: trackId }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSpotifyOpen(false);
      setSpotifyInput("");
      toast({ title: "Şarkı güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Şarkı kaydedilemedi.", variant: "destructive" });
    } finally { setSpotifySaving(false); }
  };

  const handleRemoveSpotify = async () => {
    await fetch("/api/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotifyTrackId: null }),
    });
    await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
    setSpotifyOpen(false);
  };

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
  const spotifyTrackId = (profile as any).spotifyTrackId as string | null | undefined;

  const currentPosts = activeTab === "posts" ? posts : activeTab === "reels" ? mediaPosts : likedPosts;
  const currentLoading = activeTab === "posts" ? postsLoading : activeTab === "reels" ? mediaLoading : likedLoading;

  return (
    <AppLayout>
      <div className="pb-24 bg-background">

        {/* ── Banner — full-width, rounded bottom corners, clickable to upload ── */}
        {isMe && (
          <input ref={bannerInputRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }} />
        )}
        <div
          className={`relative w-full overflow-hidden rounded-b-2xl ${isMe ? "cursor-pointer" : ""}`}
          style={{ height: "220px" }}
          onClick={() => isMe && bannerInputRef.current?.click()}
        >
          {bannerUrl ? (
            /\.(mp4|webm|mov|ogg)(\?|$)/i.test(bannerUrl) ? (
              <video src={bannerUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
            ) : (
              <img src={bannerUrl} alt="Kapak" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-950 via-purple-700 to-fuchsia-500" />
          )}

          {/* Gradient fade at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/15 pointer-events-none" />

          {/* Tap hint for own profile */}
          {isMe && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-2">
                <Video className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-semibold">Fotoğraf veya video ekle</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Avatar row: overlaps banner bottom ── */}
        <div className="px-5 flex items-end gap-4 -mt-18 mb-1">
          {/* Avatar + "+" overlay */}
          <div className="relative flex-shrink-0">
            {isMe && (
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            )}
            <div className="w-36 h-36 rounded-full border-[5px] border-background shadow-2xl overflow-hidden bg-muted">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-violet-400/30 flex items-center justify-center">
                  <span className="text-5xl font-black text-primary">{profile.displayName.charAt(0)}</span>
                </div>
              )}
            </div>
            {/* Purple "+" button — bottom-right of avatar, overlapping */}
            {isMe && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 active:scale-95 transition-all border-[3px] border-background"
              >
                <Plus className="w-5 h-5 text-primary-foreground stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* ── Name section — fully below avatar ── */}
        <div className="px-5 mt-3 space-y-1.5">
          {/* Display name + verified */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{profile.displayName}</h1>
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

        {/* ── Now Playing / Spotify card ── */}
        {spotifyTrackId ? (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-1.5">
                {/* Spotify logo */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">ŞU AN DİNLENİYOR</span>
              </div>
              {isMe && (
                <button
                  onClick={() => { setSpotifyInput(""); setSpotifyOpen(true); }}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  Değiştir
                </button>
              )}
            </div>
            {/* Spotify embed iframe — compact */}
            <iframe
              src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="block"
            />
          </div>
        ) : isMe ? (
          /* No track set → show "add song" button for own profile */
          <button
            onClick={() => { setSpotifyInput(""); setSpotifyOpen(true); }}
            className="mx-4 mt-3 w-[calc(100%-2rem)] flex items-center gap-3 p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">Şu an dinleniyor</p>
              <p className="text-xs text-muted-foreground">Spotify şarkısı ekle</p>
            </div>
            <Plus className="w-5 h-5 text-primary ml-auto" />
          </button>
        ) : null}

        {/* ── Stats row ── */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl">
          <div className="grid grid-cols-4 divide-x divide-border">
            {[
              { value: profile.followerCount, label: "Takipçi", Icon: CheckCircle2 },
              { value: profile.followingCount, label: "Takip", Icon: Plus },
              { value: postCount, label: "Gönderi", Icon: LayoutGrid },
              { value: (profile as any).likeCount ?? 0, label: "Beğeni", Icon: Heart },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center py-4 gap-1">
                <span className="text-2xl font-black text-primary">{stat.value}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <stat.Icon className="w-3 h-3" />
                  <span>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mx-4 mt-3 flex gap-2">
          {isMe ? (
            <>
              <button
                onClick={openEdit}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
              >
                Profili Düzenle
              </button>
              <button
                onClick={() => {}}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Mesaj
              </button>
              <button className="w-12 flex items-center justify-center rounded-2xl border border-border hover:bg-muted transition-colors">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          ) : (
            <>
              {/* Takip Et */}
              <button
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors shadow-md ${
                  profile.isFollowing
                    ? "border border-border text-foreground hover:bg-muted/80"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {profile.isFollowing ? "Takiptesin" : "Takip Et"}
              </button>

              {/* Mesaj */}
              <button
                onClick={() => setLocation(`/dm/${profile.id}`)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Mesaj
              </button>

              {/* Dropdown */}
              <button className="w-12 flex items-center justify-center rounded-2xl border border-border hover:bg-muted transition-colors">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
        </div>

        {/* ── Eserler card ── */}
        <div className="mx-4 mt-3 bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="rounded-2xl p-4 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-400">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-base leading-tight">Eserler</p>
                <p className="text-white/80 text-xs mt-0.5">Kullanıcının yayınladığı eserler</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Deneme", "Deneme yapıyoruz"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Anılar (Story Highlights) ── */}
        <div className="mt-4 mx-4 bg-card border border-border rounded-2xl p-4 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">Anılar</p>
              <p className="text-xs text-muted-foreground">Anılarını loop diye paylaş.</p>
            </div>
            <button className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted transition-colors flex-shrink-0">
              Tümünü Gör
            </button>
          </div>
          {/* Rounded-rect cards */}
          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {HIGHLIGHTS.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-[88px] h-[116px] rounded-[20px] bg-gradient-to-b ${h.gradient} flex items-end justify-center pb-4 shadow-md`}>
                  <span className="text-3xl">{HIGHLIGHT_ICONS[i]}</span>
                </div>
                <span className="text-[11px] text-foreground/70 font-medium capitalize">{h.label}</span>
              </div>
            ))}
            {isMe && (
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <button className="w-[88px] h-[116px] rounded-[20px] border-2 border-dashed border-border flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors">
                  <Plus className="w-7 h-7 text-muted-foreground" />
                </button>
                <span className="text-[11px] text-muted-foreground font-medium">Yeni</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Anonymous Q&A card ── */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#1a0a2e] flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">Anonim bir soru g...</p>
            <p className="text-xs text-muted-foreground">Sorular anonim kalır.</p>
          </div>
          <button className="px-4 py-2 rounded-full border border-border text-primary text-sm font-semibold flex-shrink-0 hover:bg-primary/5 transition-colors">
            Soru Gönder
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-5 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {[
              { id: "posts" as Tab, label: "Gönderiler", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
              { id: "reels" as Tab, label: "Loops", icon: <Play className="w-3.5 h-3.5" /> },
              { id: "bulletin" as Tab, label: "Bülten", icon: <MessageCircle className="w-3.5 h-3.5" /> },
              { id: "liked" as Tab, label: "Beğeniler", icon: <Heart className="w-3.5 h-3.5" /> },
              { id: "reposted" as Tab, label: "Tekrar Paylaşım", icon: <Repeat2 className="w-3.5 h-3.5" /> },
              { id: "saved" as Tab, label: "Kaydedilen", icon: <Bookmark className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
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

      {/* ── Spotify Dialog ── */}
      <Dialog open={spotifyOpen} onOpenChange={setSpotifyOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Spotify Şarkısı Ekle
            </DialogTitle>
            <DialogDescription>
              Spotify'dan bir şarkının linkini veya Track ID'sini yapıştır
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Spotify Linki veya Track ID</label>
              <Input
                value={spotifyInput}
                onChange={e => setSpotifyInput(e.target.value)}
                placeholder="https://open.spotify.com/track/..."
                className="rounded-xl font-mono text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Spotify'da şarkıyı aç → ••• → Paylaş → Bağlantıyı kopyala
              </p>
            </div>

            {/* Preview extracted ID */}
            {spotifyInput && extractSpotifyTrackId(spotifyInput) && (
              <div className="rounded-xl overflow-hidden border border-border">
                <iframe
                  src={`https://open.spotify.com/embed/track/${extractSpotifyTrackId(spotifyInput)}?utm_source=generator&theme=0`}
                  width="100%"
                  height="80"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            )}

            <div className="flex gap-3">
              {spotifyTrackId && (
                <button
                  onClick={handleRemoveSpotify}
                  className="px-4 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
                >
                  Kaldır
                </button>
              )}
              <button
                onClick={() => setSpotifyOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveSpotify}
                disabled={spotifySaving || !spotifyInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#1DB954] text-white text-sm font-semibold hover:bg-[#1aa34a] transition-colors disabled:opacity-50"
              >
                {spotifySaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
