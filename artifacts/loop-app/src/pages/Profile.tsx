import { useParams, Link } from "wouter";
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
  LayoutGrid, Clapperboard, Send, Video, X, Briefcase, Star, Bookmark, Repeat2, Lock,
} from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Tab = "posts" | "reels" | "bulletin" | "liked" | "reposted" | "saved";

// Polaroid highlights
const HIGHLIGHTS = [
  { label: "Yazdıklarım ✏️", gradient: "from-violet-950 via-purple-800 to-indigo-700", rotate: "-rotate-3", tape: "bg-violet-300" },
  { label: "Anılar 🌙",     gradient: "from-purple-900 via-fuchsia-800 to-violet-600", rotate: "rotate-1",  tape: "bg-fuchsia-300" },
  { label: "Ben 💜",        gradient: "from-indigo-900 via-purple-700 to-violet-500",  rotate: "-rotate-1", tape: "bg-purple-300" },
  { label: "İlhamım ✨",    gradient: "from-violet-800 via-purple-600 to-pink-500",    rotate: "rotate-2",  tape: "bg-pink-300" },
  { label: "Müziğim ♫",    gradient: "from-purple-950 via-violet-800 to-fuchsia-600", rotate: "-rotate-2", tape: "bg-violet-200" },
];

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
  const [bulletinPosts, setBulletinPosts] = useState<any[] | null>(null);
  const [bulletinLoading, setBulletinLoading] = useState(false);
  const [repostedPosts, setRepostedPosts] = useState<any[] | null>(null);
  const [repostedLoading, setRepostedLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState<any[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);

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
    if (tab === "bulletin" && bulletinPosts === null && !bulletinLoading) {
      setBulletinLoading(true);
      try {
        const r = await fetch(`/api/posts?userId=${targetUserId}&postType=bulletin`);
        setBulletinPosts(await r.json());
      } catch { setBulletinPosts([]); }
      finally { setBulletinLoading(false); }
    }
    if (tab === "reposted" && repostedPosts === null && !repostedLoading) {
      setRepostedLoading(true);
      try {
        const r = await fetch(`/api/posts?reposted=true`);
        setRepostedPosts(await r.json());
      } catch { setRepostedPosts([]); }
      finally { setRepostedLoading(false); }
    }
    if (tab === "saved" && savedPosts === null && !savedLoading && isMe) {
      setSavedLoading(true);
      try {
        const r = await fetch("/api/posts?saved=true");
        setSavedPosts(await r.json());
      } catch { setSavedPosts([]); }
      finally { setSavedLoading(false); }
    }
  };

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  // Bio-only edit
  const [bioOpen, setBioOpen] = useState(false);
  const [bioText, setBioText] = useState("");
  const [bioSaving, setBioSaving] = useState(false);

  // Avatar options menu
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);

  // kept for backward compat (Spotify etc.)
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

  // Followers / Following — combined Instagram-style dialog
  const [followDialogOpen, setFollowDialogOpen] = useState(false);
  const [followTab, setFollowTab] = useState<"followers" | "following">("followers");
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const loadFollowLists = async () => {
    setFollowListLoading(true);
    try {
      const [frs, fing] = await Promise.all([
        fetch(`/api/users/${targetUserId}/followers`).then(r => r.json()),
        fetch(`/api/users/${targetUserId}/following`).then(r => r.json()),
      ]);
      setFollowersList(Array.isArray(frs) ? frs : []);
      setFollowingList(Array.isArray(fing) ? fing : []);
    } catch { setFollowersList([]); setFollowingList([]); }
    finally { setFollowListLoading(false); }
  };

  const openFollowers = () => { setFollowTab("followers"); setFollowDialogOpen(true); loadFollowLists(); };
  const openFollowing = () => { setFollowTab("following"); setFollowDialogOpen(true); loadFollowLists(); };

  const handleUnfollow = async (userId: number) => {
    try {
      await fetch(`/api/users/${userId}/unfollow`, { method: "POST" });
      setFollowingList(prev => prev.filter((u: any) => u.id !== userId));
      toast({ title: "Takipten çıkıldı" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
  };

  const handleRemoveFollower = async (userId: number) => {
    try {
      await fetch(`/api/users/${userId}/remove-follower`, { method: "POST" });
      setFollowersList(prev => prev.filter((u: any) => u.id !== userId));
      toast({ title: "Takipçi kaldırıldı" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
  };

  const handleFollowToggleInList = async (userId: number, currentlyFollowing: boolean) => {
    const endpoint = currentlyFollowing ? "unfollow" : "follow";
    try {
      await fetch(`/api/users/${userId}/${endpoint}`, { method: "POST" });
      const updateList = (list: any[]) =>
        list.map((u: any) => u.id === userId ? { ...u, isFollowing: !currentlyFollowing } : u);
      setFollowersList(prev => updateList(prev));
      setFollowingList(prev => updateList(prev));
      toast({ title: currentlyFollowing ? "Takipten çıkıldı" : "Takip edildi" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
  };

  // Anonymous question
  const [anonQOpen, setAnonQOpen] = useState(false);
  const [anonQText, setAnonQText] = useState("");
  const [anonQSaving, setAnonQSaving] = useState(false);

  const handleSendAnonQ = async () => {
    if (!anonQText.trim()) return;
    setAnonQSaving(true);
    try {
      const res = await fetch(`/api/users/${targetUserId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: anonQText.trim() }),
      });
      if (!res.ok) throw new Error("Gönderilemedi");
      setAnonQOpen(false);
      setAnonQText("");
      toast({ title: "Soru gönderildi!", description: "Sorun anonim olarak iletildi." });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally { setAnonQSaving(false); }
  };

  // My questions inbox
  const [myQOpen, setMyQOpen] = useState(false);
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [myQLoading, setMyQLoading] = useState(false);

  const openMyQuestions = async () => {
    setMyQLoading(true);
    setMyQOpen(true);
    try {
      const r = await fetch("/api/users/me/questions");
      setMyQuestions(await r.json());
    } catch { setMyQuestions([]); }
    finally { setMyQLoading(false); }
  };

  // Change password
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async () => {
    if (pwNew !== pwConfirm) {
      toast({ title: "Hata", description: "Yeni şifreler eşleşmiyor", variant: "destructive" });
      return;
    }
    if (pwNew.length < 6) {
      toast({ title: "Hata", description: "Şifre en az 6 karakter olmalı", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre değiştirilemedi");
      setPwOpen(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      toast({ title: "Şifre değiştirildi", description: "Yeni şifreniz kaydedildi." });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally { setPwSaving(false); }
  };

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

  // Bio-only save
  const handleSaveBio = async () => {
    setBioSaving(true);
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioText }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setBioOpen(false);
      toast({ title: "Biyografi güncellendi" });
    } catch {
      toast({ title: "Hata", description: "Biyografi kaydedilemedi.", variant: "destructive" });
    } finally { setBioSaving(false); }
  };

  // Save display name + username from avatar menu
  const handleSaveInfo = async () => {
    setInfoSaving(true);
    try {
      const body: Record<string, string> = {};
      if (editDisplayName.trim()) body.displayName = editDisplayName.trim();
      if (editUsername.trim()) body.username = editUsername.trim();
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setAvatarMenuOpen(false);
      toast({ title: "Bilgiler güncellendi" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally { setInfoSaving(false); }
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

  const currentPosts =
    activeTab === "posts" ? posts :
    activeTab === "reels" ? mediaPosts :
    activeTab === "liked" ? likedPosts :
    activeTab === "bulletin" ? bulletinPosts :
    activeTab === "reposted" ? repostedPosts :
    activeTab === "saved" ? savedPosts : null;
  const currentLoading =
    activeTab === "posts" ? postsLoading :
    activeTab === "reels" ? mediaLoading :
    activeTab === "liked" ? likedLoading :
    activeTab === "bulletin" ? bulletinLoading :
    activeTab === "reposted" ? repostedLoading :
    activeTab === "saved" ? savedLoading : false;

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
                onClick={() => {
                  setEditDisplayName(profile?.displayName ?? "");
                  setEditUsername(profile?.username ?? "");
                  setAvatarMenuOpen(true);
                }}
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

            {/* Circular pencil button — sadece biyografi */}
            {isMe && (
              <button
                onClick={() => { setBioText(profile?.bio ?? ""); setBioOpen(true); }}
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
            {/* Takipçi — tıklanabilir */}
            <button onClick={openFollowers} className="flex flex-col items-center py-4 gap-1 hover:bg-muted/40 transition-colors rounded-l-2xl">
              <span className="text-2xl font-black text-primary">{profile.followerCount}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3" /><span>Takipçi</span>
              </div>
            </button>
            {/* Takip — tıklanabilir */}
            <button onClick={openFollowing} className="flex flex-col items-center py-4 gap-1 hover:bg-muted/40 transition-colors">
              <span className="text-2xl font-black text-primary">{profile.followingCount}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Plus className="w-3 h-3" /><span>Takip</span>
              </div>
            </button>
            <div className="flex flex-col items-center py-4 gap-1">
              <span className="text-2xl font-black text-primary">{postCount}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LayoutGrid className="w-3 h-3" /><span>Gönderi</span>
              </div>
            </div>
            <div className="flex flex-col items-center py-4 gap-1">
              <span className="text-2xl font-black text-primary">{(profile as any).likeCount ?? 0}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="w-3 h-3" /><span>Beğeni</span>
              </div>
            </div>
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
              <button
                onClick={() => { setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwOpen(true); }}
                className="w-12 flex items-center justify-center rounded-2xl border border-border hover:bg-muted transition-colors"
                title="Şifremi Değiştir"
              >
                <Lock className="w-4 h-4 text-muted-foreground" />
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

        {/* ── Anılar — Polaroid tasarım ── */}
        <div className="mt-4 mx-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <span className="font-bold text-sm">Öne Çıkanlar</span>
            </div>
            <button className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity">
              Tümünü Gör
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 px-1 hide-scrollbar">
            {/* ── Yeni Anı ekle — en sol ── */}
            {isMe && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-2">
                <button
                  className="bg-white rounded-sm shadow-md border-2 border-dashed border-primary/30 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors"
                  style={{ width: 100, height: 132 }}
                >
                  <Plus className="w-7 h-7 text-primary/40" />
                </button>
              </div>
            )}
            {HIGHLIGHTS.map((h, i) => (
              <div key={i} className={`flex-shrink-0 flex flex-col items-center gap-1 ${h.rotate} transition-transform hover:scale-105 hover:rotate-0 cursor-pointer`}>
                {/* Polaroid card */}
                <div className="bg-white rounded-sm shadow-lg" style={{ width: 100, padding: 6, paddingBottom: 28 }}>
                  {/* Tape at top */}
                  <div className="flex justify-center -mt-3 mb-1">
                    <div className={`${h.tape} opacity-80 rounded-sm`} style={{ width: 28, height: 10 }} />
                  </div>
                  {/* Photo */}
                  <div className={`w-full rounded-sm bg-gradient-to-b ${h.gradient} flex items-end justify-center`} style={{ height: 88 }}>
                    <span className="text-2xl pb-1">{i === 0 ? "✏️" : i === 1 ? "🌙" : i === 2 ? "💜" : i === 3 ? "✨" : "♫"}</span>
                  </div>
                  {/* Label inside white area */}
                  <p className="text-center text-[9px] font-semibold text-gray-600 mt-2 leading-tight truncate px-1">{h.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Anonymous Q&A card ── */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#1a0a2e] flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Anonim soru gönder</p>
            <p className="text-xs text-muted-foreground">Sorular anonim kalır.</p>
          </div>
          {isMe ? (
            <button
              onClick={openMyQuestions}
              className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold flex-shrink-0 hover:bg-primary/20 transition-colors"
            >
              Gelen Kutusu
            </button>
          ) : (
            <button
              onClick={() => { setAnonQText(""); setAnonQOpen(true); }}
              className="px-4 py-2 rounded-full border border-border text-primary text-sm font-semibold flex-shrink-0 hover:bg-primary/5 transition-colors"
            >
              Soru Gönder
            </button>
          )}
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

      {/* ── Takipçi / Takip Edilenler — Instagram-style tam ekran ── */}
      <Dialog open={followDialogOpen} onOpenChange={v => { setFollowDialogOpen(v); if (!v) { setFollowersList([]); setFollowingList([]); } }}>
        <DialogContent className="p-0 gap-0 w-full max-w-md rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: "85vh" }}>
          {/* Başlık */}
          <DialogHeader className="px-4 pt-4 pb-0 flex-shrink-0">
            <DialogTitle className="text-base font-bold text-center">{profile?.displayName}</DialogTitle>
            <DialogDescription className="sr-only">Takipçi ve takip listesi</DialogDescription>
          </DialogHeader>

          {/* Tab çubuğu */}
          <div className="flex border-b border-border flex-shrink-0 mt-3">
            <button
              onClick={() => setFollowTab("followers")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                followTab === "followers"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Takipçi · {profile?.followerCount ?? 0}
            </button>
            <button
              onClick={() => setFollowTab("following")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                followTab === "following"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Takip · {profile?.followingCount ?? 0}
            </button>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {followListLoading ? (
              <div className="space-y-1 p-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : (followTab === "followers" ? followersList : followingList).length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                {followTab === "followers" ? "Henüz takipçi yok" : "Henüz kimse takip edilmiyor"}
              </p>
            ) : (followTab === "followers" ? followersList : followingList).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex-shrink-0 overflow-hidden border border-border">
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt={u.displayName} />
                    : <span className="w-full h-full flex items-center justify-center text-primary font-bold text-lg">{u.displayName?.charAt(0)}</span>}
                </div>

                {/* İsim + kullanıcı adı */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate leading-tight">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>

                {/* Aksiyon butonları */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Profili Gör */}
                  <Link href={`/profile/${u.username}`} onClick={() => setFollowDialogOpen(false)}>
                    <button className="px-3 py-1.5 rounded-full bg-muted text-xs font-semibold hover:bg-muted/80 transition-colors">
                      Profil
                    </button>
                  </Link>
                  {/* Takip Et / Takip Ediyorsun — başkasının profilinde veya kendi takipçi listesinde */}
                  {!isMe && (
                    <button
                      onClick={() => handleFollowToggleInList(u.id, !!u.isFollowing)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        u.isFollowing
                          ? "border border-border text-muted-foreground hover:bg-muted"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {u.isFollowing ? "Takiptesin" : "Takip Et"}
                    </button>
                  )}
                  {/* Takipten Çıkar / Kaldır — sadece kendi profilinde */}
                  {isMe && followTab === "following" && (
                    <button
                      onClick={() => handleUnfollow(u.id)}
                      className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      Çıkar
                    </button>
                  )}
                  {isMe && followTab === "followers" && (
                    <>
                      <button
                        onClick={() => handleFollowToggleInList(u.id, !!u.isFollowing)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          u.isFollowing
                            ? "border border-border text-muted-foreground hover:bg-muted"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {u.isFollowing ? "Takiptesin" : "Takip Et"}
                      </button>
                      <button
                        onClick={() => handleRemoveFollower(u.id)}
                        className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Kaldır
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Anonymous Q Send Dialog ── */}
      <Dialog open={anonQOpen} onOpenChange={setAnonQOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><span className="text-xl">🤖</span> Anonim Soru Gönder</DialogTitle>
            <DialogDescription>Kimliğin gizli kalacak. {profile?.displayName} sorunuzu görecek.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={anonQText}
              onChange={e => setAnonQText(e.target.value)}
              placeholder="Sorunuzu yazın..."
              className="resize-none rounded-xl"
              rows={4}
              maxLength={300}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">{anonQText.length}/300</p>
            <div className="flex gap-3">
              <button onClick={() => setAnonQOpen(false)} disabled={anonQSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">İptal</button>
              <button onClick={handleSendAnonQ} disabled={anonQSaving || !anonQText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {anonQSaving ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── My Questions Inbox Dialog ── */}
      <Dialog open={myQOpen} onOpenChange={setMyQOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><span>🤖</span> Gelen Sorular</DialogTitle><DialogDescription>Sana gelen anonim sorular</DialogDescription></DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 py-2">
            {myQLoading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)
            ) : myQuestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Henüz soru yok</p>
            ) : myQuestions.map((q: any) => (
              <div key={q.id} className="bg-muted/50 rounded-xl p-3 border border-border">
                <p className="text-sm font-medium">{q.question_text}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(q.created_at).toLocaleDateString("tr-TR")}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* ── Bio Edit Dialog ── */}
      <Dialog open={bioOpen} onOpenChange={setBioOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Biyografi Düzenle
            </DialogTitle>
            <DialogDescription>Kendinle ilgili bir şeyler yaz</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={bioText}
              onChange={e => setBioText(e.target.value)}
              placeholder="Kendinden bahset..."
              className="resize-none rounded-xl"
              rows={5}
              maxLength={200}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">{bioText.length}/200</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBioOpen(false)}
                disabled={bioSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveBio}
                disabled={bioSaving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {bioSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Avatar Options Dialog ── */}
      <Dialog open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Profil Ayarları</DialogTitle>
            <DialogDescription>Fotoğraf, görünen ad veya kullanıcı adını değiştir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photo change button */}
            <button
              onClick={() => { setAvatarMenuOpen(false); setTimeout(() => avatarInputRef.current?.click(), 100); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ImagePlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Profil Fotoğrafını Değiştir</p>
                <p className="text-xs text-muted-foreground">Galeriden fotoğraf seç</p>
              </div>
            </button>

            {/* Display name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Görünen Ad</label>
              <Input
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                placeholder="Görünen adın"
                maxLength={60}
                className="rounded-xl"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Kullanıcı Adı</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="kullanici_adi"
                  maxLength={30}
                  className="rounded-xl pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">Harf, rakam ve _ kullanabilirsin</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAvatarMenuOpen(false)}
                disabled={infoSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveInfo}
                disabled={infoSaving || (!editDisplayName.trim() && !editUsername.trim())}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {infoSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ── */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Şifremi Değiştir
            </DialogTitle>
            <DialogDescription>
              Mevcut şifreni girerek yeni bir şifre belirle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Mevcut Şifre</label>
              <Input
                type="password"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                placeholder="Mevcut şifreni gir"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Yeni Şifre</label>
              <Input
                type="password"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                placeholder="En az 6 karakter"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Yeni Şifre (Tekrar)</label>
              <Input
                type="password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                placeholder="Yeni şifreyi tekrar gir"
                className="rounded-xl"
              />
              {pwConfirm && pwNew !== pwConfirm && (
                <p className="text-xs text-destructive">Şifreler eşleşmiyor</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPwOpen(false)}
                disabled={pwSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm || pwNew !== pwConfirm}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {pwSaving ? "Kaydediliyor..." : "Kaydet"}
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
