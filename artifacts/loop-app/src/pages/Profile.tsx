import { useParams, Link } from "wouter";
import {
  useGetUser, useListPosts, useFollowUser, useUnfollowUser,
  useListStories, getGetUserQueryKey, getGetMeQueryKey, getListPostsQueryKey, getListStoriesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { revealVideoAfterFrame } from "@/lib/video-visibility";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus, Pencil, MessageCircle, Plus, MapPin, Calendar, Eye, EyeOff,
  CheckCircle2, BadgeCheck, Music2, Heart, Play, ChevronDown,
  LayoutGrid, Clapperboard, Send, Video, X, Briefcase, BookOpen, Star, Bookmark, Repeat2, Lock, ArrowLeft, Frame, MoreVertical, Flag, ShieldOff, Link2, Volume2, VolumeX, Ban, Share2, ShieldCheck, CircleHelp,
  Users, Sparkles,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { NormalizedFrame } from "@/components/shared/NormalizedFrame";
import { PostCard } from "@/components/shared/PostCard";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";
import { ChromaKeyAnimation } from "@/components/live/ChromaKeyAnimation";
import { Country, State } from "country-state-city";

type Tab = "posts" | "reels" | "bulletin" | "liked" | "reposted" | "saved";
type AvatarFrameTransform = { x: number; y: number; scale: number };

const parseAvatarFrameTransform = (value: unknown): AvatarFrameTransform | null => {
  if (!value || typeof value !== "object") return null;
  const transform = value as Record<string, unknown>;
  if (
    typeof transform.x !== "number" || !Number.isFinite(transform.x) || transform.x < -42 || transform.x > 42
    || typeof transform.y !== "number" || !Number.isFinite(transform.y) || transform.y < -42 || transform.y > 42
    || typeof transform.scale !== "number" || !Number.isFinite(transform.scale) || transform.scale < 0.8 || transform.scale > 1.3
  ) return null;
  return { x: transform.x, y: transform.y, scale: transform.scale };
};

const ALL_COUNTRIES = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name, "tr"));
const COUNTRY_NAMES = ALL_COUNTRIES.map(country => country.name === "Turkey" ? "Türkiye" : country.name);
const getCitiesForCountry = (countryName: string) => {
  const country = ALL_COUNTRIES.find(item => item.name === countryName || (countryName === "Türkiye" && item.name === "Turkey"));
  if (country) {
    const topLevelLocations = State.getStatesOfCountry(country.isoCode)
      .map(state => state.name)
      .filter(Boolean);
    return [...new Set(topLevelLocations)].sort((a, b) => a.localeCompare(b, "tr"));
  }
  return [];
};

const getProfilePostTypeLabel = (post: { postType?: string; isLoop?: boolean; mediaType?: string }) => {
  if (post.isLoop) return "Loop";
  switch (post.postType) {
    case "micro": return "Mikro kurgu";
    case "book": return "Kitap";
    case "trailer": return "Fragman";
    case "column": return "Köşe yazısı";
    case "bulletin": return "Bülten";
    case "poll": return "Anket";
    default: return post.mediaType && /video/i.test(post.mediaType) ? "Video" : "Gönderi";
  }
};

const getProfilePostText = (content: string, postType?: string) => {
  if (postType === "column") {
    const styleMeta = content.match(/^\[\[column-style:.*?\]\]/s);
    return styleMeta ? content.slice(styleMeta[0].length).trim() : content;
  }
  if (postType === "book") {
    const bookMeta = content.match(/^\[\[book-meta:(.*?)\]\]/s);
    if (bookMeta) {
      try {
        const book = JSON.parse(bookMeta[1]) as { title?: string; text?: string };
        return [book.title, book.text].filter(Boolean).join("\n");
      } catch {
        return content.slice(bookMeta[0].length).trim();
      }
    }
  }
  return content;
};

export default function Profile() {
  const { t } = useLanguage();
  const params = useParams();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("posts");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [panoMenuOpen, setPanoMenuOpen] = useState(false);
  const [profileReportOpen, setProfileReportOpen] = useState(false);
  const [profileReportReason, setProfileReportReason] = useState("Spam");
  const [profileReportSending, setProfileReportSending] = useState(false);
  const [profileControls, setProfileControls] = useState({
    blocked: false,
    restricted: false,
    postsHidden: false,
    blockedByMe: false,
    blockedByThem: false,
  });
  const [profileControlsLoading, setProfileControlsLoading] = useState(false);
  const [profileControlSaving, setProfileControlSaving] = useState(false);
  const [profileAboutOpen, setProfileAboutOpen] = useState(false);
  const [profileIntroVideoOpen, setProfileIntroVideoOpen] = useState(false);
  const [profileIntroOrigin, setProfileIntroOrigin] = useState({ x: 0, y: 0 });
  const [profileIntroVideoSaving, setProfileIntroVideoSaving] = useState(false);
  const [introVideoTransparencyMode, setIntroVideoTransparencyMode] = useState<"auto" | "none" | "green" | "white">("auto");
  const [introVideoEdgeFade, setIntroVideoEdgeFade] = useState(true);
  const [profileHasCommunity, setProfileHasCommunity] = useState(false);
  const [membershipBenefits, setMembershipBenefits] = useState<{
    badge?: string | null;
    badgeLabel?: string | null;
    badgeAssetUrl?: string | null;
    canUseProfileIntroVideo?: boolean;
    activeMemberships?: Array<{ id: string; name: string }>;
  } | null>(null);
  const introVideoSeenProfileId = useRef<number | null>(null);
  const profileBannerRef = useRef<HTMLDivElement>(null);

  // ── Galeri parçalama — pinch-to-zoom ──
  const [gridCols, setGridCols] = useState(3);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [profileViewCounts, setProfileViewCounts] = useState<Record<number, number>>({});
  const [profileLikeStates, setProfileLikeStates] = useState<Record<number, { liked: boolean; count: number }>>({});
  const pinchDistRef = useRef<number | null>(null);
  const pinchStartColsRef = useRef(3);
  const profileVideoViewsRef = useRef(new Set<number>());

  const recordProfileVideoView = (postId: number) => {
    const post = currentPosts?.find((item: any) => item.id === postId);
    const isLoop = Boolean(post?.isLoop && post.sourceId);
    const viewUrl = isLoop ? `/api/loop/photos/${post.sourceId}/view` : `/api/posts/${postId}/view`;
    if (profileVideoViewsRef.current.has(postId)) return;
    profileVideoViewsRef.current.add(postId);
    void fetch(viewUrl, { method: "POST", credentials: "include" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const nextCount = isLoop ? data?.views : data?.viewCount;
        if (typeof nextCount === "number") {
          setProfileViewCounts(current => ({
            ...current,
            [postId]: Math.max(current[postId] ?? 0, nextCount),
          }));
        }
      })
      .catch(() => { profileVideoViewsRef.current.delete(postId); });
  };

  const getPinchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const onPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { pinchDistRef.current = getPinchDist(e); pinchStartColsRef.current = gridCols; }
  };
  const onPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || pinchDistRef.current === null) return;
    const ratio = pinchDistRef.current / getPinchDist(e); // >1 = sıkıştırma = daha fazla sütun
    const delta = Math.round((ratio - 1) * 8);
    const next = Math.min(6, Math.max(3, pinchStartColsRef.current + delta));
    if (next !== gridCols) setGridCols(next);
  };
  const onPinchEnd = () => { pinchDistRef.current = null; };

  const toggleProfileLike = async (event: React.MouseEvent, post: any) => {
    event.stopPropagation();
    if (post.isLoop) return;
    const previous = profileLikeStates[post.id] ?? { liked: Boolean(post.isLiked), count: Number(post.likeCount ?? 0) };
    const next = { liked: !previous.liked, count: Math.max(0, previous.count + (previous.liked ? -1 : 1)) };
    setProfileLikeStates(current => ({ ...current, [post.id]: next }));
    try {
      const response = await fetch(`/api/posts/${post.id}/${previous.liked ? "unlike" : "like"}`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Like failed");
    } catch {
      setProfileLikeStates(current => ({ ...current, [post.id]: previous }));
    }
  };

  const isMe = !params.userId || params.userId === "me" || parseInt(params.userId) === me?.id;
  const targetUserId = isMe ? me?.id : parseInt(params.userId || "0");

  useEffect(() => {
    setMembershipBenefits(null);
    if (!targetUserId) return;
    let cancelled = false;
    void fetch(`/api/live/membership-benefits/${targetUserId}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Üyelik rozetleri yüklenemedi.");
        return await response.json() as typeof membershipBenefits;
      })
      .then(result => {
        if (!cancelled) setMembershipBenefits(result);
      })
      .catch(error => {
        if (!cancelled) console.error("Profil üyelik hakları yüklenemedi:", error);
      });
    return () => { cancelled = true; };
  }, [targetUserId]);

  useEffect(() => {
    setProfileHasCommunity(false);
    if (!targetUserId || isMe) return;

    let cancelled = false;
    void fetch(`/api/communities/owner/${targetUserId}`, { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("Kullanıcının toplulukları yüklenemedi.");
        return await response.json() as Array<{ id: number }>;
      })
      .then(communities => {
        if (!cancelled) setProfileHasCommunity(communities.length > 0);
      })
      .catch(error => {
        if (!cancelled) console.error("Profil topluluğu yüklenemedi:", error);
      });

    return () => { cancelled = true; };
  }, [targetUserId, isMe]);

  const { data: storyGroups } = useListStories({
    query: { queryKey: getListStoriesQueryKey(), refetchOnMount: "always" },
  });

  useEffect(() => {
    if (!targetUserId || isMe || !me?.id) {
      setProfileControls({
        blocked: false,
        restricted: false,
        postsHidden: false,
        blockedByMe: false,
        blockedByThem: false,
      });
      return;
    }

    const controller = new AbortController();
    setProfileControlsLoading(true);
    fetch(`/api/users/${targetUserId}/controls`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error("Profil tercihleri yüklenemedi");
        return response.json();
      })
      .then((controls: typeof profileControls) => setProfileControls(controls))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast({ title: "Profil tercihleri yüklenemedi", variant: "destructive" });
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileControlsLoading(false);
      });

    return () => controller.abort();
  }, [targetUserId, isMe, me?.id, toast]);

  const updateProfileControl = async (
    control: "blocked" | "restricted" | "postsHidden",
    enabled: boolean,
  ) => {
    if (!targetUserId || profileControlSaving) return;
    setProfileControlSaving(true);
    try {
      const response = await fetch(`/api/users/${targetUserId}/controls`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control, enabled }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Profil tercihi kaydedilemedi");
      setProfileControls(current => ({
        ...current,
        [control]: enabled,
        ...(control === "blocked" ? { blockedByMe: enabled } : {}),
      }));
      setProfileMenuOpen(false);
      toast({
        title: control === "blocked"
          ? enabled ? "Kullanıcı engellendi" : "Engel kaldırıldı"
          : control === "restricted"
            ? enabled ? "Kullanıcı kısıtlandı" : "Kısıtlama kaldırıldı"
            : enabled ? "Paylaşımlar gizlendi" : "Paylaşımlar yeniden gösteriliyor",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Profil tercihi kaydedilemedi",
        variant: "destructive",
      });
    } finally {
      setProfileControlSaving(false);
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/profile/${targetUserId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.displayName ?? "Profil"} · Loop`,
          text: `@${profile?.username ?? ""} profilini görüntüle`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Profil bağlantısı kopyalandı" });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Profil paylaşılamadı", variant: "destructive" });
    }
    setProfileMenuOpen(false);
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${targetUserId}`);
      toast({ title: "Profil bağlantısı kopyalandı" });
      setProfileMenuOpen(false);
    } catch {
      toast({ title: "Bağlantı kopyalanamadı", description: "Tarayıcı pano erişimine izin vermedi.", variant: "destructive" });
    }
  };

  const submitProfileReport = async () => {
    if (!targetUserId || !profileReportReason.trim() || profileReportSending) return;
    setProfileReportSending(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: targetUserId,
          targetType: "user",
          reason: profileReportReason.trim(),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Şikayet gönderilemedi");
      setProfileReportOpen(false);
      setProfileMenuOpen(false);
      toast({ title: "Şikayetin incelemeye gönderildi" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Şikayet gönderilemedi",
        variant: "destructive",
      });
    } finally {
      setProfileReportSending(false);
    }
  };

  const { data: profile, isLoading: profileLoading } = useGetUser(targetUserId || 0, {
    query: { queryKey: getGetUserQueryKey(targetUserId || 0), enabled: !!targetUserId },
  });
  const profilePrivacy = profile as typeof profile & {
    isPrivateAccount?: boolean;
    canViewPrivateContent?: boolean;
    isFollowRequestPending?: boolean;
  };
  const privateProfileLocked = !isMe
    && Boolean(profilePrivacy?.isPrivateAccount && !profilePrivacy.canViewPrivateContent);
  const profileWithIntroVideo = profile as typeof profile & {
    role?: string;
    profileIntroVideoUrl?: string | null;
    profileIntroVideoTransparencyMode?: "auto" | "none" | "green" | "white";
    profileIntroVideoEdgeFade?: boolean;
  };
  const profileIntroVideoUrl = profileWithIntroVideo?.profileIntroVideoUrl;
  const canManageProfileIntroVideo = isMe
    && (me?.role === "brand" || profileWithIntroVideo?.role === "brand" || membershipBenefits?.canUseProfileIntroVideo === true);

  useEffect(() => {
    const canShowProfileIntroVideo = profileWithIntroVideo?.role === "brand" || membershipBenefits?.canUseProfileIntroVideo === true;
    if (!profileWithIntroVideo || isMe || !canShowProfileIntroVideo || !profileIntroVideoUrl) {
      setProfileIntroVideoOpen(false);
      introVideoSeenProfileId.current = null;
      return;
    }
    if (introVideoSeenProfileId.current === profileWithIntroVideo.id) return;
    introVideoSeenProfileId.current = profileWithIntroVideo.id;
    const bannerRect = profileBannerRef.current?.getBoundingClientRect();
    if (bannerRect) {
      setProfileIntroOrigin({
        x: bannerRect.left + bannerRect.width / 2 - window.innerWidth / 2,
        y: bannerRect.top + bannerRect.height / 2 - window.innerHeight * 0.75,
      });
    } else {
      setProfileIntroOrigin({ x: 0, y: 0 });
    }
    setProfileIntroVideoOpen(true);
  }, [profileWithIntroVideo?.id, profileWithIntroVideo?.role, profileIntroVideoUrl, isMe, membershipBenefits?.canUseProfileIntroVideo]);

  useEffect(() => {
    setIntroVideoTransparencyMode(profileWithIntroVideo?.profileIntroVideoTransparencyMode ?? "auto");
    setIntroVideoEdgeFade(profileWithIntroVideo?.profileIntroVideoEdgeFade ?? true);
  }, [
    profileWithIntroVideo?.id,
    profileWithIntroVideo?.profileIntroVideoTransparencyMode,
    profileWithIntroVideo?.profileIntroVideoEdgeFade,
  ]);
  const profileDecorationData = profile as typeof profile & {
    badge?: string | null;
    badgeLabel?: string | null;
    avatarFrame?: string | null;
    badgeAssetId?: number | null;
    emblemAssetId?: number | null;
    avatarFrameAssetId?: number | null;
    badgeAssetUrl?: string | null;
    emblemAssetUrl?: string | null;
    avatarFrameAssetUrl?: string | null;
    avatarFrameTransform?: { x: number; y: number; scale: number } | null;
  };
  const profileDecoration = {
    ...profileDecorationData,
    badge: profileDecorationData?.badge ?? membershipBenefits?.badge ?? null,
    badgeLabel: profileDecorationData?.badgeLabel ?? membershipBenefits?.badgeLabel ?? null,
    badgeAssetUrl: profileDecorationData?.badgeAssetUrl ?? membershipBenefits?.badgeAssetUrl ?? null,
  };
  const membershipBadgeColor = profileDecoration.badgeLabel?.startsWith("Altın Tik") ? "text-amber-400" : "text-sky-500";
  const hasActiveStory = Boolean(profile?.id && storyGroups?.some(group => group.user.id === profile.id && group.hasUnviewed));
  const hasStoryFrame = hasActiveStory && Boolean(profileDecoration.avatarFrameAssetUrl);
  const [authoredBooks, setAuthoredBooks] = useState<any[]>([]);

  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    fetch("/api/books", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then((books: any[]) => {
        if (cancelled || !Array.isArray(books)) return;
        setAuthoredBooks(books.filter(book =>
          book.authorId === targetUserId ||
          book.author?.id === targetUserId ||
          book.author?.username === profile?.username,
        ));
      })
      .catch(() => { if (!cancelled) setAuthoredBooks([]); });
    return () => { cancelled = true; };
  }, [targetUserId, profile?.username]);

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
    setSelectedPostId(null);
    if (tab === "reels" && mediaPosts === null && !mediaLoading) {
      setMediaLoading(true);
      try {
        const loopsResponse = await fetch("/api/loop/photos", { credentials: "include", cache: "no-store" });
        const loops = loopsResponse.ok ? await loopsResponse.json() : [];
        const profileLoops = Array.isArray(loops)
          ? loops.filter((loop: any) => Number(loop.sender?.id) === Number(targetUserId)).map((loop: any) => ({
              id: 1000000 + Number(loop.id),
              sourceId: Number(loop.id),
              content: loop.title || "Loop",
              mediaUrl: loop.mediaUrl,
              mediaItems: Array.isArray(loop.mediaItems)
                ? loop.mediaItems.map((item: string | { url?: string }) => typeof item === "string" ? item : item.url).filter((url: unknown): url is string => typeof url === "string" && url.length > 0)
                : [loop.mediaUrl],
              mediaType: loop.mediaType || "video",
              viewCount: Number(loop.views ?? 0),
              likeCount: Number(loop.likeCount ?? 0),
              commentCount: Number(loop.commentCount ?? 0),
              user: loop.sender,
              isLoop: true,
            }))
          : [];
        setMediaPosts(profileLoops);
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

  useEffect(() => {
    document.body.style.overflow = selectedPostId === null ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [selectedPostId]);

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  // Bio-only edit
  const [bioOpen, setBioOpen] = useState(false);
  const [bioText, setBioText] = useState("");
  const [bioSaving, setBioSaving] = useState(false);

  // Avatar options menu
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [frameAdjustOpen, setFrameAdjustOpen] = useState(false);
  const [frameTransformSaving, setFrameTransformSaving] = useState(false);
  const [frameTransform, setFrameTransform] = useState({ x: 0, y: 0, scale: 1 });
  const legacyFrameMigrationRef = useRef(new Set<number>());
  const frameDragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);

  // kept for backward compat (Spotify etc.)
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileIntroVideoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!targetUserId || !profileDecoration) return;
    if (profileDecoration.avatarFrameTransform) {
      setFrameTransform(profileDecoration.avatarFrameTransform);
      if (isMe) localStorage.removeItem(`loop-frame-transform-${targetUserId}`);
      return;
    }
    if (!isMe) {
      setFrameTransform({ x: 0, y: 0, scale: 1 });
      return;
    }
    try {
      const saved = localStorage.getItem(`loop-frame-transform-${targetUserId}`);
      const legacyTransform = saved ? parseAvatarFrameTransform(JSON.parse(saved)) : null;
      if (!legacyTransform) {
        setFrameTransform({ x: 0, y: 0, scale: 1 });
        return;
      }
      setFrameTransform(legacyTransform);
      if (legacyFrameMigrationRef.current.has(targetUserId)) return;
      legacyFrameMigrationRef.current.add(targetUserId);
      void (async () => {
        try {
          const response = await fetch("/api/users/me/avatar-frame-transform", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(legacyTransform),
          });
          const result = await response.json() as { error?: string };
          if (!response.ok) throw new Error(result.error || "Eski çerçeve yerleşimi aktarılamadı.");
          localStorage.removeItem(`loop-frame-transform-${targetUserId}`);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId) }),
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
          ]);
          toast({ title: "Kayıtlı çerçeve yerleşimin hesabına aktarıldı" });
        } catch (error) {
          legacyFrameMigrationRef.current.delete(targetUserId);
          toast({
            title: error instanceof Error ? error.message : "Eski çerçeve yerleşimi aktarılamadı.",
            variant: "destructive",
          });
        }
      })();
    } catch { setFrameTransform({ x: 0, y: 0, scale: 1 }); }
  }, [targetUserId, isMe, profileDecoration?.avatarFrameTransform?.x, profileDecoration?.avatarFrameTransform?.y, profileDecoration?.avatarFrameTransform?.scale, queryClient, toast]);

  useEffect(() => {
    if (!targetUserId || !isMe || !frameAdjustOpen) return;
    localStorage.setItem(`loop-frame-transform-${targetUserId}`, JSON.stringify(frameTransform));
  }, [frameAdjustOpen, frameTransform, isMe, targetUserId]);

  const saveFrameTransform = async () => {
    if (!isMe || frameTransformSaving) return;
    setFrameTransformSaving(true);
    try {
      const response = await fetch("/api/users/me/avatar-frame-transform", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frameTransform),
      });
      const result = await response.json() as { avatarFrameTransform?: typeof frameTransform; error?: string };
      if (!response.ok) throw new Error(result.error || "Çerçeve konumu kaydedilemedi.");
      localStorage.removeItem(`loop-frame-transform-${targetUserId}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) }),
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
      ]);
      setFrameAdjustOpen(false);
      toast({ title: "Çerçeve yerleşimi kaydedildi" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Çerçeve konumu kaydedilemedi", variant: "destructive" });
    } finally {
      setFrameTransformSaving(false);
    }
  };

  const handleFramePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameAdjustOpen) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    frameDragRef.current = { x: event.clientX, y: event.clientY, startX: frameTransform.x, startY: frameTransform.y };
  };
  const handleFramePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = frameDragRef.current;
    if (!drag) return;
    setFrameTransform(current => ({ ...current, x: Math.max(-42, Math.min(42, drag.startX + event.clientX - drag.x)), y: Math.max(-42, Math.min(42, drag.startY + event.clientY - drag.y)) }));
  };
  const handleFramePointerEnd = () => { frameDragRef.current = null; };

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
        credentials: "include",
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
      const r = await fetch("/api/users/me/questions", { credentials: "include" });
      const data = await r.json();
      setMyQuestions(Array.isArray(data) ? data : []);
    } catch { setMyQuestions([]); }
    finally { setMyQLoading(false); }
  };

  // PB butonu — sol üst banner köşesi
  const [pbPressed, setPbPressed] = useState(false);
  const [pbLoading, setPbLoading] = useState(false);
  const [pbCount, setPbCount] = useState<number | null>(null);
  const [pbCountOpen, setPbCountOpen] = useState(false);
  const [pbHologramVisible, setPbHologramVisible] = useState(false);
  const pbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!targetUserId) return;
    fetch(`/api/users/${targetUserId}/profile-like-count`)
      .then(r => r.json())
      .then(d => setPbCount(d.count ?? 0))
      .catch(() => setPbCount(0));
    fetch(`/api/users/${targetUserId}/pb-status`)
      .then(r => r.json())
      .then(d => setPbPressed(d.pressed ?? false))
      .catch(() => {});
  }, [targetUserId]);

  const showPbHologram = () => {
    setPbHologramVisible(true);
    if (pbTimerRef.current) clearTimeout(pbTimerRef.current);
    pbTimerRef.current = setTimeout(() => setPbHologramVisible(false), 4500);
  };

  const handlePBClick = async () => {
    if (pbLoading) return;
    if (pbPressed) { showPbHologram(); return; }
    setPbLoading(true);
    try {
      const r = await fetch(`/api/users/${targetUserId}/like-profile`, { method: "POST" });
      if (r.ok) {
        setPbPressed(true);
        setPbCount(c => (c ?? 0) + 1);
      }
    } catch {}
    finally { setPbLoading(false); }
    showPbHologram();
  };

  // Change password
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Pano mesajı (thought)
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [thoughtSaving, setThoughtSaving] = useState(false);
  const [lockMenuOpen, setLockMenuOpen] = useState(false);

  const handleSaveThought = async () => {
    setThoughtSaving(true);
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought: thoughtText }),
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setThoughtOpen(false);
      toast({ title: "Pano mesajı güncellendi" });
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    setThoughtSaving(false);
  };

  // Profil fotoğrafı önizleme (uzun basış)
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const avatarLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAvatarPress = () => {
    avatarLongPressRef.current = setTimeout(() => { if (profile?.avatarUrl) setAvatarPreviewOpen(true); }, 500);
  };
  const cancelAvatarPress = () => {
    if (avatarLongPressRef.current) { clearTimeout(avatarLongPressRef.current); avatarLongPressRef.current = null; }
  };

  // Öne çıkanlar (highlights) — localStorage kalıcı
  const [highlightAddOpen, setHighlightAddOpen] = useState(false);
  const [highlightAppendToId, setHighlightAppendToId] = useState<number | null>(null);
  const [highlightCoverEditId, setHighlightCoverEditId] = useState<number | null>(null);
  const [highlightLabel, setHighlightLabel] = useState("");
  const [highlightCaption, setHighlightCaption] = useState("");
  const [highlightImageUrl, setHighlightImageUrl] = useState<string | null>(null);
  const [highlightMediaType, setHighlightMediaType] = useState<"image" | "video">("image");
  const [highlightImageUploading, setHighlightImageUploading] = useState(false);
  const highlightImageRef = useRef<HTMLInputElement>(null);
  const [highlightViewOpen, setHighlightViewOpen] = useState(false);
  const [highlightStoryIdx, setHighlightStoryIdx] = useState(0);
  const [highlightItemIdx, setHighlightItemIdx] = useState(0);
  const [highlightProgress, setHighlightProgress] = useState(0);
  const [highlightVideoDuration, setHighlightVideoDuration] = useState<number | null>(null);
  const [highlightPaused, setHighlightPaused] = useState(false);
  const [highlightMuted, setHighlightMuted] = useState(true);
  const [highlightViewers, setHighlightViewers] = useState<any[]>([]);
  const [highlightViewersOpen, setHighlightViewersOpen] = useState(false);
  const [highlightStatsById, setHighlightStatsById] = useState<Record<string, { likeCount: number; viewerCount: number; replyCount: number; likedByMe: boolean }>>({});
  const [highlightRepliesById, setHighlightRepliesById] = useState<Record<string, any[]>>({});
  const [highlightPinnedReplies, setHighlightPinnedReplies] = useState<Record<string, any[]>>({});
  const [highlightRepliesOpen, setHighlightRepliesOpen] = useState(false);
  const [highlightReplyText, setHighlightReplyText] = useState("");
  const highlightAnimationRef = useRef<number | null>(null);
  const highlightStartedAtRef = useRef(0);
  const highlightPausedProgressRef = useRef(0);
  const highlightVideoRef = useRef<HTMLVideoElement | null>(null);
  const [customHighlights, setCustomHighlights] = useState<Array<{ id?: number; label: string; imageUrl?: string; mediaType?: string; caption?: string; mediaItems?: Array<{ mediaUrl: string; mediaType?: string }>; likes: number; likedByMe: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem("loop_highlights") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    if (!targetUserId) return;
    fetch(`/api/users/${targetUserId}/highlights`, { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setCustomHighlights(data.map((item: any) => ({ id: item.id, label: item.label, imageUrl: item.mediaUrl, mediaType: item.mediaType, caption: item.caption, mediaItems: item.mediaItems, likes: 0, likedByMe: false }))); })
      .catch(() => {});
  }, [targetUserId]);

  // Tüm highlight'lar (custom önce, sonra statik)
  const allHighlights = useMemo(() => [
    ...customHighlights.map(h => ({ ...h, isCustom: true as const })),
  ], [customHighlights]);
  const allHighlightsRef = useRef(allHighlights);
  allHighlightsRef.current = allHighlights;

  // Keep the progress bar tied to real elapsed time for smooth motion.
  useEffect(() => {
    if (!highlightViewOpen) {
      if (highlightAnimationRef.current !== null) cancelAnimationFrame(highlightAnimationRef.current);
      return;
    }
    if (highlightPaused) {
      if (highlightAnimationRef.current !== null) cancelAnimationFrame(highlightAnimationRef.current);
      return;
    }
    const current = allHighlightsRef.current[highlightStoryIdx] as any;
    const isVideo = current?.mediaItems?.[highlightItemIdx]?.mediaType === "video";
    const duration = 5000;
    const video = highlightVideoRef.current;
    const mediaDuration = highlightVideoDuration ?? (video?.duration && Number.isFinite(video.duration) ? video.duration * 1000 : duration);
    const totalDuration = mediaDuration || 5000;
    highlightStartedAtRef.current = performance.now() - (highlightPausedProgressRef.current / 100) * totalDuration;
    const animate = (now: number) => {
      const videoProgress = isVideo && highlightVideoRef.current && Number.isFinite(highlightVideoRef.current.duration) && highlightVideoRef.current.duration > 0
        ? (highlightVideoRef.current.currentTime / highlightVideoRef.current.duration) * 100
        : null;
      const next = Math.min(videoProgress ?? (((now - highlightStartedAtRef.current) / totalDuration) * 100), 100);
      setHighlightProgress(next);
      if (next >= 100) {
        highlightPausedProgressRef.current = 0;
        const itemCount = allHighlightsRef.current[highlightStoryIdx]?.mediaItems?.length || 1;
        if (highlightItemIdx + 1 < itemCount) setHighlightItemIdx(itemIdx => itemIdx + 1);
        else {
          setHighlightItemIdx(0);
          setHighlightStoryIdx(idx => {
            const nextIdx = idx + 1;
            if (nextIdx >= allHighlightsRef.current.length) { setHighlightViewOpen(false); return 0; }
            return nextIdx;
          });
        }
        return;
      }
      highlightAnimationRef.current = requestAnimationFrame(animate);
    };
    highlightAnimationRef.current = requestAnimationFrame(animate);
    return () => { if (highlightAnimationRef.current !== null) cancelAnimationFrame(highlightAnimationRef.current); };
  }, [highlightViewOpen, highlightStoryIdx, highlightItemIdx, highlightPaused, highlightVideoDuration]);

  useEffect(() => {
    if (highlightViewOpen) { setHighlightProgress(0); highlightPausedProgressRef.current = 0; setHighlightVideoDuration(null); }
  }, [highlightViewOpen, highlightStoryIdx, highlightItemIdx]);

  useEffect(() => {
    const video = highlightVideoRef.current;
    if (!video) return;
    if (highlightPaused) video.pause();
    else void video.play().catch(() => {});
  }, [highlightPaused, highlightStoryIdx, highlightViewOpen]);

  const currentHighlightStateKey = (() => {
    const current = allHighlights[highlightStoryIdx] as any;
    return `${Number(current?.id ?? 0)}:${highlightItemIdx}`;
  })();

  const currentHighlightStats = highlightStatsById[currentHighlightStateKey] ?? { likeCount: 0, viewerCount: 0, replyCount: 0, likedByMe: false };

  useEffect(() => {
    const current = allHighlights[highlightStoryIdx] as any;
    if (!highlightViewOpen || !current?.id) return;
    void fetch(`/api/highlights/${current.id}/view`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaItemIndex: highlightItemIdx }) });
    void fetch(`/api/highlights/${current.id}/stats?mediaItemIndex=${highlightItemIdx}`, { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data) return;
        setHighlightStatsById(prev => ({
          ...prev,
          [currentHighlightStateKey]: {
            likeCount: Number(data.likeCount ?? 0),
            viewerCount: Number(data.viewerCount ?? 0),
            replyCount: Number(data.replyCount ?? 0),
            likedByMe: Boolean(data.likedByMe),
          },
        }));
      })
      .catch(() => {});
    void fetch(`/api/highlights/${current.id}/pinned-replies?mediaItemIndex=${highlightItemIdx}`, { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => setHighlightPinnedReplies(prev => ({ ...prev, [currentHighlightStateKey]: Array.isArray(data) ? data : [] })))
      .catch(() => setHighlightPinnedReplies(prev => ({ ...prev, [currentHighlightStateKey]: [] })));
  }, [highlightViewOpen, highlightStoryIdx, highlightItemIdx, allHighlights, currentHighlightStateKey]);

  const toggleHighlightLike = async () => {
    const current = allHighlights[highlightStoryIdx] as any;
    if (!current?.id) return;
    const response = await fetch(`/api/highlights/${current.id}/like`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaItemIndex: highlightItemIdx }) });
    if (response.ok) {
      const data = await response.json();
      setHighlightStatsById(prev => {
        const currentStats = prev[currentHighlightStateKey] ?? { likeCount: 0, viewerCount: 0, replyCount: 0, likedByMe: false };
        return {
          ...prev,
          [currentHighlightStateKey]: {
            ...currentStats,
            likedByMe: data.liked,
            likeCount: Math.max(0, currentStats.likeCount + (data.liked ? 1 : -1)),
          },
        };
      });
    }
  };

  const loadHighlightReplies = async () => {
    const current = allHighlights[highlightStoryIdx] as any;
    if (!current?.id) return;
    setHighlightPaused(true);
    setHighlightViewersOpen(false);
    const response = await fetch(`/api/highlights/${current.id}/replies?mediaItemIndex=${highlightItemIdx}`, { credentials: "include", cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      const mapped = Array.isArray(data) ? data : [];
      setHighlightRepliesById(prev => ({ ...prev, [currentHighlightStateKey]: mapped }));
      setHighlightPinnedReplies(prev => ({ ...prev, [currentHighlightStateKey]: mapped.filter((reply: any) => reply.pinned) }));
    }
    setHighlightRepliesOpen(true);
  };

  const toggleHighlightReplyPin = async (replyId: number) => {
    const current = allHighlights[highlightStoryIdx] as any;
    if (!current?.id || !isMe) return;
    const response = await fetch(`/api/highlights/${current.id}/replies/${replyId}/pin`, { method: "POST", credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    setHighlightRepliesById(prev => ({
      ...prev,
      [currentHighlightStateKey]: (prev[currentHighlightStateKey] ?? []).map(reply => reply.id === replyId ? { ...reply, pinned: data.pinned } : reply),
    }));
    const currentReply = (highlightRepliesById[currentHighlightStateKey] ?? []).find(reply => reply.id === replyId) ?? {};
    setHighlightPinnedReplies(prev => {
      const list = prev[currentHighlightStateKey] ?? [];
      const next = data.pinned
        ? [...list.filter(reply => reply.id !== replyId), { ...currentReply, id: replyId, pinned: true }]
        : list.filter(reply => reply.id !== replyId);
      return { ...prev, [currentHighlightStateKey]: next };
    });
  };

  const sendHighlightReply = async () => {
    const current = allHighlights[highlightStoryIdx] as any;
    const content = highlightReplyText.trim();
    if (!current?.id || !content) return;
    const response = await fetch(`/api/highlights/${current.id}/replies`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, mediaItemIndex: highlightItemIdx }) });
    if (response.ok) {
      setHighlightReplyText("");
      setHighlightStatsById(prev => ({
        ...prev,
        [currentHighlightStateKey]: {
          ...((prev[currentHighlightStateKey] ?? { likeCount: 0, viewerCount: 0, replyCount: 0, likedByMe: false })),
          replyCount: ((prev[currentHighlightStateKey]?.replyCount ?? 0) + 1),
        },
      }));
      await loadHighlightReplies();
    }
  };

  const loadHighlightViewers = async () => {
    const current = allHighlights[highlightStoryIdx] as any;
    if (!current?.id) return;
    setHighlightPaused(true);
    setHighlightRepliesOpen(false);
    const response = await fetch(`/api/highlights/${current.id}/viewers?mediaItemIndex=${highlightItemIdx}`, { credentials: "include", cache: "no-store" });
    if (response.ok) { setHighlightViewers(await response.json()); setHighlightViewersOpen(true); }
    else { setHighlightViewers([]); setHighlightViewersOpen(true); }
  };

  const handleHighlightImageSelect = async (file: File) => {
    setHighlightImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (r.ok) { const { url, mediaType } = await r.json(); setHighlightImageUrl(url); setHighlightMediaType(mediaType === "video" ? "video" : "image"); }
    } catch {}
    setHighlightImageUploading(false);
  };

  const addHighlight = async () => {
    if (!highlightImageUrl) return;
    const mediaType = highlightMediaType;
    if (highlightCoverEditId) {
      const response = await fetch(`/api/highlights/${highlightCoverEditId}/cover`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaUrl: highlightImageUrl, mediaType }) });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast({ title: "Kapak kaydedilemedi", description: error?.error || "Oturumunu veya sahiplik iznini kontrol et.", variant: "destructive" });
        return;
      }
      const saved = await response.json();
      setCustomHighlights(current => current.map(item => item.id === highlightCoverEditId ? { ...item, imageUrl: saved.mediaUrl, mediaType: saved.mediaType } : item));
      setHighlightImageUrl(null);
      setHighlightMediaType("image");
      setHighlightCoverEditId(null);
      setHighlightAddOpen(false);
      toast({ title: "Kapak fotoğrafı güncellendi" });
      return;
    }
    if (!highlightAppendToId && !highlightLabel.trim()) return;
    const endpoint = highlightAppendToId ? `/api/highlights/${highlightAppendToId}/items` : "/api/highlights";
    const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(highlightAppendToId ? { mediaUrl: highlightImageUrl, mediaType } : { mediaUrl: highlightImageUrl, mediaType, label: highlightLabel, caption: highlightCaption }) });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      toast({ title: "Öne çıkan kaydedilemedi", description: error?.error || "Lütfen tekrar dene.", variant: "destructive" });
      return;
    }
    const saved = await response.json();
    if (highlightAppendToId) {
      setCustomHighlights(current => current.map(item => item.id === highlightAppendToId ? { ...item, mediaItems: saved.mediaItems } : item));
    } else {
      setCustomHighlights(current => [{ id: saved.id, label: saved.label, imageUrl: saved.mediaUrl, mediaType: saved.mediaType, caption: saved.caption, mediaItems: saved.mediaItems, likes: 0, likedByMe: false }, ...current]);
    }
    setHighlightLabel("");
    setHighlightCaption("");
    setHighlightImageUrl(null);
    setHighlightMediaType("image");
    setHighlightAppendToId(null);
    setHighlightCoverEditId(null);
    setHighlightAddOpen(false);
    toast({ title: "Öne çıkan eklendi" });
  };

  const toggleStoredHighlightLike = (idx: number) => {
    const updated = customHighlights.map((h, i) => {
      if (i !== idx) return h;
      return { ...h, likedByMe: !h.likedByMe, likes: h.likedByMe ? h.likes - 1 : h.likes + 1 };
    });
    setCustomHighlights(updated);
    localStorage.setItem("loop_highlights", JSON.stringify(updated));
  };

  // Pano board
  const [panoSheetOpen, setPanoSheetOpen] = useState(false);
  const [panoMessages, setPanoMessages] = useState<any[]>([]);
  const [panoInput, setPanoInput] = useState("");
  const [panoSending, setPanoSending] = useState(false);
  const [panoReplyOpen, setPanoReplyOpen] = useState<number | null>(null);
  const [panoReplyText, setPanoReplyText] = useState("");
  const [panoReplies, setPanoReplies] = useState<Record<number, any[]>>({});

  const loadPanoMessages = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const r = await fetch(`/api/users/${targetUserId}/pano`);
      const data = await r.json();
      if (Array.isArray(data)) setPanoMessages(data);
    } catch {}
  }, [targetUserId]);

  useEffect(() => { loadPanoMessages(); }, [loadPanoMessages]);

  const sendPanoMessage = async () => {
    if (!panoInput.trim() || !targetUserId) return;
    setPanoSending(true);
    try {
      const r = await fetch(`/api/users/${targetUserId}/pano`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: panoInput.trim() }),
      });
      if (r.ok) {
        setPanoInput("");
        loadPanoMessages();
      }
    } catch {} finally { setPanoSending(false); }
  };

  const togglePanoLike = async (msgId: number) => {
    const r = await fetch(`/api/pano/${msgId}/like`, { method: "POST", credentials: "include" });
    if (r.ok) {
      const { liked } = await r.json();
      setPanoMessages(prev => prev.map(m => m.id === msgId ? { ...m, likeCount: m.likeCount + (liked ? 1 : -1), isLiked: liked } : m));
    }
  };

  const loadPanoReplies = async (msgId: number) => {
    const r = await fetch(`/api/pano/${msgId}/replies`);
    if (r.ok) { const data = await r.json(); setPanoReplies(prev => ({ ...prev, [msgId]: data })); }
    setPanoReplyOpen(msgId);
  };

  const sendPanoReply = async (msgId: number) => {
    if (!panoReplyText.trim()) return;
    await fetch(`/api/pano/${msgId}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: panoReplyText.trim() }),
    });
    setPanoReplyText("");
    loadPanoReplies(msgId);
    setPanoMessages(prev => prev.map(m => m.id === msgId ? { ...m, replyCount: (m.replyCount ?? 0) + 1 } : m));
  };

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

  const handleFollowToggle = async () => {
    if (!profile) return;
    if (profilePrivacy?.isFollowRequestPending) {
      try {
        const response = await fetch(`/api/users/${profile.id}/follow-request`, {
          method: "DELETE",
          credentials: "include",
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Takip isteği iptal edilemedi");
        await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(profile.id) });
        toast({ title: "Takip isteği iptal edildi" });
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Takip isteği iptal edilemedi",
          variant: "destructive",
        });
      }
      return;
    }
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
    setEditCity((profile as any)?.locationCity ?? "");
    setEditCountry((profile as any)?.locationCountry ?? "");
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName, bio: editBio, locationCity: editCity, locationCountry: editCountry }),
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

  const handleProfileIntroVideoUpload = async (file: File) => {
    if (!canManageProfileIntroVideo) return;
    if (!["video/mp4", "video/webm"].includes(file.type) || file.size > 20 * 1024 * 1024) {
      toast({
        title: "Desteklenmeyen video",
        description: "En fazla 20 MB boyutunda MP4 veya WebM seç.",
        variant: "destructive",
      });
      return;
    }

    setProfileIntroVideoSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/users/me/profile-intro-video", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Video yüklenemedi");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profil giriş videosu kaydedildi" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Video yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setProfileIntroVideoSaving(false);
      if (profileIntroVideoInputRef.current) profileIntroVideoInputRef.current.value = "";
    }
  };

  const saveProfileIntroVideoSettings = async () => {
    if (!canManageProfileIntroVideo) return;
    setProfileIntroVideoSaving(true);
    try {
      const response = await fetch("/api/users/me/profile-intro-video/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transparencyMode: introVideoTransparencyMode,
          edgeFade: introVideoEdgeFade,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Animasyon ayarları kaydedilemedi");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profil giriş animasyonu ayarları kaydedildi" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Animasyon ayarları kaydedilemedi",
        variant: "destructive",
      });
    } finally {
      setProfileIntroVideoSaving(false);
    }
  };

  const removeProfileIntroVideo = async () => {
    setProfileIntroVideoSaving(true);
    try {
      const response = await fetch("/api/users/me/profile-intro-video", {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Video kaldırılamadı");
      await queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(targetUserId || 0) });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profil giriş videosu kaldırıldı" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Video kaldırılamadı",
        variant: "destructive",
      });
    } finally {
      setProfileIntroVideoSaving(false);
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
      <div className="w-full max-w-full overflow-x-hidden pb-24 bg-background">

        <div className={selectedPostId !== null ? "hidden" : ""}>

        {/* ── Banner — full-width, rounded bottom corners, clickable to upload ── */}
        {isMe && (
          <input ref={bannerInputRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }} />
        )}
        <div
          ref={profileBannerRef}
          className={`relative w-full overflow-visible rounded-b-2xl ${bannerUrl && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(bannerUrl) ? "bg-black" : "bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-950"} ${isMe ? "cursor-pointer" : ""}`}
          style={{ height: "220px" }}
          onClick={() => isMe && bannerInputRef.current?.click()}
        >
          <div className="absolute inset-0 overflow-hidden rounded-b-2xl">
            {bannerUrl ? (
              /\.(mp4|webm|mov|ogg)(\?|$)/i.test(bannerUrl) ? (
                <video
                  src={bannerUrl}
                  className="loop-autoplay-video absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  onLoadStart={(event) => { delete event.currentTarget.dataset.playing; }}
                  onPlaying={(event) => revealVideoAfterFrame(event.currentTarget)}
                />
              ) : (
                <img src={bannerUrl} alt="Kapak" className="absolute inset-0 h-full w-full object-cover" />
              )
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-violet-950 via-purple-700 to-fuchsia-500" />
            )}

            {/* Gradient fade at bottom */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/15" />
          </div>

          {/* Tap hint for own profile */}
          {isMe && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-2">
                <Video className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-semibold">Fotoğraf veya video ekle</span>
              </div>
            </div>
          )}

          {isMe ? (
            <Link
              href="/community"
              onClick={event => event.stopPropagation()}
              aria-label="Topluluk sunucularım"
              title="Topluluk sunucularım"
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-xl transition hover:bg-black/50 active:scale-95"
            >
              <Users className="h-4 w-4" />
            </Link>
          ) : (
            <div className="absolute right-4 top-4 z-30">
              {profileHasCommunity && (
                <Link
                  href={`/community?ownerId=${profile.id}`}
                  onClick={event => event.stopPropagation()}
                  aria-label={`${profile.displayName} topluluğunu görüntüle`}
                  title="Topluluğu görüntüle"
                  className="absolute right-14 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-xl transition hover:bg-black/50 active:scale-95"
                >
                  <Users className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  setProfileMenuOpen(open => !open);
                }}
                aria-label="Profil seçenekleri"
                aria-expanded={profileMenuOpen}
                className="relative z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-lg backdrop-blur-xl transition hover:bg-black/60 active:scale-95"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {profileMenuOpen && (
                <div
                  role="menu"
                  aria-label="Profil seçenekleri"
                  onClick={event => event.stopPropagation()}
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 max-w-[calc(100vw-2rem)] overflow-visible rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-2xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setProfileMenuOpen(false); setProfileAboutOpen(true); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                  >
                    <CircleHelp className="h-4 w-4 text-muted-foreground" /> Bu hesap hakkında
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyProfileLink()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground" /> Profil URL’sini kopyala
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void shareProfile()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" /> Profili paylaş
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={profileControls.postsHidden}
                    disabled={profileControlSaving || profileControlsLoading}
                    onClick={() => void updateProfileControl("postsHidden", !profileControls.postsHidden)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                  >
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> {profileControls.postsHidden ? "Paylaşımlarını göster" : "Paylaşımlarını gizle"}
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={profileControls.restricted}
                    disabled={profileControlSaving || profileControlsLoading}
                    onClick={() => void updateProfileControl("restricted", !profileControls.restricted)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-500" /> {profileControls.restricted ? "Kısıtlamayı kaldır" : "Kısıtla"}
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={profileControls.blocked}
                    disabled={profileControlSaving || profileControlsLoading}
                    onClick={() => {
                      if (profileControls.blocked || window.confirm(`@${profile.username} hesabını engellemek istiyor musun? Bu hesap sana mesaj gönderemez ve profilini göremez.`)) {
                        void updateProfileControl("blocked", !profileControls.blocked);
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" /> {profileControls.blocked ? "Engeli kaldır" : "Engelle"}
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setProfileReportReason("Spam");
                      setProfileReportOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                  >
                    <Flag className="h-4 w-4" /> Profili şikâyet et
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PB sayacı */}
          {isMe && profile && (
            <div className="absolute left-4 top-4 z-30">
              <button
                type="button"
                aria-label="Profil beğeni sayısını göster"
                aria-expanded={pbCountOpen}
                title="Profil beğeni sayısı"
                onClick={(event) => {
                  event.stopPropagation();
                  setPbCountOpen((open) => !open);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-[13px] border border-cyan-200/40 bg-black/45 text-sm font-black tracking-wide text-cyan-100 shadow-lg backdrop-blur-xl transition hover:bg-black/60 active:scale-95"
              >
                PB
              </button>
              {pbCountOpen && (
                <div
                  role="status"
                  className="absolute right-0 top-[calc(100%+0.5rem)] whitespace-nowrap rounded-xl border border-cyan-200/30 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-xl backdrop-blur-xl"
                >
                  PB: {(pbCount ?? 0).toLocaleString("tr-TR")}
                </div>
              )}
            </div>
          )}
          {!isMe && profile && (
            <button
              onClick={e => { e.stopPropagation(); handlePBClick(); }}
              disabled={pbLoading}
              className="absolute top-4 left-4 z-20 active:scale-90 transition-transform select-none"
              style={{
                width: 48, height: 48,
                borderRadius: 13,
                background: pbPressed
                  ? "rgba(34,211,238,0.14)"
                  : "rgba(255,255,255,0.13)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: pbPressed
                  ? "1.5px solid rgba(34,211,238,0.55)"
                  : "1.5px solid rgba(255,255,255,0.30)",
                boxShadow: pbPressed
                  ? "0 0 12px rgba(34,211,238,0.30), 0 4px 18px rgba(0,0,0,0.22)"
                  : "0 4px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: pbLoading ? "wait" : "pointer",
              }}
            >
              <span style={{
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: "0.05em",
                color: pbPressed ? "#67e8f9" : "rgba(255,255,255,0.93)",
                textShadow: pbPressed
                  ? "0 0 8px #22d3ee"
                  : "0 1px 4px rgba(0,0,0,0.45)",
                userSelect: "none",
              }}>PB</span>
            </button>
          )}

        </div>

        {/* ── Avatar row: overlaps banner bottom ── */}
        <div className="relative z-10 px-5 flex items-end gap-4 -mt-18 mb-1">
          {/* Avatar + "+" overlay */}
          <div className="relative flex-shrink-0">
            {isMe && (
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            )}
            <div
              data-story-user-id={profile.id}
              className={`relative w-36 h-36 rounded-full border-[5px] border-background shadow-2xl overflow-hidden bg-muted cursor-pointer select-none ${hasActiveStory ? hasStoryFrame ? "" : "story-avatar-ring" : profileDecoration.avatarFrame === "violet" ? "story-highlight-profile-ring" : profileDecoration.avatarFrame === "gold" ? "ring-4 ring-amber-400" : profileDecoration.avatarFrame === "cyan" ? "ring-4 ring-cyan-400" : profileDecoration.avatarFrame === "rose" ? "ring-4 ring-rose-400" : ""}`}
              onPointerDown={handleFramePointerDown}
              onPointerMove={handleFramePointerMove}
              onPointerUp={handleFramePointerEnd}
              onPointerCancel={handleFramePointerEnd}
              style={frameAdjustOpen ? { touchAction: "none" } : undefined}
              onTouchStart={frameAdjustOpen ? undefined : startAvatarPress}
              onTouchEnd={frameAdjustOpen ? undefined : cancelAvatarPress}
              onTouchMove={frameAdjustOpen ? undefined : cancelAvatarPress}
              onMouseDown={frameAdjustOpen ? undefined : startAvatarPress}
              onMouseUp={frameAdjustOpen ? undefined : cancelAvatarPress}
              onMouseLeave={frameAdjustOpen ? undefined : cancelAvatarPress}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-violet-400/30 flex items-center justify-center">
                  <span className="text-5xl font-black text-primary">{profile.displayName.charAt(0)}</span>
                </div>
              )}
            </div>
            {profileDecoration.avatarFrameAssetUrl && (
              <NormalizedFrame src={profileDecoration.avatarFrameAssetUrl} isReferenceFrame={profileDecoration.avatarFrameAssetId === 1} offsetX={frameTransform.x} offsetY={frameTransform.y} scale={frameTransform.scale} />
            )}
            {hasStoryFrame && !isMe && (
              <svg
                aria-hidden="true"
                className="story-frame-infinity"
                viewBox="0 0 48 24"
                fill="none"
              >
                <path
                  d="M24 12C14 0 3 1 3 12s11 12 21 0 21-12 21 0-11 12-21 0Z"
                  pathLength="100"
                  stroke="url(#story-frame-infinity-gradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="14 6"
                />
                <defs>
                  <linearGradient id="story-frame-infinity-gradient" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#facc15" />
                    <stop offset=".25" stopColor="#ef4444" />
                    <stop offset=".5" stopColor="#172554" />
                    <stop offset=".75" stopColor="#7c3aed" />
                    <stop offset="1" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
            )}
            {/* Purple "+" button — bottom-right of avatar, overlapping */}
            {isMe && (
              <button
                onClick={() => {
                  setEditDisplayName(profile?.displayName ?? "");
                  setEditUsername(profile?.username ?? "");
                  setAvatarMenuOpen(true);
                }}
                className="absolute bottom-1 right-1 z-20 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 active:scale-95 transition-all border-[3px] border-background"
              >
                <Plus className="w-5 h-5 text-primary-foreground stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {isMe && profileDecoration.avatarFrameAssetUrl && frameAdjustOpen && (
          <div className="mx-5 mt-3 rounded-2xl border border-cyan-200/20 bg-slate-950/5 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Çerçeveyi yerleştir</p>
                <p className="text-[11px] text-muted-foreground">Avatarın üzerinde parmağınla sürükle</p>
              </div>
              <button type="button" onClick={() => void saveFrameTransform()} disabled={frameTransformSaving} className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{frameTransformSaving ? "Kaydediliyor..." : "Bitti"}</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-[11px] font-semibold text-muted-foreground">Yatay
                <input type="range" min="-42" max="42" value={frameTransform.x} onChange={event => setFrameTransform(current => ({ ...current, x: Number(event.target.value) }))} className="mt-1 w-full accent-cyan-500" />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">Dikey
                <input type="range" min="-42" max="42" value={frameTransform.y} onChange={event => setFrameTransform(current => ({ ...current, y: Number(event.target.value) }))} className="mt-1 w-full accent-cyan-500" />
              </label>
            </div>
            <label className="mt-2 block text-[11px] font-semibold text-muted-foreground">Boyut
              <input type="range" min="0.8" max="1.3" step="0.01" value={frameTransform.scale} onChange={event => setFrameTransform(current => ({ ...current, scale: Number(event.target.value) }))} className="mt-1 w-full accent-violet-500" />
            </label>
            <button type="button" onClick={() => setFrameTransform({ x: 0, y: 0, scale: 1 })} className="mt-3 text-[11px] font-bold text-cyan-600 hover:text-cyan-500">Varsayılan konuma dön</button>
          </div>
        )}

        {/* ── Name section — fully below avatar ── */}
        <div className="px-5 mt-3 space-y-1.5">
          {/* Display name + verified */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{profile.displayName}</h1>
            {profileDecoration.badgeAssetUrl && <img src={profileDecoration.badgeAssetUrl} alt="" className="inline-block h-5 w-5 object-contain" />}
            {!profileDecoration.badgeAssetUrl && profileDecoration.badge && profileDecoration.badge !== "none" && (
              <BadgeCheck aria-label={profileDecoration.badgeLabel || profileDecoration.badge} className={`h-5 w-5 shrink-0 ${membershipBadgeColor}`} />
            )}
            {profileDecoration.emblemAssetUrl && <img src={profileDecoration.emblemAssetUrl} alt="" className="inline-block h-5 w-5 object-contain" />}
            {profileDecoration.badgeLabel && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{profileDecoration.badgeLabel}</span>}
          </div>

          {/* Username */}
          <p className="text-[15px] text-muted-foreground">@{profile.username}</p>

          {/* Location + date */}
          {!privateProfileLocked && <div className="flex items-center gap-5 text-[13px] text-muted-foreground pt-0.5">
            {((profile as any).locationCity || (profile as any).locationCountry) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary/70" />
                {[((profile as any).locationCity || "").trim(), ((profile as any).locationCountry || "").trim()].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary/70" />
              {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : "Tarih bilinmiyor"}
            </span>
          </div>}
        </div>

        {privateProfileLocked ? (
          <section className="mx-4 mt-5 rounded-2xl border border-border bg-card px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Eye className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-lg font-bold">Özel hesap</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Bu hesabın paylaşımlarını görmek için hesabı takip et.
            </p>
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={followMutation.isPending || unfollowMutation.isPending}
              className="mt-5 rounded-xl bg-foreground px-6 py-3 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {profile.isFollowing ? "Takiptesin" : profilePrivacy?.isFollowRequestPending ? "İstek gönderildi · İptal et" : "Takip Et"}
            </button>
          </section>
        ) : (
          <>
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
            <button onClick={openFollowers} className="flex flex-col items-center py-4 gap-1 hover:bg-muted/40 transition-colors rounded-l-2xl"><span className="profile-stat-value text-2xl font-black">{profile.followerCount}</span><div className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3" /><span>{t("followers")}</span></div></button>
            <button onClick={openFollowing} className="flex flex-col items-center py-4 gap-1 hover:bg-muted/40 transition-colors"><span className="profile-stat-value text-2xl font-black">{profile.followingCount}</span><div className="flex items-center gap-1 text-xs text-muted-foreground"><Plus className="w-3 h-3" /><span>{t("following")}</span></div></button>
            <div className="flex flex-col items-center py-4 gap-1"><span className="profile-stat-value text-2xl font-black">{postCount}</span><div className="flex items-center gap-1 text-xs text-muted-foreground"><LayoutGrid className="w-3 h-3" /><span>{t("posts")}</span></div></div>
            <div className="flex flex-col items-center py-4 gap-1"><span className="profile-stat-value text-2xl font-black">{(profile as any).likeCount ?? 0}</span><div className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="w-3 h-3" /><span>{t("likes")}</span></div></div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mx-4 mt-3 flex gap-2">
          {isMe ? <>
            <button type="button" onClick={openEdit} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity shadow-md">Profili Düzenle</button>
            <button type="button" onClick={() => {}} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"><MessageCircle className="w-4 h-4" />Mesaj</button>
          </> : <>
            <button type="button" onClick={() => void handleFollowToggle()} disabled={followMutation.isPending || unfollowMutation.isPending} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors shadow-md ${profile.isFollowing ? "border border-border text-foreground hover:bg-muted/80" : "bg-foreground text-background hover:opacity-90"}`}>{profile.isFollowing ? "Takiptesin" : profilePrivacy?.isFollowRequestPending ? "İstek gönderildi · İptal et" : "Takip Et"}</button>
            <button type="button" onClick={() => setLocation(`/dm/${profile.id}`)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"><MessageCircle className="w-4 w-4" />Mesaj</button>
          </>}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setPanoMenuOpen(open => !open)}
              aria-expanded={panoMenuOpen}
              aria-label="Pano seçenekleri"
              className="h-full min-h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${panoMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {panoMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                {isMe && (
                  <button
                    type="button"
                    onClick={() => { setPanoMenuOpen(false); setThoughtText((profile as any)?.thought ?? ""); setThoughtOpen(true); }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    Pano mesajı yaz
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setPanoMenuOpen(false); setPanoSheetOpen(true); }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Pano mesajlarını gör
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Eserler vitrini ── */}
        {authoredBooks.length > 0 && (
          <section className="mx-4 mt-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <div>
                  <h2 className="text-xs font-black">Eserler</h2>
                  <p className="text-[10px] text-muted-foreground">Yayınlanan kitaplar</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">{authoredBooks.length} eser</span>
            </div>
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {authoredBooks.map((book: any) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setLocation(`/kitap/${book.id}`)}
                  className="group relative h-40 w-28 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-muted text-left shadow-sm transition-transform active:scale-[0.98]"
                >
                  {book.cover ? (
                    <img src={book.cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-500">
                      <BookOpen className="h-8 w-8 text-white/70" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8">
                    <p className="truncate text-xs font-bold text-white">{book.title || "İsimsiz eser"}</p>
                    <p className="mt-0.5 truncate text-[9px] text-white/75">{book.genres?.[0] || "Kitap"}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Anılar — yalnızca gerçek kullanıcı içerikleri ── */}
        {(isMe || customHighlights.length > 0) && (
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
          <div className="flex gap-2 overflow-x-auto pb-3 px-1 hide-scrollbar">
            {/* ── Yeni Anı ekle — en sol ── */}
            {isMe && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-1">
                        <button
                          onClick={() => { setHighlightLabel(""); setHighlightAppendToId(null); setHighlightAddOpen(true); }}
                  className="group relative flex h-[148px] w-[108px] items-center justify-center overflow-hidden rounded-xl border border-violet-200/25 bg-gradient-to-br from-[#24133d] via-[#160f2d] to-[#0b0a18] shadow-[0_12px_28px_rgba(76,29,149,0.28),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all hover:-translate-y-1 hover:border-violet-200/70 hover:shadow-[0_16px_34px_rgba(109,40,217,0.38),inset_0_1px_0_rgba(255,255,255,0.16)]"
                >
                  <div className="absolute inset-[3px] rounded-[0.7rem] border border-white/10" />
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-300/10 to-transparent" />
                  <div className="relative flex flex-col items-center gap-2 text-violet-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-200/45 bg-white/[0.08] shadow-[0_0_24px_rgba(167,139,250,0.24)] transition-transform duration-300 group-hover:scale-110">
                      <Plus className="h-6 w-6 stroke-[1.8]" />
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-100/85">Yeni ekle</span>
                    <span className="text-[8px] font-medium tracking-[0.08em] text-white/40">ÖNE ÇIKAN</span>
                  </div>
                </button>
              </div>
            )}
            {customHighlights.map((h, i) => (
              <div key={`custom-${i}`} className="group flex-shrink-0 cursor-pointer transition-transform hover:-translate-y-1"
                onClick={() => { setHighlightStoryIdx(i); setHighlightItemIdx(0); setHighlightPaused(false); setHighlightViewOpen(true); }}>
                <div className="relative h-[148px] w-[108px] overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-[0_10px_26px_rgba(15,23,42,0.2)] ring-1 ring-primary/20 transition-all group-hover:ring-primary/60">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-fuchsia-500/20 opacity-70" />
                  <div className="absolute inset-[3px] overflow-hidden rounded-[0.75rem]">
                    {h.imageUrl
                      ? h.mediaType === "video"
                        ? <video src={h.imageUrl} muted loop playsInline className="h-full w-full object-cover" />
                        : <img src={h.imageUrl} alt={h.label} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center bg-muted"><Star className="h-6 w-6 text-muted-foreground/40" /></div>
                    }
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-2 pb-2 pt-9">
                    <p className="truncate text-[11px] font-bold tracking-tight text-white">{h.label}</p>
                    {h.caption && <p className="mt-0.5 truncate text-[8px] font-normal leading-none text-white/60" title={h.caption}>{h.caption}</p>}
                  </div>
                  {isMe && (
                    <div className="absolute right-2 bottom-2 z-10 flex items-center gap-1">
                      <button type="button" aria-label={`${h.label} kapağını değiştir`} onClick={(event) => { event.stopPropagation(); setHighlightImageUrl(null); setHighlightMediaType("image"); setHighlightCoverEditId(h.id ?? null); setHighlightAppendToId(null); setHighlightAddOpen(true); }} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`${h.label} içine ekle`} onClick={(event) => { event.stopPropagation(); setHighlightImageUrl(null); setHighlightMediaType("image"); setHighlightLabel(h.label); setHighlightCaption(""); setHighlightAppendToId(h.id ?? null); setHighlightCoverEditId(null); setHighlightAddOpen(true); }} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-primary"><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                  {h.mediaType === "video" && <span className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/35 px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">Video</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
        <div className="mx-4 mt-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-3 py-2 shadow-sm">
          {isMe ? (
            <button
              onClick={openMyQuestions}
              className="flex w-full items-center gap-2 text-left text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">🤖</span>
              <span className="flex-1">Anonim sorular</span>
              <span className="text-[11px] font-medium text-muted-foreground">Gelen Kutusu</span>
            </button>
          ) : (
            <button
              onClick={() => { setAnonQText(""); setAnonQOpen(true); }}
              className="flex w-full items-center gap-2 text-left text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">🤖</span>
              <span className="flex-1">Anonim soru sor</span>
              <span className="text-[11px] font-medium text-muted-foreground">Gizli</span>
            </button>
          )}
        </div>

          </>
        )}
        </div>

        {!privateProfileLocked && (
          <>
        {/* ── Tabs ── */}
        <div className={selectedPostId !== null ? "hidden" : "mt-5 px-4"}>
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-foreground/10 text-foreground hover:bg-foreground/15"
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
          {!isMe && (profileControls.blocked || profileControls.postsHidden) ? (
            <div className="mx-4 my-8 rounded-2xl border border-border bg-card px-5 py-8 text-center">
              {profileControls.blocked ? <Ban className="mx-auto h-8 w-8 text-destructive" /> : <EyeOff className="mx-auto h-8 w-8 text-muted-foreground" />}
              <p className="mt-3 text-sm font-bold">{profileControls.blocked ? "Bu kullanıcıyı engelledin" : "Bu kullanıcının paylaşımlarını gizledin"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{profileControls.blocked ? "Profiline ve sana gönderdiği mesajlara erişimi engellendi." : "Paylaşımları yalnızca senin profil görünümünde gizlendi."}</p>
              <button
                type="button"
                onClick={() => void updateProfileControl(profileControls.blocked ? "blocked" : "postsHidden", false)}
                disabled={profileControlSaving}
                className="mt-4 rounded-xl border border-border px-4 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
              >
                {profileControls.blocked ? "Engeli kaldır" : "Paylaşımları göster"}
              </button>
            </div>
          ) : currentLoading ? (
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
          ) : selectedPostId !== null ? (
            <div className="instagram-feed fixed inset-0 z-[70] mx-auto max-w-screen-md overflow-y-auto overscroll-contain bg-background px-0 pb-24 pt-0">
              <div className="sticky top-0 z-10 border-y border-border bg-background/95 shadow-md backdrop-blur-md">
                <div className="relative flex h-14 items-center justify-center border-b border-border/70 px-14">
                  <button
                    type="button"
                    onClick={() => setSelectedPostId(null)}
                    aria-label="Profil gönderilerine dön"
                    className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </button>
                  <h2 className="text-[22px] font-bold tracking-tight text-foreground">Gönderiler</h2>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.displayName || profile.username || "Profil"} className="h-11 w-11 shrink-0 rounded-full border-2 border-primary/30 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold text-foreground">
                      {(profile.displayName || profile.username || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <UserNameWithDecorations
                      user={profileDecoration}
                      className="text-[16px] font-bold text-foreground"
                      showLabel={Boolean(profileDecoration.badgeLabel)}
                    />
                    <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
                  </div>
                </div>
              </div>
              {currentPosts!.map((post: any) => (
                <div key={post.id} id={`profile-post-${post.id}`}>
                  <PostCard
                    post={post}
                    onViewRecorded={(postId, viewCount) => setProfileViewCounts(current => ({
                      ...current,
                      [postId]: Math.max(current[postId] ?? 0, viewCount),
                    }))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="grid grid-cols-3 gap-[2px] transition-all duration-200"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
              onTouchStart={onPinchStart}
              onTouchMove={onPinchMove}
              onTouchEnd={onPinchEnd}
            >
              {currentPosts.map((post: any) => {
                const imageUrl = post.backgroundUrl || post.mediaUrl || "";
                const isVideo = !post.backgroundUrl && (Boolean(post.mediaType && /video/i.test(post.mediaType)) || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(imageUrl));
                const usesContentCard = ["micro", "column", "poll"].includes(post.postType);
                const showMedia = Boolean(imageUrl) && (Boolean(post.backgroundUrl) || !usesContentCard);
                const text = getProfilePostText(post.content || "", post.postType).replace(/\s+/g, " ").trim() || "Yeni içerik";
                const preview = text.length > 88 ? `${text.slice(0, 85)}…` : text;
                const accents = [
                  "linear-gradient(135deg, #f7d7c8 0%, #9e7aea 45%, #1f2937 100%)",
                  "linear-gradient(135deg, #dbeafe 0%, #a78bfa 30%, #0f172a 100%)",
                  "linear-gradient(135deg, #fef3c7 0%, #f9a8d4 38%, #1f2937 100%)",
                  "linear-gradient(135deg, #d1fae5 0%, #67e8f9 35%, #111827 100%)",
                ];
                return (
                  <div
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (post.isLoop) {
                        setLocation(`/loops?loop=${post.sourceId}`);
                        return;
                      }
                      setSelectedPostId(post.id);
                      window.setTimeout(() => {
                        document.getElementById(`profile-post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 50);
                    }}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (post.isLoop) {
                          setLocation(`/loops?loop=${post.sourceId}`);
                          return;
                        }
                        setSelectedPostId(post.id);
                        window.setTimeout(() => {
                          document.getElementById(`profile-post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 50);
                      }
                    }}
                    className="group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-[0.35rem] bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {isVideo && showMedia ? (
                      <video
                        src={imageUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        onTimeUpdate={event => {
                          const video = event.currentTarget;
                          if (video.duration > 0 && video.currentTime / video.duration >= 0.8) recordProfileVideoView(post.id);
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : showMedia ? (
                      <img src={imageUrl} alt={text} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[0.85rem] border border-white/10 p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" style={{ background: accents[Math.abs(post.id) % accents.length] }}>
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_32%,rgba(15,23,42,0.35)_100%)]" />
                        <div className="relative flex items-center justify-between gap-2 text-[7.5px] text-white/80">
                          <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 backdrop-blur-sm">{post.user?.displayName?.split(" ")[0] || "Kullanıcı"}</span>
                          <span className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/15 px-1 py-0.5 backdrop-blur-sm"><Eye className="h-2.5 w-2.5" />{profileViewCounts[post.id] ?? post.viewCount ?? post.views ?? 0}</span>
                        </div>
                        <div className="relative mt-2 rounded-[0.8rem] border border-white/10 bg-black/15 p-2.5 backdrop-blur-[2px]">
                          <div className="mb-1.5 flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.18em] text-violet-200/90"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />{getProfilePostTypeLabel(post)}</div>
                          <p className="line-clamp-5 text-[10px] font-medium leading-[1.45] text-white/95">{preview}</p>
                          {post.postType === "poll" && Array.isArray(post.pollOptions) && (
                            <div className="mt-2 space-y-1">
                              {(post.pollOptions as string[]).slice(0, 3).map((option, index) => (
                                <div key={`${post.id}-poll-${index}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[8px] text-white/85">{option}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative mt-2 flex items-center justify-between text-[7px] text-white/75"><span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">{getProfilePostTypeLabel(post)}</span><span className="flex items-center gap-2"><button type="button" onClick={event => void toggleProfileLike(event, post)} className="flex items-center gap-0.5"><Heart className={`h-2.5 w-2.5 ${profileLikeStates[post.id]?.liked ? "fill-current text-rose-300" : ""}`} />{profileLikeStates[post.id]?.count ?? post.likeCount ?? 0}</button><span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" />{post.commentCount ?? 0}</span></span></div>
                      </div>
                    )}
                    {showMedia && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />}
                    {showMedia && <div className="absolute left-1.5 right-1.5 top-1.5 flex items-center justify-between"><span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[7.5px] font-semibold text-white/90 backdrop-blur-sm">{post.user?.displayName?.split(" ")[0] || "Kullanıcı"}</span><span className="flex items-center gap-1 rounded-full bg-black/25 px-1 py-0.5 text-[7.5px] text-white/90">{post.isLoop && post.mediaItems?.length > 1 && <span>{post.mediaItems.length} fotoğraf</span>}<span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{profileViewCounts[post.id] ?? post.viewCount ?? post.views ?? 0}</span></span></div>}
                    {showMedia && <div className="absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-1"><div className="min-w-0 flex-1"><p className="text-[7.5px] font-semibold text-white/90">{getProfilePostTypeLabel(post)}</p>{post.isLoop && <p className="truncate text-[7.5px] font-medium text-white/75">{text}</p>}</div><span className="flex items-center gap-2 rounded-full bg-black/20 px-1 py-0.5 text-[7.5px] text-white/90"><button type="button" onClick={event => void toggleProfileLike(event, post)} className="flex items-center gap-0.5"><Heart className={`h-2.5 w-2.5 ${profileLikeStates[post.id]?.liked ? "fill-current text-rose-300" : ""}`} />{profileLikeStates[post.id]?.count ?? post.likeCount ?? 0}</button><span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" />{post.commentCount ?? 0}</span></span></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* ── Takipçi / Takip Edilenler — Tam ekran (Instagram tarzı) ── */}
      {followDialogOpen && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center h-14 px-2 border-b border-border flex-shrink-0">
            <button
              onClick={() => { setFollowDialogOpen(false); setFollowersList([]); setFollowingList([]); }}
              className="p-2.5 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-base flex-1 text-center">{profile?.displayName}</span>
            <div className="w-10" />
          </div>

          {/* Tab çubuğu */}
          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => setFollowTab("followers")}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                followTab === "followers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Takipçi · {profile?.followerCount ?? 0}
            </button>
            <button
              onClick={() => setFollowTab("following")}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                followTab === "following" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Takip · {profile?.followingCount ?? 0}
            </button>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {followListLoading ? (
              <div className="space-y-0 divide-y divide-border">
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-11 h-11 rounded-full bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-muted animate-pulse rounded w-28" />
                      <div className="h-3 bg-muted animate-pulse rounded w-20" />
                    </div>
                    <div className="h-8 bg-muted animate-pulse rounded-full w-20" />
                  </div>
                ))}
              </div>
            ) : (followTab === "followers" ? followersList : followingList).length === 0 ? (
              <p className="text-center text-muted-foreground py-16 text-sm">
                {followTab === "followers" ? "Henüz takipçi yok" : "Henüz kimse takip edilmiyor"}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {(followTab === "followers" ? followersList : followingList).map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    {/* Avatar */}
                    <Link href={`/profile/${u.id}`} onClick={() => setFollowDialogOpen(false)} className="flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-primary/10 overflow-hidden border border-border">
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt={u.displayName} />
                          : <span className="w-full h-full flex items-center justify-center text-primary font-bold">{u.displayName?.charAt(0)}</span>}
                      </div>
                    </Link>

                    {/* İsim + kullanıcı adı */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate leading-tight">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>

                    {/* Aksiyon butonları */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Takip Et / Takiptesin — başkasının profilinde */}
                      {!isMe && (
                        <button
                          onClick={() => handleFollowToggleInList(u.id, !!u.isFollowing)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            u.isFollowing
                              ? "border border-border text-muted-foreground hover:bg-muted"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {u.isFollowing ? "Takipte" : "Takip Et"}
                        </button>
                      )}

                      {/* Kendi profilinde: Takip Et / Çıkar */}
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
                          {/* Karşılıklı takip yoksa "Sende Takip Et" göster */}
                          {!u.isFollowing && (
                            <button
                              onClick={() => handleFollowToggleInList(u.id, false)}
                              className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                            >
                              Sende Takip Et
                            </button>
                          )}
                          {u.isFollowing && (
                            <span className="px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground text-[10px] font-medium">
                              Karşılıklı
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveFollower(u.id)}
                            className="px-2.5 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Kaldır
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

            {profileDecoration.avatarFrameAssetUrl && (
              <button
                type="button"
                onClick={() => { setAvatarMenuOpen(false); setFrameAdjustOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-200/40 bg-cyan-50/40 hover:bg-cyan-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                  <Frame className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Çerçeveyi ayarla</p>
                  <p className="text-xs text-muted-foreground">Parmağınla taşı ve boyutunu düzenle</p>
                </div>
              </button>
            )}

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

      {/* ── Avatar Önizleme (uzun basış) ── */}
      {avatarPreviewOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center"
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <div className="relative max-w-sm w-full px-6">
            <img
              src={profile.avatarUrl ?? ""}
              alt={profile.displayName}
              className="w-full aspect-square object-cover rounded-full shadow-2xl border-4 border-white/20"
            />
            <button
              className="absolute top-2 right-8 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
              onClick={() => setAvatarPreviewOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Pano Mesajı Dialogu ── */}
      <Dialog open={thoughtOpen} onOpenChange={setThoughtOpen}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Pano Mesajı
            </DialogTitle>
            <DialogDescription>
              Profilinde görünecek kısa bir durum mesajı yaz
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={thoughtText}
              onChange={e => setThoughtText(e.target.value)}
              placeholder="Şu an ne düşünüyorsun? ✨"
              maxLength={80}
              className="rounded-xl"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">{thoughtText.length}/80</p>
            <div className="flex gap-3">
              <button
                onClick={() => setThoughtOpen(false)}
                disabled={thoughtSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveThought}
                disabled={thoughtSaving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {thoughtSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Öne Çıkan Ekle Dialogu ── */}
      <input ref={highlightImageRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleHighlightImageSelect(f); e.target.value = ""; }} />
      <Dialog open={highlightAddOpen} onOpenChange={o => { setHighlightAddOpen(o); if (!o) { setHighlightImageUrl(null); setHighlightMediaType("image"); setHighlightLabel(""); setHighlightCaption(""); setHighlightAppendToId(null); setHighlightCoverEditId(null); } }}>
        <DialogContent className="rounded-3xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {highlightCoverEditId ? "Kapak Fotoğrafını Değiştir" : highlightAppendToId ? "Öne Çıkanı Güncelle" : "Öne Çıkan Ekle"}
            </DialogTitle>
            <DialogDescription>{highlightCoverEditId ? "Galeriden veya bu öne çıkan içindeki gönderilerden bir kapak seç" : highlightAppendToId ? "Bu karta yeni bir gönderi ekle" : "Profilinde polaroid kartı olarak gösterilecek"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Image upload */}
            <button
              onClick={() => highlightImageRef.current?.click()}
              disabled={highlightImageUploading}
              className="w-full h-36 rounded-2xl border-2 border-dashed border-border overflow-hidden flex items-center justify-center relative hover:border-primary transition-colors"
            >
              {highlightImageUrl
                ? highlightMediaType === "video"
                  ? <video src={highlightImageUrl} muted playsInline controls className="w-full h-full object-cover" />
                  : <img src={highlightImageUrl} alt="" className="w-full h-full object-cover" />
                : highlightImageUploading
                  ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImagePlus className="w-8 h-8" />
                      <span className="text-sm font-medium">Galeriden fotoğraf veya video seç</span>
                    </div>
              }
              {highlightImageUrl && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-semibold bg-black/60 px-3 py-1 rounded-full">Değiştir</span>
                </div>
              )}
            </button>
            {highlightCoverEditId && (() => {
              const selectedHighlight = customHighlights.find(item => item.id === highlightCoverEditId);
              const coverChoices = selectedHighlight?.mediaItems?.length ? selectedHighlight.mediaItems : selectedHighlight?.imageUrl ? [{ mediaUrl: selectedHighlight.imageUrl, mediaType: selectedHighlight.mediaType }] : [];
              return coverChoices.length > 0 ? <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Bu öne çıkan içinden seç</p><span className="text-[10px] text-muted-foreground">{coverChoices.length} gönderi</span></div><div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">{coverChoices.map((item, index) => <button key={`${item.mediaUrl}-${index}`} type="button" onClick={() => { setHighlightImageUrl(item.mediaUrl); setHighlightMediaType(item.mediaType === "video" ? "video" : "image"); }} className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${highlightImageUrl === item.mediaUrl ? "border-primary ring-2 ring-primary/25" : "border-border"}`}>{item.mediaType === "video" ? <video src={item.mediaUrl} muted playsInline className="h-full w-full object-cover" /> : <img src={item.mediaUrl} alt={`Gönderi ${index + 1}`} className="h-full w-full object-cover" />}<span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[8px] text-white">{index + 1}</span></button>)}</div></div> : null;
            })()}
            {!highlightAppendToId && !highlightCoverEditId && <>
              <Input value={highlightLabel} onChange={e => setHighlightLabel(e.target.value)} placeholder="Başlık (örn: Anılarım 🌙)" maxLength={30} className="rounded-xl" autoFocus onKeyDown={e => e.key === "Enter" && addHighlight()} />
              <Textarea value={highlightCaption} onChange={e => setHighlightCaption(e.target.value)} placeholder="Açıklama ekle..." maxLength={500} rows={3} className="resize-none rounded-xl" />
            </>}
            <div className="flex gap-3">
              <button
                onClick={() => { setHighlightAddOpen(false); setHighlightImageUrl(null); setHighlightLabel(""); setHighlightCaption(""); setHighlightAppendToId(null); setHighlightCoverEditId(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={addHighlight}
                disabled={!highlightImageUrl || (!highlightAppendToId && !highlightCoverEditId && !highlightLabel.trim())}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {highlightCoverEditId ? "Kapağı Kaydet" : highlightAppendToId ? "Gönderiyi Ekle" : "Ekle"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(() => {
        const currentDisplayedHighlight = allHighlights[Math.min(highlightStoryIdx, allHighlights.length - 1)];
        const currentDisplayedHighlightId = Number(currentDisplayedHighlight?.id ?? 0);
        const currentDisplayedHighlightItemKey = `${currentDisplayedHighlightId}:${highlightItemIdx}`;
        const currentDisplayedHighlightReplies = currentDisplayedHighlightId
          ? (highlightRepliesById[currentDisplayedHighlightItemKey] ?? []).filter((reply: any) => Number(reply.highlightId ?? reply.highlight_id ?? currentDisplayedHighlightId) === currentDisplayedHighlightId)
          : [];
        const currentDisplayedHighlightPinnedReplies = currentDisplayedHighlightId
          ? (highlightPinnedReplies[currentDisplayedHighlightItemKey] ?? []).filter((reply: any) => {
              const replyHighlightId = Number(reply.highlightId ?? reply.highlight_id ?? currentDisplayedHighlightId);
              return replyHighlightId === currentDisplayedHighlightId && (reply.pinned === true || reply.is_pinned === true);
            })
          : [];
        return null;
      })()}

      {/* ── Highlight Stories Viewer ── */}
      {highlightViewOpen && allHighlights.length > 0 && (() => {
        const cur = allHighlights[Math.min(highlightStoryIdx, allHighlights.length - 1)];
        if (!cur) return null;
        const mediaItems = cur.mediaItems?.length ? cur.mediaItems : [{ mediaUrl: cur.imageUrl, mediaType: cur.mediaType }];
        const currentMedia = mediaItems[Math.min(highlightItemIdx, mediaItems.length - 1)];
        const mediaItemsFor = (highlight: any) => highlight.mediaItems?.length ? highlight.mediaItems : [{ mediaUrl: highlight.imageUrl, mediaType: highlight.mediaType }];
        const currentHighlightId = Number(cur?.id ?? 0);
        const currentHighlightStateKey = `${currentHighlightId}:${highlightItemIdx}`;
        const currentHighlightPinnedReplies = currentHighlightId
          ? (highlightPinnedReplies[currentHighlightStateKey] ?? []).filter((reply: any) => {
              const replyHighlightId = Number(reply.highlightId ?? reply.highlight_id ?? currentHighlightId);
              return replyHighlightId === currentHighlightId && (reply.pinned === true || reply.is_pinned === true);
            })
          : [];
        const currentHighlightReplies = currentHighlightId
          ? (highlightRepliesById[currentHighlightStateKey] ?? []).filter((reply: any) => Number(reply.highlightId ?? reply.highlight_id ?? currentHighlightId) === currentHighlightId)
          : [];
        const pinnedReplies = currentHighlightPinnedReplies.slice(0, 3);
        const goNext = () => {
          if (highlightItemIdx + 1 < mediaItems.length) {
            setHighlightItemIdx(index => index + 1);
            return;
          }
          setHighlightItemIdx(0);
          const next = highlightStoryIdx + 1;
          if (next >= allHighlights.length) { setHighlightViewOpen(false); return; }
          setHighlightStoryIdx(next);
        };
        const goPrev = () => {
          if (highlightItemIdx > 0) {
            setHighlightItemIdx(index => index - 1);
            return;
          }
          setHighlightStoryIdx(i => Math.max(0, i - 1));
          setHighlightItemIdx(0);
        };
        return (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col select-none">
            {/* Progress bars */}
            <div className="flex gap-1 px-3 pt-10 pb-2 z-10">
              {mediaItemsFor(cur).map((_: any, itemIndex: number) => {
                const isBefore = itemIndex < highlightItemIdx;
                const isCurrent = itemIndex === highlightItemIdx;
                return <div key={`${cur.id ?? highlightStoryIdx}-${itemIndex}`} className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full" style={{ width: isBefore ? "100%" : isCurrent ? `${highlightProgress}%` : "0%", background: "linear-gradient(90deg, #a855f7, #7c3aed, #c026d3)", boxShadow: isCurrent ? "0 0 8px 2px #a855f7aa" : undefined }} />
                </div>;
              })}
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 z-10">
              <Avatar className="w-9 h-9 ring-2 ring-white/60 flex-shrink-0">
                <AvatarImage src={(profile as any)?.avatarUrl || ""} />
                <AvatarFallback className="text-xs font-bold bg-primary/20 text-white">
                  {((profile as any)?.displayName ?? (profile as any)?.username ?? "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-white font-semibold text-sm truncate">{cur.label}</span>
              {currentMedia?.mediaType === "video" && (
                <button
                  type="button"
                  aria-label={highlightMuted ? "Videonun sesini aç" : "Videoyu sessize al"}
                  onClick={() => {
                    setHighlightMuted(muted => !muted);
                    void highlightVideoRef.current?.play().catch(() => {});
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                >
                  {highlightMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={() => setHighlightViewOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pinnedReplies.length > 0 && (
              <div className="pointer-events-none absolute left-4 top-[112px] z-30 h-36 w-[min(72%,300px)]">
                {pinnedReplies.map((reply: any, index: number) => (
                  <div
                    key={reply.id}
                    className="animate-highlight-reply-float-in absolute flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-white/20 border-l-2 border-l-amber-200/85 bg-black/45 px-2.5 py-1.5 text-white shadow-[0_6px_18px_rgba(0,0,0,0.24)] backdrop-blur-lg"
                    style={{
                      top: `${index * 44}px`,
                      left: `${[0, 24, 8][index] ?? 0}px`,
                      animationDelay: `${index * 110}ms`,
                    }}
                  >
                    <Avatar className="h-5 w-5 shrink-0 border border-white/35"><AvatarImage src={reply.avatarUrl || ""} /><AvatarFallback className="bg-white/15 text-[8px]">{reply.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="truncate text-[8px] font-semibold text-white/65">{reply.displayName || "Kullanıcı"}</p><p className="truncate text-[10px] leading-tight text-white/90">{reply.content}</p></div>
                  </div>
                ))}
              </div>
            )}

            {/* Content — tap left/right to navigate */}
            <div
              className="flex-1 relative overflow-hidden"
              onPointerDown={() => { highlightPausedProgressRef.current = highlightProgress; setHighlightPaused(true); }}
              onPointerUp={() => setHighlightPaused(false)}
              onPointerCancel={() => setHighlightPaused(false)}
              onPointerLeave={() => setHighlightPaused(false)}
            >
              {/* Tap zones */}
              <div className="absolute inset-0 flex z-10">
                <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
                <div className="flex-1 h-full" />
                <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
              </div>
              {/* Media */}
              {currentMedia?.mediaUrl
                ? currentMedia.mediaType === "video"
                  ? <video
                      ref={highlightVideoRef}
                      src={currentMedia.mediaUrl}
                      autoPlay
                      muted={highlightMuted}
                      playsInline
                      onLoadedMetadata={event => { if (event.currentTarget.duration > 0) { highlightPausedProgressRef.current = highlightProgress; setHighlightVideoDuration(event.currentTarget.duration * 1000); } }}
                      onTimeUpdate={event => { if (event.currentTarget.duration > 0 && highlightPaused) setHighlightProgress((event.currentTarget.currentTime / event.currentTarget.duration) * 100); }}
                      onEnded={goNext}
                      className="h-full w-full object-cover"
                    />
                  : <img src={currentMedia.mediaUrl} alt={cur.label} className="w-full h-full object-cover" />
                : <div className={`w-full h-full bg-gradient-to-b ${(cur as any).gradient ?? "from-violet-900 via-purple-700 to-indigo-600"}`} />
              }
            </div>

            {/* Bottom bar */}
            <div className="flex flex-col gap-3 px-4 py-4 pb-8 bg-gradient-to-t from-black/70 to-transparent">
              <div className="flex items-center gap-4 px-1 text-xs text-white/75">
                <button type="button" onClick={toggleHighlightLike} className={`flex items-center gap-1 ${currentHighlightStats.likedByMe ? "text-rose-300" : ""}`}><Heart className={`h-4 w-4 ${currentHighlightStats.likedByMe ? "fill-current" : ""}`} />{currentHighlightStats.likeCount}</button>
                <button type="button" onClick={loadHighlightReplies} className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{currentHighlightStats.replyCount}</button>
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{currentHighlightStats.viewerCount}</span>
              </div>
              {cur.isCustom && isMe && (
                <div className="flex w-full gap-2">
                  <button onClick={loadHighlightViewers} className="flex-1 rounded-xl border border-white/20 px-3 py-2 text-white text-xs font-semibold"><Eye className="mr-1 inline h-3.5 w-3.5" />İzleyenler</button>
                  <button onClick={loadHighlightReplies} className="flex-1 rounded-xl border border-white/20 px-3 py-2 text-white text-xs font-semibold"><MessageCircle className="mr-1 inline h-3.5 w-3.5" />Yanıtlar</button>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Bu öne çıkanı silmek istediğinizden emin misiniz?")) return;
                      const idx = highlightStoryIdx;
                      const selected = customHighlights[idx];
                      if (selected?.id) await fetch(`/api/highlights/${selected.id}`, { method: "DELETE", credentials: "include" });
                      const updated = customHighlights.filter((_, i) => i !== idx);
                      setCustomHighlights(updated);
                      localStorage.setItem("loop_highlights", JSON.stringify(updated));
                      setHighlightViewersOpen(false);
                      setHighlightViewOpen(false);
                      toast({ title: "Öne çıkan silindi" });
                    }}
                    className="flex-1 rounded-xl border border-white/20 px-3 py-2 text-white/70 font-semibold text-xs hover:bg-white/10 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl w-[90vw] max-w-md">
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
            {canManageProfileIntroVideo && (
              <section className="space-y-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-3">
                <div>
                  <p className="text-sm font-bold">Profil giriş animasyonu</p>
                  <p className="text-xs text-muted-foreground">Ziyaretçiler profilini açtığında video sessiz oynar. 20 MB’a kadar MP4 veya WebM.</p>
                </div>
                {profileIntroVideoUrl && (
                  <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),rgba(0,0,0,0.22)_55%,rgba(0,0,0,0.58)_100%)]">
                    <ChromaKeyAnimation
                      src={profileIntroVideoUrl}
                      mimeType={profileIntroVideoUrl.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"}
                      muted
                      keyingSensitivity="high"
                      transparencyMode={introVideoTransparencyMode}
                      edgeFade={introVideoEdgeFade ? "top-bottom" : "none"}
                      className="profile-intro-preview-video live-gift-animation h-full w-full object-contain"
                    />
                  </div>
                )}
                <input
                  ref={profileIntroVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  className="hidden"
                  onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void handleProfileIntroVideoUpload(file);
                  }}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-semibold">
                    Yeşil ekran / şeffaflık
                    <select
                      value={introVideoTransparencyMode}
                      onChange={event => setIntroVideoTransparencyMode(event.target.value as typeof introVideoTransparencyMode)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal text-foreground"
                    >
                      <option value="auto">Otomatik (yeşil ve beyaz)</option>
                      <option value="green">Yeşil arka planı kaldır</option>
                      <option value="white">Beyaz arka planı kaldır</option>
                      <option value="none">Şeffaflaştırma yok</option>
                    </select>
                  </label>
                  <label className="flex min-h-10 items-center gap-2 self-end rounded-xl border border-border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={introVideoEdgeFade}
                      onChange={event => setIntroVideoEdgeFade(event.target.checked)}
                      className="h-4 w-4 accent-fuchsia-600"
                    />
                    Üst ve alt kenarları yumuşat
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={profileIntroVideoSaving}
                    onClick={() => profileIntroVideoInputRef.current?.click()}
                    className="min-h-10 flex-1 rounded-xl bg-fuchsia-600 px-3 text-sm font-bold text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
                  >
                    {profileIntroVideoSaving ? "Kaydediliyor..." : profileIntroVideoUrl ? "Videoyu değiştir" : "Giriş videosu ekle"}
                  </button>
                  <button
                    type="button"
                    disabled={profileIntroVideoSaving}
                    onClick={() => void saveProfileIntroVideoSettings()}
                    className="min-h-10 flex-1 rounded-xl border border-fuchsia-500/40 px-3 text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-500/10 disabled:opacity-50 dark:text-fuchsia-300"
                  >
                    Ayarları kaydet
                  </button>
                  {profileIntroVideoUrl && (
                    <button
                      type="button"
                      disabled={profileIntroVideoSaving}
                      onClick={() => void removeProfileIntroVideo()}
                      className="min-h-10 rounded-xl border border-border px-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              </section>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Eyalet / Bölge</label>
                <select
                  value={editCity}
                  onChange={event => setEditCity(event.target.value)}
                  disabled={!editCountry}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Eyalet / bölge seç</option>
                  {getCitiesForCountry(editCountry).map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Ülke</label>
                <select
                  value={editCountry}
                  onChange={event => { setEditCountry(event.target.value); setEditCity(""); }}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Ülke seç</option>
                  {COUNTRY_NAMES.map(country => <option key={country} value={country}>{country}</option>)}
                </select>
              </div>
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

      {/* ── Pano Board Bottom Sheet ── */}
      {panoSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0f0f0f]">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-white/10">
            <button
              onClick={() => setPanoSheetOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="flex-1 font-bold text-white text-base truncate">
              {profile?.username ?? ""}
            </span>
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={(profile as any)?.avatarUrl || ""} />
              <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                {(profile as any)?.displayName?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Input row */}
          {me && (
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
              <input
                value={panoInput}
                onChange={e => setPanoInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendPanoMessage()}
                placeholder="Bir gönderi paylaş..."
                maxLength={280}
                className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:bg-white/15 transition-colors"
              />
              <button
                onClick={sendPanoMessage}
                disabled={!panoInput.trim() || panoSending}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          )}

          {/* Message list */}
          <div className="flex-1 overflow-y-auto">
            {panoMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
                <span className="text-4xl">📋</span>
                <p className="text-sm">Henüz pano mesajı yok</p>
                {me && <p className="text-xs text-white/30">İlk mesajı yazan sen ol!</p>}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {panoMessages.map((msg) => (
                  <div key={msg.id} className="px-4 py-4">
                    {/* Post label */}
                    <p className="text-[11px] text-white/40 mb-2">
                      A post on {profile?.username}'s profile 😊
                    </p>
                    {/* User row */}
                    {msg.user && (
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage src={msg.user.avatarUrl || ""} />
                          <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                            {(msg.user.displayName || msg.user.username || "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-bold text-white text-sm">{msg.user.username ?? msg.user.displayName}</span>
                          <span className="text-white/40 text-xs ml-2">
                            ({msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: false, locale: tr }) : ""} önce)
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Content */}
                    <p className="text-white text-sm leading-relaxed mb-3">{msg.content}</p>
                    {/* Actions */}
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        onClick={() => panoReplyOpen === msg.id ? setPanoReplyOpen(null) : loadPanoReplies(msg.id)}
                        className="text-primary font-semibold text-xs hover:opacity-80 transition-opacity"
                      >
                        {(msg.replyCount ?? 0) > 0 ? `View ${msg.replyCount} Comment${msg.replyCount > 1 ? "s" : ""}` : "İlk cevabı yaz"}
                      </button>
                      <button
                        onClick={() => me && togglePanoLike(msg.id)}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${msg.isLiked ? "text-primary" : "text-white/50 hover:text-white"}`}
                      >
                        <span className="text-base leading-none">👍</span>
                        {msg.likeCount > 0 && <span>{msg.likeCount}</span>}
                      </button>
                      <button className="text-white/50 hover:text-white transition-colors text-xs">
                        <span className="text-base leading-none">😊</span>
                      </button>
                      <button className="text-white/50 hover:text-white transition-colors text-sm ml-auto leading-none">⋯</button>
                    </div>

                    {/* Reply thread */}
                    {panoReplyOpen === msg.id && (
                      <div className="mt-3 pl-3 border-l-2 border-white/10">
                        {(panoReplies[msg.id] ?? []).map((reply: any) => (
                          <div key={reply.id} className="flex gap-2 mb-3">
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarImage src={reply.user?.avatarUrl || ""} />
                              <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
                                {(reply.user?.username || "?").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-white/8 rounded-xl px-3 py-2">
                              <span className="font-semibold text-xs text-white">{reply.user?.username}</span>
                              <p className="text-xs text-white/70 mt-0.5">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                        {me && (
                          <div className="flex gap-2 mt-2">
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarImage src={me.avatarUrl || ""} />
                              <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">{me.displayName?.charAt(0) ?? "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex gap-1">
                              <input
                                value={panoReplyText}
                                onChange={e => setPanoReplyText(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && sendPanoReply(msg.id)}
                                placeholder="Yanıtla..."
                                className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:bg-white/15"
                              />
                              <button onClick={() => sendPanoReply(msg.id)} disabled={!panoReplyText.trim()}
                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                                <Send className="w-3 h-3 text-primary-foreground" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {highlightViewOpen && highlightViewersOpen && (
        <div className="fixed left-0 right-0 bottom-0 z-[80] mx-auto flex max-h-[82dvh] w-auto max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden rounded-t-[28px] border-t border-white/15 bg-slate-950/95 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:bottom-5 sm:left-3 sm:right-3 sm:max-h-[min(60vh,420px)] sm:max-w-md sm:rounded-3xl sm:border sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-sm font-bold">İzleyenler</p><p className="mt-0.5 text-[11px] text-white/45">Bu öne çıkanı izleyen hesaplar</p></div><button onClick={() => { setHighlightViewersOpen(false); setHighlightPaused(false); }} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white">Kapat</button></div>
          <div className="min-h-0 max-h-[calc(82dvh-82px)] flex-1 overflow-y-auto px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:max-h-[min(45vh,320px)]">
            {highlightViewers.length === 0 ? <div className="px-3 py-10 text-center"><Eye className="mx-auto mb-2 h-6 w-6 text-white/35" /><p className="text-xs text-white/55">Henüz izleyen yok.</p></div> : highlightViewers.map(viewer => <div key={viewer.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/[0.06]"><Avatar className="h-9 w-9"><AvatarImage src={viewer.avatarUrl || ""} /><AvatarFallback className="bg-white/10 text-xs">{viewer.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{viewer.displayName || "Kullanıcı"}</p><p className="truncate text-[11px] text-white/45">@{viewer.username || "kullanici"}</p></div><span className="shrink-0 text-[10px] text-white/40">{viewer.viewedAt ? formatDistanceToNow(new Date(viewer.viewedAt), { addSuffix: true, locale: tr }) : ""}</span></div>)}
          </div>
        </div>
      )}
      {highlightViewOpen && highlightRepliesOpen && (() => {
        const currentDisplayHighlight = allHighlights[Math.min(highlightStoryIdx, allHighlights.length - 1)];
        const currentDisplayHighlightId = Number(currentDisplayHighlight?.id ?? 0);
        const currentDisplayHighlightStateKey = `${currentDisplayHighlightId}:${highlightItemIdx}`;
        const currentDisplayHighlightReplies = currentDisplayHighlightId
          ? (highlightRepliesById[currentDisplayHighlightStateKey] ?? []).filter((reply: any) => {
              const replyHighlightId = Number(reply.highlightId ?? reply.highlight_id ?? currentDisplayHighlightId);
              const replyMediaItemIndex = Number(reply.mediaItemIndex ?? reply.media_item_index ?? highlightItemIdx);
              return replyHighlightId === currentDisplayHighlightId && replyMediaItemIndex === highlightItemIdx;
            })
          : [];
        return (
          <div className="fixed left-0 right-0 bottom-0 z-[80] mx-auto flex max-h-[82dvh] w-auto max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden rounded-t-[28px] border-t border-white/15 bg-slate-950/95 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:bottom-5 sm:left-3 sm:right-3 sm:max-h-[min(65vh,480px)] sm:max-w-md sm:rounded-3xl sm:border sm:shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-sm font-bold">Yanıtlar</p><p className="mt-0.5 text-[11px] text-white/45">Bu öne çıkan hakkında gelen yanıtlar</p></div><button onClick={() => { setHighlightRepliesOpen(false); setHighlightPaused(false); }} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white">Kapat</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-2">
              {currentDisplayHighlightReplies.length === 0 ? <div className="px-3 py-10 text-center"><MessageCircle className="mx-auto mb-2 h-6 w-6 text-white/35" /><p className="text-xs text-white/55">Henüz yanıt yok.</p></div> : currentDisplayHighlightReplies.map((reply: any) => <div key={reply.id} className="flex gap-3 border-b border-white/10 py-3 last:border-0"><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={reply.avatarUrl || ""} /><AvatarFallback className="bg-white/10 text-xs">{reply.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-xs font-semibold">{reply.displayName || "Kullanıcı"}</p><span className="shrink-0 text-[10px] text-white/35">{reply.createdAt ? formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: tr }) : ""}</span></div><p className="text-[11px] text-white/45">@{reply.username || "kullanici"}</p><p className="mt-1 break-words text-sm leading-relaxed text-white/80">{reply.content}</p>{isMe && <button type="button" onClick={() => void toggleHighlightReplyPin(reply.id)} className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${reply.pinned ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/55 hover:text-white"}`}><Bookmark className={`h-3 w-3 ${reply.pinned ? "fill-current" : ""}`} />{reply.pinned ? "Sabitlendi" : "Sabitle"}</button>}</div></div>)}
            </div>
            <div className="border-t border-white/10 bg-black/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1"><input value={highlightReplyText} onChange={event => setHighlightReplyText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void sendHighlightReply(); }} placeholder="Yanıt yaz..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs outline-none placeholder:text-white/35" /><button onClick={() => void sendHighlightReply()} disabled={!highlightReplyText.trim()} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">Gönder</button></div></div>
          </div>
        );
      })()}
      {/* ── PB hologram sayaç (fixed, banner dışında) ── */}
      {pbHologramVisible && !isMe && profile && (
        <div
          className="fixed top-16 left-4 z-50 pointer-events-none select-none"
          style={{
            opacity: pbHologramVisible ? 1 : 0,
            transform: pbHologramVisible ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.92)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
          }}
        >
          <div
            className="relative flex flex-col items-center px-5 py-3 rounded-2xl overflow-hidden"
            style={{
              background: "rgba(2,18,24,0.82)",
              border: "1.5px solid rgba(34,211,238,0.55)",
              boxShadow: "0 0 22px 6px rgba(34,211,238,0.32), 0 0 50px 10px rgba(6,182,212,0.16), inset 0 0 20px rgba(34,211,238,0.06)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            {/* Tarama çizgileri */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(34,211,238,0.05) 2px,rgba(34,211,238,0.05) 3px)" }} />
            {/* Üst ışık yansıması */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg,transparent,rgba(34,211,238,0.7),transparent)" }} />
            <span
              className="text-3xl font-black tabular-nums relative z-10"
              style={{
                color: "#22d3ee",
                textShadow: "0 0 6px #22d3ee, 0 0 18px #06b6d4, 0 0 36px #0e7490, 0 0 2px #fff",
                letterSpacing: "0.06em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {(pbCount ?? 0).toLocaleString("tr-TR")}
            </span>
            <span
              className="text-[10px] font-semibold mt-0.5 uppercase tracking-widest relative z-10"
              style={{ color: "#67e8f9", textShadow: "0 0 8px #06b6d4" }}
            >
              PB
            </span>
          </div>
        </div>
      )}

      <Dialog open={profileAboutOpen} onOpenChange={setProfileAboutOpen}>
        <DialogContent className="max-h-[85dvh] w-[92vw] max-w-md overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Bu hesap hakkında</DialogTitle>
            <DialogDescription>Loop profil bilgileri</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatarUrl || ""} />
              <AvatarFallback>{profile.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{profile.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Loop’a katılma</p>
              <p className="mt-1 text-sm font-bold">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long" }) : "Bilinmiyor"}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gönderiler</p>
              <p className="mt-1 text-sm font-bold">{postCount}</p>
            </div>
          </div>
          <div className="flex gap-2 rounded-xl border border-border p-3 text-xs text-muted-foreground">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span>{profile.followerCount} takipçi · {profile.followingCount} takip edilen</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setProfileAboutOpen(false);
              void copyProfileLink();
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-bold transition hover:bg-muted"
          >
            <Link2 className="h-4 w-4" /> Profil bağlantısını kopyala
          </button>
        </DialogContent>
      </Dialog>

      {profileIntroVideoOpen && profileIntroVideoUrl && profileWithIntroVideo && (
        <div
          className="profile-intro-overlay pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden text-white"
          style={{
            "--profile-intro-origin-x": `${profileIntroOrigin.x}px`,
            "--profile-intro-origin-y": `${profileIntroOrigin.y}px`,
          } as React.CSSProperties}
          role="dialog"
          aria-modal="false"
          aria-label={`${profile.displayName} profil giriş animasyonu`}
        >
          <div className="profile-intro-vignette absolute inset-0" />
          {profile.avatarUrl && (
            <img
              src={profile.avatarUrl}
              alt=""
              aria-hidden="true"
              className="profile-intro-ambient absolute left-1/2 top-1/2 h-[min(100vw,54rem)] w-[min(100vw,54rem)] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-20 blur-[100px]"
            />
          )}
          <div className="profile-intro-content absolute bottom-0 left-0 z-[1] flex h-1/2 w-full items-center justify-center">
            <ChromaKeyAnimation
              key={profileIntroVideoUrl}
              src={profileIntroVideoUrl}
              mimeType={profileIntroVideoUrl.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"}
              muted
              keyingSensitivity="high"
              transparencyMode={profileWithIntroVideo.profileIntroVideoTransparencyMode ?? "auto"}
              edgeFade={profileWithIntroVideo.profileIntroVideoEdgeFade === false ? "none" : "top-bottom"}
              onEnded={() => setProfileIntroVideoOpen(false)}
              onError={() => toast({ title: "Profil giriş videosu oynatılamadı", variant: "destructive" })}
              className="profile-intro-video live-gift-animation max-h-full max-w-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => setProfileIntroVideoOpen(false)}
            aria-label="Giriş videosunu kapat"
            className="pointer-events-auto absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/80 backdrop-blur-xl transition hover:bg-black/65 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <Dialog open={profileReportOpen} onOpenChange={open => {
        if (!profileReportSending) setProfileReportOpen(open);
      }}>
        <DialogContent className="w-[92vw] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" /> Profili şikâyet et
            </DialogTitle>
            <DialogDescription>@{profile.username} hesabını neden şikâyet ettiğini seç.</DialogDescription>
          </DialogHeader>
          <label className="block text-sm font-semibold" htmlFor="profile-report-reason">Şikâyet nedeni</label>
          <select
            id="profile-report-reason"
            value={profileReportReason}
            onChange={event => setProfileReportReason(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option>Spam</option>
            <option>Taciz veya zorbalık</option>
            <option>Uygunsuz içerik</option>
            <option>Sahte hesap</option>
            <option>Diğer</option>
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={() => setProfileReportOpen(false)} disabled={profileReportSending} className="min-h-11 flex-1 rounded-xl border border-border text-sm font-bold transition hover:bg-muted disabled:opacity-50">Vazgeç</button>
            <button type="button" onClick={() => void submitProfileReport()} disabled={profileReportSending || !profileReportReason.trim()} className="min-h-11 flex-1 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50">{profileReportSending ? "Gönderiliyor..." : "Şikâyeti gönder"}</button>
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
