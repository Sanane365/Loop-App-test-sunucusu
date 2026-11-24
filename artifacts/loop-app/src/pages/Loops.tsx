import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import {
  BadgeCheck,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Coins,
  Crown,
  Eye,
  Heart,
  Home,
  ImagePlus,
  MessageCircle,
  MoreVertical,
  Music2,
  Play,
  Plus,
  Radio,
  Repeat2,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Smile,
  Swords,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  X,
  Flag,
  Gift,
  Trash2,
  Trophy,
  User,
  Users,
  EyeOff,
  MessageSquare,
  Sparkles,
  Orbit,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { revealVideoAfterFrame } from "@/lib/video-visibility";
import { LoopsComposer } from "@/components/loops/LoopsComposer";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import GifPicker from "@/components/shared/GifPicker";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";
import { getStoredVideoMuted, storeVideoMuted } from "@/lib/video-preferences";
import { ChromaKeyAnimation } from "@/components/live/ChromaKeyAnimation";
import { getListStoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Loop = {
  id: number;
  user: {
    id?: number;
    username: string;
    displayName?: string;
    avatar: string;
    badge?: string | null;
    badgeAssetUrl?: string | null;
    emblemAssetUrl?: string | null;
    badgeLabel?: string | null;
  };
  title: string;
  caption: string;
  tags?: string;
  location: string;
  audio: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  repostFriends: string[];
  sourceId?: number;
  reposted?: boolean;
  repostCount?: number;
  cover: string;
  mediaItems?: string[];
  isVideo?: boolean;
  liked?: boolean;
};

const LOOPS: Loop[] = [];
type LiveStatus = "enabled" | "coming_soon" | "disabled";
type LiveBroadcast = {
  id: string;
  title: string;
  content: string;
  type: "chat" | "game";
  startedAt: string;
  viewerCount: number;
  endedAt?: string;
  user: {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
};
type LiveComment = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  replyTo?: { id: string; username: string } | null;
};
type LiveJoinRequest = {
  id: string;
  broadcastId: string;
  user: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
};
type LiveParticipant = LiveJoinRequest["user"];
type TransparencyMode = "auto" | "none" | "green" | "white";
type LiveGift = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  coverUrl?: string | null;
  coinValue?: number;
  transparencyMode?: TransparencyMode;
  edgeFade?: "none" | "top-bottom";
  published: boolean;
};
type LiveGiftEvent = {
  id: string;
  giftName: string;
  coinValue?: number;
  url: string;
  mimeType: string;
  transparencyMode?: TransparencyMode;
  edgeFade?: "none" | "top-bottom";
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  recipient?: LiveParticipant;
};
type LiveGiftToast = { id: string; gift: LiveGiftEvent; comboCount: number; expiresAt: number };

function useLiveGiftToasts(events: LiveGiftEvent[], enabled: boolean) {
  const [cards, setCards] = useState<LiveGiftToast[]>([]);
  const cardsRef = useRef<LiveGiftToast[]>([]);
  const queueRef = useRef<LiveGiftToast[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const comboRef = useRef<Map<string, { id: string; lastAt: number }>>(new Map());
  const timerRef = useRef<number | null>(null);
  const scheduleRef = useRef<() => void>(() => {});

  scheduleRef.current = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const nextExpiry = Math.min(...cardsRef.current.map((card) => card.expiresAt));
    if (!Number.isFinite(nextExpiry)) return;
    timerRef.current = window.setTimeout(() => {
      const now = Date.now();
      const nextCards = cardsRef.current.filter((card) => card.expiresAt > now);
      while (nextCards.length < 3 && queueRef.current.length > 0) {
        const queued = queueRef.current.shift()!;
        nextCards.push({ ...queued, expiresAt: now + 5000 });
      }
      cardsRef.current = nextCards;
      setCards(nextCards);
      scheduleRef.current();
    }, Math.max(0, nextExpiry - Date.now()));
  };

  useEffect(() => {
    if (!enabled) {
      events.forEach((gift) => seenIdsRef.current.add(gift.id));
      cardsRef.current = [];
      queueRef.current = [];
      comboRef.current.clear();
      setCards([]);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const newEvents = events.filter((gift) => !seenIdsRef.current.has(gift.id));
    if (newEvents.length === 0) return;
    let nextCards = [...cardsRef.current];
    for (const gift of newEvents) {
      seenIdsRef.current.add(gift.id);
      const giftCreatedAt = Date.parse(gift.createdAt);
      if (Number.isFinite(giftCreatedAt) && Date.now() - giftCreatedAt > 15_000) continue;
      const now = Date.now();
      const comboKey = `${gift.user.id}:${gift.giftName}:${gift.recipient?.id ?? ""}`;
      const previous = comboRef.current.get(comboKey);
      const activeIndex = previous ? nextCards.findIndex((card) => card.id === previous.id) : -1;
      const queuedIndex = previous ? queueRef.current.findIndex((card) => card.id === previous.id) : -1;
      if (previous && now - previous.lastAt <= 5000 && (activeIndex >= 0 || queuedIndex >= 0)) {
        comboRef.current.set(comboKey, { id: previous.id, lastAt: now });
        if (activeIndex >= 0) {
          const card = nextCards[activeIndex]!;
          nextCards[activeIndex] = { ...card, gift, comboCount: card.comboCount + 1, expiresAt: now + 5000 };
        } else {
          const card = queueRef.current[queuedIndex]!;
          queueRef.current[queuedIndex] = { ...card, gift, comboCount: card.comboCount + 1 };
        }
        continue;
      }
      const toast: LiveGiftToast = { id: gift.id, gift, comboCount: 1, expiresAt: 0 };
      comboRef.current.set(comboKey, { id: gift.id, lastAt: now });
      if (nextCards.length < 3) nextCards.push({ ...toast, expiresAt: now + 5000 });
      else queueRef.current.push(toast);
    }
    cardsRef.current = nextCards;
    setCards(nextCards);
    scheduleRef.current();
  }, [enabled, events]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return cards;
}

function LiveGiftToastCard({ toast }: { toast: LiveGiftToast }) {
  const { gift, comboCount } = toast;
  return (
    <div className="live-gift-card live-gift-toast live-viewer-gift-toast flex items-center gap-2.5 text-[10px] text-white/95">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/25 bg-violet-500/40">
        {gift.user.avatarUrl ? <img src={gift.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] font-black">{(gift.user.displayName || gift.user.username).charAt(0).toUpperCase()}</span>}
      </div>
      <span className="min-w-0 flex-1 truncate leading-tight">
        <strong className="block truncate text-[11px] font-extrabold text-white">{gift.user.displayName || `@${gift.user.username}`}</strong>
        <span className="mt-0.5 block truncate text-[10px] text-white/70">{gift.giftName} gönderdi</span>
      </span>
      <div className="live-viewer-gift-asset flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
        {gift.mimeType.startsWith("video/") ? (
          <video src={gift.url} muted autoPlay loop playsInline className="h-full w-full object-contain" />
        ) : (
          <img src={gift.url} alt={gift.giftName} className="h-full w-full object-contain" />
        )}
      </div>
      <span key={`${toast.id}-${comboCount}`} className="live-gift-combo-count shrink-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.3)]">x{comboCount}</span>
    </div>
  );
}
type AudienceHistory = {
  viewerId: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalSeconds: number;
  firstJoinedAt: string;
  lastSeenAt: string;
  firstBroadcastId: string;
  lastBroadcastId: string;
  likeCount: number;
  firstBroadcastStartedAt?: string;
  firstBroadcastEndedAt?: string;
};
type LiveLeagueProgress = {
  name: string;
  stage: number;
  stageCount: number;
  points: number;
  pointsPerStage: number;
  fragments: number;
  fragmentCount: number;
  label: string;
};
type LiveStats = {
  viewerCount: number;
  liveLikeCount: number;
  recipientCoinTotals?: Record<number, number>;
  myWeeklyCoins?: number | null;
  hourlyRanking: Array<{ user: LiveGiftEvent["user"]; coins: number; league?: LiveLeagueProgress }>;
  dailyRanking?: Array<{ user: LiveGiftEvent["user"]; coins: number; league?: LiveLeagueProgress }>;
  coinRanking: Array<{ user: LiveGiftEvent["user"]; coins: number; league?: LiveLeagueProgress }>;
  liveSupporters?: Array<{ user: LiveGiftEvent["user"]; coins: number; league?: LiveLeagueProgress }>;
  myLeague?: LiveLeagueProgress;
  collection: { collected: number; total: number; gifts: string[]; featuredGiftIds?: string[] };
  activeAudience?: AudienceHistory[];
  audienceHistory?: AudienceHistory[];
  supporterHistory?: Array<{
    user: LiveGiftEvent["user"];
    coins: number;
    firstSupportAt: string;
    lastSupportAt: string;
  }>;
  likes?: Array<{
    userId: number;
    broadcasterId: number;
    broadcastId: string;
    createdAt: string;
  }>;
};
const HOURLY_PREVIEW_LEAGUES = ["Elit", "Elmas", "Platin", "Altın", "Gümüş", "Bronz"] as const;
type LiveSupporterLevel = {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progress: number;
};
type LiveCreatorClub = {
  creator: LiveParticipant;
  clubName: string;
  isOwner: boolean;
  memberCount: number;
  isMember: boolean;
  myRank: number | null;
  myProgress: LiveSupporterLevel;
  clubProgress: LiveSupporterLevel;
  topMembers: Array<LiveSupporterLevel & { user: LiveParticipant }>;
  members: Array<LiveSupporterLevel & { user: LiveParticipant; joinedAt: string }>;
};
type LiveCoinPackage = { id: string; name: string; coins: number; bonus: number; amountTry: string; playProductId: string; currency: "TRY" };
type LiveCoinWallet = {
  balance: number | null;
  currency: "LOOP_COIN";
  paymentExempt: boolean;
  demoGiftMode?: boolean;
  paymentReady: boolean;
  googlePlayReady: boolean;
  testMode: boolean;
  packages: LiveCoinPackage[];
  transactions: Array<{ id: string; type: "purchase" | "gift"; amount: number; description: string; createdAt: string }>;
};
type LivePaymentBuyer = {
  name: string;
  surname: string;
  identityNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
};
type LiveBattle = {
  active: boolean;
  preparing?: boolean;
  preparationSecondsRemaining?: number;
  matchId?: string;
  opponentBroadcastId?: string;
  paletteId?: LivePkPaletteId;
  teamAssignments?: Record<string, "red" | "blue">;
  startedAt?: string;
  durationSeconds?: number;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  scores?: Array<{
    user: LiveParticipant;
    score: number;
    team?: "red" | "blue";
    supporters?: Array<{ user: LiveParticipant; coins: number }>;
  }>;
  winner?: LiveParticipant | null;
  winnerTeam?: "red" | "blue";
  isDraw?: boolean;
  offers?: Array<{ id: string; from: LiveParticipant; status: "pending"; createdAt: string }>;
  myOffer?: { id: string; status: "pending" | "accepted"; from: LiveParticipant } | null;
};
type LiveBattleResultAnimation = {
  id: string;
  name: string;
  outcome: "win" | "lose";
  url: string;
  mimeType: string;
  transparencyMode: TransparencyMode;
  edgeFade: "none" | "top-bottom";
};
type LiveArenaAsset = {
  id: string;
  name: string;
  role: "background" | "left-team" | "right-team" | "vs-emblem" | "score-bar" | "overlay";
  url: string;
  mimeType: string;
  published: boolean;
};

type LiveButtonAsset = {
  id: string;
  role: "subscribe" | "guests" | "like" | "gift" | "share" | "comment" | "streak" | "ranking" | "collection" | "coin" | "general";
  url: string;
  mimeType: string;
};

type LiveEventImage = { id: string; url: string; mimeType: string };
type LiveEvent = { id: string; title: string; description: string; images: LiveEventImage[]; published: boolean; createdAt: string };

function useLiveButtonAssets() {
  const [assets, setAssets] = useState<LiveButtonAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadAssets = async () => {
      try {
        const response = await fetch("/api/live/button-assets", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const items = (await response.json()) as LiveButtonAsset[];
        if (!cancelled) setAssets(items);
      } catch {
        if (!cancelled) setAssets([]);
      }
    };
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAssets();
    }, 10000);
    window.addEventListener("focus", loadAssets);
    void loadAssets();
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", loadAssets);
    };
  }, []);

  return assets;
}

function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      try {
        const response = await fetch("/api/live/events", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const items = (await response.json()) as LiveEvent[];
        if (!cancelled) setEvents(items);
      } catch {
        if (!cancelled) setEvents([]);
      }
    };
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadEvents();
    }, 15000);
    void loadEvents();
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  return events;
}

function LiveEventBanner({ events, className = "" }: { events: LiveEvent[]; className?: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const eventKey = events.map((event) => event.id).join("|");

  useEffect(() => {
    setDismissed(false);
    setEventIndex(0);
    setImageIndex(0);
  }, [eventKey]);

  const event = events[eventIndex];
  if (!event || dismissed) return null;

  const changeEvent = (direction: number) => {
    setEventIndex((current) => (current + direction + events.length) % events.length);
    setImageIndex(0);
  };

  return (
    <aside className={`absolute left-3 right-16 z-[75] sm:left-5 sm:right-24 ${className}`} aria-label="Canlı yayın etkinliği">
      <div className="overflow-hidden rounded-2xl border border-fuchsia-200/25 bg-[#120719]/90 shadow-[0_12px_40px_rgba(0,0,0,0.48),0_0_24px_rgba(168,85,247,0.12)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-2.5">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-fuchsia-200/70">CANLI ETKİNLİK</p>
            <h3 className="truncate text-xs font-black text-white sm:text-sm">{event.title}</h3>
            {event.description && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/65">{event.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {events.length > 1 && <span className="mr-1 text-[9px] font-semibold text-white/55">{eventIndex + 1}/{events.length}</span>}
            <button type="button" aria-label="Önceki etkinlik" onClick={() => changeEvent(-1)} disabled={events.length < 2} className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/70 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Sonraki etkinlik" onClick={() => changeEvent(1)} disabled={events.length < 2} className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/70 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Etkinlik banner’ını kapat" onClick={() => setDismissed(true)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/75"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={(scrollEvent) => setImageIndex(Math.round(scrollEvent.currentTarget.scrollLeft / Math.max(1, scrollEvent.currentTarget.clientWidth)))}>
          {event.images.map((image, index) => (
            <img key={image.id} src={image.url} alt={`${event.title} görsel ${index + 1}`} className="h-24 w-[88%] shrink-0 snap-center rounded-xl border border-white/10 bg-black/30 object-cover sm:h-28" />
          ))}
        </div>
        {event.images.length > 1 && <div className="flex items-center justify-center gap-1 pb-2">{event.images.map((image, index) => <span key={image.id} className={`h-1 rounded-full transition-all ${index === imageIndex ? "w-4 bg-fuchsia-300" : "w-1.5 bg-white/30"}`} />)}</div>}
      </div>
    </aside>
  );
}

const getLiveButtonAsset = (assets: LiveButtonAsset[], role: LiveButtonAsset["role"]) =>
  assets.find((asset) => asset.role === role) ?? assets.find((asset) => asset.role === "general");

function LiveButtonVisual({
  asset,
  fallback,
  className = "h-8 w-8",
}: {
  asset?: LiveButtonAsset;
  fallback: React.ReactNode;
  className?: string;
}) {
  if (!asset) return fallback;
  const mediaClassName = `${className} object-contain`;
  return asset.mimeType.startsWith("video/") ? (
    <video src={asset.url} muted autoPlay loop playsInline aria-hidden="true" className={mediaClassName} />
  ) : (
    <img src={asset.url} alt="" aria-hidden="true" className={mediaClassName} />
  );
}

const normalizeLoopMediaUrl = (value: unknown) => {
  const mediaUrl = String(value || "");
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("/api/uploads/")) return mediaUrl;
  if (mediaUrl.startsWith("/uploads/")) return `/api${mediaUrl}`;
  return mediaUrl;
};

const isVideoMediaUrl = (value: unknown) =>
  /\.(mp4|webm|mov|m4v|avi|mkv|3gp|mpeg|mpg|ogv|ts|mts|m2ts)(?:\?|$)/i.test(
    String(value || ""),
  );

function LiveStreamVideo({
  stream,
  muted = true,
  mirror = false,
  className,
}: {
  stream: MediaStream;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.srcObject === stream) return;
    video.srcObject = stream;
    video.style.transform = mirror ? "scaleX(-1)" : "none";
    video.style.webkitTransform = mirror ? "scaleX(-1)" : "none";
    video.style.objectFit = "cover";
    void video.play().catch(() => {});
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      muted={muted}
      playsInline
      autoPlay
      style={{ transform: mirror ? "scaleX(-1)" : "none", WebkitTransform: mirror ? "scaleX(-1)" : "none", objectPosition: "center" }}
      className={className}
    />
  );
}

function useBattleOpponentStream(enabled: boolean, broadcastId?: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled || !broadcastId) {
      setStream(null);
      return;
    }

    let cancelled = false;
    let connecting = false;
    let peer: RTCPeerConnection | null = null;
    let appliedOffer: string | null = null;
    const viewerId = crypto.randomUUID();

    const connect = async () => {
      if (cancelled || connecting) return;
      connecting = true;
      try {
        const response = await fetch(`/api/live/broadcasts/${broadcastId}/signal?viewerId=${encodeURIComponent(viewerId)}`, { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { offer?: string | null };
        if (!data.offer || data.offer === appliedOffer) return;
        if (peer && peer.signalingState !== "stable") return;

        if (!peer) {
          peer = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun.cloudflare.com:3478" },
            ],
          });
          peer.ontrack = (event) => setStream(event.streams[0] ?? new MediaStream([event.track]));
          peer.onconnectionstatechange = () => {
            if (peer?.connectionState === "failed" || peer?.connectionState === "closed") setStream(null);
          };
        }

        await peer.setRemoteDescription(JSON.parse(data.offer) as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await Promise.race([
          new Promise<void>((resolve) => {
            if (peer?.iceGatheringState === "complete") return resolve();
            peer?.addEventListener("icegatheringstatechange", () => {
              if (peer?.iceGatheringState === "complete") resolve();
            });
          }),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
        ]);
        if (cancelled || !peer.localDescription) return;
        const answerResponse = await fetch(`/api/live/broadcasts/${broadcastId}/signal`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "answer", viewerId, description: JSON.stringify(peer.localDescription) }),
        });
        if (answerResponse.ok) appliedOffer = data.offer;
      } catch {
        setStream(null);
      } finally {
        connecting = false;
      }
    };

    void connect();
    const timer = window.setInterval(() => void connect(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      peer?.close();
      setStream(null);
    };
  }, [enabled, broadcastId]);

  return stream;
}

const shuffleLoops = <T,>(items: T[], previousFirstId?: number) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const swapIndex = randomBytes[0]! % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }

  if (
    previousFirstId !== undefined &&
    shuffled.length > 1 &&
    (shuffled[0] as { id?: number }).id === previousFirstId
  ) {
    const swapIndex =
      1 +
      (crypto.getRandomValues(new Uint32Array(1))[0]! % (shuffled.length - 1));
    [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[0]!];
  }
  return shuffled;
};

const TABS = ["Canlı yayın", "Akış", "Takip Edilenler"];
type LivePkPaletteId = "classic" | "ember" | "grove" | "nebula" | "gold";
const LIVE_PK_PALETTES: Array<{
  id: LivePkPaletteId;
  name: string;
  red: { name: string; main: string; soft: string; glow: string };
  blue: { name: string; main: string; soft: string; glow: string };
}> = [
  { id: "classic", name: "Kızıl · Mavi", red: { name: "Kızıl", main: "#f43f5e", soft: "#fda4af", glow: "rgba(244,63,94,.72)" }, blue: { name: "Mavi", main: "#3b82f6", soft: "#93c5fd", glow: "rgba(59,130,246,.72)" } },
  { id: "ember", name: "Kor · Buz", red: { name: "Kor", main: "#f97316", soft: "#fdba74", glow: "rgba(249,115,22,.72)" }, blue: { name: "Buz", main: "#06b6d4", soft: "#67e8f9", glow: "rgba(6,182,212,.72)" } },
  { id: "grove", name: "Filiz · Gece", red: { name: "Filiz", main: "#22c55e", soft: "#86efac", glow: "rgba(34,197,94,.72)" }, blue: { name: "Gece", main: "#8b5cf6", soft: "#c4b5fd", glow: "rgba(139,92,246,.72)" } },
  { id: "nebula", name: "Nova · Dalga", red: { name: "Nova", main: "#e879f9", soft: "#f5d0fe", glow: "rgba(232,121,249,.72)" }, blue: { name: "Dalga", main: "#14b8a6", soft: "#99f6e4", glow: "rgba(20,184,166,.72)" } },
  { id: "gold", name: "Güneş · Zümrüt", red: { name: "Güneş", main: "#eab308", soft: "#fde047", glow: "rgba(234,179,8,.72)" }, blue: { name: "Zümrüt", main: "#10b981", soft: "#6ee7b7", glow: "rgba(16,185,129,.72)" } },
];
const LOOP_LEAGUES = [
  { name: "Bronz", minCoins: 0, maxCoins: 50, stages: 3, color: "#cd7f32" },
  { name: "Gümüş", minCoins: 50, maxCoins: 250, stages: 3, color: "#c0c0c0" },
  { name: "Altın", minCoins: 250, maxCoins: 1000, stages: 4, color: "#d4af37" },
  { name: "Platin", minCoins: 1000, maxCoins: 2860, stages: 5, color: "#aeb9c5" },
  { name: "Elmas", minCoins: 2860, maxCoins: 7000, stages: 6, color: "#66d9ef" },
  { name: "Elit", minCoins: 7000, maxCoins: Number.POSITIVE_INFINITY, stages: 6, color: "#c084fc" },
];
function getLoopLeague(coins: number) {
  const safeCoins = Math.max(0, coins);
  const index = LOOP_LEAGUES.reduce((currentIndex, league, candidateIndex) => safeCoins >= league.minCoins ? candidateIndex : currentIndex, 0);
  const current = LOOP_LEAGUES[index]!;
  const next = LOOP_LEAGUES[index + 1];
  const tierProgress = Math.max(0, next
    ? (safeCoins - current.minCoins) / (next.minCoins - current.minCoins)
    : (safeCoins - current.minCoins) / 3000);
  const stageProgress = tierProgress * current.stages;
  const stage = Math.min(current.stages, Math.floor(stageProgress) + 1);
  return {
    current,
    stage,
    fragments: Math.floor(Math.max(0, coins) / 10),
    next,
    progress: Math.min(100, Math.max(0, (stageProgress % 1) * 100)),
  };
}
const LOOP_DOCK_ITEMS = [
  { href: "/", label: "Ana sayfa", Icon: Home },
  { href: "/explore", label: "Keşfet", Icon: Search },
  { href: "/loops", label: "Loops", Icon: Clapperboard },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
  { href: "/voice", label: "Voice", Icon: Volume2 },
  { href: "/profile/me", label: "Profil", Icon: User },
];

function LoopDock({ hidden = false }: { hidden?: boolean }) {
  const [location] = useLocation();
  if (hidden) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-1 z-50 h-16 bg-gradient-to-t from-[#050611]/90 via-[#050611]/45 to-transparent px-3 pb-1 pt-3">
      <nav className="pointer-events-auto mx-auto flex h-full max-w-[28rem] items-end justify-between gap-1" aria-label="Loops navigasyonu">
        {LOOP_DOCK_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/loops" ? location.startsWith("/loops") : location === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={(event) => {
                if (active && href === "/loops") {
                  event.preventDefault();
                  window.location.reload();
                }
              }}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1 text-[9px] font-semibold transition-colors md:text-[10px] ${active ? "text-white" : "text-white/45 hover:text-white/80"}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center transition-transform group-active:scale-90 ${active ? "text-violet-200" : ""}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.8} />
              </span>
              <span className="truncate">{label}</span>
              {active && <span className="h-0.5 w-5 rounded-full bg-violet-300 shadow-[0_0_10px_#c4b5fd]" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
const count = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1).replace(".0", "")}K`
    : String(value);
const formatWatchTime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days} gün ${hours} sa` : hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
};
const formatLiveDate = (value?: string) => value ? new Date(value).toLocaleDateString("tr-TR") : "-";
const formatLiveDuration = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const daysSince = (value: string) => Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86400000));

function hasBattleTeamLayout(battle: LiveBattle | null | undefined): boolean {
  return Boolean(battle?.teamAssignments && (battle.active || battle.preparing));
}

function getBattleCommentHeightLimit(battle: LiveBattle | null, viewportHeight: number): number {
  const topOffset = battle?.preparing ? 22 * 16 : 15 * 16;
  const largestTeamSize = battle && hasBattleTeamLayout(battle)
    ? Math.max(0, ...(["red", "blue"] as const).map((team) => (battle.scores ?? []).filter((entry, index) => (battle.teamAssignments?.[String(entry.user.id)] ?? entry.team ?? (index === 0 ? "red" : "blue")) === team).length))
    : 0;
  return largestTeamSize > 0
    ? Math.max(16, Math.min(44, Math.floor(((viewportHeight - topOffset - 68 - 40 - 12 - 24 - largestTeamSize * 28) / viewportHeight) * 100)))
    : 44;
}

function getBattleTileLayout(battle: LiveBattle | null, userId?: number): React.CSSProperties | undefined {
  if (!hasBattleTeamLayout(battle) || !battle?.teamAssignments || userId === undefined) return undefined;
  const scores = battle.scores ?? [];
  const userIndex = scores.findIndex((entry) => entry.user.id === userId);
  if (userIndex < 0) return undefined;
  const team = battle.teamAssignments[String(userId)] ?? scores[userIndex]?.team ?? (userIndex === 0 ? "red" : "blue");
  const teamMembers = scores.filter((entry, index) => (battle.teamAssignments?.[String(entry.user.id)] ?? entry.team ?? (index === 0 ? "red" : "blue")) === team);
  const tileIndex = Math.max(0, teamMembers.findIndex((entry) => entry.user.id === userId));
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 400 : window.innerWidth;
  const topOffset = Math.min(battle.preparing ? 22 * 16 : 15 * 16, viewportHeight * 0.42);
  const reservedBottom = Math.min(12 * 16, viewportHeight * 0.22);
  const tileGap = 8;
  const availableHeight = Math.max(0, viewportHeight - topOffset - reservedBottom);
  const teamColumnWidth = viewportWidth / 2 - 24;
  const availableWidth = Math.min(360, teamColumnWidth);
  const tileSize = Math.max(0, Math.min(availableWidth, (availableHeight - tileGap * Math.max(0, teamMembers.length - 1)) / Math.max(1, teamMembers.length)));
  const teamCenter = team === "red" ? viewportWidth / 4 : viewportWidth * 3 / 4;
  return {
    top: `${topOffset + tileIndex * (tileSize + tileGap)}px`,
    left: `${teamCenter - tileSize / 2}px`,
    height: `${tileSize}px`,
    width: `${tileSize}px`,
  };
}

function getLiveCameraTileLayout(index: number, count: number): React.CSSProperties {
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 400 : window.innerWidth;
  const topOffset = Math.min(13.5 * 16, viewportHeight * 0.28);
  const reservedBottom = Math.min(12 * 16, viewportHeight * 0.22);
  const gap = 8;
  const maxWidth = Math.min(360, (viewportWidth - 24 - gap * (columns - 1)) / columns);
  const availableRowHeight = Math.max(0, (viewportHeight - topOffset - reservedBottom - gap * (rows - 1)) / rows);
  const tileSize = Math.max(0, Math.min(maxWidth, availableRowHeight));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const itemsInRow = Math.min(columns, count - row * columns);
  const rowWidth = itemsInRow * tileSize + gap * (itemsInRow - 1);
  return {
    top: `${topOffset + row * (tileSize + gap)}px`,
    left: `${(viewportWidth - rowWidth) / 2 + column * (tileSize + gap)}px`,
    width: `${tileSize}px`,
    height: `${tileSize}px`,
  };
}

function BattleScoreCounter({ score, side }: { score: number; side: "left" | "right" }) {
  const previousScore = useRef(score);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (previousScore.current === score) return;
    previousScore.current = score;
    setAnimationKey((key) => key + 1);
  }, [score]);

  return (
    <span
      key={animationKey}
      className={`live-pk-score-count live-pk-score-count-${side} absolute z-10 max-w-[42%] truncate tabular-nums`}
      aria-label={`${score.toLocaleString("tr-TR")} coin`}
    >
      {score.toLocaleString("tr-TR")}
      <span className="ml-1 text-[0.68em] font-bold uppercase tracking-[0.12em] opacity-80">coin</span>
    </span>
  );
}

function KapismaArena({ battle, className = "", currentUserId, canConfigurePalette = false, onSelectTeam, onSelectPalette }: { battle: LiveBattle; className?: string; currentUserId?: number; canConfigurePalette?: boolean; onSelectTeam?: (team: "red" | "blue") => void; onSelectPalette?: (paletteId: LivePkPaletteId) => void }) {
  const scores = battle.scores ?? [];
  if (scores.length < 2) return null;

  const palette = LIVE_PK_PALETTES.find((item) => item.id === battle.paletteId) ?? LIVE_PK_PALETTES[0]!;
  const remaining = Math.max(0, battle.remainingSeconds ?? battle.durationSeconds ?? 180);
  const finished = !battle.active && battle.remainingSeconds !== undefined;
  const teamBattle = Boolean(battle.teamAssignments);
  const teamFor = (userId: number, index: number) => battle.teamAssignments?.[String(userId)] ?? scores.find((entry) => entry.user.id === userId)?.team ?? (index === 0 ? "red" : "blue");
  const leftMembers = teamBattle ? scores.filter((entry, index) => teamFor(entry.user.id, index) === "red") : scores.slice(0, 1);
  const rightMembers = teamBattle ? scores.filter((entry, index) => teamFor(entry.user.id, index) === "blue") : scores.slice(1, 2);
  const leftScore = leftMembers.reduce((total, entry) => total + entry.score, 0);
  const rightScore = rightMembers.reduce((total, entry) => total + entry.score, 0);
  const totalScore = leftScore + rightScore;
  const leftShare = totalScore > 0 ? (leftScore / totalScore) * 100 : 50;
  const rightShare = 100 - leftShare;
  const leadingSide = leftScore === rightScore ? "draw" : leftScore > rightScore ? "left" : "right";
  const clashWidth = Math.min(18, 5 + Math.abs(leftShare - rightShare) * 0.16);
  const clashStyle: React.CSSProperties = leadingSide === "left"
    ? { left: `${Math.max(0, leftShare - clashWidth)}%`, width: `${clashWidth}%` }
    : { left: `${leftShare}%`, width: `${clashWidth}%` };

  return (
    <section className={`pointer-events-none w-full px-2 pb-1 pt-1 text-white sm:px-3 ${className}`} aria-live="polite">
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        {([{ side: "red", members: leftMembers }, { side: "blue", members: rightMembers }] as const).map(({ side, members }) => (
          <div key={side} className={`flex min-w-0 items-center gap-1 ${side === "blue" ? "justify-end" : ""}`} title={members.map((entry) => `@${entry.user.username}`).join(", ")}>
            {members.slice(0, teamBattle ? 3 : 1).map((entry) => (
              <span key={entry.user.id} className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-black/35 text-[10px] font-black" style={{ borderColor: `${palette[side].soft}b3` }}>
                {entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (entry.user.displayName || entry.user.username).charAt(0).toUpperCase()}
              </span>
            ))}
            <span className="truncate text-[9px] font-black uppercase tracking-wide" style={{ color: palette[side].soft }}>
              {teamBattle ? `${palette[side].name} · ${members.length}` : members[0]?.user.displayName || `@${members[0]?.user.username}`}
            </span>
          </div>
        ))}
      </div>
      <div className={`live-pk-scorebar relative flex h-5 items-center overflow-hidden rounded-full bg-slate-950/55 ring-1 ring-white/20 shadow-[0_0_18px_rgba(255,255,255,0.14)] sm:h-6 ${leadingSide === "left" ? "live-pk-leading-left" : leadingSide === "right" ? "live-pk-leading-right" : "live-pk-draw"}`} role="img" aria-label={`${palette.red.name} takımı ${leftScore} coin, ${palette.blue.name} takımı ${rightScore} coin`}>
        <div className="live-pk-score-fill-left absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-700" style={{ width: `${leftShare}%`, backgroundImage: `linear-gradient(105deg,${palette.red.main} 0%,${palette.red.main} 52%,${palette.red.soft} 100%)`, boxShadow: `0 0 18px ${palette.red.glow}` }} />
        <div className="live-pk-score-fill-right absolute inset-y-0 right-0 rounded-r-full transition-[width] duration-700" style={{ width: `${rightShare}%`, backgroundImage: `linear-gradient(255deg,${palette.blue.main} 0%,${palette.blue.main} 52%,${palette.blue.soft} 100%)`, boxShadow: `0 0 18px ${palette.blue.glow}` }} />
        {leadingSide !== "draw" && <span aria-hidden="true" className="live-pk-clash-trail absolute inset-y-0" style={{ ...clashStyle, background: leadingSide === "left" ? `linear-gradient(90deg,transparent,${palette.red.main}55,rgba(255,255,255,.9))` : `linear-gradient(90deg,rgba(255,255,255,.9),${palette.blue.main}55,transparent)` }} />}
        <BattleScoreCounter score={leftScore} side="left" />
        <BattleScoreCounter score={rightScore} side="right" />
        <span className="absolute z-20 -translate-x-1/2 transition-[left] duration-700 ease-out" style={{ left: `${leftShare}%` }}>
          <span className="live-pk-clash-marker relative flex h-5 w-5 items-center justify-center rounded-full border border-white/90 bg-slate-950/95 text-white shadow-[0_0_14px_rgba(255,255,255,0.75)]" style={{ boxShadow: `0 0 9px ${leadingSide === "left" ? palette.red.glow : palette.blue.glow}, 0 0 18px rgba(255,255,255,.75)` }}>
            <Swords className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
      </div>
      <div className="mt-1 flex justify-center">
        {battle.preparing ? (
          <time className="font-mono text-[10px] font-black leading-4 tabular-nums text-amber-100" aria-label={`Takım seçimi için ${battle.preparationSecondsRemaining ?? 0} saniye`}>
            Takım seçimi · 00:{String(battle.preparationSecondsRemaining ?? 0).padStart(2, "0")}
          </time>
        ) : (
          <time className={`font-mono text-[11px] font-bold leading-4 tabular-nums ${finished ? "text-white/60" : "text-white/85"}`} aria-label={`Kalan süre ${Math.floor(remaining / 60)} dakika ${remaining % 60} saniye`}>
            {`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
          </time>
        )}
      </div>
      {battle.preparing && currentUserId !== undefined && scores.some((entry) => entry.user.id === currentUserId) && onSelectTeam && (
        <div className="pointer-events-auto mt-1 flex justify-center gap-1.5">
          {(["red", "blue"] as const).map((team) => (
            <button key={team} type="button" onClick={() => onSelectTeam(team)} aria-pressed={teamFor(currentUserId, 0) === team} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-black transition" style={teamFor(currentUserId, 0) === team ? { backgroundColor: palette[team].main, color: "#fff" } : { backgroundColor: "rgba(0,0,0,.4)", color: "rgba(255,255,255,.75)", outline: `1px solid ${palette[team].soft}66` }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette[team].soft }} />
              {palette[team].name} takım
            </button>
          ))}
        </div>
      )}
      {battle.preparing && canConfigurePalette && onSelectPalette && (
        <div className="pointer-events-auto mx-auto mt-2 w-full max-w-sm rounded-xl border border-white/10 bg-slate-950/80 p-2 shadow-lg backdrop-blur-md" aria-label="PK renk paletleri">
          <span className="mb-1.5 block text-center text-[8px] font-bold uppercase tracking-wider text-white/55">Renk teması</span>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {LIVE_PK_PALETTES.map((option) => (
              <button key={option.id} type="button" onClick={() => onSelectPalette(option.id)} aria-pressed={palette.id === option.id} title={option.name} className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] font-bold transition ${palette.id === option.id ? "bg-white/20 text-white ring-1 ring-white/50" : "bg-white/[0.04] text-white/65 ring-1 ring-white/10 hover:bg-white/10"}`}>
                <span className="flex shrink-0 items-center gap-0.5">
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: option.red.main }} />
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: option.blue.main }} />
                </span>
                <span className="truncate">{option.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LiveBattleSupporters({ battle, commentHeight = 30 }: { battle: LiveBattle; commentHeight?: number }) {
  const scores = battle.scores ?? [];
  const teams = (["red", "blue"] as const).map((side) => {
    const supporters = new Map<number, { user: LiveParticipant; coins: number }>();
    scores.forEach((entry, entryIndex) => {
      const team = battle.teamAssignments?.[String(entry.user.id)] ?? entry.team ?? (entryIndex === 0 ? "red" : "blue");
      if (team !== side) return;
      entry.supporters?.forEach((supporter) => {
        const existing = supporters.get(supporter.user.id) ?? { user: supporter.user, coins: 0 };
        existing.coins += supporter.coins;
        supporters.set(supporter.user.id, existing);
      });
    });
    return { side, supporters: [...supporters.values()].sort((left, right) => right.coins - left.coins).slice(0, 3) };
  });
  if (teams.every((team) => team.supporters.length === 0)) return null;

  return (
    <div
      className="live-battle-supporters pointer-events-auto absolute inset-x-3 z-[110] grid grid-cols-2 items-center sm:inset-x-5"
      style={{ bottom: `calc(${commentHeight}vh + var(--live-comment-bar-height, 4.25rem) + env(safe-area-inset-bottom) + 0.75rem)` }}
      aria-label="Kapışmanın en çok destek veren ilk üç kişisi"
    >
      {teams.map(({ side, supporters }) => {
        return (
          <div key={side} className={`flex max-w-full items-center gap-1.5 ${side === "red" ? "col-start-1 justify-start" : "col-start-2 justify-end"}`}>
            {supporters.map((supporter, supporterIndex) => (
              <Link
                key={supporter.user.id}
                href={`/profile/${supporter.user.id}`}
                title={`#${supporterIndex + 1} @${supporter.user.username} · ${supporter.coins.toLocaleString("tr-TR")} coin`}
                aria-label={`${supporterIndex + 1}. destekçi @${supporter.user.username}, profili görüntüle`}
                className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 bg-slate-950 text-[10px] font-black shadow-lg transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${side === "red" ? "border-rose-200/85 shadow-rose-500/35" : "border-cyan-200/85 shadow-cyan-500/35"}`}
              >
                {supporter.user.avatarUrl ? <img src={supporter.user.avatarUrl} alt={`@${supporter.user.username}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{(supporter.user.displayName || supporter.user.username).charAt(0).toUpperCase()}</span>}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-0.5 text-[7px] font-black leading-none text-white">{supporterIndex + 1}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function useLiveBattleResultAnimations() {
  const [animations, setAnimations] = useState<LiveBattleResultAnimation[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live/battle-result-animations", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((items: LiveBattleResultAnimation[]) => { if (!cancelled) setAnimations(items); })
      .catch(() => setAnimations([]));
    return () => { cancelled = true; };
  }, []);

  return animations;
}

function KapismaResultAnimations({ battle, animations, className = "" }: { battle: LiveBattle; animations: LiveBattleResultAnimation[]; className?: string }) {
  const [playingMatchId, setPlayingMatchId] = useState<string | null>(null);
  const playedMatchIdRef = useRef<string | null>(null);
  const pendingSidesRef = useRef<Set<number>>(new Set());
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (battle.active) {
      setPlayingMatchId(null);
      pendingSidesRef.current.clear();
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      return;
    }

    if (battle.remainingSeconds !== 0 || !battle.startedAt || !battle.winner || battle.isDraw || playedMatchIdRef.current === battle.startedAt) return;
    const scoreEntries = battle.scores ?? [];
    const sides = battle.winnerTeam
      ? (["red", "blue"] as const).map((team) => ({
          user: scoreEntries.find((entry) => (battle.teamAssignments?.[String(entry.user.id)] ?? entry.team) === team)?.user,
          team,
        })).filter((side): side is { user: LiveParticipant; team: "red" | "blue" } => Boolean(side.user))
      : scoreEntries.slice(0, 2).map((side) => ({ user: side.user, team: undefined }));
    const eligibleSides = sides.filter((side) => animations.some((animation) => animation.outcome === (battle.winnerTeam ? side.team === battle.winnerTeam ? "win" : "lose" : side.user.id === battle.winner!.id ? "win" : "lose")));
    if (eligibleSides.length === 0) return;

    playedMatchIdRef.current = battle.startedAt;
    pendingSidesRef.current = new Set(eligibleSides.map((side) => side.user.id));
    setPlayingMatchId(battle.startedAt);
    fallbackTimerRef.current = window.setTimeout(() => setPlayingMatchId(null), 12000);
    return () => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [battle.active, battle.remainingSeconds, battle.startedAt, battle.winner?.id, battle.winnerTeam, battle.isDraw, animations]);

  if (!playingMatchId || playingMatchId !== battle.startedAt || !battle.winner) return null;

  const finishSide = (userId: number) => {
    pendingSidesRef.current.delete(userId);
    if (pendingSidesRef.current.size === 0) setPlayingMatchId(null);
  };

  return (
    <div className={`pointer-events-none absolute left-3 right-3 top-[13rem] z-[45] grid grid-cols-2 gap-2 ${className}`} aria-hidden="true">
      {(battle.winnerTeam
        ? (["red", "blue"] as const).map((team) => {
            const entry = (battle.scores ?? []).find((score) => (battle.teamAssignments?.[String(score.user.id)] ?? score.team) === team);
            return entry ? { user: entry.user, team } : null;
          }).filter((side): side is { user: LiveParticipant; team: "red" | "blue" } => Boolean(side))
        : (battle.scores ?? []).slice(0, 2).map((side) => ({ user: side.user, team: undefined }))).map((side) => {
        const outcome = battle.winnerTeam ? side.team === battle.winnerTeam ? "win" : "lose" : side.user.id === battle.winner!.id ? "win" : "lose";
        const animation = animations.find((item) => item.outcome === outcome);
        if (!animation) return <div key={side.user.id} />;
        return (
          <div key={`${playingMatchId}-${side.user.id}-${animation.id}`} className="relative aspect-square min-w-0">
            <ChromaKeyAnimation
              src={animation.url}
              mimeType={animation.mimeType}
              transparencyMode={animation.transparencyMode}
              edgeFade={animation.edgeFade}
              onEnded={() => finishSide(side.user.id)}
              className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(255,255,255,0.5)]"
            />
          </div>
        );
      })}
    </div>
  );
}

function LiveBroadcastGrid({ broadcasts }: { broadcasts: LiveBroadcast[] }) {
  if (broadcasts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Radio className="h-12 w-12 text-violet-300/60" />
        <p className="text-lg font-black text-white">Şu anda canlı yayın yok</p>
        <p className="max-w-sm text-sm text-violet-100/60">
          Canlı yayın başladığında burada tüm yayınları birlikte görebileceksin.
        </p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-300">
            Şimdi canlı
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Canlı yayınlar
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-violet-100">
          {broadcasts.length} yayın
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {broadcasts.map((broadcast) => (
          <article
            key={broadcast.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/20"
          >
            <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-violet-950 via-[#17112f] to-rose-950">
              <Radio className="h-14 w-14 text-violet-200/35" />
              <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                CANLI
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white">
                {count(broadcast.viewerCount)} izleyici
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full border border-violet-300/40 bg-violet-500/20">
                  {broadcast.user.avatarUrl ? (
                    <img
                      src={broadcast.user.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-black text-violet-100">
                      {broadcast.user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {broadcast.user.displayName ||
                      `@${broadcast.user.username}`}
                  </p>
                  <p className="truncate text-xs text-violet-100/55">
                    @{broadcast.user.username}
                  </p>
                </div>
              </div>
              <h3 className="mt-4 truncate text-base font-black text-white">
                {broadcast.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-violet-100/65">
                {broadcast.content}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-bold text-violet-200/60">
                  {broadcast.type === "game"
                    ? "Oyun / ekran paylaşımı"
                    : "Sohbet yayını"}
                </span>
                <span className="rounded-full bg-rose-500/15 px-3 py-1.5 text-xs font-black text-rose-200">
                  Yayına katıl
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function LiveBroadcastScene({ broadcast, buttonAssets, events, isActiveScene, onSwitchBroadcast, autoJoinRequest }: { broadcast: LiveBroadcast; buttonAssets: LiveButtonAsset[]; events: LiveEvent[]; isActiveScene: boolean; onSwitchBroadcast: (broadcastId: string) => void; autoJoinRequest: { broadcastId: string; nonce: number } | null }) {
  const { user } = useAuth();
  const battleResultAnimations = useLiveBattleResultAnimations();
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; color: string; left: number; top: number }>>([]);
  const heartColorIndexRef = useRef(0);
  const heartIdRef = useRef(0);
  const [joined, setJoined] = useState(false);
  const [joinedNoticeVisible, setJoinedNoticeVisible] = useState(false);
  const [commentHeight, setCommentHeight] = useState(30);
  const [commentHeightOpen, setCommentHeightOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const commentsListRef = useRef<HTMLDivElement>(null);
  const commentsAtBottomRef = useRef(true);
  const [giftEvents, setGiftEvents] = useState<LiveGiftEvent[]>([]);
  const visibleGiftCards = useLiveGiftToasts(giftEvents, true);
  const [activeGiftEvent, setActiveGiftEvent] = useState<LiveGiftEvent | null>(
    null,
  );
  const giftAnimationQueueRef = useRef<LiveGiftEvent[]>([]);
  const seenGiftIdsRef = useRef<Set<string>>(new Set());
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<LiveComment | null>(null);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [collectionPanelOpen, setCollectionPanelOpen] = useState(false);
  const [gifts, setGifts] = useState<LiveGift[]>([]);
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [giftSending, setGiftSending] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [coinWallet, setCoinWallet] = useState<LiveCoinWallet | null>(null);
  const [coinWalletError, setCoinWalletError] = useState("");
  const [coinWalletLoading, setCoinWalletLoading] = useState(false);
  const [coinPurchaseId, setCoinPurchaseId] = useState<string | null>(null);
  const [checkoutPackageId, setCheckoutPackageId] = useState<string | null>(null);
  const [googlePlayProducts, setGooglePlayProducts] = useState<Record<string, { priceString: string }>>({});
  const [paymentBuyer, setPaymentBuyer] = useState<LivePaymentBuyer>({ name: "", surname: "", identityNumber: "", email: "", phone: "", address: "", city: "", country: "Türkiye", zipCode: "" });
  const [battle, setBattle] = useState<LiveBattle | null>(null);
  const [showOpponentScreen, setShowOpponentScreen] = useState(false);
  const [arenaAssets, setArenaAssets] = useState<LiveArenaAsset[]>([]);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [giftRecipientId, setGiftRecipientId] = useState(broadcast.user.id);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    viewerCount: broadcast.viewerCount,
    liveLikeCount: 0,
    recipientCoinTotals: {},
    hourlyRanking: [],
    coinRanking: [],
    liveSupporters: [],
    collection: { collected: 0, total: 10, gifts: [], featuredGiftIds: [] },
    activeAudience: [],
    audienceHistory: [],
    supporterHistory: [],
  });
  const verifyGoogleCoinPurchase = async (productId: string, purchaseToken: string) => {
    const response = await fetch("/api/live/coin-wallet/google-play/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, purchaseToken }),
    });
    const result = await response.json() as { error?: string; balance?: number; finalizationPending?: boolean };
    if (!response.ok) throw new Error(result.error || "Google Play satın alması doğrulanamadı.");
    return result;
  };
  const verifyGooglePremiumPurchase = async (productId: string, purchaseToken: string) => {
    const response = await fetch("/api/live/premium/google-play/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, purchaseToken }),
    });
    const result = await response.json() as { error?: string; acknowledgementPending?: boolean };
    if (!response.ok) throw new Error(result.error || "Google Play Premium aboneliği doğrulanamadı.");
    return result;
  };
  const [rankingPanelOpen, setRankingPanelOpen] = useState(false);
  const [rankingPeriod, setRankingPeriod] = useState<"live" | "hourly" | "daily" | "weekly">("live");
  const [creatorClub, setCreatorClub] = useState<LiveCreatorClub | null>(null);
  const [clubPanelOpen, setClubPanelOpen] = useState(false);
  const [clubRequesting, setClubRequesting] = useState(false);
  const [clubError, setClubError] = useState("");
  const [clubNameDraft, setClubNameDraft] = useState("");
  const [clubNameSaving, setClubNameSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [joinRequest, setJoinRequest] = useState<LiveJoinRequest | null>(null);
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [guestStreamReady, setGuestStreamReady] = useState(false);
  const [guestLocalStream, setGuestLocalStream] = useState<MediaStream | null>(null);
  const [remoteGuestReady, setRemoteGuestReady] = useState(false);
  const [remoteGuestStreams, setRemoteGuestStreams] = useState<Array<{ stream: MediaStream; user?: LiveParticipant }>>([]);
  const [remoteGuestCameraOff, setRemoteGuestCameraOff] = useState<Record<string, boolean>>({});
  const [remoteHostCameraOff, setRemoteHostCameraOff] = useState(false);
  const [guestCameraOff, setGuestCameraOff] = useState(false);
  const chatGuestCapacityFull = broadcast.type === "chat"
    && participants.filter((participant) => participant.id !== broadcast.user.id).length >= 16;
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const guestVideoRef = useRef<HTMLVideoElement>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const remoteGuestStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef<string>(crypto.randomUUID());
  const answerSentRef = useRef(false);
  const guestOfferSentRef = useRef(false);
  const guestAnswerAppliedRef = useRef(false);
  const lastBroadcastOfferRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`loop-live-comment-height:${user?.id ?? "guest"}`);
      if (saved === null) {
        setCommentHeight(30);
        return;
      }
      const value = Number(saved);
      if (Number.isFinite(value)) setCommentHeight(Math.max(16, Math.min(44, value)));
    } catch {
      // Keep the default comment height when local storage is unavailable.
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadJoinRequest = async () => {
      const response = await fetch(`/api/live/broadcasts/${broadcast.id}/join-requests`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as { request?: LiveJoinRequest | null; participants?: LiveParticipant[] };
      setJoinRequest(data.request ?? null);
      const nextParticipants = data.participants ?? [];
      setParticipants(nextParticipants);
      const giftRecipients = [broadcast.user, ...nextParticipants];
      if (!giftRecipients.some((item) => item.id === giftRecipientId)) setGiftRecipientId(broadcast.user.id);
    };
    void loadJoinRequest();
    const timer = window.setInterval(() => void loadJoinRequest(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [broadcast.id, user, giftRecipientId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live/arena-assets", { cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then((items: LiveArenaAsset[]) => { if (!cancelled) setArenaAssets(items); })
      .catch(() => setArenaAssets([]));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBattle = async () => {
      const response = await fetch(`/api/live/broadcasts/${broadcast.id}/battle`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      setBattle((await response.json()) as LiveBattle);
    };
    void loadBattle();
    const timer = window.setInterval(() => void loadBattle(), 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [broadcast.id]);

  useEffect(() => {
    if (autoJoinRequest?.broadcastId !== broadcast.id || !isActiveScene) return;
    setJoined(true);
    setAudioEnabled(false);
    if (liveVideoRef.current) {
      liveVideoRef.current.muted = true;
      void liveVideoRef.current.play().catch(() => {});
    }
  }, [autoJoinRequest?.broadcastId, autoJoinRequest?.nonce, broadcast.id, isActiveScene]);

  useEffect(() => {
    setJoined(isActiveScene);
    setAudioEnabled(false);
    if (isActiveScene && liveVideoRef.current) {
      liveVideoRef.current.muted = true;
      void liveVideoRef.current.play().catch(() => {});
    }
  }, [isActiveScene]);

  const acceptBattleOffer = async (offerId: string) => {
    const response = await fetch(`/api/live/broadcasts/${broadcast.id}/battle/offers/${offerId}/accept`, { method: "POST", credentials: "include" }).catch(() => null);
    if (response?.ok) setBattle((await response.json()) as LiveBattle);
  };

  const chooseBattleTeam = async (team: "red" | "blue") => {
    if (!user) return;
    const response = await fetch(`/api/live/broadcasts/${broadcast.id}/battle/team`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    }).catch(() => null);
    if (!response?.ok) {
      setConnectionError("Takım seçimin kaydedilemedi. Lütfen tekrar dene.");
      return;
    }
    const data = (await response.json()) as { teamAssignments: Record<string, "red" | "blue"> };
    setBattle((current) => current ? { ...current, teamAssignments: data.teamAssignments } : current);
  };

  const chooseBattlePalette = async (paletteId: LivePkPaletteId) => {
    const response = await fetch(`/api/live/broadcasts/${broadcast.id}/battle/palette`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paletteId }),
    }).catch(() => null);
    if (!response?.ok) {
      setConnectionError("PK renk teması kaydedilemedi. Takım seçimi süresi içinde tekrar deneyin.");
      return;
    }
    setBattle((current) => current ? { ...current, paletteId } : current);
  };

  useEffect(() => {
    if (joinRequest?.status !== "accepted" || !user || guestStreamRef.current) return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
        guestStreamRef.current = stream;
        setGuestLocalStream(stream);
        setGuestCameraOff(true);
        setGuestStreamReady(true);
      })
      .catch(() => setConnectionError("Yayına katılmak için kamera ve mikrofon izni gerekli."));
    return () => {
      cancelled = true;
    };
  }, [joinRequest?.status, user]);

  const requestToJoin = async () => {
    if (!user || requestingJoin) return;
    setRequestingJoin(true);
    const response = await fetch(`/api/live/broadcasts/${broadcast.id}/join-requests`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) setJoinRequest((await response.json()) as LiveJoinRequest);
    else if (response?.status === 409) setConnectionError("Sohbet yayınındaki konuk kontenjanı dolu.");
    else if (response) setConnectionError("Konuk olma isteği gönderilemedi.");
    else setConnectionError("Bağlantı kurulamadı. Lütfen tekrar dene.");
    setRequestingJoin(false);
  };

  const toggleGuestCamera = () => {
    const nextCameraOff = !guestCameraOff;
    setGuestCameraOff(nextCameraOff);
    guestStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
  };

  useEffect(() => {
    const peer = peerRef.current;
    const stream = guestStreamRef.current;
    if (joinRequest?.status !== "accepted" || !guestStreamReady || !peer || !stream || guestOfferSentRef.current) return;
    let cancelled = false;
    const negotiateGuest = async () => {
      try {
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === "complete") return resolve();
          peer.addEventListener("icegatheringstatechange", () => {
            if (peer.iceGatheringState === "complete") resolve();
          });
          window.setTimeout(resolve, 3000);
        });
        if (cancelled || !peer.localDescription) return;
        const response = await fetch(`/api/live/broadcasts/${broadcast.id}/signal`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "guest-offer", viewerId: viewerIdRef.current, description: JSON.stringify(peer.localDescription) }),
        });
        if (response.ok) guestOfferSentRef.current = true;
      } catch {
        setConnectionError("Konuk bağlantısı kurulamadı.");
      }
    };
    void negotiateGuest();
    return () => { cancelled = true; };
  }, [broadcast.id, guestStreamReady, joinRequest?.status]);

  useEffect(() => {
    if (joinRequest?.status !== "accepted" || !guestStreamReady) return;
    let cancelled = false;
    const loadGuestAnswer = async () => {
      const response = await fetch(`/api/live/broadcasts/${broadcast.id}/signal?viewerId=${encodeURIComponent(viewerIdRef.current)}`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as { guestAnswer?: string | null };
      if (!guestOfferSentRef.current || !data.guestAnswer || !peerRef.current || guestAnswerAppliedRef.current) return;
      const peer = peerRef.current;
      if (peer.signalingState !== "have-local-offer") return;
      try {
        await peer.setRemoteDescription(JSON.parse(data.guestAnswer) as RTCSessionDescriptionInit);
        guestAnswerAppliedRef.current = true;
      } catch {
        // A newer negotiation may have already moved this peer to stable.
      }
    };
    const timer = window.setInterval(() => void loadGuestAnswer(), 1000);
    void loadGuestAnswer();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [broadcast.id, guestStreamReady, joinRequest?.status]);

  useEffect(() => {
    if (!joined || !isActiveScene) {
      setConnecting(false);
      return;
    }
    let cancelled = false;
    let connectingNow = false;
    answerSentRef.current = false;
    guestOfferSentRef.current = false;
    guestAnswerAppliedRef.current = false;
    viewerIdRef.current = crypto.randomUUID();
    const connectToBroadcast = async () => {
      if (!isActiveScene || connectingNow || cancelled) return;
      if (answerSentRef.current) {
        await fetch(
          `/api/live/broadcasts/${broadcast.id}/signal?viewerId=${encodeURIComponent(viewerIdRef.current)}`,
          { cache: "no-store" },
        ).catch(() => {});
        return;
      }
      connectingNow = true;
      setConnecting(true);
      try {
        const signalResponse = await fetch(
          `/api/live/broadcasts/${broadcast.id}/signal?viewerId=${encodeURIComponent(viewerIdRef.current)}`,
          { cache: "no-store" },
        );
        if (!signalResponse.ok) {
          if (signalResponse.status === 404) {
            setConnectionError("Bu canlı yayın sona ermiş.");
            return;
          }
          throw new Error(`Live signal request failed (${signalResponse.status})`);
        }
        const signal = (await signalResponse.json()) as {
          offer?: string | null;
        };
        if (!signal.offer || answerSentRef.current) return;
        lastBroadcastOfferRef.current = signal.offer;
        const peer = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
          ],
        });
        peerRef.current = peer;
        guestStreamRef.current?.getTracks().forEach((track) => {
          if (!peer.getSenders().some((sender) => sender.track?.id === track.id)) {
            peer.addTrack(track, guestStreamRef.current!);
          }
        });
        peer.ontrack = (event) => {
          const stream = event.streams[0] ?? new MediaStream([event.track]);
          if (liveVideoRef.current && !liveVideoRef.current.srcObject) {
            liveVideoRef.current.srcObject = stream;
            liveVideoRef.current.style.transform = "scaleX(-1)";
            liveVideoRef.current.style.webkitTransform = "scaleX(-1)";
            setStreamConnected(true);
            if (event.track.kind === "video") {
              event.track.onmute = () => setRemoteHostCameraOff(true);
              event.track.onunmute = () => setRemoteHostCameraOff(false);
            }
            setConnecting(false);
            setConnectionError("");
            liveVideoRef.current.onloadedmetadata = () => {
              void liveVideoRef.current?.play().catch(() => {});
            };
            void liveVideoRef.current.play().catch(() => {});
          } else if (liveVideoRef.current?.srcObject === stream) {
            return;
          } else {
            setRemoteGuestStreams((current) => current.some((item) => item.stream.id === stream.id)
              ? current
              : [...current, { stream, user: participants[current.length] }]);
            setRemoteGuestReady(true);
            if (event.track.kind === "video") {
              event.track.onmute = () => setRemoteGuestCameraOff((current) => ({ ...current, [stream.id]: true }));
              event.track.onunmute = () => setRemoteGuestCameraOff((current) => ({ ...current, [stream.id]: false }));
            }
          }
        };
        peer.onconnectionstatechange = () => {
          if (
            peer.connectionState === "failed" ||
            peer.connectionState === "disconnected"
          ) {
            setStreamConnected(false);
            setConnecting(false);
            setConnectionError("Canlı kamera bağlantısı koptu.");
            if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
            liveVideoRef.current && (liveVideoRef.current.muted = true);
            setAudioEnabled(false);
            peer.close();
            if (peerRef.current === peer) {
              peerRef.current = null;
              answerSentRef.current = false;
              viewerIdRef.current = crypto.randomUUID();
            }
          }
        };
        if (peer.signalingState !== "stable") return;
        await peer.setRemoteDescription(JSON.parse(signal.offer) as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await Promise.race([
          new Promise<void>((resolve) => {
            if (peer.iceGatheringState === "complete") return resolve();
            peer.addEventListener("icegatheringstatechange", () => {
              if (peer.iceGatheringState === "complete") resolve();
            });
          }),
          new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
        ]);
        if (cancelled || !peer.localDescription) return;
        const response = await fetch(
          `/api/live/broadcasts/${broadcast.id}/signal`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "answer",
              viewerId: viewerIdRef.current,
              description: JSON.stringify(peer.localDescription),
            }),
          },
        );
        if (!response.ok) {
          throw new Error(`Live answer request failed (${response.status})`);
        }
        answerSentRef.current = true;
      } catch {
        peerRef.current?.close();
        peerRef.current = null;
        answerSentRef.current = false;
        setConnectionError("Canlı yayına bağlanılamadı. Yeniden bağlanmayı deneyin.");
      } finally {
        connectingNow = false;
        if (!answerSentRef.current) setConnecting(false);
      }
    };
    void connectToBroadcast();
    const timer = window.setInterval(() => void connectToBroadcast(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      peerRef.current?.close();
      peerRef.current = null;
      guestStreamRef.current?.getTracks().forEach((track) => track.stop());
      guestStreamRef.current = null;
      setGuestLocalStream(null);
      setGuestStreamReady(false);
      setRemoteGuestReady(false);
      setRemoteGuestStreams([]);
      setRemoteGuestCameraOff({});
      setRemoteHostCameraOff(false);
      setGuestCameraOff(false);
      setAudioEnabled(false);
      answerSentRef.current = false;
      guestOfferSentRef.current = false;
      guestAnswerAppliedRef.current = false;
      if (guestVideoRef.current) guestVideoRef.current.srcObject = null;
      setStreamConnected(false);
      setConnecting(false);
      if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    };
  }, [broadcast.id, user, isActiveScene, joined]);

  useEffect(() => {
    if (!joined || streamConnected) return;
    const timeout = window.setTimeout(() => {
      if (!liveVideoRef.current?.srcObject) {
        setConnecting(false);
        setConnectionError("Yayıncı bağlantısı yanıt vermiyor. Biraz sonra yeniden deneyebilirsin.");
      }
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [broadcast.id, joined, streamConnected]);

  useEffect(() => {
    if (!streamConnected || !peerRef.current) return;
    let cancelled = false;
    const acceptBroadcastOffer = async () => {
      try {
        const response = await fetch(`/api/live/broadcasts/${broadcast.id}/signal?viewerId=${encodeURIComponent(viewerIdRef.current)}`, { cache: "no-store" }).catch(() => null);
        if (!response?.ok || cancelled) return;
        const data = (await response.json()) as { offer?: string | null };
        if (!data.offer || data.offer === lastBroadcastOfferRef.current || !peerRef.current) return;
        const peer = peerRef.current;
        if (peer.signalingState !== "stable") return;
        await peer.setRemoteDescription(JSON.parse(data.offer) as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === "complete") return resolve();
          peer.addEventListener("icegatheringstatechange", () => {
            if (peer.iceGatheringState === "complete") resolve();
          });
          window.setTimeout(resolve, 3000);
        });
        if (cancelled || !peer.localDescription) return;
        await fetch(`/api/live/broadcasts/${broadcast.id}/signal`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "answer", viewerId: viewerIdRef.current, description: JSON.stringify(peer.localDescription) }),
        });
        lastBroadcastOfferRef.current = data.offer;
      } catch {
        // Ignore a stale offer; the next stable poll will retry it.
      }
    };
    const timer = window.setInterval(() => void acceptBroadcastOffer(), 1000);
    void acceptBroadcastOffer();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [broadcast.id, streamConnected]);

  useEffect(() => {
    let cancelled = false;
    const loadComments = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${broadcast.id}/comments`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const items = (await response.json()) as LiveComment[];
        if (!cancelled) setComments(items);
      } catch {
        if (!cancelled) setComments([]);
      }
    };
    void loadComments();
    const timer = window.setInterval(() => void loadComments(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [broadcast.id]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${broadcast.id}/stats`,
          { cache: "no-store" },
        );
        if (response.ok && !cancelled) {
          const nextStats = (await response.json()) as LiveStats;
          setLiveStats((current) => ({ ...current, ...nextStats }));
        }
      } catch {
        // Ranking refresh is best-effort.
      }
    };
    void loadStats();
    const timer = window.setInterval(() => void loadStats(), 750);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [broadcast.id]);

  useEffect(() => {
    let cancelled = false;
    const loadClub = async () => {
      try {
        const response = await fetch(`/api/live/creators/${broadcast.user.id}/yanki-kulubu`, { credentials: "include", cache: "no-store" });
        if (!response.ok || cancelled) return;
        const nextClub = (await response.json()) as LiveCreatorClub;
        setCreatorClub(nextClub);
        setClubNameDraft((current) => current || nextClub.clubName);
      } catch {
        if (!cancelled) setClubError("Topluluk bilgileri şu anda yüklenemiyor.");
      }
    };
    void loadClub();
    const timer = window.setInterval(() => void loadClub(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [broadcast.user.id]);

  useEffect(() => {
    const newGifts = giftEvents.filter((gift) => !seenGiftIdsRef.current.has(gift.id));
    if (newGifts.length === 0) return;
    newGifts.forEach((gift) => {
      seenGiftIdsRef.current.add(gift.id);
      giftAnimationQueueRef.current.push(gift);
    });
    setActiveGiftEvent((current) => current ?? giftAnimationQueueRef.current.shift() ?? null);
  }, [giftEvents, joined, streamConnected]);

  useEffect(() => {
    const commentsElement = commentsListRef.current;
    if (!commentsElement || !commentsAtBottomRef.current) return;
    commentsElement.scrollTop = commentsElement.scrollHeight;
  }, [comments]);

  useEffect(() => {
    let cancelled = false;
    const loadGifts = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${broadcast.id}/gifts`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const items = (await response.json()) as LiveGiftEvent[];
        if (!cancelled) setGiftEvents(items);
      } catch {
        // Gift polling is best-effort and should not interrupt the stream.
      }
    };
    void loadGifts();
    const timer = window.setInterval(() => void loadGifts(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [broadcast.id]);

  useEffect(() => {
    if ((!giftPanelOpen && !collectionPanelOpen) || gifts.length > 0) return;
    fetch("/api/live/animations", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: LiveGift[]) => setGifts(items))
      .catch(() => setGifts([]));
  }, [giftPanelOpen, collectionPanelOpen, gifts.length]);

  useEffect(() => {
    if (!giftPanelOpen || !user) return;
    let cancelled = false;
    setCoinWalletLoading(true);
    fetch("/api/live/coin-wallet", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Bakiye alınamadı. Lütfen yeniden deneyin.");
        return (await response.json()) as LiveCoinWallet;
      })
      .then(async (wallet) => {
        if (cancelled) return;
        setCoinWallet(wallet);
        setCoinWalletError("");
        if (Capacitor.getPlatform() !== "android" || !wallet.googlePlayReady) return;

        await NativePurchases.configure({ autoFinishTransactions: false });
        const productIds = wallet.packages.map((item) => item.playProductId);
        const { products } = await NativePurchases.getProducts({
          productIdentifiers: productIds,
          productType: PURCHASE_TYPE.INAPP,
        });
        if (cancelled) return;
        setGooglePlayProducts(Object.fromEntries(products.map((product) => [product.identifier, { priceString: product.priceString }])));

        const { transactions } = await NativePurchases.getUnfinishedTransactions();
        for (const transaction of transactions) {
          if (cancelled || !transaction.purchaseToken) continue;
          if (wallet.packages.some((item) => item.playProductId === transaction.productIdentifier)) {
            const result = await verifyGoogleCoinPurchase(transaction.productIdentifier, transaction.purchaseToken);
            if (typeof result.balance === "number") {
              setCoinWallet((current) => current ? { ...current, balance: result.balance! } : current);
            }
            if (result.finalizationPending) setCoinWalletError("Coinler bakiyene eklendi; Google Play işleminin son onayı tekrar denenecek.");
          } else if (transaction.productIdentifier === "loop_premium_monthly") {
            const result = await verifyGooglePremiumPurchase(transaction.productIdentifier, transaction.purchaseToken);
            if (result.acknowledgementPending) setCoinWalletError("Premium aboneliğin doğrulandı; Google Play son onayı tekrar denenecek.");
          }
        }
      })
      .catch((error) => { if (!cancelled) setCoinWalletError(error instanceof Error ? error.message : "Bakiye alınamadı."); })
      .finally(() => { if (!cancelled) setCoinWalletLoading(false); });
    return () => { cancelled = true; };
  }, [giftPanelOpen, user]);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("coinOrder");
    if (!orderId || !user) return;
    setGiftPanelOpen(true);
    void fetch(`/api/live/coin-wallet/orders/${encodeURIComponent(orderId)}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string; status?: string; balance?: number };
        if (!response.ok) throw new Error(result.error || "Ödeme durumu doğrulanamadı.");
        if (typeof result.balance === "number") setCoinWallet((current) => current ? { ...current, balance: result.balance! } : current);
        if (result.status === "paid") setGiftMessage("Ödeme onaylandı, coinler bakiyene eklendi.");
        else if (result.status === "review" || result.status === "pending") setGiftMessage("Ödeme sağlayıcı onayı bekleniyor. Bakiye onaydan sonra güncellenecek.");
        else setGiftMessage("Ödeme tamamlanmadı; bakiyenden coin düşülmedi.");
      })
      .catch((error) => setCoinWalletError(error instanceof Error ? error.message : "Ödeme durumu doğrulanamadı."))
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("coinOrder");
        window.history.replaceState(window.history.state, "", url.toString());
      });
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRankingPeriod((period) => period === "hourly" ? "daily" : period === "daily" ? "weekly" : "hourly");
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const sendGift = async (gift: LiveGift) => {
    if (giftSending || !user) return;
    setGiftSending(true);
    setGiftMessage("");
    try {
      const response = await fetch(
        `/api/live/broadcasts/${broadcast.id}/gifts`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ giftId: gift.id, recipientId: giftRecipientId }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as { error?: string; balance?: number };
      if (!response.ok) {
        if (typeof result.balance === "number") setCoinWallet((current) => current ? { ...current, balance: result.balance! } : current);
        throw new Error(result.error || "Hediye gönderilemedi. Lütfen tekrar dene.");
      }
      if (typeof result.balance === "number") setCoinWallet((current) => current ? { ...current, balance: result.balance! } : current);
      setSelectedGift(gift.id);
      const recipient = [broadcast.user, ...participants].find((item) => item.id === giftRecipientId);
      setGiftMessage(`${gift.name} @${recipient?.username ?? broadcast.user.username} kullanıcısına gönderildi!`);
      if (giftRecipientId === broadcast.user.id) {
        void fetch(`/api/live/creators/${broadcast.user.id}/yanki-kulubu`, { credentials: "include", cache: "no-store" })
          .then((clubResponse) => clubResponse.ok ? clubResponse.json() as Promise<LiveCreatorClub> : null)
          .then((nextClub) => { if (nextClub) setCreatorClub(nextClub); })
          .catch(() => setClubError("Destekçi seviyen yenilenemedi; birkaç saniye sonra kulüp panelini tekrar aç."));
      }
      window.setTimeout(() => {
        setSelectedGift(null);
        setGiftMessage("");
      }, 1000);
    } catch (error) {
      setGiftMessage(error instanceof Error ? error.message : "Hediye gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setGiftSending(false);
    }
  };

  const buyCoinPackage = async () => {
    const coinPackage = coinWallet?.packages.find((item) => item.id === checkoutPackageId);
    const isAndroid = Capacitor.getPlatform() === "android";
    const paymentReady = isAndroid ? coinWallet?.googlePlayReady : coinWallet?.paymentReady;
    if (!user || !coinPackage || !paymentReady || !coinWallet || coinWallet.paymentExempt || coinPurchaseId) return;
    setCoinPurchaseId(coinPackage.id);
    setCoinWalletError("");
    try {
      if (isAndroid) {
        const storeProduct = googlePlayProducts[coinPackage.playProductId];
        if (!storeProduct) throw new Error("Bu coin paketi şu anda Google Play mağazasında bulunamadı.");
        const accountDigest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`loop:${user.id}`),
        );
        const appAccountToken = Array.from(new Uint8Array(accountDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        const purchase = await NativePurchases.purchaseProduct({
          productIdentifier: coinPackage.playProductId,
          productType: PURCHASE_TYPE.INAPP,
          appAccountToken,
          autoAcknowledgePurchases: false,
          isConsumable: false,
        });
        if (!purchase.purchaseToken) throw new Error("Google Play satın alma tokenı alınamadı.");
        const result = await verifyGoogleCoinPurchase(coinPackage.playProductId, purchase.purchaseToken);
        if (typeof result.balance === "number") {
          setCoinWallet((current) => current ? { ...current, balance: result.balance! } : current);
        }
        setGiftMessage(result.finalizationPending
          ? "Coinler bakiyene eklendi; Google Play son onayı tekrar denenecek."
          : "Satın alma doğrulandı, coinler bakiyene eklendi.");
        setCheckoutPackageId(null);
        return;
      }

      const response = await fetch("/api/live/coin-wallet/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: coinPackage.id, buyer: paymentBuyer }),
      });
      const result = (await response.json()) as { error?: string; paymentPageUrl?: string };
      if (!response.ok || !result.paymentPageUrl) throw new Error(result.error || "iyzico ödeme sayfası açılamadı.");
      window.location.assign(result.paymentPageUrl);
    } catch (error) {
      setCoinWalletError(error instanceof Error ? error.message : "Coin satın alma başlatılamadı.");
    } finally {
      setCoinPurchaseId(null);
    }
  };

  const toggleCreatorClubMembership = async () => {
    if (!user || !creatorClub || clubRequesting) return;
    setClubRequesting(true);
    setClubError("");
    try {
      const response = await fetch(`/api/live/creators/${broadcast.user.id}/yanki-kulubu${creatorClub.isMember ? "/uyelik" : "/katil"}`, {
        method: creatorClub.isMember ? "DELETE" : "POST",
        credentials: "include",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Kulüp üyeliği güncellenemedi.");
      const refreshed = await fetch(`/api/live/creators/${broadcast.user.id}/yanki-kulubu`, { credentials: "include", cache: "no-store" });
      if (!refreshed.ok) throw new Error("Kulüp bilgileri yenilenemedi.");
      setCreatorClub((await refreshed.json()) as LiveCreatorClub);
    } catch (error) {
      setClubError(error instanceof Error ? error.message : "Kulüp üyeliği güncellenemedi.");
    } finally {
      setClubRequesting(false);
    }
  };

  const saveCreatorClubName = async () => {
    if (!creatorClub?.isOwner || clubNameSaving) return;
    const name = clubNameDraft.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 32) {
      setClubError("Topluluk adı 2 ile 32 karakter arasında olmalı.");
      return;
    }
    setClubNameSaving(true);
    setClubError("");
    try {
      const response = await fetch(`/api/live/creators/${broadcast.user.id}/yanki-kulubu/ad`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as { error?: string; clubName?: string };
      if (!response.ok) throw new Error(result.error || "Topluluk adı kaydedilemedi.");
      const savedName = result.clubName ?? name;
      setClubNameDraft(savedName);
      setCreatorClub((current) => current ? { ...current, clubName: savedName } : current);
    } catch (error) {
      setClubError(error instanceof Error ? error.message : "Topluluk adı kaydedilemedi.");
    } finally {
      setClubNameSaving(false);
    }
  };

  const sendComment = async () => {
    const content = commentText.trim();
    if (!content || sending || !user || !joined) return;
    setSending(true);
    try {
      const response = await fetch(
        `/api/live/broadcasts/${broadcast.id}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, replyToId: replyingTo?.id }),
        },
      );
      if (!response.ok) throw new Error("comment_failed");
      const comment = (await response.json()) as LiveComment;
      setComments((current) => [...current.slice(-49), comment]);
      setCommentText("");
      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  };

  const sendLiveLike = async () => {
    if (!user) return;
    const response = await fetch(`/api/live/broadcasts/${broadcast.id}/like`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) {
      const data = (await response.json()) as { likeCount?: number };
      if (typeof data.likeCount === "number") {
        setLiveStats((current) => ({ ...current, liveLikeCount: data.likeCount! }));
      }
    }
  };

  const commentHeightLimit = typeof window !== "undefined"
    ? getBattleCommentHeightLimit(battle, window.innerHeight)
    : 44;
  const visibleCommentHeight = Math.min(commentHeight, commentHeightLimit);

  const updateCommentHeight = (value: number) => {
    const nextValue = Math.max(16, Math.min(commentHeightLimit, value));
    setCommentHeight(nextValue);
    try {
      window.localStorage.setItem(`loop-live-comment-height:${user?.id ?? "guest"}`, String(nextValue));
    } catch {
      // The setting remains active for this session if local storage is unavailable.
    }
  };

  const toggleLiveAudio = () => {
    const video = liveVideoRef.current;
    const nextAudioEnabled = !audioEnabled;
    setAudioError("");
    setAudioEnabled(nextAudioEnabled);
    if (!video) return;
    video.muted = !nextAudioEnabled;
    if (nextAudioEnabled) void video.play().catch(() => {
      video.muted = true;
      setAudioEnabled(false);
      setAudioError("Canlı yayın sesi başlatılamadı. Yeniden dokunun.");
    });
  };

  const handleLiveTouch = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (!joined || !streamConnected || !user) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientY - bounds.top < Math.min(160, bounds.height * 0.25)) return;
    event.preventDefault();
    const colors = ["#ff4d8d", "#ffcf4a", "#68e1ff", "#b388ff", "#7dff9f"];
    const heart = {
      id: heartIdRef.current++,
      color: colors[heartColorIndexRef.current++ % colors.length]!,
      left: Math.min(88, Math.max(4, ((event.clientX - bounds.left) / bounds.width) * 100)),
      top: Math.min(82, Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
    setFloatingHearts((current) => [...current.slice(-11), heart]);
    setLiveStats((current) => ({ ...current, liveLikeCount: current.liveLikeCount + 1 }));
    void sendLiveLike();
    window.setTimeout(() => setFloatingHearts((current) => current.filter((item) => item.id !== heart.id)), 1300);
  };

  useEffect(() => {
    if (!joined) {
      setJoinedNoticeVisible(false);
      return;
    }
    setJoinedNoticeVisible(true);
    const timer = window.setTimeout(() => setJoinedNoticeVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [joined]);

  const arenaScoreBar = arenaAssets.find(asset => asset.role === "score-bar");
  const arenaVsEmblem = arenaAssets.find(asset => asset.role === "vs-emblem");
  const arenaLeftTeam = arenaAssets.find(asset => asset.role === "left-team");
  const arenaRightTeam = arenaAssets.find(asset => asset.role === "right-team");
  const hourlyRankingLeader = liveStats.hourlyRanking[0];
  const dailyRankingLeader = liveStats.dailyRanking?.[0];
  const weeklyRankingLeader = liveStats.coinRanking[0];
  const rankingEntries = rankingPeriod === "live" ? liveStats.liveSupporters ?? [] : rankingPeriod === "hourly" ? liveStats.hourlyRanking : rankingPeriod === "daily" ? liveStats.dailyRanking ?? [] : liveStats.coinRanking;
  const rankingLeader = rankingPeriod === "live" ? liveStats.liveSupporters?.[0] : rankingPeriod === "hourly" ? hourlyRankingLeader : rankingPeriod === "daily" ? dailyRankingLeader : weeklyRankingLeader;
  const rankingPeriodLabel = rankingPeriod === "live" ? "Bu Canlıdaki Destekçiler" : rankingPeriod === "hourly" ? "Saatlik Akış" : rankingPeriod === "daily" ? "Günlük Akış" : "Haftalık Loop Ligi";
  const rankingRangeLabel = rankingPeriod === "live" ? "Yalnızca bu yayındaki toplam destek" : rankingPeriod === "hourly" ? "Son 60 dakikadaki destek" : rankingPeriod === "daily" ? "Son 24 saatteki destek" : "Son 7 gün · Bu yayın";
  const weeklyLeague = weeklyRankingLeader?.league ?? null;
  const featuredGiftIds = liveStats.collection.featuredGiftIds ?? liveStats.collection.gifts;
  const collectionGifts = gifts.filter((gift) => featuredGiftIds.includes(gift.id));
  const openGiftPanelFor = (participantId: number) => {
    setGiftRecipientId(participantId);
    setGiftPanelOpen(true);
  };
  const battleSides = battle?.scores ?? [];
  const guestContestant = battleSides[1]?.user ?? participants[0];
  const viewerIsGuestContestant = Boolean(user && guestContestant?.id === user.id);
  const kapismaOpponent = viewerIsGuestContestant ? battleSides[0]?.user ?? broadcast.user : guestContestant;
  const guestIsMainScreen = Boolean(joined && battle?.active && (viewerIsGuestContestant ? !showOpponentScreen : showOpponentScreen));
  const hostIsPictureInPicture = guestIsMainScreen;
  const guestIsPictureInPicture = Boolean(battle?.active && !guestIsMainScreen);
  const viewerCameraGuestCount = Math.max(
    remoteGuestStreams.length + Number(Boolean(guestLocalStream)),
    participants.filter((participant) => participant.id !== broadcast.user.id).length,
  );
  const viewerCameraCount = 1 + viewerCameraGuestCount;
  const showLegacyGuestSplit = Boolean(joined && !battle?.active && viewerCameraGuestCount > 0);
  const giftRecipients = (battle?.active && battle.scores?.length
    ? battle.scores.map((entry) => entry.user)
    : [broadcast.user, ...participants]).filter((participant) => participant.id !== user?.id);
  const paymentBuyerFields: Array<{ key: keyof LivePaymentBuyer; label: string; placeholder: string; type?: string }> = [
    { key: "name", label: "Ad", placeholder: "Adınız" },
    { key: "surname", label: "Soyad", placeholder: "Soyadınız" },
    { key: "identityNumber", label: "T.C. kimlik / pasaport no", placeholder: "Kimlik veya pasaport numarası" },
    { key: "email", label: "E-posta", placeholder: "ornek@eposta.com", type: "email" },
    { key: "phone", label: "Telefon", placeholder: "+90 5xx xxx xx xx", type: "tel" },
    { key: "address", label: "Fatura adresi", placeholder: "Adres" },
    { key: "city", label: "Şehir", placeholder: "Şehir" },
    { key: "country", label: "Ülke", placeholder: "Ülke" },
    { key: "zipCode", label: "Posta kodu", placeholder: "Posta kodu" },
  ];
  const selectedCoinPackage = coinWallet?.packages.find((item) => item.id === checkoutPackageId);
  const isAndroidPlatform = Capacitor.getPlatform() === "android";
  const coinPurchaseReady = isAndroidPlatform ? coinWallet?.googlePlayReady : coinWallet?.paymentReady;

  return (
    <section
      id={`live-broadcast-${broadcast.id}`}
      data-live-broadcast={broadcast.id}
      className="live-arena-surface live-viewer-scene relative h-full w-full shrink-0 snap-start overflow-hidden"
      style={{
        scrollSnapStop: "always",
        ...({ "--live-comment-list-height": `${visibleCommentHeight}vh` } as React.CSSProperties),
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.08),transparent_30%)]" />
      <LiveEventBanner events={events} className="top-[27%]" />
      {arenaAssets.filter(asset => asset.role === "background").slice(0, 1).map(asset => asset.mimeType.startsWith("video/") ? (
        <video key={asset.id} src={asset.url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-80" />
      ) : (
        <img key={asset.id} src={asset.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      ))}
      {arenaAssets.filter(asset => asset.role === "overlay").slice(0, 1).map(asset => asset.mimeType.startsWith("video/") ? (
        <video key={asset.id} src={asset.url} autoPlay muted loop playsInline className="pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover opacity-80 mix-blend-screen" />
      ) : (
        <img key={asset.id} src={asset.url} alt="" className="pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover opacity-80 mix-blend-screen" />
      ))}
      {joined && streamConnected && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
          {floatingHearts.map((heart) => (
            <Heart key={heart.id} className="live-floating-heart absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 fill-current drop-shadow-lg" style={{ left: `${heart.left}%`, top: `${heart.top}%`, color: heart.color }} />
          ))}
        </div>
      )}
      <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="order-1 mr-auto flex max-w-[min(82vw,26rem)] min-w-0 flex-col items-start gap-1">
          <div className="live-arena-glass flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1 shadow-xl shadow-black/20 sm:gap-2 sm:px-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/80 bg-violet-500/30 sm:h-9 sm:w-9">
              {broadcast.user.avatarUrl ? (
                <img src={broadcast.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-black text-white">
                  {broadcast.user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="max-w-20 truncate text-xs font-black text-white sm:max-w-40 sm:text-sm">
                  {broadcast.user.displayName || broadcast.user.username}
                </p>
                <button
                  type="button"
                  onClick={() => { setClubError(""); setClubPanelOpen(true); }}
                  aria-label="Hayran Kulübü alanını aç"
                  title="Hayran Kulübü"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-200/25 bg-violet-500/20 text-violet-100 transition hover:bg-violet-500/35"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={!user}
              onClick={() => setFollowing((value) => !value)}
              aria-label={following ? "İçerik üreticisini takipten çıkar" : "İçerik üreticisini takip et"}
              className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-500 px-2 py-1.5 text-[10px] font-black text-white shadow-md transition hover:brightness-110 disabled:opacity-50 sm:px-2.5"
            >
              {following ? "Takipte" : "+ Takip et"}
            </button>
          </div>
          <div className="flex items-center gap-1.5 pl-1 pt-1">
            <span className="flex h-4 items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-500 px-1.5 text-[8px] font-bold leading-none text-white shadow-sm">
              <span className="h-1 w-1 animate-pulse rounded-full bg-rose-400" />
              CANLI
            </span>
            <span aria-label={`${count(liveStats.viewerCount)} izleyici`} className="flex h-4 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-1.5 text-[9px] font-semibold leading-none text-white/80">
              <Eye className="h-2.5 w-2.5 text-white/65" />
              {count(liveStats.viewerCount)}
            </span>
          </div>
        </div>
        <div className="relative order-2 flex max-w-[35%] shrink-0 flex-wrap items-center justify-end gap-1.5">
          {(liveStats.liveSupporters ?? []).length > 0 && (
            <button
              type="button"
              aria-label="Bu canlıdaki ilk üç destekçinin bilgilerini aç"
              title="Bu canlıdaki en çok destek verenler"
              onClick={() => { setRankingPeriod("live"); setRankingPanelOpen(true); }}
              className="flex items-end gap-1 rounded-xl px-1 py-0.5 transition hover:bg-white/10"
            >
              {(liveStats.liveSupporters ?? []).slice(0, 3).map((supporter, index) => (
                <span key={supporter.user.id} className="flex w-7 flex-col items-center gap-0.5">
                  <span className="relative h-6 w-6 overflow-hidden rounded-full border border-amber-200/60 bg-violet-500/70 text-[9px] font-black text-white shadow-sm">
                    {supporter.user.avatarUrl ? <img src={supporter.user.avatarUrl} alt={supporter.user.displayName || supporter.user.username} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center">{(supporter.user.displayName || supporter.user.username).charAt(0).toUpperCase()}</span>}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-[#211b27] bg-[#c6a365] text-[7px] font-black text-[#21180b]">{index + 1}</span>
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-black/65 px-1 text-[8px] font-black leading-3 text-amber-100">
                    <Coins className="h-2 w-2" />{supporter.coins.toLocaleString("tr-TR")}
                  </span>
                </span>
              ))}
            </button>
          )}
          {streamConnected && (
            <button
              type="button"
              aria-label={audioEnabled ? "Yayın sesini kapat" : "Yayın sesini aç"}
              title={audioEnabled ? "Yayın sesini kapat" : "Yayın sesini aç"}
              onClick={toggleLiveAudio}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md"
            >
              {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            aria-label="Yayından çık"
            onClick={() => {
              setAudioEnabled(false);
              setJoined(false);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      {joined && audioError && (
        <p role="alert" className="absolute right-3 top-14 z-40 max-w-[min(80vw,24rem)] rounded-xl border border-rose-200/20 bg-black/80 px-3 py-2 text-right text-xs font-semibold text-rose-100 shadow-lg">
          {audioError}
        </p>
      )}
      {joined && battle?.active && kapismaOpponent && (
        <button
          type="button"
          onClick={() => {
            if (battle?.opponentBroadcastId) {
              onSwitchBroadcast(battle.opponentBroadcastId);
              return;
            }
            setShowOpponentScreen((current) => !current);
          }}
          aria-label={battle?.opponentBroadcastId ? "Rakip yayıncıya geç" : viewerIsGuestContestant ? "Yayıncı ekranına geç" : "Rakip ekranına geç"}
          aria-pressed={showOpponentScreen}
          title={battle?.opponentBroadcastId ? "Rakip yayıncıya geç" : viewerIsGuestContestant ? "Yayıncı ekranına geç" : "Rakip ekranına geç"}
          className="absolute right-4 top-[5.4rem] z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/70 shadow-lg backdrop-blur transition hover:scale-105"
        >
          {kapismaOpponent.avatarUrl ? <img src={kapismaOpponent.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-xs font-black text-white">{(kapismaOpponent.displayName || kapismaOpponent.username).charAt(0).toUpperCase()}</span>}
          <Repeat2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-black p-0.5 text-white" aria-hidden="true" />
        </button>
      )}
      {rankingPanelOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setRankingPanelOpen(false)}>
          <section className="w-full max-w-sm overflow-hidden rounded-3xl border border-fuchsia-200/20 bg-[linear-gradient(155deg,rgba(31,10,49,0.98),rgba(10,5,20,0.98))] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.16)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70">LOOP DESTEK LİGİ</p><h3 className="mt-1 text-base font-black">{rankingPeriodLabel}</h3><p className="mt-0.5 text-[10px] text-white/50">{rankingRangeLabel}</p></div>
              <button type="button" aria-label="Sıralamayı kapat" onClick={() => setRankingPanelOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 grid grid-cols-4 rounded-xl border border-white/8 bg-black/25 p-1">
              {([["live", "Bu canlı"], ["hourly", "1 saat"], ["daily", "24 saat"], ["weekly", "7 gün"]] as const).map(([period, label]) => <button key={period} type="button" aria-pressed={rankingPeriod === period} onClick={() => setRankingPeriod(period)} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold transition ${rankingPeriod === period ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow" : "text-white/55 hover:text-white"}`}>{label}</button>)}
            </div>
            {liveStats.myLeague && (
              <div className="mb-3 rounded-2xl border border-[#c6a365]/15 bg-gradient-to-r from-[#a8843e]/[0.12] via-[#211b27]/75 to-[#17131c] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Senin lig seviyen</p><p className="mt-0.5 text-xs font-black text-[#f0e3c5]">{liveStats.myLeague.label}</p></div>
                  <span className="text-[9px] font-bold text-[#ddc88e]">{liveStats.myLeague.fragmentCount ? `${liveStats.myLeague.fragments}/${liveStats.myLeague.fragmentCount} parça` : `${liveStats.myLeague.points}/${liveStats.myLeague.pointsPerStage} puan`}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/45">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c6a365] to-[#f2dfb0]" style={{ width: `${(liveStats.myLeague.fragmentCount ? liveStats.myLeague.fragments / liveStats.myLeague.fragmentCount : liveStats.myLeague.points / liveStats.myLeague.pointsPerStage) * 100}%` }} />
                </div>
              </div>
            )}
            {rankingPeriod === "weekly" && weeklyRankingLeader && weeklyLeague && (
              <div className="mb-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/25 text-lg text-[#e4c98e]"><Sparkles className="h-5 w-5" /></span>
                    <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Bu yayının lig lideri</p><p className="text-xs font-black">@{weeklyRankingLeader.user.username} · {weeklyLeague.label}</p></div>
                  </div>
                  <span className="rounded-full px-2 py-1 text-[9px] font-black" style={{ color: "#e4c98e", backgroundColor: "rgba(198,163,101,0.12)" }}>{weeklyLeague.points}/{weeklyLeague.pointsPerStage} puan</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c6a365] to-[#f2dfb0] transition-[width] duration-500" style={{ width: `${weeklyLeague.points / weeklyLeague.pointsPerStage * 100}%` }} />
                </div>
                <p className="mt-1 text-[9px] text-white/45">Saatlik dönemde ilk %20 puan kazanır, son %20 puan kaybeder.</p>
              </div>
            )}
            {rankingEntries.length === 0 ? <p className="py-8 text-center text-xs text-white/55">Bu yayında henüz destek yok.</p> : <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">{rankingEntries.map((entry, index) => {
              const league = "league" in entry ? entry.league : undefined;
              return (
                <div key={entry.user.id} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${index === 0 ? "border-fuchsia-300/25 bg-fuchsia-400/10" : "border-white/6 bg-white/[0.025]"}`}>
                  <span className={`w-5 text-center text-[11px] font-black ${index === 0 ? "text-fuchsia-200" : "text-white/45"}`}>{String(index + 1).padStart(2, "0")}</span>
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-fuchsia-200/25 bg-fuchsia-500/20">{entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-black">{(entry.user.displayName || entry.user.username).charAt(0).toUpperCase()}</span>}</div>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">@{entry.user.username}</span>
                  {league && <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black text-[#e4c98e] bg-[#c6a365]/10">{league.label}</span>}
                  <span className="flex items-center gap-1 text-xs font-black text-fuchsia-100"><Coins className="h-3 w-3 text-fuchsia-300" />{entry.coins.toLocaleString("tr-TR")}</span>
                </div>
              );
            })}</div>}
          </section>
        </div>
      )}
      {clubPanelOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={() => setClubPanelOpen(false)}>
          <section className="w-full max-w-sm overflow-hidden rounded-3xl border border-violet-200/20 bg-[linear-gradient(155deg,rgba(30,18,58,0.98),rgba(8,8,20,0.98))] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_35px_rgba(139,92,246,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-200/70">HAYRAN KULÜBÜ</p>
                <h3 className="mt-1 text-base font-black">{creatorClub?.clubName ?? "Hayran Kulübü"}</h3>
                <p className="mt-0.5 text-[10px] text-white/50">{creatorClub?.memberCount ?? 0} üye · Katılım ücretsiz</p>
              </div>
              <button type="button" aria-label="Topluluk panelini kapat" onClick={() => setClubPanelOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"><X className="h-4 w-4" /></button>
            </div>
            {creatorClub ? (
              <>
                {creatorClub.isOwner && (
                  <div className="mb-3 rounded-2xl border border-violet-200/15 bg-black/20 p-3">
                    <label htmlFor={`live-club-name-${broadcast.id}`} className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-white/55">Hayran kulübüne bir ad ver</label>
                    <div className="flex gap-2">
                      <input id={`live-club-name-${broadcast.id}`} value={clubNameDraft} maxLength={32} onChange={(event) => setClubNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveCreatorClubName(); }} placeholder="Örn. Yıldız Takımı" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-violet-300/50 focus:outline-none" />
                      <button type="button" disabled={clubNameSaving || clubNameDraft.trim().length < 2 || clubNameDraft.trim() === creatorClub.clubName} onClick={() => void saveCreatorClubName()} className="shrink-0 rounded-xl bg-violet-500/20 px-3 py-2 text-[10px] font-black text-violet-100 transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40">{clubNameSaving ? "Kaydediliyor" : "Kaydet"}</button>
                    </div>
                    <p className="mt-1 text-[9px] text-white/35">2–32 karakter. Adın tüm topluluk üyelerine görünür.</p>
                  </div>
                )}
                <div className="mb-3 rounded-2xl border border-fuchsia-200/15 bg-gradient-to-br from-fuchsia-400/[0.09] to-violet-400/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-300/10 text-fuchsia-100"><Sparkles className="h-5 w-5" /></span>
                      <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Kulübün ortak seviyesi</p><p className="text-sm font-black">{creatorClub.clubName} · Seviye {creatorClub.clubProgress.level}</p></div>
                    </div>
                    <span className="rounded-full bg-fuchsia-300/10 px-2 py-1 text-[9px] font-black text-fuchsia-100">{creatorClub.clubProgress.xp.toLocaleString("tr-TR")} XP</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/45"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-200 transition-[width] duration-500" style={{ width: `${creatorClub.clubProgress.progress}%` }} /></div>
                  <p className="mt-1.5 text-[9px] text-white/45">{creatorClub.clubProgress.nextLevelXp === null ? "Topluluk en üst seviyede" : `${(creatorClub.clubProgress.nextLevelXp - creatorClub.clubProgress.xp).toLocaleString("tr-TR")} XP sonra Topluluk Seviyesi ${creatorClub.clubProgress.level + 1} · Üyelerin hediyelerinden gelen XP birleşir`}</p>
                </div>
                <div className="mb-3 rounded-2xl border border-violet-200/15 bg-violet-300/[0.06] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><Sparkles className="h-5 w-5" /></span>
                      <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Hediye destekçi seviyen</p><p className="text-sm font-black">Seviye {creatorClub.myProgress.level}</p></div>
                    </div>
                    <span className="rounded-full bg-violet-300/10 px-2 py-1 text-[9px] font-black text-violet-100">{creatorClub.myRank ? `#${creatorClub.myRank} sıra` : "Üye değilsin"}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/45"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-300 transition-[width] duration-500" style={{ width: `${creatorClub.myProgress.progress}%` }} /></div>
                  <p className="mt-1.5 text-[9px] text-white/45">{creatorClub.myProgress.xp.toLocaleString("tr-TR")} XP · {creatorClub.myProgress.nextLevelXp === null ? "En üst seviye" : `${(creatorClub.myProgress.nextLevelXp - creatorClub.myProgress.xp).toLocaleString("tr-TR")} XP sonra Seviye ${creatorClub.myProgress.level + 1}`} · Hediyedeki her coin 1 XP kazandırır</p>
                </div>
                <button type="button" disabled={!user || clubRequesting || creatorClub.creator.id === user?.id} onClick={() => void toggleCreatorClubMembership()} className={`mb-3 w-full rounded-xl px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${creatorClub.isMember ? "border border-white/15 bg-white/[0.06] text-white/75 hover:bg-white/10" : "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-950/30 hover:brightness-110"}`}>
                  {!user ? "Kulübe katılmak için giriş yap" : creatorClub.creator.id === user.id ? "Bu senin hayran kulübün" : clubRequesting ? "Güncelleniyor..." : creatorClub.isMember ? "Kulüpten ayrıl" : "Ücretsiz katıl"}
                </button>
                {clubError && <p role="alert" className="mb-3 rounded-xl border border-rose-200/15 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-100">{clubError}</p>}
                <div className="mb-2 flex items-center justify-between"><h4 className="text-[10px] font-black uppercase tracking-wider text-white/65">Kulüp sıralaması</h4><span className="text-[9px] text-white/40">hediye XP&apos;ye göre</span></div>
                {creatorClub.members.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-[10px] text-white/45">İlk üye sen olabilirsin.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-1.5 overflow-y-auto pr-1">
                    {creatorClub.members.map((member, index) => (
                      <div key={member.user.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                        <span className={`w-4 text-center text-[10px] font-black ${index === 0 ? "text-amber-200" : "text-white/40"}`}>{index + 1}</span>
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-violet-200/20 bg-violet-400/15">{member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] font-black">{(member.user.displayName || member.user.username).charAt(0).toUpperCase()}</span>}</div>
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">@{member.user.username}</span>
                        <span className="rounded-full bg-violet-300/10 px-1.5 py-1 text-[8px] font-black text-violet-100">YS {member.level}</span>
                        <span className="text-[9px] font-bold text-white/55">{member.xp.toLocaleString("tr-TR")} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-xs text-white/55">{clubError || "Hayran kulübü bilgileri yükleniyor..."}</p>
            )}
          </section>
        </div>
      )}
      <div className="absolute left-3 right-3 top-[5.9rem] z-20 flex max-w-[min(94vw,42rem)] flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:left-4 sm:right-auto">
        <span className="flex h-7 items-center gap-1 rounded-full border border-amber-200/25 bg-black/55 px-2 text-[10px] font-black text-amber-100">
          <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "streak")} fallback={<span className="text-amber-300">🔥</span>} className="h-3.5 w-3.5" />
          {rankingPeriod === "live" ? "Bu Canlı" : rankingPeriod === "weekly" ? "Loop Ligi" : rankingPeriod === "hourly" ? "Saatlik Akış" : "Günlük Akış"}
          <span className="max-w-28 truncate text-white/85">
            {rankingLeader ? `@${rankingLeader.user.username} · ${rankingLeader.coins}` : "Henüz destekçi yok"}
          </span>
        </span>
        <button type="button" onClick={() => { setRankingPeriod("live"); setRankingPanelOpen(true); }} className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-amber-200/25 bg-black/55 px-2 text-[10px] font-bold text-amber-100">
          <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "ranking")} fallback={<Coins className="h-3 w-3" />} className="h-3.5 w-3.5" /> Sıralama
        </button>
        <button type="button" onClick={() => setCollectionPanelOpen(true)} className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-fuchsia-200/25 bg-black/55 px-2 text-[10px] font-bold text-fuchsia-100">
          <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "collection")} fallback={<ImagePlus className="h-3 w-3" />} className="h-3.5 w-3.5" /> Koleksiyon {liveStats.collection.collected}/{liveStats.collection.total}
        </button>
      </div>
      {joined && (battle?.active || battle?.remainingSeconds !== undefined || (user?.id === broadcast.user.id && (battle?.offers?.length ?? 0) > 0)) && (
        <div className="absolute left-2 right-2 top-[8.2rem] z-20 space-y-2 sm:left-4 sm:right-4">
          {battle && (battle.active || battle.remainingSeconds !== undefined) && <KapismaArena battle={battle} currentUserId={user?.id} canConfigurePalette={user?.id === broadcast.user.id} onSelectTeam={chooseBattleTeam} onSelectPalette={chooseBattlePalette} />}
          {isActiveScene && battle && battle.remainingSeconds === 0 && <KapismaResultAnimations battle={battle} animations={battleResultAnimations} />}
          {!battle?.active && user?.id === broadcast.user.id && (battle?.offers?.length ?? 0) > 0 && (
            <div className="pointer-events-auto space-y-2 rounded-xl border border-cyan-200/20 bg-[#071629]/90 p-2 text-white backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Kapışma teklifleri</p>
              {battle?.offers?.map((offer) => (
                <div key={offer.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">@{offer.from.username} Kapışma teklif etti</span>
                  <button type="button" onClick={() => void acceptBattleOffer(offer.id)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-black text-white">Kabul et</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {joined && battle?.active && <LiveBattleSupporters battle={battle} commentHeight={visibleCommentHeight} />}
      {joined && streamConnected && (
        <div className="absolute right-5 top-[8.5rem] z-30 flex items-center gap-1.5 rounded-full border border-rose-200/25 bg-black/50 px-3 py-2 text-xs font-black text-rose-100 shadow-lg backdrop-blur-md">
          <Heart className="h-4 w-4 fill-rose-400 text-rose-300" />
          <span>{count(liveStats.liveLikeCount)} beğeni</span>
        </div>
      )}
      <video
        ref={liveVideoRef}
        onPointerUp={handleLiveTouch}
        muted={!audioEnabled}
        playsInline
        autoPlay
        style={{ transform: "none", WebkitTransform: "none", objectPosition: "center", ...(hasBattleTeamLayout(battle) ? getBattleTileLayout(battle, broadcast.user.id) : showLegacyGuestSplit ? getLiveCameraTileLayout(0, viewerCameraCount) : undefined) }}
        className={`absolute ${hasBattleTeamLayout(battle) ? "z-20 rounded-2xl border-2 border-rose-300/90 shadow-lg" : hostIsPictureInPicture ? "live-camera-pip bottom-24 left-3 z-30 aspect-square h-28 w-28 rounded-xl border border-white/60 shadow-xl sm:h-36 sm:w-36" : showLegacyGuestSplit ? "z-20 rounded-2xl border border-white/60 shadow-lg" : "inset-0 h-full w-full"} object-cover transition-all duration-300 ${joined ? "opacity-100" : "opacity-0"}`}
      />
      {hasBattleTeamLayout(battle) && battle?.teamAssignments && (
        <span
          style={{ top: getBattleTileLayout(battle, broadcast.user.id)?.top, left: battle.teamAssignments[String(broadcast.user.id)] === "blue" ? undefined : "1rem", right: battle.teamAssignments[String(broadcast.user.id)] === "blue" ? "1rem" : undefined }}
          className="absolute z-30 max-w-[45%] truncate rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 backdrop-blur-md"
        >
          {battle.teamAssignments[String(broadcast.user.id)] === "blue" ? "Mavi" : "Kırmızı"}
        </span>
      )}
      {joined && remoteHostCameraOff && viewerCameraGuestCount > 0 && (
        <div style={hasBattleTeamLayout(battle) ? getBattleTileLayout(battle, broadcast.user.id) : showLegacyGuestSplit ? getLiveCameraTileLayout(0, viewerCameraCount) : undefined} className={`absolute z-20 flex flex-col items-center justify-center gap-2 bg-[#10131d]/90 text-white/75 ${hasBattleTeamLayout(battle) ? `rounded-2xl border-2 ${battle?.teamAssignments?.[String(broadcast.user.id)] === "blue" ? "border-cyan-300/90" : "border-rose-300/90"}` : hostIsPictureInPicture ? "live-camera-pip bottom-24 left-3 h-28 w-28 rounded-xl sm:h-36 sm:w-36" : showLegacyGuestSplit ? "rounded-2xl border border-white/60 shadow-lg" : "inset-0"}`}>
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-lg font-black text-white">{broadcast.user.avatarUrl ? <img src={broadcast.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : broadcast.user.username.charAt(0).toUpperCase()}</span>
          <span className="text-xs font-bold">Kamera kapalı</span>
        </div>
      )}
      {joined && (guestStreamReady || remoteGuestStreams.length > 0 || Boolean(kapismaOpponent)) && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {broadcast.type === "chat" && user?.id !== broadcast.user.id && (
            <button
              type="button"
              onClick={() => openGiftPanelFor(broadcast.user.id)}
              aria-label={`@${broadcast.user.username} yayıncısına hediye gönder; bu yayında ${liveStats.recipientCoinTotals?.[broadcast.user.id] ?? 0} coin aldı`}
              style={showLegacyGuestSplit ? getLiveCameraTileLayout(0, viewerCameraCount) : undefined}
              className={`pointer-events-auto absolute z-30 flex items-center gap-1 rounded-full border border-amber-200/35 bg-black/80 px-2 py-1 text-[9px] font-black text-amber-100 shadow-lg backdrop-blur hover:bg-black ${showLegacyGuestSplit ? "left-1/2 -translate-x-1/2" : "left-3 top-3"}`}
            >
              <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3 text-amber-300" />} className="h-3 w-3 shrink-0" />
              <span>{(liveStats.recipientCoinTotals?.[broadcast.user.id] ?? 0).toLocaleString("tr-TR")}</span>
              <Gift className="h-3 w-3 shrink-0 text-pink-300" />
            </button>
          )}
          {guestLocalStream && (
            <div style={hasBattleTeamLayout(battle) ? getBattleTileLayout(battle, user?.id) : showLegacyGuestSplit ? getLiveCameraTileLayout(1, viewerCameraCount) : undefined} className={`absolute overflow-hidden bg-black/30 ${hasBattleTeamLayout(battle) ? `rounded-2xl border-2 shadow-lg ${battle?.teamAssignments?.[String(user?.id)] === "red" ? "border-rose-300/90" : "border-cyan-300/90"}` : guestIsMainScreen ? "inset-0" : showLegacyGuestSplit ? "rounded-2xl border border-white/60 shadow-lg" : "live-camera-pip bottom-24 left-3 h-28 w-28 rounded-xl border border-white/70 sm:h-36 sm:w-36"}`}>
              <LiveStreamVideo stream={guestLocalStream} mirror className="h-full w-full object-cover" />
              {guestCameraOff && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#10131d]/90 text-white/75"><span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-lg font-black text-white">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user?.username ?? "K").charAt(0).toUpperCase()}</span><span className="text-xs font-bold">Kamera kapalı</span></div>}
              {broadcast.type === "chat" && user && (
                <span aria-label={`Bu yayında ${liveStats.recipientCoinTotals?.[user.id] ?? 0} coin aldın`} className="absolute bottom-1.5 left-1/2 z-30 flex max-w-[calc(100%-0.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200/35 bg-black/80 px-2 py-1 text-[9px] font-black text-amber-100 shadow-lg backdrop-blur">
                  <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3 text-amber-300" />} className="h-3 w-3 shrink-0" />
                  <span className="truncate">{(liveStats.recipientCoinTotals?.[user.id] ?? 0).toLocaleString("tr-TR")}</span>
                  <Gift className="h-3 w-3 shrink-0 text-pink-300" />
                </span>
              )}
            </div>
          )}
          {remoteGuestStreams.map((guest, index) => {
            const guestId = guest.user?.id ?? participants[index]?.id;
            const guestUser = guest.user ?? participants.find((participant) => participant.id === guestId);
            const guestTeam = battle?.teamAssignments?.[String(guestId)] ?? "blue";
            const tileIndex = 1 + Number(Boolean(guestLocalStream)) + index;
            return <div key={guest.stream.id} style={hasBattleTeamLayout(battle) ? getBattleTileLayout(battle, guestId) : showLegacyGuestSplit ? getLiveCameraTileLayout(tileIndex, viewerCameraCount) : undefined} className={`absolute overflow-hidden bg-black/30 ${hasBattleTeamLayout(battle) ? `rounded-2xl border-2 shadow-lg ${guestTeam === "red" ? "border-rose-300/90" : "border-cyan-300/90"}` : guestIsMainScreen ? "inset-0" : showLegacyGuestSplit ? "rounded-2xl border border-white/60 shadow-lg" : "live-camera-pip bottom-24 right-3 h-28 w-28 rounded-xl border border-white/70 sm:h-36 sm:w-36"}`}>
              <LiveStreamVideo stream={guest.stream} mirror className="h-full w-full object-cover" />
              {remoteGuestCameraOff[guest.stream.id] && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#10131d]/90 text-white/75"><span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-lg font-black text-white">{guest.user?.avatarUrl ? <img src={guest.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (guest.user?.username ?? "K").charAt(0).toUpperCase()}</span><span className="text-xs font-bold">Kamera kapalı</span></div>}
              {hasBattleTeamLayout(battle) && battle?.teamAssignments && <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100 backdrop-blur-md">{guestTeam === "red" ? "Kırmızı" : "Mavi"}</span>}
              {broadcast.type === "chat" && guestUser && guestUser.id !== user?.id && (
                <button type="button" onClick={() => openGiftPanelFor(guestUser.id)} aria-label={`@${guestUser.username} kullanıcısına hediye gönder; bu yayında ${liveStats.recipientCoinTotals?.[guestUser.id] ?? 0} coin aldı`} className="pointer-events-auto absolute bottom-1.5 left-1/2 z-30 flex max-w-[calc(100%-0.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200/35 bg-black/80 px-2 py-1 text-[9px] font-black text-amber-100 shadow-lg backdrop-blur hover:bg-black">
                  <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3 text-amber-300" />} className="h-3 w-3 shrink-0" />
                  <span className="truncate">{(liveStats.recipientCoinTotals?.[guestUser.id] ?? 0).toLocaleString("tr-TR")}</span>
                  <Gift className="h-3 w-3 shrink-0 text-pink-300" />
                </button>
              )}
            </div>
          })}
          {hasBattleTeamLayout(battle) && battle?.teamAssignments && participants
            .filter((participant) => participant.id !== broadcast.user.id && participant.id !== user?.id && !remoteGuestStreams.some((guest) => guest.user?.id === participant.id))
            .map((participant) => {
              const team = battle.teamAssignments?.[String(participant.id)] ?? "blue";
              return (
                <div
                  key={`waiting-${participant.id}`}
                  style={getBattleTileLayout(battle, participant.id)}
                  className={`absolute flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 bg-[#10131d]/90 text-white ${team === "red" ? "border-rose-300/90" : "border-cyan-300/90"}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-sm font-black">
                    {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : (participant.displayName || participant.username).charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[9px] text-white/60">Kamera bekleniyor</span>
                </div>
              );
            })}
          {!hasBattleTeamLayout(battle) && participants
            .filter((participant) =>
              participant.id !== broadcast.user.id
              && !(guestLocalStream && participant.id === user?.id)
              && !remoteGuestStreams.some((guest) => guest.user?.id === participant.id),
            )
            .map((participant, index) => {
              const tileIndex = 1 + Number(Boolean(guestLocalStream)) + remoteGuestStreams.length + index;
              return (
                <div key={`waiting-${participant.id}`} style={showLegacyGuestSplit ? getLiveCameraTileLayout(tileIndex, viewerCameraCount) : undefined} className={`absolute flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#10131d]/90 text-white ${showLegacyGuestSplit ? "rounded-2xl border border-cyan-200/50" : "live-camera-pip bottom-24 right-3 h-28 w-28 rounded-2xl border border-cyan-200/50 sm:h-36 sm:w-36"}`}>
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-xl font-black">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : (participant.displayName || participant.username).charAt(0).toUpperCase()}</span>
                  <span className="text-[10px] text-white/60">Kamera bağlanıyor</span>
                  {broadcast.type === "chat" && participant.id !== user?.id && (
                    <button type="button" onClick={() => openGiftPanelFor(participant.id)} aria-label={`@${participant.username} kullanıcısına hediye gönder; bu yayında ${liveStats.recipientCoinTotals?.[participant.id] ?? 0} coin aldı`} className="pointer-events-auto absolute bottom-1.5 left-1/2 z-30 flex max-w-[calc(100%-0.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200/35 bg-black/80 px-2 py-1 text-[9px] font-black text-amber-100 shadow-lg backdrop-blur hover:bg-black">
                      <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3 text-amber-300" />} className="h-3 w-3 shrink-0" />
                      <span className="truncate">{(liveStats.recipientCoinTotals?.[participant.id] ?? 0).toLocaleString("tr-TR")}</span>
                      <Gift className="h-3 w-3 shrink-0 text-pink-300" />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
      {joined && !streamConnected && (
        <div className="absolute inset-x-5 top-1/2 z-10 -translate-y-1/2 text-center">
          <Radio className="mx-auto h-16 w-16 animate-pulse text-white/35" />
          <p className="mt-5 text-lg font-black text-white">
            {connectionError || (connecting ? "Yayına bağlanılıyor..." : "Yayıncı akışı bekleniyor...")}
          </p>
          <p className="mt-2 text-sm text-white/65">
            {connecting ? "Canlı görüntü bağlantısı kuruluyor" : "Yayın açık olduğunda görüntü burada başlayacak"}
          </p>
          {connectionError && (
            <button
              type="button"
              onClick={() => {
                setConnectionError("");
                setJoined(false);
                window.setTimeout(() => setJoined(true), 0);
              }}
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-900"
            >
              Yeniden bağlan
            </button>
          )}
        </div>
      )}
      <div
        className={`live-comment-panel absolute z-[100] min-h-[9rem] bg-transparent p-0 md:-translate-y-10 ${joined ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ bottom: 0, left: 0, right: 0, minHeight: "9rem", visibility: "visible", opacity: 1 }}
      >
        {joinedNoticeVisible && (
          <div className="mb-3 rounded-full border border-emerald-200/25 bg-emerald-500/15 px-4 py-2 text-center text-xs font-bold text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.12)]">
            Canlı yayına katıldın
          </div>
        )}
        {joined && (
          <>
            <div
              ref={commentsListRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                commentsAtBottomRef.current =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <
                  24;
              }}
              className="live-comment-list live-comment-list-creator mb-0 min-h-0 overflow-y-auto overscroll-contain pr-3"
            >
              <div className="flex flex-col gap-3">
                {comments.map((comment) => {
                const hasReply = comments.some(
                  (item) => item.replyTo?.id === comment.id,
                );
                const isCreator = comment.user.id === broadcast.user.id;
                const isAudienceQuestion = isCreator && comment.content.startsWith("❓ SORU: ");
                return (
                  <div
                    key={comment.id}
                    className={`live-comment-row flex max-w-[92%] items-start gap-2 px-0 py-1 text-xs leading-5 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] ${isAudienceQuestion ? "rounded-lg border-l-2 border-fuchsia-300 bg-fuchsia-500/15 pl-2" : isCreator ? "border-l-2 border-yellow-300/90 bg-gradient-to-r from-amber-400/15 via-yellow-300/5 to-transparent pl-2 shadow-[0_0_18px_rgba(251,191,36,0.16)]" : hasReply ? "border-l-2 border-cyan-300/80 pl-2" : ""}`}
                  >
                    <div
                      className={`mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border ${isCreator ? "border-yellow-200 bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 shadow-[0_0_14px_rgba(251,191,36,0.5)]" : "border-white/35 bg-violet-500/70"}`}
                    >
                      {comment.user.avatarUrl ? (
                        <img
                          src={comment.user.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] font-black">
                          {(comment.user.displayName || comment.user.username)
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 break-words">
                      {isCreator && (
                        <span className="mr-1 text-[10px] font-black uppercase tracking-wide text-amber-400">
                          Yayıncı
                        </span>
                      )}
                      {comment.replyTo && (
                        <span className="mb-0.5 block text-[10px] text-white/60">
                          @{comment.replyTo.username} kullanıcısına yanıt
                        </span>
                      )}
                      <strong className={`block text-xs font-bold ${isCreator ? "text-amber-400" : "text-white/70"}`}>
                        @{comment.user.username}
                      </strong>
                      {isAudienceQuestion && <span className="block text-[9px] font-black uppercase tracking-wider text-fuchsia-200">İzleyiciye soru</span>}
                      <span className="block text-sm leading-5 text-white">{isAudienceQuestion ? comment.content.slice("❓ SORU: ".length) : comment.content}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(comment);
                          setCommentText(`@${comment.user.username} `);
                        }}
                        aria-label={`@${comment.user.username} kullanıcısına yanıt ver`}
                        className="mt-1 block w-fit text-[10px] font-bold leading-4 text-white/55 underline decoration-white/30 underline-offset-2"
                      >
                        Yanıtla
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
            <div className="absolute bottom-[4.6rem] right-3 z-20">
              {commentHeightOpen && (
                <div className="mb-2 w-40 rounded-xl border border-white/15 bg-slate-950/90 p-2.5 text-white shadow-2xl backdrop-blur-xl">
                  <input
                    id={`live-comment-height-${broadcast.id}`}
                    type="range"
                    min="16"
                    max={commentHeightLimit}
                    step="1"
                    value={visibleCommentHeight}
                    aria-label="Ekranda görünen yorum alanının yüksekliği"
                    aria-valuetext={`Ekran yüksekliğinin yüzde ${commentHeight} kadarı`}
                    onChange={(event) => updateCommentHeight(Number(event.currentTarget.value))}
                    className="h-6 w-full cursor-pointer touch-pan-x accent-fuchsia-400"
                  />
                </div>
              )}
              <button
                type="button"
                aria-expanded={commentHeightOpen}
                aria-label={commentHeightOpen ? "Yorum alanı ayarını kapat" : "Yorum görünür alanı yüksekliğini ayarla"}
                onClick={() => setCommentHeightOpen((open) => !open)}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur-md"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-fuchsia-200" />
              </button>
            </div>
            <div className="min-h-0">
              {replyingTo && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-black/35 px-3 py-2 text-xs text-white/70">
                  <span>
                    <span className="text-violet-200">
                      @{replyingTo.user.username}
                    </span>{" "}
                    kullanıcısına yanıt
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setCommentText("");
                    }}
                    aria-label="Yanıtı iptal et"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {arenaLeftTeam && (guestStreamReady || remoteGuestReady) && <img src={arenaLeftTeam.url} alt="" className="pointer-events-none absolute left-3 top-[13rem] z-10 h-20 w-20 -translate-y-1/2 object-contain opacity-80" />}
              {arenaRightTeam && (guestStreamReady || remoteGuestReady) && <img src={arenaRightTeam.url} alt="" className="pointer-events-none absolute right-3 top-[13rem] z-10 h-20 w-20 -translate-y-1/2 object-contain opacity-80" />}
              <div className="hidden items-center gap-2">
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void sendComment();
                    }
                  }}
                  placeholder={user ? "Yorum ekleyin..." : "Yorum için giriş yap"}
                  disabled={!user || sending}
                  className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => void sendComment()}
                  disabled={!commentText.trim() || !user || sending}
                  aria-label="Yorumu gönder"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
        <div className="live-comment-bar mt-4 translate-y-2 flex flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden text-xs font-bold text-white/75 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {joined && (
            <button type="button" onClick={() => setFollowing((value) => !value)} disabled={!user} className="live-comment-action flex shrink-0 flex-col items-center gap-1 text-[10px] font-black text-white/85 disabled:opacity-50">
              <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "subscribe")} fallback={<Sparkles className="h-6 w-6 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]" />} className="h-9 w-9" />
              <span>{following ? "Takipte" : "Abone ol"}</span>
            </button>
          )}
          {joined && streamConnected && user && (
            <button type="button" onClick={() => joinRequest?.status === "accepted" ? toggleGuestCamera() : void requestToJoin()} disabled={requestingJoin || joinRequest?.status === "pending" || (chatGuestCapacityFull && joinRequest?.status !== "accepted")} aria-label={joinRequest?.status === "accepted" ? (guestCameraOff ? "Konuk kamerasını aç" : "Konuk kamerasını kapat") : "Konuk olma isteği gönder"} className="live-comment-action flex shrink-0 flex-col items-center gap-1 text-[10px] font-black text-white/85 disabled:opacity-50">
              <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "guests")} fallback={joinRequest?.status === "accepted" ? (guestCameraOff ? <VideoOff className="h-6 w-6 text-cyan-300" /> : <Video className="h-6 w-6 text-cyan-300" />) : <Users className="h-6 w-6 text-cyan-300" />} className="h-9 w-9" />
              <span>{joinRequest?.status === "accepted" ? "Konuk" : joinRequest?.status === "pending" ? "Beklemede" : chatGuestCapacityFull ? "Dolu" : requestingJoin ? "Gönderiliyor" : "Konuk ol"}</span>
            </button>
          )}
          {joined && <div className="live-comment-input flex min-w-0 flex-1 shrink items-center rounded-full border border-violet-200/15 bg-[#17182a]/90 px-3 py-2.5 shadow-inner shadow-black/20">
            <input value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void sendComment(); } }} placeholder={user ? "Yorum yaz..." : "Giriş yap ve yorum yaz"} disabled={!user || sending} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/55" />
            <button type="button" aria-label="Emoji ekle" onClick={() => setCommentText((value) => `${value} 🙂`)} className="ml-2 text-violet-200/80 transition-colors hover:text-white"><LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "comment")} fallback={<Smile className="h-6 w-6" />} /></button>
          </div>}
          {joined && <>
            <button type="button" onClick={() => setGiftPanelOpen(true)} className="live-comment-action flex shrink-0 flex-col items-center gap-1 text-[10px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "gift")} fallback={<Sparkles className="h-6 w-6 text-pink-300" />} className="h-9 w-9" /><span>Hediye</span></button>
            <button type="button" onClick={() => void navigator.share?.({ title: broadcast.title, text: broadcast.content }).catch(() => {})} className="live-comment-action flex shrink-0 flex-col items-center gap-1 text-[10px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "share")} fallback={<Share2 className="h-6 w-6 text-violet-200" />} /><span>Paylaş</span></button>
          </>}
        </div>
      </div>
      {visibleGiftCards.length > 0 && (
        <div
          className="live-viewer-gift-cards live-gift-cards live-gift-cards-inline flex max-h-[18vh] w-[min(76vw,15rem)] flex-col gap-1 overflow-hidden"
          aria-live="polite"
          aria-label="Gönderilen hediyeler"
        >
          {visibleGiftCards.map((toast) => (
            <LiveGiftToastCard key={`${toast.id}-${toast.comboCount}`} toast={toast} />
          ))}
        </div>
      )}
      {joined && streamConnected && giftEvents.length > 0 && (
        <div className="hidden live-gift-cards absolute bottom-[12.2rem] left-4 z-30 flex max-h-[28vh] w-[min(86vw,25rem)] flex-col gap-2 overflow-hidden sm:bottom-36 sm:left-6">
          <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/85">
            <Sparkles className="h-3 w-3" /> Son hediyeler
          </div>
          {giftEvents.slice(-3).map((gift) => (
            <div
              key={gift.id}
              className="live-gift-card flex min-h-16 items-center gap-3 rounded-2xl border border-white/20 bg-[linear-gradient(100deg,rgba(8,12,26,0.9),rgba(31,19,35,0.72))] px-3 py-2 text-xs text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.38)] backdrop-blur-xl"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-rose-300/70 bg-amber-400/30 shadow-[0_0_12px_rgba(255,120,160,0.28)]">
                {gift.user.avatarUrl ? (
                  <img
                    src={gift.user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center font-black text-amber-100">
                    {(gift.user.displayName || gift.user.username)
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate leading-5">
                <strong className="block truncate text-sm text-white">{gift.user.displayName || `@${gift.user.username}`}</strong>
                <span className="block truncate text-xs text-white/70">{gift.giftName} gönderdi{gift.recipient ? ` → @${gift.recipient.username}` : ""}</span>
              </span>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/25">
                {gift.mimeType === "image/gif" ? (
                  <img
                    src={gift.url}
                    alt={gift.giftName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <video
                    src={gift.url}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {activeGiftEvent && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-40 h-1/2 w-full overflow-hidden">
          <ChromaKeyAnimation
            key={activeGiftEvent.id}
            src={activeGiftEvent.url}
            mimeType={activeGiftEvent.mimeType}
            transparencyMode={activeGiftEvent.transparencyMode}
            edgeFade={activeGiftEvent.edgeFade ?? "top-bottom"}
            onEnded={() => setActiveGiftEvent(giftAnimationQueueRef.current.shift() ?? null)}
            className="live-gift-animation absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
      {joined && streamConnected && (
        <div className="hidden absolute bottom-[8.2rem] right-4 z-30 flex flex-col items-center gap-3 sm:bottom-36 sm:right-6">
          {[1, 2, 3].map((item) => (
            <button key={item} type="button" aria-label="Yayını beğen" onClick={() => void sendLiveLike()} className="drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)] transition-transform active:scale-75">
              <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "like")} fallback={<Heart className={`fill-rose-500 text-rose-200 ${item === 3 ? "h-9 w-9" : "h-7 w-7"}`} />} className={item === 3 ? "h-9 w-9" : "h-7 w-7"} />
            </button>
          ))}
          <span className="rounded-full bg-black/45 px-2 py-1 text-[10px] font-black text-white/80 backdrop-blur-md">{count(liveStats.liveLikeCount)}</span>
        </div>
      )}
      {giftPanelOpen && (
        <div
          className="absolute inset-0 z-[120] flex items-end bg-black/75 backdrop-blur-[3px]"
          onClick={() => setGiftPanelOpen(false)}
        >
          <section
            className="relative z-[121] max-h-[88vh] w-full overflow-y-auto rounded-t-[30px] border-t border-white/15 bg-[#171225] px-4 pb-6 pt-3 shadow-[0_-18px_60px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-white/25" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="hidden items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-200">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                      Canlı hediyeler
                    </p>
                    <h3 className="mt-0.5 text-lg font-black text-white">
                      Yayıncıya destek ol
                    </h3>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  Bir hediye seç ve yayına gönder.
                </p>
              </div>
              <button
                type="button"
                aria-label="Hediye panelini kapat"
                onClick={() => setGiftPanelOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 rounded-2xl border border-amber-200/15 bg-amber-300/[0.06] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black text-amber-100">Coin cüzdanın</p>
                  <p className="text-[9px] text-white/45">{coinWallet?.paymentExempt ? "Yönetici hesabı · satın alma ve harcama ücreti alınmaz" : coinWallet?.demoGiftMode ? "Geliştirme demosu · hediyeler ücretsiz test edilir" : isAndroidPlatform ? "Google Play · Loop Coin bakiyen" : coinWallet?.testMode ? "iyzico test ortamı · gerçek tahsilat yapılmaz" : "Loop Coin bakiyen"}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1.5 text-xs font-black text-amber-100">
                  <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3 text-amber-300" />} className="h-3.5 w-3.5" />
                  {coinWalletLoading ? "…" : coinWallet?.paymentExempt ? "Ücretsiz" : (coinWallet?.balance ?? 0).toLocaleString("tr-TR")}
                </span>
              </div>
              {!user ? (
                <p className="rounded-lg bg-black/20 px-2.5 py-2 text-[10px] text-white/55">Coin satın almak ve hediye göndermek için giriş yap.</p>
              ) : coinWallet?.demoGiftMode ? (
                <p className="rounded-lg bg-violet-300/[0.08] px-2.5 py-2 text-[10px] text-violet-100/80">Geliştirme modunda hediyeleri ödeme veya coin bakiyesi olmadan test edebilirsin. Bu ücretsiz test modu canlı üretimde kapalıdır.</p>
              ) : coinWallet?.paymentExempt ? (
                <p className="rounded-lg bg-violet-300/[0.08] px-2.5 py-2 text-[10px] text-violet-100/80">Bu ayrıcalıklı hesap hediyeleri ücretsiz gönderir. Gerçek ödeme ve coin satın alma kapalıdır.</p>
              ) : !coinPurchaseReady ? (
                <p className="rounded-lg bg-amber-200/[0.06] px-2.5 py-2 text-[10px] text-amber-100/75">{isAndroidPlatform ? "Google Play Billing hazırlandı. Play Console ürünleri ve sunucu servis hesabı yapılandırılana kadar satın alma güvenlik için kapalıdır." : "iyzico ödemesini açmak için API anahtarı, gizli anahtar ve herkese açık HTTPS dönüş adresi sunucuda yapılandırılmalıdır."}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {(coinWallet?.packages ?? []).map((coinPackage) => (
                    <button key={coinPackage.id} type="button" disabled={Boolean(coinPurchaseId) || coinWalletLoading || (isAndroidPlatform && !googlePlayProducts[coinPackage.playProductId])} aria-pressed={checkoutPackageId === coinPackage.id} onClick={() => setCheckoutPackageId((current) => current === coinPackage.id ? null : coinPackage.id)} className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-wait disabled:opacity-50 ${checkoutPackageId === coinPackage.id ? "border-amber-200/50 bg-amber-200/[0.12]" : "border-amber-100/10 bg-black/20 hover:border-amber-200/30 hover:bg-amber-200/[0.08]"}`}>
                      <span className="min-w-0"><span className="block truncate text-[9px] font-bold text-white/70">{coinPackage.name}</span><span className="block text-[10px] font-black text-amber-100">{(coinPackage.coins + coinPackage.bonus).toLocaleString("tr-TR")} coin {coinPackage.bonus > 0 && <span className="text-emerald-200">(+{coinPackage.bonus})</span>}</span></span>
                      <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-1 text-[9px] font-black text-amber-100">{isAndroidPlatform ? googlePlayProducts[coinPackage.playProductId]?.priceString ?? "Mağazada yok" : Number(coinPackage.amountTry).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</span>
                    </button>
                  ))}
                </div>
              )}
              {coinWallet && selectedCoinPackage && coinPurchaseReady && !coinWallet.paymentExempt && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  {isAndroidPlatform ? (
                    <>
                      <p className="mb-2 text-[10px] font-black text-white/75">{selectedCoinPackage.name} · {googlePlayProducts[selectedCoinPackage.playProductId]?.priceString}</p>
                      <p className="text-[8px] leading-3 text-white/40">Ödeme Google Play üzerinden alınır. Coinler yalnızca Google Play satın alması sunucuda doğrulandıktan sonra eklenir.</p>
                      <button type="button" disabled={Boolean(coinPurchaseId) || !googlePlayProducts[selectedCoinPackage.playProductId]} onClick={() => void buyCoinPackage()} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-[10px] font-black text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-45">
                        <Coins className="h-3.5 w-3.5" />{coinPurchaseId === selectedCoinPackage.id ? "Google Play açılıyor..." : `Google Play ile satın al · ${googlePlayProducts[selectedCoinPackage.playProductId]?.priceString ?? ""}`}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-[10px] font-black text-white/75">Fatura bilgileri · {selectedCoinPackage.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentBuyerFields.map(({ key, label, placeholder, type }) => (
                          <label key={key} className={`min-w-0 space-y-1 ${key === "address" ? "col-span-2" : ""}`}>
                            <span className="block text-[8px] font-bold text-white/45">{label}</span>
                            <input type={type ?? "text"} value={paymentBuyer[key]} maxLength={key === "address" ? 300 : key === "identityNumber" ? 32 : 254} autoComplete="off" onChange={(event) => setPaymentBuyer((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-amber-200/35" />
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[8px] leading-3 text-white/40">Kart bilgilerin iyzico’nun güvenli ödeme sayfasında girilir; Loop tarafından kaydedilmez.</p>
                      <button type="button" disabled={Boolean(coinPurchaseId) || paymentBuyerFields.some(({ key }) => !paymentBuyer[key].trim())} onClick={() => void buyCoinPackage()} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-[10px] font-black text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-45">
                        <Coins className="h-3.5 w-3.5" />{coinPurchaseId === selectedCoinPackage.id ? "Ödeme sayfası açılıyor..." : `iyzico ile öde · ${Number(selectedCoinPackage.amountTry).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}`}
                      </button>
                      <p className="mt-1.5 text-center text-[8px] text-white/35">Paket fiyatları başlangıç değeridir; satın alma tutarı sunucuda doğrulanır.</p>
                    </>
                  )}
                </div>
              )}
              {coinWalletError && <p role="alert" className="mt-2 rounded-lg bg-rose-400/10 px-2.5 py-2 text-[9px] text-rose-100">{coinWalletError}</p>}
              <div className="mt-3 rounded-xl border border-violet-200/10 bg-violet-300/[0.05] p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-black text-violet-100"><Crown className="h-3 w-3" />Loop Premium aboneliği</p>
                <p className="mt-1 text-[9px] leading-3 text-white/45">Google Play abonelik doğrulama ve hak iskeleti hazır. Premium kapsamı, fiyatı ve Play Console ürünü tanımlanana kadar özellik açılmaz.</p>
              </div>
            </div>
            <p className="mb-2 text-[10px] font-bold text-white/65">{battle?.active ? "Kapışma tarafını seç" : "Hediyenin alıcısını seç"}</p>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {giftRecipients.map((participant) => (
                <button
                  type="button"
                  key={participant.id}
                  onClick={() => setGiftRecipientId(participant.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${giftRecipientId === participant.id ? "border-rose-300 bg-rose-500/30 text-white" : "border-white/10 bg-white/5 text-white/60"}`}
                >
                  @{participant.username}
                </button>
              ))}
            </div>
            {gifts.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/55">
                Henüz yayınlanmış hediye yok.
              </div>
            ) : (
              <div className="max-h-[54vh] overflow-y-auto overscroll-contain pr-1 pb-2 [scrollbar-width:thin]">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {gifts.map((gift) => (
                    <button
                      type="button"
                      key={gift.id}
                      disabled={giftSending || Boolean(user && coinWallet && !coinWallet.paymentExempt && !coinWallet.demoGiftMode && coinWallet.balance !== null && coinWallet.balance < (gift.coinValue ?? 1))}
                      onClick={() => void sendGift(gift)}
                      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border p-1.5 text-left transition active:scale-[.98] disabled:cursor-wait disabled:opacity-60 ${selectedGift === gift.id ? "border-rose-300/80 bg-rose-500/20 shadow-lg shadow-rose-950/30" : "border-white/10 bg-white/[0.06] hover:border-white/20 hover:bg-white/[0.1]"}`}
                    >
                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {gift.coverUrl ? (
                          <img src={gift.coverUrl} alt={gift.name} className="h-full w-full object-cover" />
                        ) : gift.mimeType === "image/gif" ? (
                          <img
                            src={gift.url}
                            alt={gift.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <video
                            src={gift.url}
                            muted
                            loop
                            autoPlay
                            playsInline
                            className="h-full w-full object-contain"
                          />
                        )}
                      </div>
                      <span className="mt-1 truncate px-0.5 text-[11px] font-bold text-white">
                        {gift.name}
                      </span>
                      <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-black text-amber-200">
                        <LiveButtonVisual asset={getLiveButtonAsset(buttonAssets, "coin")} fallback={<Coins className="h-3 w-3" />} className="h-3 w-3" />
                        {gift.coinValue ?? 1}
                      </span>
                      <span
                        className={`mt-1 truncate rounded-full px-1.5 py-1 text-center text-[9px] font-black ${selectedGift === gift.id ? "bg-emerald-400/20 text-emerald-200" : "bg-cyan-500 text-slate-950"}`}
                      >
                        {selectedGift === gift.id ? "Gönderildi" : "Gönder"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {giftMessage && (
              <p
                className={`mt-3 rounded-xl border px-3 py-2 text-center text-xs font-semibold ${giftMessage.endsWith("gönderildi!") ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300" : "border-rose-300/20 bg-rose-400/10 text-rose-200"}`}
              >
                {giftMessage}
              </p>
            )}
          </section>
        </div>
      )}
      {collectionPanelOpen && (
        <div className="absolute inset-0 z-[120] flex items-end bg-black/75 backdrop-blur-[3px]" onClick={() => setCollectionPanelOpen(false)}>
          <section className="relative z-[121] flex h-[78dvh] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 w-full flex-col overflow-hidden rounded-t-[24px] border-t border-white/15 bg-[#171225] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_60px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-white/25" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">Hediye koleksiyonu</h3>
                <p className="mt-1 text-xs text-white/55">{liveStats.collection.collected}/{liveStats.collection.total} hediye</p>
              </div>
              <button type="button" aria-label="Koleksiyonu kapat" onClick={() => setCollectionPanelOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {collectionGifts.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-white/55">
                {gifts.length === 0 ? "Koleksiyon yükleniyor..." : "Henüz koleksiyona hediye eklenmedi."}
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-4 content-start gap-2 overflow-y-auto overscroll-contain pb-2 sm:grid-cols-5">
                {collectionGifts.map((gift) => {
                  const isCollected = liveStats.collection.gifts.includes(gift.id);
                  return (
                  <div key={gift.id} className={`min-w-0 rounded-xl border p-1.5 transition ${isCollected ? "border-cyan-300/70 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,0.22)]" : "border-white/10 bg-white/[0.04] opacity-55 grayscale"}`}>
                    <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/30 ${isCollected ? "shadow-[0_0_16px_rgba(34,211,238,0.35)]" : ""}`}>
                      {gift.coverUrl ? (
                        <img src={gift.coverUrl} alt={gift.name} className="h-full w-full object-cover" />
                      ) : gift.mimeType === "image/gif" ? (
                        <img src={gift.url} alt={gift.name} className="h-full w-full object-contain" />
                      ) : (
                        <video src={gift.url} muted loop autoPlay playsInline className="h-full w-full object-contain" />
                      )}
                      {isCollected && <span className="absolute right-1 top-1 rounded-full bg-cyan-300 px-1.5 py-0.5 text-[8px] font-black text-slate-950 shadow">ALINDI</span>}
                    </div>
                    <p className="mt-1 truncate text-center text-[10px] font-bold text-white/85">{gift.name}</p>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
  /*

    return <section className="relative h-full w-full shrink-0 snap-start overflow-hidden bg-gradient-to-br from-[#100d22] via-[#36202f] to-[#9a543d]" style={{ scrollSnapStop: "always" }}><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,218,184,0.32),transparent_35%),linear-gradient(180deg,rgba(21,11,18,0.55),rgba(9,5,12,0.86))]" /><div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between"><div className="flex items-center gap-2 text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-black tracking-tight backdrop-blur-md">LIVE</span><span className="text-lg font-black tracking-tight">Loops</span></div><nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-5 text-sm font-bold text-white/55"><span>Topluluk</span><span>Takipte</span><span className="relative text-white">Sizin için<span className="absolute -bottom-3 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-white" /></span></nav><button type="button" aria-label="Canlı yayınları ara" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md"><Search className="h-6 w-6" /></button></div><div className="absolute left-5 right-5 top-20 z-10 flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-12 w-12 overflow-hidden rounded-full border-2 border-rose-300 bg-violet-500/30">{broadcast.user.avatarUrl ? <img src={broadcast.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-black text-white">{broadcast.user.username.charAt(0).toUpperCase()}</div>}</div><div><p className="font-black text-white">{broadcast.user.displayName || `@${broadcast.user.username}`}</p><p className="text-xs text-white/60">@{broadcast.user.username}</p></div></div><span className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-black text-white"><span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />CANLI</span></div>
}
*/
}

function LiveRecommendationCard({ broadcast, onWatch }: { broadcast: LiveBroadcast; onWatch: (broadcastId: string) => void }) {
  return (
    <section className="live-arena-surface relative flex h-full w-full shrink-0 snap-start items-center justify-center overflow-hidden bg-[#080611] px-6 text-center text-white" aria-label={`Canlı yayın önerisi: ${broadcast.title}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(217,70,239,0.32),transparent_42%),radial-gradient(ellipse_at_80%_80%,rgba(244,63,94,0.22),transparent_45%),linear-gradient(180deg,rgba(8,6,17,0.15),rgba(8,6,17,0.88))]" />
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="mb-4 flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] shadow-lg shadow-rose-950/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Canlı
        </div>
        <div className="mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-white/65 bg-white/10 shadow-[0_0_32px_rgba(217,70,239,0.3)]">
          {broadcast.user.avatarUrl ? (
            <img src={broadcast.user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-2xl font-black">{(broadcast.user.displayName || broadcast.user.username).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <p className="text-sm font-bold text-white/75">{broadcast.user.displayName || `@${broadcast.user.username}`}</p>
        <h2 className="mt-2 text-2xl font-black leading-tight">{broadcast.title}</h2>
        <p className="mt-2 line-clamp-3 max-w-sm text-sm leading-6 text-white/65">{broadcast.content}</p>
        <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-white/65">
          <Eye className="h-3.5 w-3.5" />
          {count(broadcast.viewerCount)} izleyici
        </span>
        <button type="button" onClick={() => onWatch(broadcast.id)} className="mt-7 flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:brightness-110">
          <Radio className="h-4 w-4" />
          Canlı yayını izlemek için dokun
        </button>
      </div>
    </section>
  );
}

function LiveBroadcastFeed({ broadcasts, buttonAssets, events, initialBroadcastId }: { broadcasts: LiveBroadcast[]; buttonAssets: LiveButtonAsset[]; events: LiveEvent[]; initialBroadcastId?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(initialBroadcastId ?? broadcasts[0]?.id ?? null);
  const autoJoinNonceRef = useRef(0);
  const [autoJoinRequest, setAutoJoinRequest] = useState<{ broadcastId: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!broadcasts.some((broadcast) => broadcast.id === activeBroadcastId)) setActiveBroadcastId(broadcasts[0]?.id ?? null);
  }, [broadcasts, activeBroadcastId]);

  useEffect(() => {
    if (!initialBroadcastId || !broadcasts.some((broadcast) => broadcast.id === initialBroadcastId)) return;
    setActiveBroadcastId(initialBroadcastId);
    window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-live-broadcast="${CSS.escape(initialBroadcastId)}"]`);
      if (container && target) container.scrollTo({ top: target.offsetTop, behavior: "instant" });
    });
  }, [broadcasts, initialBroadcastId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      const broadcastId = (current?.target as HTMLElement | undefined)?.dataset.liveBroadcast;
      if (broadcastId) setActiveBroadcastId(broadcastId);
    }, { root: container, threshold: [0.6] });
    container.querySelectorAll<HTMLElement>("[data-live-broadcast]").forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, [broadcasts]);

  if (broadcasts.length === 0)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Radio className="h-12 w-12 text-violet-300/60" />
        <p className="text-lg font-black text-white">Şu anda canlı yayın yok</p>
        <p className="max-w-sm text-sm text-violet-100/60">
          Canlı yayın başladığında burada tüm yayınları yukarı kaydırarak
          izleyebilirsin.
        </p>
      </div>
    );
  return (
    <div ref={containerRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [touch-action:pan-y]">
      {broadcasts.map((broadcast) => (
        <LiveBroadcastScene
          key={broadcast.id}
          broadcast={broadcast}
          buttonAssets={buttonAssets}
          events={events}
          isActiveScene={activeBroadcastId === broadcast.id}
          autoJoinRequest={autoJoinRequest}
          onSwitchBroadcast={(broadcastId) => {
            setActiveBroadcastId(broadcastId);
            setAutoJoinRequest({ broadcastId, nonce: ++autoJoinNonceRef.current });
            document.getElementById(`live-broadcast-${broadcastId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ))}
    </div>
  );
}

type LoopInteractions = {
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number;
};

const getSavedInteractions = (loop: Loop): LoopInteractions => {
  const interactionKey = loop.sourceId ?? loop.id;
  const defaults = {
    liked: loop.liked ?? false,
    saved: false,
    reposted: loop.reposted ?? false,
    likes: loop.likes,
    comments: loop.comments,
    reposts: loop.repostCount ?? loop.shares,
    shares: loop.shares,
    saves: loop.saves,
  };
  try {
    const saved = localStorage.getItem(`loop-interactions:${interactionKey}`);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<LoopInteractions>;
    return {
      ...defaults,
      ...parsed,
      liked:
        typeof loop.liked === "boolean"
          ? loop.liked
          : (parsed.liked ?? defaults.liked),
      likes: loop.likes,
      comments: loop.comments,
    };
  } catch {
    return defaults;
  }
};

function Action({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex flex-col items-center gap-1 text-violet-200"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200/20 bg-black/30 text-violet-100 backdrop-blur-md transition-transform group-active:scale-90 group-hover:border-violet-300/50 group-hover:bg-violet-950/40">
        {children}
      </span>
    </button>
  );
}

function HomeStyleLoopComments({
  open,
  replies,
  commentText,
  onCommentTextChange,
  onSubmit,
  submitting,
  onClose,
  mediaUrl,
  onImagePick,
  onGifPick,
  onSticker,
  onClearMedia,
  onReply,
}: {
  open: boolean;
  replies: Array<{
    content: string;
    createdAt?: string;
    user: {
      displayName?: string | null;
      username?: string;
      avatarUrl?: string | null;
    } | null;
  }>;
  commentText: string;
  onCommentTextChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  onClose: () => void;
  mediaUrl: string;
  onImagePick: () => void;
  onGifPick: (url: string) => void;
  onSticker: () => void;
  onClearMedia: () => void;
  onReply: (username: string) => void;
}) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    startYRef.current = event.touches[0]?.clientY ?? null;
    draggingRef.current = true;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (!draggingRef.current || startYRef.current === null) return;
    setDragOffset(
      Math.max(
        0,
        (event.touches[0]?.clientY ?? startYRef.current) - startYRef.current,
      ),
    );
  };

  const handleTouchEnd = () => {
    draggingRef.current = false;
    if (dragOffset > 120) onClose();
    setDragOffset(0);
    startYRef.current = null;
  };

  const handleReply = (username: string) => {
    onReply(username);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <section
        className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] flex-col rounded-t-[28px] border-t border-white/10 bg-[#08080d] text-white shadow-[0_-4px_32px_rgba(0,0,0,0.55)]"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: draggingRef.current ? "none" : "transform 180ms ease-out",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex cursor-grab select-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>
        <header className="flex items-center justify-between px-4 pb-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="text-[15px] font-bold leading-tight">Yorumlar</p>
            <p className="text-[12px] text-white/60">
              {replies.length} yorum
            </p>
          </div>
          <div className="h-8 w-8" />
        </header>
        <div className="mx-4 h-px bg-white/10" />
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {replies.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-white/55">
              <MessageCircle className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">İlk yorumu sen yap!</p>
            </div>
          ) : (
            replies.map((reply, index) => {
              const username = reply.user?.username;
              return (
                <div key={`${reply.content}-${index}`} className="flex gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {reply.user?.avatarUrl ? (
                      <img
                        src={reply.user.avatarUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      (reply.user?.displayName || username || "K")
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-white">
                        @{username || "bilinmeyen"}
                      </span>
                      <span className="text-[11px] text-white/55">
                        ·{" "}
                        {new Date(
                          reply.createdAt || Date.now(),
                        ).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="break-words whitespace-pre-wrap text-[14px] leading-[1.45] text-white/95">
                      {reply.content}
                    </p>
                    {username && (
                      <button
                        type="button"
                        onClick={() => handleReply(username)}
                        className="mt-1 text-[11px] font-semibold text-white/55 hover:text-white"
                      >
                        Yanıtla
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="relative border-t border-white/10 p-3">
          {gifOpen && (
            <GifPicker
              onSelect={(url) => {
                onGifPick(url);
                setGifOpen(false);
              }}
              onClose={() => setGifOpen(false)}
            />
          )}
          {mediaUrl && (
            <div className="relative mb-2 w-fit">
              <img
                src={mediaUrl}
                alt="Yorum eki"
                className="max-h-20 max-w-32 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={onClearMedia}
                aria-label="Yorum ekini kaldır"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-1 text-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPlusOpen((value) => !value);
                  setGifOpen(false);
                }}
                aria-label="Yorum eklerini aç"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 hover:bg-white/10"
              >
                <Plus className="h-5 w-5" />
              </button>
              {plusOpen && (
                <div                 className="absolute bottom-full left-0 mb-2 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#15151d] text-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      onImagePick();
                      setPlusOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-xs text-foreground hover:bg-muted"
                  >
                    <ImagePlus className="h-4 w-4" /> Görüntü / Fotoğraf
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGifOpen(true);
                      setPlusOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-xs text-foreground hover:bg-muted"
                  >
                    <span className="w-4 text-center text-[10px] font-black">
                      GIF
                    </span>{" "}
                    GIF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSticker();
                      setPlusOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-xs text-foreground hover:bg-muted"
                  >
                    <Smile className="h-4 w-4" /> Sticker
                  </button>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              value={commentText}
              onChange={(event) => onCommentTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              placeholder="Yorum yaz..."
              className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/45"
            />
            <button
              type="button"
              disabled={(!commentText.trim() && !mediaUrl) || submitting}
              onClick={() => void onSubmit()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LoopComposer({
  file,
  title,
  caption,
  tags,
  audio,
  uploading,
  progress,
  onTitleChange,
  onCaptionChange,
  onTagsChange,
  onAudioChange,
  onPublish,
  onChooseVideo,
  onClose,
}: {
  file: File | null;
  title: string;
  caption: string;
  tags: string;
  audio: string;
  uploading: boolean;
  progress: number;
  onTitleChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onAudioChange: (value: string) => void;
  onPublish: () => void;
  onChooseVideo: () => void;
  onClose: () => void;
}) {
  return (
    <section className="w-full max-w-lg rounded-[1.75rem] border border-violet-300/20 bg-[#0b091b]/95 p-5 text-left shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Loop düzenleme alanı
          </p>
          <h2 className="mt-1 text-xl font-black text-white">
            Videonu yayınlamadan önce düzenle
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Düzenlemeyi kapat"
          className="rounded-full p-2 text-violet-200/70 hover:bg-violet-500/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!file ? (
        <button
          type="button"
          onClick={onChooseVideo}
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300/35 bg-violet-500/5 px-5 py-10 text-center text-violet-200 transition-colors hover:bg-violet-500/10"
        >
          <Send className="mb-3 h-8 w-8 text-violet-400" />
          <strong className="text-sm">Video seç</strong>
          <span className="mt-1 text-xs text-violet-100/50">
            MP4, WebM veya MOV yükleyebilirsin
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-violet-200/10 bg-white/5 p-3">
            <video
              src={URL.createObjectURL(file)}
              muted
              className="h-14 w-20 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                Seçilen video
              </p>
              <p className="truncate text-xs text-violet-100/65">{file.name}</p>
            </div>
            <button
              type="button"
              onClick={onChooseVideo}
              className="ml-auto shrink-0 text-xs font-bold text-violet-300 hover:text-white"
            >
              Değiştir
            </button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-violet-100/70">
              Başlık
            </span>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Loop başlığın"
              className="w-full rounded-xl border border-violet-200/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-violet-100/35 focus:border-violet-400/70"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-violet-100/70">
              Açıklama
            </span>
            <textarea
              value={caption}
              onChange={(event) => onCaptionChange(event.target.value)}
              placeholder="Bu Loop'un hikayesi..."
              rows={3}
              className="w-full resize-none rounded-xl border border-violet-200/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-violet-100/35 focus:border-violet-400/70"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-violet-100/70">
              Hashtagler
            </span>
            <input
              value={tags}
              onChange={(event) => onTagsChange(event.target.value)}
              placeholder="#gece #müzik #loop"
              className="w-full rounded-xl border border-violet-200/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-violet-100/35 focus:border-violet-400/70"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-violet-100/70">
              Müzik / ses
            </span>
            <input
              value={audio}
              onChange={(event) => onAudioChange(event.target.value)}
              placeholder="Müzik veya orijinal ses"
              className="w-full rounded-xl border border-violet-200/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-violet-100/35 focus:border-violet-400/70"
            />
          </label>
          <button
            type="button"
            disabled={uploading || !title.trim()}
            onClick={onPublish}
            className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white shadow-[0_8px_25px_rgba(139,92,246,0.28)] transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? `Yükleniyor · ${progress}%` : "Loop'u yayınla"}
          </button>
          {uploading && (
            <div className="h-1.5 overflow-hidden rounded-full bg-violet-950">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LoopScene({
  loop,
  active,
  canUpload,
  initiallyFollowing,
  liveStatus,
  liveBroadcasts,
  liveButtonAssets,
  liveEvents,
  onLoopUploaded,
  onLiveModeChange,
}: {
  loop: Loop;
  active: boolean;
  canUpload: boolean;
  initiallyFollowing: boolean;
  liveStatus: LiveStatus;
  liveBroadcasts: LiveBroadcast[];
  liveButtonAssets: LiveButtonAsset[];
  liveEvents: LiveEvent[];
  onLoopUploaded: (loop: Loop) => void;
  onLiveModeChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const loopMediaUrls = loop.mediaItems?.length ? loop.mediaItems : [loop.cover];
  const savedInteractions = getSavedInteractions(loop);
  const [liked, setLiked] = useState(savedInteractions.liked);
  const [saved, setSaved] = useState(savedInteractions.saved);
  const [reposted, setReposted] = useState(savedInteractions.reposted);
  const [following, setFollowing] = useState(initiallyFollowing);
  const [paused, setPaused] = useState(false);
  const [fastForwarding, setFastForwarding] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const pausedRef = useRef(false);
  const activeMediaUrl = loopMediaUrls[Math.min(activeMediaIndex, loopMediaUrls.length - 1)] ?? loop.cover;
  const [muted, setMuted] = useState(getStoredVideoMuted);
  const [videoProgress, setVideoProgress] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [actionsFaded, setActionsFaded] = useState(false);
  const actionsFadeTimerRef = useRef<number | null>(null);
  const [swipePanelOpen, setSwipePanelOpen] = useState(false);
  const [uploadingLoop, setUploadingLoop] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [loopTitle, setLoopTitle] = useState("");
  const [loopCaption, setLoopCaption] = useState("");
  const [loopTags, setLoopTags] = useState("");
  const [loopAudio, setLoopAudio] = useState("");
  const [likeCount, setLikeCount] = useState(savedInteractions.likes);
  const [commentCount, setCommentCount] = useState(savedInteractions.comments);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentMediaUrl, setCommentMediaUrlState] = useState("");
  const setCommentMediaUrl = (value: string | null) =>
    setCommentMediaUrlState(value ?? "");
  const [commentsPlusOpen, setCommentsPlusOpen] = useState(false);
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentReplies, setCommentReplies] = useState<
    Array<{
      content: string;
      createdAt?: string;
      user: {
        username?: string;
        displayName?: string | null;
        avatarUrl?: string | null;
      } | null;
    }>
  >([]);
  const [repostCount, setRepostCount] = useState(savedInteractions.reposts);
  const [shareCount, setShareCount] = useState(savedInteractions.shares);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [shareContacts, setShareContacts] = useState<
    Array<{
      id: number;
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    }>
  >([]);
  const [shareSent, setShareSent] = useState<Set<number>>(new Set());
  const [shareSending, setShareSending] = useState<number | null>(null);
  const [saveCount, setSaveCount] = useState(savedInteractions.saves);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [menuNotice, setMenuNotice] = useState("");
  const [loopSourceChooserOpen, setLoopSourceChooserOpen] = useState(false);
  const [stickerEditorOpen, setStickerEditorOpen] = useState(false);
  const [stickerFrameTime, setStickerFrameTime] = useState(0);
  const [stickerZoom, setStickerZoom] = useState(1);
  const [stickerName, setStickerName] = useState("Loop çıkartması");
  const [stickerSaving, setStickerSaving] = useState(false);
  const [stickerEditorError, setStickerEditorError] = useState("");
  const stickerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"camera" | "video">("camera");
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveStudioOpen, setLiveStudioOpen] = useState(false);
  const [liveStarted, setLiveStarted] = useState(false);
  const [liveStartedAt, setLiveStartedAt] = useState<number | null>(null);
  const [liveDurationSeconds, setLiveDurationSeconds] = useState(0);
  const [studioControlsOpen, setStudioControlsOpen] = useState(false);
  const [battleInviteOpen, setBattleInviteOpen] = useState(false);
  const [battleInviteMessage, setBattleInviteMessage] = useState("");
  const [battleInviteTargets, setBattleInviteTargets] = useState(liveBroadcasts);
  const [liveFilterIndex, setLiveFilterIndex] = useState(0);
  useEffect(() => setBattleInviteTargets(liveBroadcasts), [liveBroadcasts]);
  useEffect(() => {
    if (!battleInviteOpen || !liveStarted) return;
    let cancelled = false;
    const refreshTargets = async () => {
      const response = await fetch("/api/live/broadcasts", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      setBattleInviteTargets((await response.json()) as LiveBroadcast[]);
    };
    void refreshTargets();
    const timer = window.setInterval(() => void refreshTargets(), 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [battleInviteOpen, liveStarted]);
  useEffect(() => {
    if (liveStartedAt === null) {
      setLiveDurationSeconds(0);
      return;
    }
    const updateDuration = () => setLiveDurationSeconds(Math.max(0, Math.floor((Date.now() - liveStartedAt) / 1000)));
    updateDuration();
    const timer = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(timer);
  }, [liveStartedAt]);
  const [liveStreamReady, setLiveStreamReady] = useState(false);
  const [livePeerReady, setLivePeerReady] = useState(false);
  const [liveBroadcastId, setLiveBroadcastId] = useState<string | null>(null);
  const [liveJoinRequests, setLiveJoinRequests] = useState<LiveJoinRequest[]>([]);
  const [liveJoinError, setLiveJoinError] = useState("");
  const [liveBattle, setLiveBattle] = useState<LiveBattle | null>(null);
  const liveBattleResultAnimations = useLiveBattleResultAnimations();
  const battleOpponentStream = useBattleOpponentStream(Boolean(liveStarted && liveBattle?.active), liveBattle?.opponentBroadcastId);
  const battleOpponentUser = liveBattle?.scores?.find((entry) => entry.user.id !== user?.id)?.user;
  const [liveBattleStarting, setLiveBattleStarting] = useState(false);
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([]);
  const [liveGuestConnected, setLiveGuestConnected] = useState(false);
  const [liveGuestCameraOff, setLiveGuestCameraOff] = useState(false);
  const [liveGuestCameraOffByViewer, setLiveGuestCameraOffByViewer] = useState<Record<string, boolean>>({});
  const [liveGuestStreams, setLiveGuestStreams] = useState<Array<{ viewerId: string; stream: MediaStream; user?: LiveParticipant }>>([]);
  const [liveComments, setLiveComments] = useState<LiveComment[]>([]);
  const [liveGiftEvents, setLiveGiftEvents] = useState<LiveGiftEvent[]>([]);
  const visibleLiveGiftCards = useLiveGiftToasts(liveGiftEvents, liveStarted);
  const [liveStudioStats, setLiveStudioStats] = useState<LiveStats>({
    viewerCount: 0,
    liveLikeCount: 0,
    hourlyRanking: [],
    coinRanking: [],
    liveSupporters: [],
    collection: { collected: 0, total: 10, gifts: [], featuredGiftIds: [] },
    audienceHistory: [],
    supporterHistory: [],
  });
  const [studioStatsTab, setStudioStatsTab] = useState<
    "audience" | "supporters"
  >("audience");
  const [hourlyPreviewOpen, setHourlyPreviewOpen] = useState(false);
  const [hourlyPreviewLeague, setHourlyPreviewLeague] = useState<string>("Tümü");
  const hourlyRankingEntries = (liveStudioStats.hourlyRanking ?? []).map((entry) => ({
    user: entry.user,
    username: entry.user.username,
    displayName: entry.user.displayName || entry.user.username,
    coins: entry.coins,
    league: getLoopLeague(entry.coins),
  }));
  const filteredHourlyRanking = hourlyRankingEntries.filter((entry) =>
    hourlyPreviewLeague === "Tümü" || entry.league.current.name === hourlyPreviewLeague
  );
  const [audienceSort, setAudienceSort] = useState<"watch" | "likes" | "recent">("watch");
  const [supporterSort, setSupporterSort] = useState<"coins" | "recent">("coins");
  const [studioRankingOpen, setStudioRankingOpen] = useState(false);
  const [studioPanelOffset, setStudioPanelOffset] = useState(0);
  const studioPanelStartYRef = useRef<number | null>(null);
  const studioPanelDraggingRef = useRef(false);
  const [activeLiveGiftEvent, setActiveLiveGiftEvent] =
    useState<LiveGiftEvent | null>(null);
  const liveGiftAnimationQueueRef = useRef<LiveGiftEvent[]>([]);
  const seenLiveGiftIdsRef = useRef<Set<string>>(new Set());
  const [liveCommentText, setLiveCommentText] = useState("");
  const [liveReplyingTo, setLiveReplyingTo] = useState<LiveComment | null>(
    null,
  );
  const [liveCommentSending, setLiveCommentSending] = useState(false);
  const [liveQuestionOpen, setLiveQuestionOpen] = useState(false);
  const [liveQuestionDraft, setLiveQuestionDraft] = useState("");
  const [liveQuestionError, setLiveQuestionError] = useState("");
  const [liveMicMuted, setLiveMicMuted] = useState(false);
  const [liveCamOff, setLiveCamOff] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveTitle, setLiveTitle] = useState("");
  const [liveContent, setLiveContent] = useState("");
  const [liveType, setLiveType] = useState<"chat" | "game">("chat");
  const videoRef = useRef<HTMLVideoElement>(null);
  const speedHoldTimerRef = useRef<number | null>(null);
  const speedHoldTriggeredRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveGuestVideoRef = useRef<HTMLVideoElement>(null);
  const liveGuestStreamRef = useRef<MediaStream | null>(null);
  const liveGuestStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveScreenStreamRef = useRef<MediaStream | null>(null);
  const livePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const appliedLiveAnswersRef = useRef<Set<string>>(new Set());
  const appliedGuestOffersRef = useRef<Set<string>>(new Set());
  const liveCommentsRef = useRef<HTMLDivElement>(null);
  const liveCommentsAtBottomRef = useRef(true);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const viewedLoopRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const commentMediaRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const rightSwipeCountRef = useRef(0);
  const rightSwipeTimerRef = useRef<number | null>(null);
  const isOwnLoop =
    loop.user.username.toLowerCase() === user?.username?.toLowerCase();

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => () => {
    if (speedHoldTimerRef.current !== null) {
      window.clearTimeout(speedHoldTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!liveStudioOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [liveStudioOpen, liveStreamReady]);

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId) return;
    let cancelled = false;
    const loadComments = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${liveBroadcastId}/comments`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const comments = (await response.json()) as LiveComment[];
        if (!cancelled) setLiveComments(comments);
      } catch {
        // A temporary polling failure should not interrupt the live studio.
      }
    };
    void loadComments();
    const timer = window.setInterval(() => void loadComments(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveBroadcastId, liveStarted]);

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId) return;
    let cancelled = false;
    const loadJoinRequests = async () => {
      const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/join-requests`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as { requests?: LiveJoinRequest[]; participants?: LiveParticipant[] };
      setLiveJoinRequests(data.requests ?? []);
      setLiveParticipants(data.participants ?? []);
    };
    void loadJoinRequests();
    const timer = window.setInterval(() => void loadJoinRequests(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveBroadcastId, liveStarted]);

  const updateLiveJoinRequest = async (requestId: string, status: "accepted" | "rejected") => {
    if (!liveBroadcastId) return;
    setLiveJoinError("");
    const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/join-requests/${requestId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (response?.ok) setLiveJoinRequests((current) => current.filter((item) => item.id !== requestId));
    else if (response?.status === 409) setLiveJoinError("16 konuk kapasitesi dolu; yeni istek kabul edilemez.");
    else setLiveJoinError("Konuk isteği güncellenemedi. Lütfen tekrar dene.");
  };

  const rejectBattleOffer = async (offerId: string) => {
    if (!liveBroadcastId) return;
    const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle/offers/${offerId}/reject`, { method: "POST", credentials: "include" }).catch(() => null);
    if (response?.ok) setLiveBattle((current) => current ? { ...current, offers: (current.offers ?? []).filter((offer) => offer.id !== offerId) } : current);
  };

  const acceptStudioBattleOffer = async (offerId: string) => {
    if (!liveBroadcastId) return;
    const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle/offers/${offerId}/accept`, { method: "POST", credentials: "include" }).catch(() => null);
    if (response?.ok) setLiveBattle((await response.json()) as LiveBattle);
  };

  const chooseStudioBattleTeam = async (team: "red" | "blue") => {
    if (!liveBroadcastId) return;
    const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle/team`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    }).catch(() => null);
    if (!response?.ok) {
      setBattleInviteMessage("Takım seçimi kaydedilemedi. Lütfen tekrar deneyin.");
      return;
    }
    const data = (await response.json()) as { teamAssignments: Record<string, "red" | "blue"> };
    setLiveBattle((current) => current ? { ...current, teamAssignments: data.teamAssignments } : current);
  };

  const chooseStudioBattlePalette = async (paletteId: LivePkPaletteId) => {
    if (!liveBroadcastId) return;
    const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle/palette`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paletteId }),
    }).catch(() => null);
    if (!response?.ok) {
      setBattleInviteMessage("PK renk teması kaydedilemedi. Takım seçimi süresi içinde tekrar deneyin.");
      return;
    }
    setLiveBattle((current) => current ? { ...current, paletteId } : current);
  };

  const startStudioGroupBattle = async () => {
    if (!liveBroadcastId || liveBattleStarting || liveBattle?.active) return;
    setLiveBattleStarting(true);
    try {
      const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle`, { method: "POST", credentials: "include" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Takım Kapışması başlatılamadı.");
      setBattleInviteMessage("");
      setBattleInviteOpen(false);
      const battleResponse = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle`, { credentials: "include", cache: "no-store" });
      if (battleResponse.ok) setLiveBattle((await battleResponse.json()) as LiveBattle);
    } catch (error) {
      setBattleInviteMessage(error instanceof Error ? error.message : "Takım Kapışması başlatılamadı.");
    } finally {
      setLiveBattleStarting(false);
    }
  };

  const startStudioBattle = async (opponentBroadcastId: string) => {
    if (!liveBroadcastId || liveBattleStarting || liveBattle?.active) return;
    setLiveBattleStarting(true);
    try {
      const response = await fetch(`/api/live/broadcasts/${opponentBroadcastId}/battle/offers`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error();
      const opponent = liveBroadcasts.find((item) => item.id === opponentBroadcastId);
      setBattleInviteMessage(`@${opponent?.user.username ?? "yayıncı"} için Kapışma daveti gönderildi.`);
    } catch {
      setBattleInviteMessage("Kapışma daveti gönderilemedi.");
    } finally {
      setLiveBattleStarting(false);
    }
  };

  const endStudioBattle = async () => {
    if (!liveBroadcastId || !liveBattle?.active || liveBattleStarting) return;
    setLiveBattleStarting(true);
    try {
      const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle/end`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error();
      const battleResponse = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle`, { credentials: "include", cache: "no-store" });
      if (battleResponse.ok) setLiveBattle((await battleResponse.json()) as LiveBattle);
    } finally {
      setLiveBattleStarting(false);
    }
  };

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId) return;
    let cancelled = false;
    const loadBattle = async () => {
      const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/battle`, { credentials: "include", cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      setLiveBattle((await response.json()) as LiveBattle);
    };
    void loadBattle();
    const timer = window.setInterval(() => void loadBattle(), 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [liveBroadcastId, liveStarted]);

  useEffect(() => {
    if (liveBattle?.active) setStudioControlsOpen(true);
  }, [liveBattle?.active]);

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId) return;
    let cancelled = false;
    const loadStats = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${liveBroadcastId}/stats`,
          { cache: "no-store" },
        );
        if (response.ok && !cancelled) {
          const nextStats = (await response.json()) as LiveStats;
          setLiveStudioStats((current) => ({ ...current, ...nextStats }));
        }
      } catch {
        // Stats polling is best-effort and should not interrupt the studio.
      }
    };
    void loadStats();
    const timer = window.setInterval(() => void loadStats(), 750);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveBroadcastId, liveStarted]);

  useEffect(() => {
    const newGifts = liveGiftEvents.filter((gift) => !seenLiveGiftIdsRef.current.has(gift.id));
    if (newGifts.length === 0) return;
    newGifts.forEach((gift) => {
      seenLiveGiftIdsRef.current.add(gift.id);
      liveGiftAnimationQueueRef.current.push(gift);
    });
    setActiveLiveGiftEvent((current) => current ?? liveGiftAnimationQueueRef.current.shift() ?? null);
  }, [liveGiftEvents]);

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId) return;
    let cancelled = false;
    const loadGifts = async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${liveBroadcastId}/gifts`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const items = (await response.json()) as LiveGiftEvent[];
        if (!cancelled) setLiveGiftEvents(items);
      } catch {
        // Gift polling is best-effort and should not interrupt the studio.
      }
    };
    void loadGifts();
    const timer = window.setInterval(() => void loadGifts(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveBroadcastId, liveStarted]);

  useEffect(() => {
    const commentsElement = liveCommentsRef.current;
    if (!commentsElement || !liveCommentsAtBottomRef.current) return;
    commentsElement.scrollTop = commentsElement.scrollHeight;
  }, [liveComments]);

  useEffect(() => {
    if (!liveStarted || !liveBroadcastId || !livePeerReady) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/live/broadcasts/${liveBroadcastId}/signal?role=broadcaster`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          viewers?: string[];
          viewerUsers?: Record<string, LiveParticipant>;
          answers?: Record<string, string>;
          guestOffers?: Record<string, string>;
        };
        for (const viewerId of data.viewers ?? []) {
          if (livePeersRef.current.has(viewerId) || !liveStreamRef.current)
            continue;
          const peer = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun.cloudflare.com:3478" },
            ],
          });
          livePeersRef.current.set(viewerId, peer);
          liveStreamRef.current
            .getTracks()
            .forEach((track) => peer.addTrack(track, liveStreamRef.current!));
          peer.ontrack = (event) => {
            const stream = event.streams[0] ?? new MediaStream([event.track]);
            liveGuestStreamRef.current = stream;
            liveGuestStreamsRef.current.set(viewerId, stream);
            setLiveGuestStreams((current) => current.some((item) => item.viewerId === viewerId)
              ? current.map((item) => item.viewerId === viewerId ? { ...item, stream } : item)
              : [...current, { viewerId, stream, user: data.viewerUsers?.[viewerId] }]);
            setLiveGuestConnected(true);
            event.track.onmute = () => setLiveGuestCameraOffByViewer((current) => ({ ...current, [viewerId]: true }));
            event.track.onunmute = () => setLiveGuestCameraOffByViewer((current) => ({ ...current, [viewerId]: false }));
            if (liveGuestVideoRef.current) {
              liveGuestVideoRef.current.srcObject = stream;
              liveGuestVideoRef.current.style.transform = "none";
              liveGuestVideoRef.current.style.webkitTransform = "none";
              void liveGuestVideoRef.current.play().catch(() => {});
            }
            for (const [otherViewerId, otherPeer] of livePeersRef.current) {
              if (otherViewerId === viewerId) continue;
              if (otherPeer.getSenders().some((sender) => sender.track?.id === event.track.id)) continue;
              if (otherPeer.signalingState !== "stable") continue;
              otherPeer.addTrack(event.track, stream);
              void (async () => {
                try {
                  const offer = await otherPeer.createOffer();
                  await otherPeer.setLocalDescription(offer);
                  await new Promise<void>((resolve) => {
                    if (otherPeer.iceGatheringState === "complete") return resolve();
                    otherPeer.addEventListener("icegatheringstatechange", () => {
                      if (otherPeer.iceGatheringState === "complete") resolve();
                    });
                    window.setTimeout(resolve, 3000);
                  });
                  if (!otherPeer.localDescription) return;
                  await fetch(`/api/live/broadcasts/${liveBroadcastId}/signal`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "offer", viewerId: otherViewerId, description: JSON.stringify(otherPeer.localDescription) }),
                  });
                  appliedLiveAnswersRef.current.delete(otherViewerId);
                } catch {
                  // A viewer may leave while the guest stream is being added.
                }
              })();
            }
          };
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await Promise.race([
            new Promise<void>((resolve) => {
              if (peer.iceGatheringState === "complete") return resolve();
              peer.addEventListener("icegatheringstatechange", () => {
                if (peer.iceGatheringState === "complete") resolve();
              });
            }),
            new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
          ]);
          if (peer.localDescription)
            await fetch(`/api/live/broadcasts/${liveBroadcastId}/signal`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: "offer",
                viewerId,
                description: JSON.stringify(peer.localDescription),
              }),
            });
        }
        for (const [viewerId, description] of Object.entries(
          data.answers ?? {},
        )) {
          const peer = livePeersRef.current.get(viewerId);
          if (!peer) continue;
          if (appliedLiveAnswersRef.current.has(viewerId)) continue;
          if (peer.signalingState !== "have-local-offer") continue;
          try {
            await peer.setRemoteDescription(JSON.parse(description) as RTCSessionDescriptionInit);
            appliedLiveAnswersRef.current.add(viewerId);
          } catch {
            continue;
          }
        }
        for (const [viewerId, description] of Object.entries(data.guestOffers ?? {})) {
          const peer = livePeersRef.current.get(viewerId);
          if (!peer || appliedGuestOffersRef.current.has(viewerId)) continue;
          if (peer.signalingState !== "stable") continue;
          await peer.setRemoteDescription(JSON.parse(description) as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await Promise.race([
            new Promise<void>((resolve) => {
              if (peer.iceGatheringState === "complete") return resolve();
              peer.addEventListener("icegatheringstatechange", () => {
                if (peer.iceGatheringState === "complete") resolve();
              });
            }),
            new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
          ]);
          if (peer.localDescription) {
            await fetch(`/api/live/broadcasts/${liveBroadcastId}/signal`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "guest-answer", viewerId, description: JSON.stringify(peer.localDescription) }),
            });
            appliedGuestOffersRef.current.add(viewerId);
          }
        }
      } catch {
        // A viewer leaving should not interrupt the broadcaster.
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [liveBroadcastId, livePeerReady, liveStarted]);

  useEffect(() => {
    onLiveModeChange?.(liveConfirmOpen || liveStudioOpen || cameraOpen);
    return () => onLiveModeChange?.(false);
  }, [cameraOpen, liveConfirmOpen, liveStudioOpen, onLiveModeChange]);

  useEffect(() => {
    if (typeof loop.liked === "boolean") setLiked(loop.liked);
    setLikeCount(loop.likes);
  }, [loop.id, loop.liked, loop.likes]);

  const showMenuNotice = (message: string) => {
    setMenuNotice(message);
    window.setTimeout(
      () => setMenuNotice((current) => (current === message ? "" : current)),
      2200,
    );
  };

  const drawStickerFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = stickerCanvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }
    try {
      const context = canvas.getContext("2d");
      if (!context) return false;
      const cropSize = Math.min(video.videoWidth, video.videoHeight) / stickerZoom;
      const cropX = (video.videoWidth - cropSize) / 2;
      const cropY = (video.videoHeight - cropSize) / 2;
      canvas.width = 512;
      canvas.height = 512;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
      setStickerEditorError("");
      return true;
    } catch {
      setStickerEditorError("Video karesi okunamadı. Lütfen başka bir kare seçmeyi dene.");
      return false;
    }
  }, [stickerZoom]);

  const openStickerEditor = () => {
    if (!isVideoMediaUrl(activeMediaUrl)) {
      showMenuNotice("Çıkartma oluşturmak için video gerekli.");
      return;
    }
    const video = videoRef.current;
    if (!video) {
      showMenuNotice("Video henüz hazır değil. Biraz bekleyip tekrar dene.");
      return;
    }
    setStickerFrameTime(video.currentTime || 0);
    setStickerZoom(1);
    setStickerEditorError("");
    setMoreMenuOpen(false);
    setStickerEditorOpen(true);
    setPaused(true);
    video.pause();
  };

  const saveLoopSticker = async () => {
    const canvas = stickerCanvasRef.current;
    const name = stickerName.trim().slice(0, 60);
    if (!canvas || !name) {
      setStickerEditorError("Lütfen sticker için bir ad gir.");
      return;
    }
    if (!drawStickerFrame()) {
      setStickerEditorError("Video karesi henüz hazır değil. Biraz bekleyip tekrar dene.");
      return;
    }
    setStickerSaving(true);
    setStickerEditorError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error("Görsel oluşturulamadı.")), "image/png");
        } catch {
          reject(new Error("Bu videodan kare alınamadı. Video kaynağı dışa aktarmaya izin vermiyor."));
        }
      });
      const formData = new FormData();
      formData.append("file", new File([blob], `${name}.png`, { type: "image/png" }));
      formData.append("name", name);
      const response = await fetch("/api/dm/stickers", { method: "POST", body: formData, credentials: "include" });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Sticker kaydedilemedi.");
      setStickerEditorOpen(false);
      showMenuNotice("Sticker kaydedildi. DM sticker panelinden paylaşabilirsin.");
    } catch (error) {
      setStickerEditorError(error instanceof Error ? error.message : "Sticker kaydedilemedi.");
    } finally {
      setStickerSaving(false);
    }
  };

  useEffect(() => {
    if (!stickerEditorOpen) return;
    const frame = window.requestAnimationFrame(drawStickerFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [drawStickerFrame, stickerEditorOpen, stickerFrameTime]);

  const setInterestPreference = (
    preference: "interested" | "not-interested",
  ) => {
    try {
      localStorage.setItem(
        `loop-interest:${loop.sourceId ?? loop.id}`,
        preference,
      );
    } catch {
      // Preferences remain session-only when storage is unavailable.
    }
    window.dispatchEvent(
      new CustomEvent("loop-interest-changed", {
        detail: { loopId: loop.id, preference },
      }),
    );
    setMoreMenuOpen(false);
    showMenuNotice(
      preference === "interested"
        ? "Daha fazla benzer Loop göstereceğiz"
        : "Bu tür Loop'lar daha az gösterilecek",
    );
  };

  const shareLoopToStory = async () => {
    if (!loop.cover || !loop.sourceId) return;
    const storyMediaUrl = `${loop.cover}${loop.cover.includes("?") ? "&" : "?"}story-share=loop:${loop.sourceId}`;
    const response = await fetch("/api/stories", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaUrl: storyMediaUrl, mediaType: "video" }),
    });
    setMoreMenuOpen(false);
    if (response.ok) {
      await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
    }
    showMenuNotice(
      response.ok ? "Hikayende paylaşıldı" : "Hikayede paylaşım başarısız",
    );
  };

  const reportLoop = async () => {
    if (!loop.user.id || !loop.sourceId) return;
    const response = await fetch("/api/reports", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId: loop.user.id,
        targetType: "loop",
        targetId: loop.sourceId,
        reason: "Loop içeriğini şikayet et",
      }),
    });
    setMoreMenuOpen(false);
    showMenuNotice(response.ok ? "Şikayetin alındı" : "Şikayet gönderilemedi");
  };

  const deleteOwnLoop = async () => {
    if (!loop.sourceId) return;
    const response = await fetch(`/api/loop/photos/${loop.sourceId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) window.location.reload();
    else showMenuNotice("Loop silinemedi");
  };

  const toggleLike = async () => {
    if (!user) {
      showMenuNotice("Beğenmek için giriş yapmalısın");
      return;
    }
    const photoId =
      loop.sourceId ?? (loop.id >= 1000000 ? loop.id - 1000000 : 0);
    if (!photoId) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((value) => Math.max(0, value + (wasLiked ? -1 : 1)));
    try {
      const response = await fetch(`/api/loop/photos/${photoId}/react`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "❤️" }),
      });
      if (!response.ok) throw new Error("Like failed");
    } catch {
      setLiked(wasLiked);
      setLikeCount((value) => Math.max(0, value + (wasLiked ? 1 : -1)));
    }
  };

  useEffect(() => {
    setFollowing(initiallyFollowing);
  }, [initiallyFollowing, loop.id]);

  useEffect(() => {
    setActiveMediaIndex(0);
    setVideoProgress(0);
  }, [loop.id, loop.mediaItems?.length]);

  const followLoopUser = async () => {
    if (!loop.user.id || following) return;
    const response = await fetch(`/api/users/${loop.user.id}/follow`, {
      method: "POST",
      credentials: "include",
    });
    if (response.ok) setFollowing(true);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (liveConfirmOpen || liveStudioOpen || cameraOpen) return;
    const touch = event.changedTouches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSpeedHoldStart = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (speedHoldTimerRef.current !== null) window.clearTimeout(speedHoldTimerRef.current);
    speedHoldTriggeredRef.current = false;
    speedHoldTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      speedHoldTriggeredRef.current = true;
      video.playbackRate = 2;
      setFastForwarding(true);
    }, 250);
  };

  const handleSpeedHoldEnd = () => {
    if (speedHoldTimerRef.current !== null) {
      window.clearTimeout(speedHoldTimerRef.current);
      speedHoldTimerRef.current = null;
    }
    const video = videoRef.current;
    if (video && speedHoldTriggeredRef.current) video.playbackRate = 1;
    if (speedHoldTriggeredRef.current) setFastForwarding(false);
  };

  const handleSpeedHoldCancel = () => {
    handleSpeedHoldEnd();
    speedHoldTriggeredRef.current = false;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (liveConfirmOpen || liveStudioOpen || cameraOpen) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      loopMediaUrls.length > 1 &&
      Math.abs(deltaX) >= 50 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.25
    ) {
      setActiveMediaIndex(
        (index) =>
          (index + (deltaX < 0 ? 1 : -1) + loopMediaUrls.length) %
          loopMediaUrls.length,
      );
      setVideoProgress(0);
      return;
    }
    if (deltaX < 80 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    rightSwipeCountRef.current += 1;
    if (rightSwipeCountRef.current >= 2) {
      if (rightSwipeTimerRef.current)
        window.clearTimeout(rightSwipeTimerRef.current);
      rightSwipeCountRef.current = 0;
      setLocation("/chat");
      return;
    }
    rightSwipeTimerRef.current = window.setTimeout(() => {
      rightSwipeCountRef.current = 0;
      setLocation("/dm");
    }, 650);
  };

  useEffect(() => {
    setActionsFaded(false);
    if (!active || paused) return;
    const timer = window.setTimeout(() => setActionsFaded(true), 6000);
    actionsFadeTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (actionsFadeTimerRef.current === timer)
        actionsFadeTimerRef.current = null;
    };
  }, [active, paused]);

  const revealActions = () => {
    setActionsFaded(false);
    if (actionsFadeTimerRef.current)
      window.clearTimeout(actionsFadeTimerRef.current);
    if (active && !paused) {
      actionsFadeTimerRef.current = window.setTimeout(
        () => setActionsFaded(true),
        6000,
      );
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoError(false);
    video.muted = muted;
    video.setAttribute("fetchpriority", active ? "high" : "auto");
    if (!active || paused) {
      video.pause();
      return;
    }
    void video.play().catch((error: unknown) => {
      if (!video.isConnected || videoRef.current !== video || !active || pausedRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!video.muted) {
        video.muted = true;
        setMuted(true);
        void video.play().catch((retryError: unknown) => {
          if (retryError instanceof DOMException && retryError.name === "AbortError") return;
          console.warn("Loop video playback retry failed", retryError);
        });
        return;
      }
      console.warn("Loop video playback failed", error);
    });
  }, [active, paused, muted, activeMediaUrl]);

  useEffect(() => {
    if (active) return undefined;
    setVideoProgress(0);
    if (progressBarRef.current) progressBarRef.current.style.width = "0%";
    const video = videoRef.current;
    if (!video) return undefined;
    const resetTimer = window.setTimeout(() => {
      video.pause();
      video.currentTime = 0;
    }, 3000);
    return () => window.clearTimeout(resetTimer);
  }, [active]);

  useEffect(() => {
    if (!active || paused || !loop.isVideo) return;
    let frameId = 0;
    const updateProgress = () => {
      const video = videoRef.current;
      const bar = progressBarRef.current;
      if (video && bar && video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        bar.style.width = `${progress}%`;
        if (
          progress >= 80 &&
          user?.id &&
          loop.sourceId &&
          viewedLoopRef.current !== loop.sourceId
        ) {
          viewedLoopRef.current = loop.sourceId;
          void fetch(`/api/loop/photos/${loop.sourceId}/view`, {
            method: "POST",
            credentials: "include",
          }).catch(() => {});
        }
      }
      frameId = window.requestAnimationFrame(updateProgress);
    };
    frameId = window.requestAnimationFrame(updateProgress);
    return () => window.cancelAnimationFrame(frameId);
  }, [active, paused, loop.isVideo]);

  useEffect(() => {
    try {
      const interactionKey = loop.sourceId ?? loop.id;
      localStorage.setItem(
        `loop-interactions:${interactionKey}`,
        JSON.stringify({
          liked,
          saved,
          reposted,
          likes: likeCount,
          comments: commentCount,
          reposts: repostCount,
          shares: shareCount,
          saves: saveCount,
        }),
      );
    } catch {
      // Interaction counters remain available for the current session.
    }
  }, [
    loop.id,
    liked,
    saved,
    reposted,
    likeCount,
    commentCount,
    repostCount,
    shareCount,
    saveCount,
  ]);

  const selectLoopMedia = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (liveStudioOpen || liveConfirmOpen) {
      event.target.value = "";
      return;
    }

    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("video/") || file.type.startsWith("image/"))
      .slice(0, 10);
    event.target.value = "";
    if (files.length === 0) return;
    setSelectedVideos(files);
    setSelectedVideo(files[0] ?? null);
    setLoopTitle((files[0]?.name ?? "Yeni Loop").replace(/\.[^/.]+$/, ""));
    setLoopCaption("");
    setLoopTags("");
    setLoopAudio("");
    setUploadMessage("");
  };

  useEffect(() => {
    if (!cameraOpen || cameraMode !== "camera") return;
    let cancelled = false;
    setCameraError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Kamera yalnızca güvenli bağlantılarda kullanılabilir. HTTPS veya localhost kullanın.",
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = stream;
          void cameraPreviewRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCameraError("Kamera ve mikrofon izni alınamadı."));
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    };
  }, [cameraOpen, cameraMode]);

  const stopCamera = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setRecording(false);
    setCameraOpen(false);
  };

  const startRecording = () => {
    const stream = cameraStreamRef.current;
    if (!stream || !window.MediaRecorder) {
      setCameraError("Bu tarayıcıda video kaydı desteklenmiyor.");
      return;
    }
    recordingChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const file = new File(
        recordingChunksRef.current,
        `loop-${Date.now()}.webm`,
        { type: mimeType || "video/webm" },
      );
      setSelectedVideo(file);
      setSelectedVideos([file]);
      setLoopTitle("Yeni Loop");
      setLoopCaption("");
      setLoopTags("");
      setLoopAudio("");
      setUploadMessage("");
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setRecording(false);
    setCameraOpen(false);
  };

  const openLiveStudio = async () => {
    setSelectedVideo(null);
    setLiveTitle((current) => current.trim() || "Canlı yayın");
    setLiveContent((current) => current.trim() || "Canlı yayına başlıyorum.");
    setLiveConfirmOpen(false);
    setLiveStudioOpen(true);
    setLiveError("");
    setLiveStreamReady(false);
    setLiveCamOff(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("camera_unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      liveStreamRef.current = stream;
      setLiveStreamReady(true);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.style.transform = "scaleX(-1)";
        liveVideoRef.current.style.webkitTransform = "scaleX(-1)";
        void liveVideoRef.current.play().catch(() => {});
      }
    } catch {
      setLiveStreamReady(false);
      setLiveError(
        "Kamera ve mikrofon izni alınamadı. Yayın başlatmak için izin vermelisin.",
      );
    }
  };

  const startLiveBroadcast = async () => {
    if (!liveStreamRef.current) {
      setLiveError("Kamera ve mikrofon hazır değil. Lütfen önce izin verin.");
      return;
    }
    setLiveError("");
    let broadcast: LiveBroadcast;
    try {
      const response = await fetch("/api/live/broadcasts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: liveTitle,
          content: liveContent,
          type: liveType,
        }),
      });
      if (!response.ok) throw new Error("broadcast_start_failed");
      broadcast = (await response.json()) as LiveBroadcast;
      setLiveBroadcastId(broadcast.id);
      setLiveComments([]);
    } catch {
      setLiveError("Canlı yayın başlatılamadı. Lütfen tekrar dene.");
      return;
    }
    setLiveStarted(true);
    setLiveStartedAt(Date.parse(broadcast.startedAt) || Date.now());
    setLivePeerReady(true);
  };

  const closeLiveStudio = () => {
    if (liveBroadcastId) {
      void fetch(`/api/live/broadcasts/${liveBroadcastId}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    livePeersRef.current.forEach((peer) => peer.close());
    livePeersRef.current.clear();
    setLivePeerReady(false);
    appliedLiveAnswersRef.current.clear();
    appliedGuestOffersRef.current.clear();
    liveScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
    liveScreenStreamRef.current = null;
    liveGuestStreamRef.current = null;
    liveGuestStreamsRef.current.clear();
    setLiveGuestStreams([]);
    setLiveGuestConnected(false);
    setLiveGuestCameraOff(false);
    setLiveGuestCameraOffByViewer({});
    if (liveGuestVideoRef.current) liveGuestVideoRef.current.srcObject = null;
    setLiveJoinRequests([]);
    setLiveJoinError("");
    setLiveParticipants([]);
    setLiveQuestionOpen(false);
    setLiveQuestionDraft("");
    setLiveQuestionError("");
    setLiveStreamReady(false);
    setLiveBroadcastId(null);
    setLiveStarted(false);
    setLiveStartedAt(null);
    setStudioRankingOpen(false);
    setStudioPanelOffset(0);
    setLiveStudioOpen(false);
    setLiveMicMuted(false);
    setLiveCamOff(false);
  };

  const handleStudioPanelTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    studioPanelStartYRef.current = event.touches[0]?.clientY ?? null;
    studioPanelDraggingRef.current = true;
  };
  const handleStudioPanelTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (!studioPanelDraggingRef.current || studioPanelStartYRef.current === null) return;
    setStudioPanelOffset(Math.max(0, (event.touches[0]?.clientY ?? studioPanelStartYRef.current) - studioPanelStartYRef.current));
  };
  const handleStudioPanelTouchEnd = () => {
    studioPanelDraggingRef.current = false;
    if (studioPanelOffset > 100) setStudioRankingOpen(false);
    setStudioPanelOffset(0);
    studioPanelStartYRef.current = null;
  };

  const toggleLiveCamera = () => {
    const nextCamOff = !liveCamOff;
    setLiveCamOff(nextCamOff);
    liveStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCamOff;
    });
  };

  const sendLiveComment = async () => {
    const content = liveCommentText.trim();
    if (!content || !liveBroadcastId || liveCommentSending) return;
    setLiveCommentSending(true);
    try {
      const response = await fetch(
        `/api/live/broadcasts/${liveBroadcastId}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, replyToId: liveReplyingTo?.id }),
        },
      );
      if (!response.ok) throw new Error("live_comment_failed");
      const comment = (await response.json()) as LiveComment;
      setLiveComments((current) => [...current.slice(-99), comment]);
      setLiveCommentText("");
      setLiveReplyingTo(null);
    } finally {
      setLiveCommentSending(false);
    }
  };

  const sendLiveQuestion = async () => {
    const question = liveQuestionDraft.trim();
    if (!question || !liveBroadcastId || liveCommentSending) return;
    setLiveCommentSending(true);
    setLiveQuestionError("");
    try {
      const response = await fetch(`/api/live/broadcasts/${liveBroadcastId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `❓ SORU: ${question}` }),
      });
      if (!response.ok) throw new Error("live_question_failed");
      const comment = (await response.json()) as LiveComment;
      setLiveComments((current) => [...current.slice(-99), comment]);
      setLiveQuestionDraft("");
      setLiveQuestionOpen(false);
    } catch {
      setLiveQuestionError("Soru gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setLiveCommentSending(false);
    }
  };

  const shareGameScreen = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
      setLiveError(
        "Ekran paylaşımı için güvenli bağlantı gerekir. HTTPS veya localhost kullanın.",
      );
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setLiveType("game");
      liveScreenStreamRef.current = screen;
      const camera = liveStreamRef.current;
      const mixedStream = new MediaStream([
        ...screen.getVideoTracks(),
        ...(camera?.getAudioTracks() || screen.getAudioTracks()),
      ]);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mixedStream;
        void liveVideoRef.current.play().catch(() => {});
      }
      screen.getVideoTracks()[0]?.addEventListener("ended", () => {
        setLiveType("chat");
        if (liveVideoRef.current && liveStreamRef.current)
          liveVideoRef.current.srcObject = liveStreamRef.current;
      });
    } catch {
      setLiveError("Ekran paylaşımı başlatılamadı.");
    }
  };

  const uploadLoop = async () => {
    const files = selectedVideos.length > 0
      ? selectedVideos
      : selectedVideo ? [selectedVideo] : [];
    if (files.length === 0 || !loopTitle.trim()) return;
    setUploadingLoop(true);
    setUploadMessage("");
    setUploadProgress(0);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("title", loopTitle.trim());
    formData.append("caption", loopCaption.trim());
    const captionTags = loopCaption.match(/#[^\s#]+/g)?.join(" ") || "";
    formData.append("tags", loopTags.trim() || captionTags);
    formData.append("audio", loopAudio.trim());
    try {
      const result = await new Promise<{ id?: number; mediaUrl?: string; mediaItems?: Array<{ url: string }> }>(
        (resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/loop/photos");
          request.withCredentials = true;
          request.upload.onprogress = (progressEvent) => {
            if (progressEvent.lengthComputable)
              setUploadProgress(
                Math.round((progressEvent.loaded / progressEvent.total) * 100),
              );
          };
          request.onload = () => {
            if (request.status < 200 || request.status >= 300)
              return reject(new Error("upload_failed"));
            try {
              resolve(JSON.parse(request.responseText).photo ?? {});
            } catch {
              reject(new Error("invalid_response"));
            }
          };
          request.onerror = () => reject(new Error("upload_failed"));
          request.send(formData);
        },
      );
      const uploadedUrl =
        result.mediaUrl?.replace(/^\/uploads\//, "/api/uploads/") ||
        URL.createObjectURL(files[0]!);
      const uploadedMediaItems = (result.mediaItems ?? [])
        .map((item) => normalizeLoopMediaUrl(item.url))
        .filter(Boolean);
      const profileResponse = user?.id
        ? await fetch(`/api/users/${user.id}`, {
            credentials: "include",
            cache: "no-store",
          })
        : null;
      const profileDecorations = profileResponse?.ok
        ? await profileResponse.json()
        : null;
      onLoopUploaded({
        id: Number(result.id) > 0 ? 1000000 + Number(result.id) : Date.now(),
        sourceId: Number(result.id) > 0 ? Number(result.id) : undefined,
        user: {
          id: user?.id,
          username: user?.username || "kullanıcı",
          avatar: user?.avatarUrl || "",
          badgeAssetUrl:
            profileDecorations?.badgeAssetUrl ??
            (user as (typeof user & { badgeAssetUrl?: string | null }) | null)
              ?.badgeAssetUrl,
          emblemAssetUrl:
            profileDecorations?.emblemAssetUrl ??
            (user as (typeof user & { emblemAssetUrl?: string | null }) | null)
              ?.emblemAssetUrl,
          badgeLabel:
            profileDecorations?.badgeLabel ??
            (user as (typeof user & { badgeLabel?: string | null }) | null)
              ?.badgeLabel,
        },
        title: loopTitle.trim(),
        caption: loopCaption.trim() || "Yeni Loop videom",
        tags: loopTags.trim(),
        location: "",
        audio: loopAudio.trim() || "Orijinal ses",
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        repostFriends: [],
        cover: uploadedUrl,
        mediaItems: uploadedMediaItems.length > 0 ? uploadedMediaItems : [uploadedUrl],
        isVideo: Boolean(files[0]?.type.startsWith("video/")),
      });
      setUploadProgress(100);
      setUploadMessage("Loop paylaşıldı");
      window.setTimeout(() => {
        setSwipePanelOpen(false);
        setUploadMessage("");
        setSelectedVideo(null);
        setSelectedVideos([]);
        setLoopTitle("");
        setLoopCaption("");
        setLoopTags("");
        setLoopAudio("");
      }, 900);
    } catch {
      setUploadMessage("Loop medyası yüklenemedi");
      setUploadProgress(0);
    } finally {
      setUploadingLoop(false);
    }
  };

  const submitComment = async () => {
    const content =
      commentText.trim() ||
      (commentMediaUrl
        ? `[${commentMediaUrl.startsWith("data:") ? "Fotoğraf" : "GIF"}]`
        : "");
    const photoId = loop.id >= 1000000 ? loop.id - 1000000 : loop.id;
    if (!content || commentSending || photoId <= 0) return;
    setCommentSending(true);
    try {
      const response = await fetch(`/api/loop/photos/${photoId}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("comment_failed");
      setCommentText("");
      setReplyingTo(null);
      setCommentMediaUrl(null);
      setCommentCount((value) => value + 1);
      setCommentReplies((current) => [
        ...current,
        {
          content,
          createdAt: new Date().toISOString(),
          user: user
            ? {
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              }
            : null,
        },
      ]);
    } finally {
      setCommentSending(false);
    }
  };

  const toggleRepost = () => {
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostCount((countValue) => countValue + (wasReposted ? -1 : 1));
    if (!loop.sourceId) return;
    fetch(`/api/loop/photos/${loop.sourceId}/repost`, {
      method: wasReposted ? "DELETE" : "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Repost failed");
        const data = (await response.json()) as { repostCount?: number };
        if (typeof data.repostCount === "number")
          setRepostCount(data.repostCount);
      })
      .catch(() => {
        setReposted(wasReposted);
        setRepostCount((countValue) => countValue + (wasReposted ? 1 : -1));
      });
  };

  const shareLoop = async () => {
    const shareUrl = `${window.location.origin}/loops?loop=${loop.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: loop.title,
          text: loop.caption,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareCount((value) => value + 1);
    } catch {
      // Sharing can be cancelled by the user; cancelled shares do not increment.
    }
  };

  const seekVideo = (event: React.PointerEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video?.duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    video.currentTime = ratio * video.duration;
    setVideoProgress(ratio * 100);
    if (progressBarRef.current)
      progressBarRef.current.style.width = `${ratio * 100}%`;
  };

  const beginSeeking = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSeeking(true);
    seekVideo(event);
  };

  useEffect(() => {
    if (!shareOpen) return;
    fetch("/api/users", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : []))
      .then(
        (
          users: Array<{
            id: number;
            username: string;
            displayName?: string | null;
            avatarUrl?: string | null;
          }>,
        ) =>
          setShareContacts(users.filter((contact) => contact.id !== user?.id)),
      )
      .catch(() => setShareContacts([]));
  }, [shareOpen, user?.id]);

  const sendLoopToContact = async (contact: { id: number }) => {
    setShareSending(contact.id);
    try {
      const loopId =
        loop.sourceId ?? (loop.id >= 1000000 ? loop.id - 1000000 : loop.id);
      const content = `__LOOP_VIDEO_SHARE__:${JSON.stringify({ id: loopId, title: loop.title, caption: loop.caption, videoUrl: loop.cover, username: loop.user.username })}`;
      const response = await fetch(`/api/dm/${contact.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("share_failed");
      setShareSent((current) => new Set(current).add(contact.id));
      setShareCount((value) => value + 1);
    } finally {
      setShareSending(null);
    }
  };

  const handleCommentImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCommentMediaUrl(String(reader.result));
    reader.readAsDataURL(file);
    setCommentsPlusOpen(false);
  };

  useEffect(() => {
    if (!commentsOpen) return;
    const photoId = loop.id >= 1000000 ? loop.id - 1000000 : loop.id;
    fetch(`/api/loop/photos/${photoId}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            replies?: Array<{
              content: string;
              createdAt?: string;
              user: {
                username?: string;
                displayName?: string | null;
                avatarUrl?: string | null;
              } | null;
            }>;
          } | null,
        ) => setCommentReplies(data?.replies ?? []),
      )
      .catch(() => setCommentReplies([]));
  }, [commentsOpen, loop.id]);

  if (canUpload && selectedVideo) {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#f6f7ff] px-4 py-5 sm:px-8 sm:py-8">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-start justify-center">
          <LoopsComposer
            files={selectedVideos.length > 0 ? selectedVideos : selectedVideo ? [selectedVideo] : []}
            title={loopTitle}
            caption={loopCaption}
            tags={loopTags}
            audio={loopAudio}
            uploading={uploadingLoop}
            progress={uploadProgress}
            onTitleChange={setLoopTitle}
            onCaptionChange={setLoopCaption}
            onTagsChange={setLoopTags}
            onAudioChange={setLoopAudio}
            onPublish={uploadLoop}
            onChooseVideo={() => uploadInputRef.current?.click()}
            onClose={() => { setSelectedVideo(null); setSelectedVideos([]); }}
          />
        </div>
      </div>
    );
  }

  return (
    <article
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative h-full w-full overflow-hidden bg-black [touch-action:pan-y] md:rounded-[2.25rem] md:ring-1 md:ring-white/10 md:shadow-2xl md:shadow-black/60"
    >
      {(loop.isVideo || loopMediaUrls.length > 1) &&
      (!isVideoMediaUrl(activeMediaUrl) || !videoError) ? (
        <>
          {isVideoMediaUrl(activeMediaUrl) ? (
            <video
              key={`${loop.id}:${activeMediaIndex}`}
              ref={videoRef}
              src={activeMediaUrl}
              className="loop-feed-video absolute inset-0 h-full w-full bg-black object-contain"
              muted={muted}
              autoPlay={active}
              loop
              playsInline
              preload={active ? "auto" : "none"}
              onLoadStart={(event) => {
                setVideoError(false);
                delete event.currentTarget.dataset.playing;
              }}
              onPlaying={(event) => {
                revealVideoAfterFrame(event.currentTarget);
                setVideoError(false);
              }}
              onLoadedData={() => {
                if (active && !pausedRef.current)
                  void videoRef.current?.play().catch(() => {});
                if (stickerEditorOpen) {
                  setStickerFrameTime(videoRef.current?.currentTime ?? 0);
                  window.requestAnimationFrame(drawStickerFrame);
                }
              }}
              onSeeked={() => {
                if (stickerEditorOpen) drawStickerFrame();
              }}
              onCanPlay={() => {
                if (active && !pausedRef.current)
                  void videoRef.current?.play().catch(() => {});
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (speedHoldTriggeredRef.current) {
                  speedHoldTriggeredRef.current = false;
                  return;
                }
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) {
                  setPaused(false);
                  void video.play().catch(() => {});
                } else {
                  setPaused(true);
                  video.pause();
                }
              }}
              onPointerDown={handleSpeedHoldStart}
              onPointerUp={handleSpeedHoldEnd}
              onPointerCancel={handleSpeedHoldCancel}
              onContextMenu={(event) => event.preventDefault()}
              onEnded={() => {
                setVideoProgress(100);
                if (progressBarRef.current)
                  progressBarRef.current.style.width = "100%";
              }}
              onError={(event) => {
                if (!active) return;
                const video = event.currentTarget;
                if (video.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
                setVideoError(true);
              }}
            />
          ) : (
            <img
              src={activeMediaUrl}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-transform duration-[12000ms] ease-linear ${active && !paused ? "scale-105" : "scale-100"}`}
              draggable={false}
            />
          )}
          {isVideoMediaUrl(activeMediaUrl) && fastForwarding && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/65 px-4 py-2 text-lg font-black text-white shadow-xl backdrop-blur-md">
              2×
            </div>
          )}
        </>
      ) : isVideoMediaUrl(activeMediaUrl) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090719] text-center text-violet-200">
          <div>
            <Play className="mx-auto mb-3 h-10 w-10 opacity-60" />
            <p className="text-sm font-semibold">Video yüklenemedi</p>
            <p className="mt-1 text-xs text-violet-100/50">
              Bir sonraki Loop’a geçebilirsin
            </p>
          </div>
        </div>
      ) : (
        <img
          src={activeMediaUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[12000ms] ease-linear ${active && !paused ? "scale-105" : "scale-100"}`}
          draggable={false}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,24,0.9)_0%,rgba(9,7,24,0.08)_30%,rgba(6,4,15,0.02)_53%,rgba(2,2,7,0.68)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_47%,transparent_0%,rgba(2,2,9,0.03)_58%,rgba(0,0,0,0.02)_100%)]" />
      {loopMediaUrls.length > 1 && (
        <div className="absolute right-4 top-[4.35rem] z-[55] flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5 backdrop-blur-sm md:right-6" role="group" aria-label="Loop fotoğrafları">
          {loopMediaUrls.map((_, index) => (
            <button
              key={`${loop.id}-media-dot-${index}`}
              type="button"
              aria-label={`${index + 1}. Loop fotoğrafını göster`}
              aria-current={activeMediaIndex === index ? "true" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setActiveMediaIndex(index);
                setVideoProgress(0);
              }}
              className={`h-1.5 rounded-full transition-all ${activeMediaIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"}`}
            />
          ))}
          <span className="ml-0.5 text-[10px] font-semibold tabular-nums text-white/85">
            {Math.min(activeMediaIndex, loopMediaUrls.length - 1) + 1}/{loopMediaUrls.length}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2 md:left-7 md:top-7">
        <span className="bg-gradient-to-br from-white via-slate-300 to-slate-500 bg-clip-text text-[38px] font-black leading-none text-transparent drop-shadow-[0_2px_10px_rgba(255,255,255,0.22)]">
          ∞
        </span>
        <span className="border-l border-white/20 pl-2 text-[18px] font-semibold tracking-[0.08em] text-white/80">
          Loops
        </span>
      </div>
      {canUpload && (
        <button
          type="button"
          aria-label={swipePanelOpen ? "Loop menüsünü kapat" : "Yeni Loop oluştur"}
          onClick={() => setSwipePanelOpen((open) => !open)}
          className={`absolute right-4 top-4 z-50 flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-black tracking-wide text-white shadow-[0_0_18px_rgba(139,92,246,0.28)] backdrop-blur-xl transition-all active:scale-95 md:right-6 md:top-6 ${swipePanelOpen ? "border-white/30 bg-white/15 text-violet-100" : "border-violet-200/35 bg-[#100c2a]/65 text-violet-100 hover:bg-violet-900/75"}`}
        >
          {swipePanelOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span>{swipePanelOpen ? "Kapat" : "Yeni Loop"}</span>
        </button>
      )}
      <button
        type="button"
        aria-label={paused ? "Devam et" : "Duraklat"}
        onClick={() => setPaused((value) => !value)}
        className="absolute inset-0 z-10 cursor-default"
      />
      {!liveConfirmOpen && !liveStudioOpen && !cameraOpen && <div
        role="slider"
        aria-label="Video konumu"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(videoProgress)}
        tabIndex={0}
        onPointerDown={beginSeeking}
        onPointerMove={(event) => {
          if (seeking) seekVideo(event);
        }}
        onPointerUp={() => setSeeking(false)}
        onPointerCancel={() => setSeeking(false)}
        onKeyDown={(event) => {
          const video = videoRef.current;
          if (!video?.duration) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            video.currentTime = Math.max(
              0,
              Math.min(
                video.duration,
                video.currentTime + (event.key === "ArrowRight" ? 5 : -5),
              ),
            );
            setVideoProgress((video.currentTime / video.duration) * 100);
          }
        }}
        className={`group/seek absolute bottom-0 left-0 right-0 z-40 cursor-pointer overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 ${seeking ? "h-2" : "h-1"}`}
        title="Videoyu ileri veya geri sar"
      >
        <div
          ref={progressBarRef}
          className="absolute inset-y-0 left-0 block rounded-full bg-white/90 group-hover/seek:bg-white"
        />
      </div>}
      <div
        className={`absolute bottom-20 right-4 z-50 transition-opacity duration-700 md:bottom-24 md:right-6 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
      >
        <Action
          label="Daha fazla seçenek"
          onClick={() => {
            revealActions();
            setMoreMenuOpen((value) => !value);
          }}
        >
          <MoreVertical className="h-6 w-6 text-violet-200" />
        </Action>
      </div>
      {paused && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="rounded-full bg-black/35 p-5 text-white backdrop-blur-md">
            <Play className="h-9 w-9 fill-white" />
          </span>
        </div>
      )}
      <div className="absolute right-1 top-[56%] z-30 flex -translate-y-1/2 flex-col items-center gap-3">
        <div
          className={`flex min-w-[3.25rem] flex-col items-center text-purple-500 transition-opacity duration-700 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
        >
          <Action
            label={liked ? "Beğeniyi geri al" : "Beğen"}
            onClick={() => {
              revealActions();
              void toggleLike();
            }}
          >
            <Heart
              className={
                liked
                  ? "h-6 w-6 fill-purple-500 text-purple-500"
                  : "h-6 w-6 text-purple-500"
              }
            />
          </Action>
          <span className="text-[10px] font-bold text-purple-200/90">
            {count(likeCount)}
          </span>
        </div>
        <div
          className={`flex min-w-[3.25rem] flex-col items-center transition-opacity duration-700 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
        >
          <Action
            label="Yorumlar"
            onClick={() => {
              revealActions();
              setCommentsOpen(true);
            }}
          >
            <MessageCircle className="h-6 w-6 text-violet-200" />
          </Action>
          <span className="text-[10px] font-bold text-violet-100/90">
            {count(commentCount)}
          </span>
        </div>
        <div
          className={`flex min-w-[3.25rem] flex-col items-center text-emerald-400 transition-opacity duration-700 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
        >
          <Action
            label={reposted ? "Geri paylaşımı kaldır" : "Geri paylaş"}
            onClick={() => {
              revealActions();
              toggleRepost();
            }}
          >
            <Repeat2 className="h-6 w-6 text-emerald-400" />
          </Action>
          <div className="mt-1 flex -space-x-2">
            {loop.repostFriends.map((avatar) => (
              <img
                key={avatar}
                src={avatar}
                alt="Takip edilen kişi"
                className="h-4 w-4 rounded-full border border-[#080817] object-cover ring-1 ring-emerald-300/40"
              />
            ))}
          </div>
          <span className="mt-1 text-[10px] font-bold text-emerald-200/90">
            {count(repostCount)}
          </span>
        </div>
        <div
          className={`flex min-w-[3.25rem] flex-col items-center transition-opacity duration-700 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
        >
          <Action
            label="Paylaş"
            onClick={() => {
              revealActions();
              setShareOpen(true);
            }}
          >
            <Send className="h-6 w-6 text-violet-200" />
          </Action>
          <span className="text-[10px] font-bold text-violet-100/90">
            {count(shareCount)}
          </span>
        </div>
        <div
          className={`flex min-w-[3.25rem] flex-col items-center text-orange-400 transition-opacity duration-700 ${actionsFaded ? "opacity-40" : "opacity-100"}`}
        >
          <Action
            label="Kaydet"
            onClick={() => {
              revealActions();
              setSaved((value) => {
                setSaveCount((countValue) => countValue + (value ? -1 : 1));
                return !value;
              });
            }}
          >
            <Bookmark
              className={
                saved
                  ? "h-6 w-6 fill-orange-400 text-orange-400"
                  : "h-6 w-6 text-orange-400"
              }
            />
          </Action>
          <span className="text-[10px] font-bold text-orange-200/90">
            {count(saveCount)}
          </span>
        </div>
      </div>
      {moreMenuOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/55"
          onClick={() => setMoreMenuOpen(false)}
        >
          <section
            className="w-full max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-background p-4 pb-8 text-foreground shadow-[0_-8px_35px_rgba(0,0,0,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Loop seçenekleri
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  Bu Loop için ne yapmak istiyorsun?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                aria-label="Menüyü kapat"
                className="rounded-full p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => void shareLoopToStory()}
                className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-800 hover:bg-violet-100"
              >
                <Share2 className="h-5 w-5" />
                Hikayende paylaş
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  showMenuNotice("Yanıtla özelliği yakında");
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-muted-foreground opacity-55 hover:bg-muted"
              >
                <MessageSquare className="h-5 w-5" />
                Yanıtla{" "}
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  Yakında
                </span>
              </button>
              {isVideoMediaUrl(activeMediaUrl) && (
                <button
                  type="button"
                  onClick={openStickerEditor}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
                >
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  Videodan çıkartma oluştur
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  revealActions();
                  setSaved((value) => {
                    setSaveCount((countValue) => countValue + (value ? -1 : 1));
                    return !value;
                  });
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
              >
                <Bookmark className="h-5 w-5 text-orange-500" />
                {saved ? "Kaydetmeyi kaldır" : "Kaydet"}
              </button>
              {isOwnLoop && (
                <button
                  type="button"
                  onClick={() => void deleteOwnLoop()}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-5 w-5" />
                  Sil
                </button>
              )}
              <button
                type="button"
                onClick={() => setInterestPreference("not-interested")}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
              >
                <EyeOff className="h-5 w-5 text-muted-foreground" />
                İlgilenmiyorum
              </button>
              <button
                type="button"
                onClick={() => setInterestPreference("interested")}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
              >
                <Heart className="h-5 w-5 text-rose-500" />
                İlgileniyorum
              </button>
              <button
                type="button"
                onClick={() => void reportLoop()}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Flag className="h-5 w-5" />
                Şikayet et
              </button>
            </div>
          </section>
        </div>
      )}
      {loopSourceChooserOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setLoopSourceChooserOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="loop-source-title"
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#100d21] p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Yeni Loop</p>
                <h3 id="loop-source-title" className="mt-1 text-lg font-black">Nasıl eklemek istersin?</h3>
              </div>
              <button
                type="button"
                aria-label="Seçimi kapat"
                onClick={() => setLoopSourceChooserOpen(false)}
                className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLoopSourceChooserOpen(false);
                  cameraInputRef.current?.click();
                }}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 py-4 text-center transition hover:border-violet-200/50 hover:bg-violet-400/20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
                  <Camera className="h-6 w-6" />
                </span>
                <span>
                  <strong className="block text-sm">Kamera</strong>
                  <small className="mt-1 block text-xs text-white/55">Yeni video çek</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoopSourceChooserOpen(false);
                  uploadInputRef.current?.click();
                }}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-4 text-center transition hover:border-cyan-200/50 hover:bg-cyan-400/20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                  <ImagePlus className="h-6 w-6" />
                </span>
                <span>
                  <strong className="block text-sm">Galeri</strong>
                  <small className="mt-1 block text-xs text-white/55">Fotoğraf veya video seç</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
      {stickerEditorOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setStickerEditorOpen(false)}
        >
          <section
            className="w-full max-w-md rounded-3xl bg-background p-5 text-foreground shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Loops sticker</p>
                <h3 className="mt-1 text-lg font-bold">Videodan kare seç</h3>
              </div>
              <button type="button" onClick={() => setStickerEditorOpen(false)} aria-label="Düzenleyiciyi kapat" className="rounded-full p-2 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mx-auto mb-4 flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-2xl bg-black/5">
              <canvas ref={stickerCanvasRef} className="h-full w-full object-contain" aria-label="Sticker önizlemesi" />
            </div>
            <label className="mb-4 block text-xs font-semibold">
              Kare zamanı <span className="ml-1 font-normal text-muted-foreground">{stickerFrameTime.toFixed(1)} sn</span>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, Number.isFinite(videoRef.current?.duration) ? videoRef.current!.duration : 0.1)}
                step={0.05}
                value={stickerFrameTime}
                onChange={event => {
                  const time = Number(event.target.value);
                  setStickerFrameTime(time);
                  if (videoRef.current) videoRef.current.currentTime = time;
                }}
                className="mt-2 block w-full accent-primary"
                aria-label="Videodan kare seç"
              />
            </label>
            <label className="mb-4 block text-xs font-semibold">
              Yakınlaştırma <span className="ml-1 font-normal text-muted-foreground">{stickerZoom.toFixed(1)}×</span>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.1"
                value={stickerZoom}
                onChange={event => setStickerZoom(Number(event.target.value))}
                className="mt-2 block w-full accent-primary"
                aria-label="Sticker kırpma yakınlaştırması"
              />
            </label>
            <label className="mb-4 block text-xs font-semibold">
              Sticker adı
              <input
                value={stickerName}
                onChange={event => setStickerName(event.target.value)}
                maxLength={60}
                className="mt-1.5 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary"
                placeholder="Sticker adı"
              />
            </label>
            {stickerEditorError && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{stickerEditorError}</p>}
            <button
              type="button"
              onClick={() => void saveLoopSticker()}
              disabled={stickerSaving || !stickerName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {stickerSaving ? "Kaydediliyor…" : "Stickerlarım'a kaydet"}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Kaydettikten sonra DM sticker panelinden gönderebilirsin.</p>
          </section>
        </div>
      )}
      {menuNotice && (
        <div className="absolute bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-xl">
          {menuNotice}
        </div>
      )}
      {!liveStudioOpen && <div className="absolute bottom-16 left-3 right-20 z-30 md:bottom-16 md:left-5">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            aria-label={`${loop.user.username} profilini görüntüle`}
            onClick={() =>
              loop.user.id && setLocation(`/profile/${loop.user.id}`)
            }
            disabled={!loop.user.id}
            className="rounded-full disabled:cursor-default"
          >
            <span className="relative block h-9 w-9 overflow-hidden rounded-full ring-1 ring-violet-200/70 transition-transform hover:scale-105">
              {reposted && user ? (
                <>
                  <img
                    src={loop.user.avatar}
                    alt={`${loop.user.username} avatarı`}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      clipPath: "polygon(0 0, 100% 0, 58% 100%, 0 100%)",
                    }}
                  />
                  <img
                    src={user.avatarUrl || ""}
                    alt="Senin avatarın"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      clipPath: "polygon(64% 0, 100% 0, 100% 100%, 42% 100%)",
                    }}
                  />
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rotate-[24deg] bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
                </>
              ) : (
                <img
                  src={loop.user.avatar}
                  alt={`${loop.user.username} avatarı`}
                  className="h-full w-full object-cover"
                />
              )}
            </span>
          </button>
          <UserNameWithDecorations
            user={loop.user}
            className="text-sm font-extrabold text-white"
          >
            <span className="truncate">@{loop.user.username}</span>
          </UserNameWithDecorations>
          {!isOwnLoop && !following && (
            <button
              type="button"
              onClick={() => void followLoopUser()}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${following ? "border-violet-300/50 bg-violet-500/25 text-violet-100" : "border-violet-300/40 bg-violet-950/60 text-violet-200 hover:bg-violet-500/30"}`}
            >
              Takip Et
            </button>
          )}
        </div>
        <h2 className="text-[20px] font-black leading-tight tracking-tight text-white md:text-2xl">
          {loop.title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 md:text-[15px]">
          {loop.caption}
        </p>
        <div className="-ml-1 mt-3 flex items-center gap-2 text-xs font-medium text-white/80">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
            <Music2 className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{loop.audio}</span>
        </div>
      </div>}
      {swipePanelOpen && (
        <div
          className="absolute right-4 top-[4.5rem] z-[60] flex w-[min(76%,16rem)] flex-col gap-1.5 rounded-[1.35rem] border border-violet-200/25 bg-[#0b0820]/72 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.38),0_0_24px_rgba(139,92,246,0.16)] backdrop-blur-2xl md:right-6 md:top-[5.5rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[0.2em] text-violet-200/65">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_#c4b5fd]" />
            Loop Studio
          </div>
          {liveStatus === "enabled" && (
            <button
              type="button"
              onClick={() => {
                setSwipePanelOpen(false);
                setLiveConfirmOpen(true);
              }}
              className="flex items-center gap-3 rounded-xl border border-rose-200/15 bg-rose-400/[0.08] px-3 py-3 text-left text-violet-100 transition-colors hover:border-rose-200/35 hover:bg-rose-400/[0.14]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/15 text-rose-200">
                <Radio className="h-5 w-5" />
              </span>
              <span>
                <strong className="block text-sm">Canlı yayın aç</strong>
                <small className="mt-1 block text-xs text-violet-100/55">
                  Takipçilerinle şimdi buluş
                </small>
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSwipePanelOpen(false);
              setLoopSourceChooserOpen(true);
            }}
              className="flex items-center gap-3 rounded-xl border border-violet-200/15 bg-violet-400/[0.08] px-3 py-3 text-left text-violet-100 transition-colors hover:border-violet-200/35 hover:bg-violet-400/[0.14]"
          >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
              <Camera className="h-5 w-5" />
            </span>
            <span>
              <strong className="block text-sm">Kamera</strong>
              <small className="mt-1 block text-xs text-violet-100/55">
                Hemen çek veya videonu seç
              </small>
            </span>
          </button>
          <button
            type="button"
            disabled={uploadingLoop}
            onClick={() => {
              setSwipePanelOpen(false);
              uploadInputRef.current?.click();
            }}
            className="flex items-center gap-3 rounded-xl border border-cyan-200/15 bg-cyan-400/[0.06] px-3 py-3 text-left text-violet-100 transition-colors hover:border-cyan-200/35 hover:bg-cyan-400/[0.12] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200">
              <Send className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">Loops paylaş</strong>
              <small className="mt-1 block truncate text-xs text-violet-100/55">
                {uploadingLoop
                  ? `Medya yükleniyor · ${uploadProgress}%`
                  : uploadMessage || "Video veya kaydırmalı fotoğraf paylaş"}
              </small>
              {uploadingLoop && (
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-violet-950">
                  <span
                    className="block h-full rounded-full bg-violet-400 transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </span>
              )}
            </span>
          </button>
        </div>
      )}
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={selectLoopMedia}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="hidden"
        onChange={selectLoopMedia}
      />
      {cameraOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-stretch justify-center overflow-y-auto bg-[#050611]/95 backdrop-blur-md"
          onClick={(event) => event.stopPropagation()}
        >
          <section className="flex min-h-full w-full max-w-none flex-col overflow-hidden bg-[#0b091b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
                  Yeni Loop
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  Çek veya seç
                </h2>
              </div>
              <button
                type="button"
                aria-label="Kamerayı kapat"
                onClick={stopCamera}
                className="rounded-full p-2 text-violet-200/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 pb-2">
              <button
                type="button"
                onClick={() => setCameraMode("camera")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${cameraMode === "camera" ? "bg-violet-500 text-white" : "bg-white/5 text-violet-100/70"}`}
              >
                <Camera className="h-4 w-4" />
                Kamera
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraMode("video");
                  uploadInputRef.current?.click();
                  setCameraOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-bold text-violet-100/70 hover:bg-white/10"
              >
                <Video className="h-4 w-4" />
                Video seç
              </button>
            </div>
            {cameraMode === "camera" && (
              <div className="mx-auto w-full max-w-2xl space-y-3 p-4 pt-2">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={cameraPreviewRef}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>
                {cameraError && (
                  <p className="text-center text-xs text-red-300">
                    {cameraError}
                  </p>
                )}
                <button
                  type="button"
                  disabled={Boolean(cameraError) || !cameraStreamRef.current}
                  onClick={recording ? stopRecording : startRecording}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${recording ? "bg-red-500 hover:bg-red-400" : "bg-violet-500 hover:bg-violet-400"}`}
                >
                  {recording ? "Kaydı bitir ve düzenle" : "Video çek"}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {liveConfirmOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-stretch justify-center overflow-y-auto bg-black/80 backdrop-blur-sm"
          onClick={() => setLiveConfirmOpen(false)}
        >
          <section
            className="min-h-full w-full max-w-2xl border-x border-white/10 bg-[#171225] p-5 text-white shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
              <Radio className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black">Canlı yayınını oluştur</h2>
            <label className="mt-4 block text-xs font-bold text-slate-300">
              Yayının başlığı
              <input
                value={liveTitle}
                onChange={(event) => setLiveTitle(event.target.value)}
                placeholder="Yayın başlığını yaz"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
              />
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-300">
              Yayının içeriği
              <textarea
                value={liveContent}
                onChange={(event) => setLiveContent(event.target.value)}
                placeholder="Bu yayında ne paylaşacaksın?"
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLiveType("chat")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${liveType === "chat" ? "border-violet-300 bg-violet-500/30 text-white" : "border-white/10 bg-white/5 text-slate-400"}`}
              >
                Sohbet yayını
              </button>
              <button
                type="button"
                onClick={() => setLiveType("game")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${liveType === "game" ? "border-slate-200 bg-slate-400/25 text-white" : "border-white/10 bg-white/5 text-slate-400"}`}
              >
                Oyun / ekran paylaş
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Kamera ve mikrofonun kullanılacak. Yayına başlamadan önce
              görüntünü ve yayın ayarlarını kontrol edebilirsin.
            </p>
            <div className="mt-4 space-y-2 rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
              <p>• Yayını istediğin zaman durdurabilirsin.</p>
              <p>• Kamera ve mikrofon izni gereklidir.</p>
              <p>• Yayın Loop alanında canlı olarak görünür.</p>
              {liveType === "chat" && <p>• Sohbet modunda yayıncıya ek olarak en fazla 16 konuk katılabilir; konuklar onayla yayına alınır.</p>}
              {liveType === "chat" && <p>• Yayın sırasında “İzleyiciye soru sor” ile sohbeti başlatabilirsin.</p>}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setLiveConfirmOpen(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={!liveTitle.trim() || !liveContent.trim()}
                onClick={() => void openLiveStudio()}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-slate-400 px-4 py-3 text-sm font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Devam et
              </button>
            </div>
          </section>
        </div>
      )}
      {liveStudioOpen && (
        <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-[#07030b] text-white">
          <section
            className={`live-arena-surface relative h-full w-full overflow-hidden shadow-2xl ${liveStarted ? "bg-[#100516]" : "bg-[#08030d]"}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 ${liveStarted ? "bg-[radial-gradient(circle_at_50%_18%,rgba(136,28,194,0.26),transparent_42%),linear-gradient(180deg,rgba(23,5,39,0.2),rgba(8,2,14,0.82))]" : "bg-[radial-gradient(circle_at_50%_25%,rgba(116,35,151,0.2),transparent_38%),linear-gradient(180deg,rgba(5,2,10,0.18),rgba(8,2,14,0.88))]"}`}
            />
            <video
              ref={liveVideoRef}
              muted={!liveStarted || liveMicMuted}
              playsInline
              style={{ transform: "scaleX(-1)", WebkitTransform: "scaleX(-1)", objectPosition: "center", filter: ["none", "saturate(1.35) contrast(1.08)", "sepia(0.22) saturate(1.2) hue-rotate(250deg)"][liveFilterIndex], ...(hasBattleTeamLayout(liveBattle) ? getBattleTileLayout(liveBattle, user?.id) : liveGuestStreams.length > 0 || liveParticipants.length > 0 ? getLiveCameraTileLayout(0, 1 + Math.max(liveGuestStreams.length, liveParticipants.length)) : {}) }}
              className={`absolute ${hasBattleTeamLayout(liveBattle) ? `z-20 rounded-2xl border-2 shadow-lg ${liveBattle?.teamAssignments?.[String(user?.id)] === "blue" ? "border-cyan-300/90" : "border-rose-300/90"}` : liveGuestStreams.length > 0 || liveParticipants.length > 0 ? "z-20 rounded-2xl border border-white/60 shadow-lg" : "inset-0 h-full w-full"} object-cover transition-opacity duration-150 ${liveCamOff ? "opacity-0" : "opacity-100"}`}
            />
            {hasBattleTeamLayout(liveBattle) && liveBattle?.teamAssignments ? (
              <span
                style={{
                  top: getBattleTileLayout(liveBattle, user?.id)?.top,
                  left: liveBattle.teamAssignments[String(user?.id)] === "blue" ? undefined : "1rem",
                  right: liveBattle.teamAssignments[String(user?.id)] === "blue" ? "1rem" : undefined,
                }}
                className="absolute z-30 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 backdrop-blur-md"
              >
                {liveBattle.teamAssignments[String(user?.id)] === "blue" ? "Mavi" : "Kırmızı"}
              </span>
            ) : null}
            {(liveGuestStreams.length > 0 || liveParticipants.length > 0) && (
              <div className="pointer-events-none absolute inset-0 z-10">
                {liveGuestStreams.map((guest, index) => {
                  const guestTeam = liveBattle?.teamAssignments?.[String(guest.user?.id)] ?? "blue";
                  const participantIndex = liveParticipants.findIndex((participant) => participant.id === guest.user?.id);
                  const tileIndex = participantIndex >= 0 ? participantIndex + 1 : index + 1;
                  return <div key={guest.viewerId} style={hasBattleTeamLayout(liveBattle) ? getBattleTileLayout(liveBattle, guest.user?.id) : getLiveCameraTileLayout(tileIndex, 1 + Math.max(liveGuestStreams.length, liveParticipants.length))} className={`absolute overflow-hidden bg-black/30 ${hasBattleTeamLayout(liveBattle) ? `rounded-2xl border-2 shadow-lg ${guestTeam === "red" ? "border-rose-300/90" : "border-cyan-300/90"}` : "rounded-2xl border border-white/60 shadow-lg"}`}>
                <LiveStreamVideo stream={guest.stream} className="h-full w-full object-cover" />
                {liveGuestCameraOffByViewer[guest.viewerId] && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[#10131d]/90 text-white/75">
                    <VideoOff className="h-8 w-8" />
                    <span className="text-xs font-bold">Kamera kapalı</span>
                  </div>
                )}
                {hasBattleTeamLayout(liveBattle) && liveBattle?.teamAssignments && <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100 backdrop-blur-md">{guestTeam === "red" ? "Kırmızı" : "Mavi"}</span>}
              </div>
                })}
                {liveParticipants.filter((participant) => !liveGuestStreams.some((guest) => guest.user?.id === participant.id)).map((participant, index) => {
                  const participantIndex = liveParticipants.findIndex((item) => item.id === participant.id);
                  return <div key={participant.id} style={hasBattleTeamLayout(liveBattle) ? getBattleTileLayout(liveBattle, participant.id) : getLiveCameraTileLayout(participantIndex + 1, 1 + Math.max(liveGuestStreams.length, liveParticipants.length))} className={`absolute flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#10131d]/90 ${hasBattleTeamLayout(liveBattle) ? `rounded-2xl border-2 ${liveBattle?.teamAssignments?.[String(participant.id)] === "red" ? "border-rose-300/90" : "border-cyan-300/90"}` : "rounded-2xl border border-white/60 shadow-lg"}`}>
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-xl font-black text-white">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : (participant.displayName || participant.username).charAt(0).toUpperCase()}</span>
                    <span className="text-[10px] text-white/60">Kamera bağlanıyor</span>
                  </div>
                })}
              </div>
            )}
            {liveBattle?.active && liveBattle.opponentBroadcastId && (
              <div
                style={getBattleTileLayout(liveBattle, battleOpponentUser?.id)}
                className={`absolute z-10 overflow-hidden bg-[#10131d]/90 ${liveBattle.teamAssignments && battleOpponentUser ? `rounded-2xl border-2 ${liveBattle.teamAssignments[String(battleOpponentUser.id)] === "red" ? "border-rose-300/90" : "border-cyan-300/90"}` : "right-3 top-[13rem] aspect-square w-[calc(50%_-_0.375rem)]"}`}
              >
                  {battleOpponentStream ? (
                    <LiveStreamVideo stream={battleOpponentStream} mirror className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-lg font-black text-white">{battleOpponentUser?.avatarUrl ? <img src={battleOpponentUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : (battleOpponentUser?.displayName || battleOpponentUser?.username || "K").charAt(0).toUpperCase()}</span>
                      <span className="text-[10px] font-bold">Rakip yayına bağlanıyor</span>
                    </div>
                  )}
                  {liveBattle.teamAssignments && battleOpponentUser && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
                      {liveBattle.teamAssignments[String(battleOpponentUser.id)] === "red" ? "Kırmızı" : "Mavi"}
                    </span>
                  )}
              </div>
            )}
            {liveCamOff && (
              <div style={hasBattleTeamLayout(liveBattle) ? getBattleTileLayout(liveBattle, user?.id) : liveGuestStreams.length > 0 || liveParticipants.length > 0 ? getLiveCameraTileLayout(0, 1 + Math.max(liveGuestStreams.length, liveParticipants.length)) : undefined} className={`absolute z-10 flex flex-col items-center justify-center gap-3 bg-[#10131d]/90 text-slate-300 ${hasBattleTeamLayout(liveBattle) ? `rounded-2xl border-2 ${liveBattle?.teamAssignments?.[String(user?.id)] === "blue" ? "border-cyan-300/90" : "border-rose-300/90"}` : liveGuestStreams.length > 0 || liveParticipants.length > 0 ? "rounded-2xl border border-white/60 shadow-lg" : "inset-0"}`}>
                <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xl font-black text-white">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user?.username ?? "Y").charAt(0).toUpperCase()}</span>
                <p className="text-sm font-bold">Kamera kapalı</p>
              </div>
            )}
            {liveStarted && liveBattle?.active && <LiveBattleSupporters battle={liveBattle} commentHeight={40} />}
            {liveError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-6 text-center">
                <p className="max-w-xs rounded-2xl border border-rose-300/20 bg-black/45 px-5 py-4 text-sm text-rose-100 backdrop-blur-md">
                  {liveError}
                </p>
              </div>
            )}
            <header className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-6">
              <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-fuchsia-200/15 bg-[#16091f]/75 p-2 pr-3 shadow-lg shadow-black/30 backdrop-blur-xl">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-fuchsia-300/80 bg-fuchsia-500/20 shadow-[0_0_16px_rgba(192,38,211,0.24)]">
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-black text-white">{(user?.displayName || user?.username || "L").charAt(0).toUpperCase()}</span>}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-xs font-black text-white sm:text-sm">
                    <span className="truncate">{user?.displayName || user?.username || "Yayıncı"}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-fuchsia-400 text-[#16091f]" />
                  </p>
                  <p className="truncate text-[10px] text-fuchsia-100/60">@{user?.username || "yayinci"}</p>
                </div>
                {liveStarted ? (
                  <>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-500 px-2 py-1 text-[9px] font-black text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />CANLI</span>
                    <span className="hidden shrink-0 rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-white/80 sm:inline-flex">{formatLiveDuration(liveDurationSeconds)}</span>
                  </>
                ) : <span className="shrink-0 rounded-full border border-fuchsia-200/20 bg-fuchsia-500/10 px-2 py-1 text-[9px] font-bold text-fuchsia-100">ÖNİZLEME</span>}
              </div>
            </header>
            {hourlyPreviewOpen && liveStarted && (
              <div
                className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#05050b]/80 px-3 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-5 sm:py-6"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                onClick={() => setHourlyPreviewOpen(false)}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="hourly-ranking-title"
                  className="my-auto flex max-h-[min(92dvh,58rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#10111a] text-white shadow-[0_40px_140px_rgba(0,0,0,0.72)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="h-1.5 shrink-0 bg-[linear-gradient(90deg,#7c3aed_0%,#bd7cff_30%,#f2cb72_62%,#48d9c3_100%)]" />
                  <div className="relative shrink-0 overflow-hidden border-b border-white/[0.08] bg-[radial-gradient(ellipse_at_10%_0%,rgba(139,92,246,0.23),transparent_38%),radial-gradient(ellipse_at_92%_0%,rgba(242,203,114,0.16),transparent_34%),linear-gradient(115deg,#171724_0%,#11121c_58%,#17151c_100%)] px-5 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-7">
                    <div className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full border border-amber-200/[0.08] shadow-[0_0_90px_rgba(242,203,114,0.08)]" />
                    <div className="relative">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-violet-200/80">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-violet-200/20 bg-violet-300/10"><Orbit className="h-3.5 w-3.5" /></span>
                            LOOP LIVE <span className="text-white/25">/</span> DESTEKÇİLER
                          </p>
                          <h2 id="hourly-ranking-title" className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Saatlik Akış<span className="text-amber-300">.</span></h2>
                          <p className="mt-1.5 text-xs text-white/50 sm:text-sm">Son 60 dakikanın en cömert destekçileri</p>
                        </div>
                        <button type="button" aria-label="Saatlik sıralamayı kapat" onClick={() => setHourlyPreviewOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200/15 bg-amber-200/[0.07] px-3 py-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/10 text-amber-200"><Clock3 className="h-4 w-4" /></span>
                          <span><span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">Gerçek destek verisi</span><span className="font-mono text-xs font-bold tabular-nums text-amber-100">Son 60 dakika</span></span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/55"><Users className="h-3.5 w-3.5 text-violet-200" /> Bu yayının gerçek destekçileri</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_50%_0%,rgba(124,58,237,0.08),transparent_42%),linear-gradient(180deg,#11121b_0%,#0d0e15_100%)] px-4 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-6 [scrollbar-color:rgba(198,163,101,0.35)_transparent] [scrollbar-width:thin] [touch-action:pan-y]">
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between px-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Lig sıralaması</p>
                        <span className="text-[9px] text-white/35">{hourlyPreviewLeague === "Tümü" ? `${hourlyRankingEntries.length} destekçi` : `${filteredHourlyRanking.length} ${hourlyPreviewLeague}`}</span>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                        {["Tümü", ...HOURLY_PREVIEW_LEAGUES].map((leagueName) => {
                          const count = leagueName === "Tümü"
                            ? hourlyRankingEntries.length
                            : hourlyRankingEntries.filter((entry) => entry.league.current.name === leagueName).length;
                          const selected = hourlyPreviewLeague === leagueName;
                          return (
                            <button
                              key={leagueName}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setHourlyPreviewLeague(leagueName)}
                              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${selected ? "border-amber-200/35 bg-[linear-gradient(110deg,rgba(242,203,114,0.22),rgba(242,203,114,0.08))] text-amber-100 shadow-[0_0_18px_rgba(242,203,114,0.08)]" : "border-white/[0.09] bg-white/[0.035] text-white/50 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80"}`}
                            >
                              {leagueName} <span className={selected ? "text-amber-100/50" : "text-white/30"}>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-3 items-end gap-2">
                      {filteredHourlyRanking.slice(0, 3).map((entry, position) => {
                        const rank = position + 1;
                        const league = entry.league;
                        const isFirst = position === 0;
                        const podiumPosition = position === 0 ? 2 : position === 1 ? 1 : 3;
                        return (
                          <div key={entry.username} style={{ order: podiumPosition }} className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border px-2 pb-3 pt-3 text-center ${isFirst ? "min-h-48 border-amber-200/35 bg-[radial-gradient(ellipse_at_50%_0%,rgba(242,203,114,0.22),transparent_68%),linear-gradient(155deg,#262318_0%,#191923_55%,#15151e_100%)] shadow-[0_12px_36px_rgba(210,166,66,0.12)] sm:min-h-56 sm:-translate-y-2" : "min-h-40 border-white/[0.09] bg-[linear-gradient(155deg,rgba(255,255,255,0.065),rgba(255,255,255,0.02))] sm:min-h-44"}`}>
                            {isFirst && <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,#f2cb72,transparent)]" />}
                            <span className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black ${isFirst ? "bg-[linear-gradient(135deg,#d2a642,#f6dfa0)] text-[#65470d] shadow-[0_0_16px_rgba(242,203,114,0.28)]" : "border border-white/10 bg-white/[0.06] text-white/65"}`}>
                              {isFirst ? <Crown className="h-3.5 w-3.5" /> : rank}
                            </span>
                            <span className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border text-sm font-black ${isFirst ? "border-amber-100/35 bg-[linear-gradient(145deg,#f7dda0,#ac7e2d)] text-[#35250b] shadow-[0_5px_22px_rgba(242,203,114,0.16)]" : "border-white/10 bg-[linear-gradient(145deg,#2c2c3a,#1b1b27)] text-white/75"}`}>
                              {entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : entry.displayName.charAt(0)}
                            </span>
                            <span className="mt-2 max-w-full truncate text-[10px] font-extrabold text-white/90">{entry.displayName}</span>
                            <span className="mt-0.5 max-w-full truncate text-[9px] text-white/35">@{entry.username}</span>
                            <span className="mt-2 flex items-center gap-1 text-[11px] font-black tabular-nums text-amber-200">
                              <Coins className="h-3 w-3 text-amber-300" /> {entry.coins.toLocaleString("tr-TR")}
                            </span>
                            <span className="mt-1 rounded-full border border-violet-200/10 bg-violet-200/[0.06] px-2 py-0.5 text-[8px] font-semibold text-violet-100/70">{league.current.name} {league.stage}/{league.current.stages}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{hourlyPreviewLeague === "Tümü" ? "Sıralamadaki destekçiler" : `${hourlyPreviewLeague} ligi`}</p>
                      <span className="text-[9px] text-white/30">CANLI VERİ</span>
                    </div>
                    <div className="space-y-1.5">
                      {filteredHourlyRanking.slice(3).map((entry, position) => {
                        const rank = position + 4;
                        const league = entry.league;
                        return (
                        <div key={entry.username} className="relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(100deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-3 py-2.5 transition hover:border-amber-200/20 hover:bg-white/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[linear-gradient(180deg,#f2cb72,#bd7cff)]">
                          <span className="w-6 text-center text-xs font-black tabular-nums text-white/45">{String(rank).padStart(2, "0")}</span>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(145deg,#343143,#20212c)] text-xs font-black text-white/75">{entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : entry.displayName.charAt(0)}</span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="block truncate text-[11px] font-bold text-white/85">{entry.displayName}</span>
                            <span className="block truncate text-[9px] text-white/35">@{entry.username}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[11px] font-black tabular-nums text-amber-200">{entry.coins.toLocaleString("tr-TR")} <span className="text-[9px] font-medium text-white/35">coin</span></span>
                            <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-1.5 py-0.5 text-[8px] font-medium text-white/55">{league.current.name} {league.stage}/{league.current.stages}</span>
                          </span>
                        </div>
                        );
                      })}
                      {filteredHourlyRanking.length === 0 && (
                        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-6 text-center text-xs text-white/45">Son 60 dakikada bu ligde destekçi bulunmuyor.</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}
            {liveStarted && (
              <div className="absolute left-4 right-4 top-[6.2rem] z-30 flex max-w-[min(94vw,42rem)] flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 text-white [scrollbar-width:none] sm:left-6">
                <button
                  type="button"
                  onClick={() => { setStudioStatsTab("audience"); setStudioRankingOpen(true); }}
                  className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 text-[10px] font-bold text-white/85 backdrop-blur"
                >
                  <Eye className="h-3 w-3 text-fuchsia-200" />
                  {count(liveStudioStats.viewerCount)} izleyici
                </button>
                <button type="button" onClick={() => { setStudioStatsTab("supporters"); setStudioRankingOpen(true); }} aria-label="Destekçi listesini aç" className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2 text-[10px] font-bold text-white/85 backdrop-blur">
                  <span className="flex -space-x-1.5">
                    {(liveStudioStats.liveSupporters ?? []).slice(0, 3).map((entry, index) => (
                      <span key={entry.user.id} title={`#${index + 1} @${entry.user.username} · ${entry.coins} coin`} className="relative h-5 w-5 overflow-hidden rounded-full border border-white/50 bg-fuchsia-500/25 text-[8px] font-black text-white">
                        {entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center">{(entry.user.displayName || entry.user.username).charAt(0).toUpperCase()}</span>}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-[#17131c] bg-[#c6a365] text-[6px] font-black text-[#21180b]">{index + 1}</span>
                      </span>
                    ))}
                  </span>
                  <Coins className="h-3 w-3 text-amber-200" />
                  {count(liveStudioStats.liveSupporters?.length ?? 0)}
                </button>
                <button type="button" onClick={() => setHourlyPreviewOpen(true)} aria-label="Saatlik Akış sıralamasını aç" className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-amber-200/25 bg-black/45 px-2 text-[10px] font-bold text-amber-100 backdrop-blur transition hover:border-amber-200/50 hover:bg-black/65">
                  <LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "streak")} fallback={<span className="text-amber-300">🔥</span>} className="h-3.5 w-3.5" />
                  Saatlik Akış
                  <span className="max-w-24 truncate text-white/75">{liveStudioStats.hourlyRanking?.[0]?.user.username ?? "Henüz destekçi yok"}</span>
                </button>
                <span className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-cyan-200/25 bg-black/45 px-2 text-[10px] font-bold text-cyan-100 backdrop-blur">
                  {liveType === "chat" ? "Sohbet · " : "Oyun · "}
                  {liveType === "chat" ? `${liveParticipants.length}/16 konuk` : `${liveParticipants.length} konuk`}
                </span>
                <span className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-violet-200/25 bg-black/45 px-2 text-[10px] font-bold text-violet-100 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" /> Topluluğum
                </span>
                <span className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-fuchsia-200/25 bg-black/45 px-2 text-[10px] font-bold text-fuchsia-100 backdrop-blur">
                  <LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "collection")} fallback={<ImagePlus className="h-3 w-3" />} className="h-3.5 w-3.5" />
                  Koleksiyon {liveStudioStats.collection.collected}/{liveStudioStats.collection.total}
                </span>
              </div>
            )}
            {liveStarted && <LiveEventBanner events={liveEvents} className="top-[31%] right-20 z-40 sm:right-28" />}
            {liveStarted && liveBattle && (liveBattle.active || liveBattle.remainingSeconds !== undefined) && (liveBattle.scores ?? []).length > 0 && (
              <KapismaArena battle={liveBattle} currentUserId={user?.id} canConfigurePalette={Boolean(liveStarted && liveBroadcastId)} onSelectTeam={chooseStudioBattleTeam} onSelectPalette={chooseStudioBattlePalette} className="absolute left-2 right-2 top-[8.2rem] z-30 sm:left-4 sm:right-4" />
            )}
            {liveStarted && liveBattle && liveBattle.remainingSeconds === 0 && (
              <KapismaResultAnimations battle={liveBattle} animations={liveBattleResultAnimations} />
            )}
            {liveStarted && liveJoinRequests.length > 0 && (
              <div className="absolute right-4 top-20 z-40 w-[min(90vw,22rem)] rounded-2xl border border-cyan-200/30 bg-[#0b1e45]/95 p-3 text-white shadow-2xl backdrop-blur-xl sm:right-6 sm:top-24">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Yayına katılma istekleri</p>
                  <span className="rounded-full bg-cyan-400/20 px-2 py-1 text-[10px] font-black text-cyan-100">{liveJoinRequests.length}</span>
                </div>
                {liveJoinError && <p role="alert" className="mb-2 rounded-lg bg-rose-500/15 px-2 py-1.5 text-[10px] text-rose-100">{liveJoinError}</p>}
                <div className="max-h-[min(45vh,18rem)] space-y-2 overflow-y-auto pr-1">
                  {liveJoinRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-black text-cyan-100">
                        {(request.user.displayName || request.user.username).charAt(0).toUpperCase()}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">@{request.user.username}</span>
                      <button type="button" onClick={() => void updateLiveJoinRequest(request.id, "accepted")} disabled={liveType === "chat" && liveParticipants.length >= 16} className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Kabul et</button>
                      <button type="button" onClick={() => void updateLiveJoinRequest(request.id, "rejected")} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white/75">Reddet</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {liveStarted && (liveBattle?.offers?.length ?? 0) > 0 && (
              <div className="absolute right-4 top-36 z-40 w-[min(90vw,22rem)] rounded-2xl border border-rose-200/30 bg-[#2b1020]/95 p-3 text-white shadow-2xl backdrop-blur-xl sm:right-6 sm:top-40">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-100">Kapışma teklifleri</p>
                  <span className="rounded-full bg-rose-400/20 px-2 py-1 text-[10px] font-black text-rose-100">{liveBattle?.offers?.length}</span>
                </div>
                <div className="space-y-2">
                  {liveBattle?.offers?.map((offer) => (
                    <div key={offer.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">@{offer.from.username} Kapışma teklif etti</span>
                      <button type="button" onClick={() => void acceptStudioBattleOffer(offer.id)} className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-black text-white">Kabul et</button>
                      <button type="button" onClick={() => void rejectBattleOffer(offer.id)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-black text-white/80">Reddet</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {liveStarted && studioRankingOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-slate-950/65 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:px-6 sm:py-4"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                onClick={() => setStudioRankingOpen(false)}
              >
                <section
                  className="flex max-h-[min(88dvh,48rem)] min-h-0 w-full flex-col overflow-hidden rounded-t-[28px] border border-amber-100/[0.12] bg-[radial-gradient(ellipse_at_top,rgba(194,151,82,0.20),transparent_42%),radial-gradient(ellipse_at_85%_25%,rgba(110,78,134,0.16),transparent_42%),linear-gradient(155deg,#18141e_0%,#100e17_55%,#0b0b12_100%)] px-4 pt-3 text-white shadow-[0_-24px_80px_rgba(0,0,0,0.72)] sm:max-h-[min(84dvh,48rem)] sm:max-w-xl sm:rounded-[28px]"
                  style={{ transform: `translateY(${studioPanelOffset}px)`, transition: studioPanelDraggingRef.current ? "none" : "transform 180ms ease-out", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mx-auto mb-3 h-1 w-10 shrink-0 touch-none rounded-full bg-white/25" onTouchStart={handleStudioPanelTouchStart} onTouchMove={handleStudioPanelTouchMove} onTouchEnd={handleStudioPanelTouchEnd} />
                  <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e4c98e]">
                        <Sparkles className="h-3.5 w-3.5" /> LOOP LIVE · TOPLULUK
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                        {studioStatsTab === "supporters" ? "Destekçi kulübü" : "Canlı topluluk"}
                      </h3>
                      <p className="mt-1 text-xs text-[#aaa1b0]">
                        {studioStatsTab === "supporters" ? "Yayına güç katan topluluğun" : "Yayını izleyen ve destekleyen kişiler"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Yayın istatistiklerini kapat"
                      onClick={() => setStudioRankingOpen(false)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.045] text-[#c9c0ce] transition hover:border-amber-100/20 hover:bg-amber-100/[0.08] hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-4 grid shrink-0 grid-cols-2 rounded-2xl border border-white/[0.07] bg-black/30 p-1 shadow-inner shadow-black/20">
                    <button type="button" onClick={() => setStudioStatsTab("audience")} className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${studioStatsTab === "audience" ? "bg-gradient-to-b from-[#f2dfb0] to-[#c6a365] text-[#21180b] shadow-[0_3px_14px_rgba(198,163,101,0.20)]" : "text-[#928a99] hover:bg-white/[0.04] hover:text-[#e6d9bd]"}`}>İzleyici geçmişi</button>
                    <button type="button" onClick={() => setStudioStatsTab("supporters")} className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${studioStatsTab === "supporters" ? "bg-gradient-to-b from-[#f2dfb0] to-[#c6a365] text-[#21180b] shadow-[0_3px_14px_rgba(198,163,101,0.20)]" : "text-[#928a99] hover:bg-white/[0.04] hover:text-[#e6d9bd]"}`}>Destekçi geçmişi</button>
                  </div>
                  <div className="mb-4 grid shrink-0 grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-[#c2a9dc]/[0.14] bg-gradient-to-br from-[#9674b7]/[0.15] via-[#211a29]/70 to-[#17131d] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl border border-[#d9c5eb]/10 bg-[#bca0d6]/[0.10] text-[#d2b9ed]">
                        <Users className="h-4 w-4" />
                      </div>
                      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#a79bad]">İzleyici</p>
                      <p className="mt-0.5 text-xl font-black text-white">
                        {count(liveStudioStats.viewerCount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#e2c783]/[0.20] bg-gradient-to-br from-[#c8a458]/[0.17] via-[#282014]/70 to-[#17130f] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl border border-[#f1dcaa]/10 bg-[#dfc17c]/[0.10] text-[#e6cf96]">
                        <Coins className="h-4 w-4" />
                      </div>
                      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#aa9b7c]">Destekçi</p>
                      <p className="mt-0.5 text-xl font-black text-white">
                        {(liveStudioStats.liveSupporters ?? []).length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#d5a7b7]/[0.13] bg-gradient-to-br from-[#aa7187]/[0.14] via-[#261820]/70 to-[#171116] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl border border-[#e9c0cd]/10 bg-[#d09aab]/[0.09] text-[#d9a8b8]">
                        <Heart className="h-4 w-4" />
                      </div>
                      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#a9959d]">Beğeni</p>
                      <p className="mt-0.5 text-xl font-black text-white">{count(liveStudioStats.liveLikeCount)}</p>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(198,163,101,0.35)_transparent] [scrollbar-width:thin] [touch-action:pan-y]">
                    {studioStatsTab === "audience" ? (
                      <>
                        <div className="mb-3 flex items-center justify-between border-b border-[#d8c29a]/10 pb-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e1d6c1]">
                            Aktif izleyiciler
                          </p>
                          <span className="text-[10px] font-medium text-[#b5a277]">Şu an yayında</span>
                        </div>
                        {(liveStudioStats.activeAudience ?? []).length === 0 ? (
                          <p className="mb-4 rounded-2xl border border-dashed border-[#c6a365]/20 bg-[#c6a365]/[0.035] px-3 py-4 text-center text-xs text-[#92899a]">Şu an aktif izleyici yok</p>
                        ) : (
                          <div className="mb-5 space-y-1.5">
                            {(liveStudioStats.activeAudience ?? []).map((entry) => (
                              <div key={`active-${entry.viewerId}-${entry.firstJoinedAt}`} className="flex items-center gap-2 rounded-2xl border border-[#b8a477]/[0.14] bg-gradient-to-r from-[#a58d58]/[0.09] to-[#211c25]/65 px-3 py-3">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#cbb57c] shadow-[0_0_8px_rgba(203,181,124,0.5)]" />
                                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#e6dfd2]">{entry.displayName || `@${entry.username}`}</span>
                                <span className="text-[10px] font-semibold text-[#d9c390]">{formatWatchTime(entry.totalSeconds)}</span>
                                <span className="text-[10px] text-[#a69dab]">{entry.likeCount} beğeni</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mb-3 flex items-center justify-between border-b border-[#d8c29a]/10 pb-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e1d6c1]">Kalıcı izleyici geçmişi</p>
                          <select value={audienceSort} onChange={(event) => setAudienceSort(event.target.value as typeof audienceSort)} className="rounded-xl border border-[#c6a365]/15 bg-[#211a26] px-2.5 py-2 text-[10px] text-[#d6c9b4] outline-none focus:border-[#c6a365]/40">
                            <option value="watch">En çok izleme</option>
                            <option value="likes">En çok beğeni</option>
                            <option value="recent">Son izleme</option>
                          </select>
                        </div>
                        {(liveStudioStats.audienceHistory ?? []).length === 0 ? (
                          <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-6 text-center text-xs text-slate-500">
                            Henüz geçmiş izleyici yok
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {(liveStudioStats.audienceHistory ?? []).slice().sort((a, b) => audienceSort === "likes" ? b.likeCount - a.likeCount : audienceSort === "recent" ? Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) : b.totalSeconds - a.totalSeconds).map((entry, index) => (
                              <div key={entry.viewerId + entry.firstBroadcastId} className="rounded-2xl border border-white/[0.065] bg-gradient-to-r from-[#211b27] to-[#17131c] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                                <div className="flex items-center gap-2">
                                  <span className={`w-5 text-center text-xs font-black ${index === 0 ? "text-[#e5ca8d]" : "text-[#827988]"}`}>{index + 1}</span>
                                  <div className="h-8 w-8 overflow-hidden rounded-full border border-[#c6a365]/20 bg-[#302738]">
                                    {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-semibold text-[#e5d5b5]">{(entry.displayName || entry.username).charAt(0).toUpperCase()}</span>}
                                  </div>
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#e6dfd2]">{entry.displayName || `@${entry.username}`}</span>
                                  <span className="text-[10px] font-bold text-[#d9c390]">{formatWatchTime(entry.totalSeconds)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] text-[#968d9c]">
                                  <span>{formatWatchTime(entry.totalSeconds)} toplam</span>
                                  <span>{daysSince(entry.firstJoinedAt)} gündür izliyor</span>
                                  <span>{entry.likeCount} beğeni</span>
                                  <span>İlk katılım: {formatLiveDate(entry.firstJoinedAt)}</span>
                                  <span>İlk yayın: {formatLiveDate(entry.firstBroadcastStartedAt)}{entry.firstBroadcastEndedAt ? ` - ${formatLiveDate(entry.firstBroadcastEndedAt)}` : " (devam ediyor)"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center justify-between border-b border-[#d8c29a]/10 pb-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f0e3c5]">Bu canlıdaki destekçiler</p>
                            <p className="mt-1 text-[10px] text-[#a59aab]">Bu yayına katkı sağlayanlar</p>
                          </div>
                          <span className="flex items-center gap-1.5 rounded-full border border-[#c6a365]/20 bg-[#c6a365]/[0.07] px-2.5 py-1 text-[10px] font-semibold text-[#ddc88e]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d9c184]" /> CANLI</span>
                        </div>
                        {(liveStudioStats.liveSupporters ?? []).length === 0 ? (
                          <p className="mb-5 rounded-2xl border border-dashed border-[#c6a365]/20 bg-[#c6a365]/[0.035] px-3 py-4 text-center text-xs text-[#92899a]">Bu canlıda henüz destek yok</p>
                        ) : (
                          <div className="mb-5 space-y-1.5">
                            {(liveStudioStats.liveSupporters ?? []).slice(0, 10).map((entry, index) => (
                              <div key={`live-supporter-${entry.user.id}`} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${index === 0 ? "border-[#e1c781]/30 bg-gradient-to-r from-[#a8843e]/[0.20] via-[#55432a]/[0.12] to-[#211b27] shadow-[0_8px_28px_rgba(171,132,62,0.10)]" : "border-white/[0.065] bg-gradient-to-r from-[#211b27] to-[#17131c] hover:border-[#c6a365]/20 hover:from-[#292131]"}`}>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-[#dfc781]/[0.18] text-[#f2dda2] ring-1 ring-[#dfc781]/30" : "bg-white/[0.055] text-[#9b91a0]"}`}>{index + 1}</span>
                                <span className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-[#302738] ${index === 0 ? "border-[#dfc781]/45 shadow-[0_0_14px_rgba(223,199,129,0.16)]" : "border-white/10"}`}>
                                  {entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-sm font-bold text-[#e7d7b8]">{(entry.user.displayName || entry.user.username).charAt(0).toUpperCase()}</span>}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="block truncate text-sm font-semibold text-[#eee7dc]">{entry.user.displayName || `@${entry.user.username}`}</span>
                                  {entry.league && <span className="mt-0.5 block truncate text-[9px] font-semibold text-[#d9c184]">{entry.league.label}</span>}
                                </span>
                                <span className="shrink-0 rounded-full border border-[#ddc27d]/20 bg-[#ddc27d]/[0.075] px-2.5 py-1 text-[11px] font-black tabular-nums text-[#ead69d]">{entry.coins.toLocaleString("tr-TR")} <span className="font-semibold text-[#bba976]">coin</span></span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mb-3 flex items-center justify-between border-b border-[#d8c29a]/10 pb-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e1d6c1]">Kalıcı destekçi geçmişi</p>
                            <p className="mt-1 text-[10px] text-[#968d9c]">Yayına en çok katkı sağlayanlar</p>
                          </div>
                          <select value={supporterSort} onChange={(event) => setSupporterSort(event.target.value as typeof supporterSort)} className="rounded-xl border border-[#c6a365]/15 bg-[#211a26] px-2.5 py-2 text-[10px] text-[#d6c9b4] outline-none focus:border-[#c6a365]/40">
                            <option value="coins">En çok destek</option>
                            <option value="recent">Son destek</option>
                          </select>
                        </div>
                        {(liveStudioStats.supporterHistory ?? []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-6 text-center text-xs text-slate-500">
                        Henüz destek yok
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {(liveStudioStats.supporterHistory ?? [])
                          .slice()
                          .sort((a, b) => supporterSort === "recent" ? Date.parse(b.lastSupportAt) - Date.parse(a.lastSupportAt) : b.coins - a.coins)
                          .slice(0, 50)
                          .map((entry, index) => (
                            <div key={entry.user.id}>
                              <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${index === 0 ? "border-[#e1c781]/30 bg-gradient-to-r from-[#a8843e]/[0.20] via-[#55432a]/[0.12] to-[#211b27] shadow-[0_8px_28px_rgba(171,132,62,0.10)]" : "border-white/[0.065] bg-gradient-to-r from-[#211b27] to-[#17131c] hover:border-[#c6a365]/20 hover:from-[#292131]"}`}>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-[#dfc781]/[0.18] text-[#f2dda2] ring-1 ring-[#dfc781]/30" : "bg-white/[0.055] text-[#9b91a0]"}`}>{index + 1}</span>
                                <span className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-[#302738] ${index === 0 ? "border-[#dfc781]/45 shadow-[0_0_14px_rgba(223,199,129,0.16)]" : "border-white/10"}`}>
                                  {entry.user.avatarUrl ? <img src={entry.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-sm font-bold text-[#e7d7b8]">{(entry.user.displayName || entry.user.username).charAt(0).toUpperCase()}</span>}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#eee7dc]">{entry.user.displayName || `@${entry.user.username}`}</span>
                                <span className="shrink-0 rounded-full border border-[#ddc27d]/20 bg-[#ddc27d]/[0.075] px-2.5 py-1 text-[11px] font-black tabular-nums text-[#ead69d]">{entry.coins.toLocaleString("tr-TR")} <span className="font-semibold text-[#bba976]">coin</span></span>
                              </div>
                              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 px-11 pb-1 pt-1 text-[10px] text-[#968d9c]">
                                <span>İlk: {formatLiveDate(entry.firstSupportAt)}</span>
                                <span>Son: {formatLiveDate(entry.lastSupportAt)}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                      </>
                    )}
                  </div>
                </section>
              </div>
            )}
            {liveStarted && (
              <div className="live-comment-panel live-comment-panel-creator absolute bottom-0 left-0 right-0 z-20 w-auto max-w-none rounded-none border-0 bg-transparent p-0 pb-2 pr-20 shadow-none md:-translate-y-16 sm:bottom-6 sm:left-6 sm:right-6 sm:pb-2 sm:pr-28">
                {visibleLiveGiftCards.length > 0 && (
                  <div className="live-gift-cards live-gift-cards-inline live-gift-cards-fixed live-gift-comment-band flex max-h-[18vh] w-full max-w-[18rem] flex-col gap-1 overflow-hidden">
                    {visibleLiveGiftCards.map((toast) => <LiveGiftToastCard key={`studio-${toast.id}-${toast.comboCount}`} toast={toast} />)}
                  </div>
                )}
                <div
                  ref={liveCommentsRef}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    liveCommentsAtBottomRef.current =
                      element.scrollHeight -
                        element.scrollTop -
                        element.clientHeight <
                      24;
                  }}
                  className="live-comment-list live-comment-list-creator mb-0 min-h-0 overflow-y-auto overscroll-contain pr-3"
                >
                  <div className="flex flex-col gap-3">
                    {liveComments.map((comment) => {
                      const hasReply = liveComments.some(
                        (item) => item.replyTo?.id === comment.id,
                      );
                      const isAudienceQuestion = comment.user.id === user?.id && comment.content.startsWith("❓ SORU: ");
                      return (
                        <div
                          key={comment.id}
                          className={`live-comment-row flex max-w-full items-start gap-2.5 px-0 py-1 text-xs leading-5 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] sm:text-sm ${isAudienceQuestion ? "rounded-lg border-l-2 border-fuchsia-300 bg-fuchsia-500/15 pl-2" : comment.replyTo ? "border-l-2 border-violet-300/65 pl-2" : hasReply ? "border-l-2 border-cyan-300/80 pl-2" : ""}`}
                        >
                          <div className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/35 bg-violet-500/70 shadow-lg">
                            {comment.user.avatarUrl ? (
                              <img
                                src={comment.user.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center text-xs font-black text-white">
                                {(
                                  comment.user.displayName ||
                                  comment.user.username
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 break-words">
                            {comment.replyTo && (
                              <span className="mb-0.5 block text-[10px] font-bold text-violet-200">
                                @{comment.replyTo.username} kullanıcısına yanıt
                              </span>
                            )}
                            <strong className="block text-xs font-bold text-white/70">
                              @{comment.user.username}
                            </strong>
                            {isAudienceQuestion && <span className="block text-[9px] font-black uppercase tracking-wider text-fuchsia-200">İzleyiciye soru</span>}
                            <span className="block text-sm leading-5 text-white">{isAudienceQuestion ? comment.content.slice("❓ SORU: ".length) : comment.content}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLiveReplyingTo(comment);
                                setLiveCommentText(
                                  `@${comment.user.username} `,
                                );
                              }}
                              aria-label={`@${comment.user.username} kullanıcısına yanıt ver`}
                              className="mt-1 block w-fit text-[10px] font-bold leading-4 text-white/55 underline decoration-white/30 underline-offset-2"
                            >
                              Yanıtla
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {liveReplyingTo && (
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-black/35 px-3 py-2 text-xs text-white/70">
                    <span>
                      <span className="text-violet-200">
                        @{liveReplyingTo.user.username}
                      </span>{" "}
                      kullanıcısına yanıt
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLiveReplyingTo(null);
                        setLiveCommentText("");
                      }}
                      aria-label="Yanıtı iptal et"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="live-comment-bar relative z-10 flex flex-nowrap items-center gap-1.5 overflow-hidden">
                  <input
                    value={liveCommentText}
                    onChange={(event) => setLiveCommentText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendLiveComment();
                      }
                    }}
                    placeholder="Yorum yaz..."
                    disabled={liveCommentSending}
                    className="live-comment-input min-w-0 flex-1 rounded-full border border-cyan-200/15 bg-[#101b35]/90 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/50"
                  />
                  <button
                    type="button"
                    onClick={() => void sendLiveComment()}
                    disabled={!liveCommentText.trim() || liveCommentSending}
                    aria-label="Canlı yorumu gönder"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-violet-600 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)] disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {liveStarted && visibleLiveGiftCards.length > 0 && (
              <div className="hidden live-gift-cards absolute bottom-[8.8rem] right-20 z-30 flex max-h-[28vh] w-[min(68vw,22rem)] flex-col gap-2 overflow-hidden sm:bottom-24 sm:right-24">
                {visibleLiveGiftCards.map((toast) => <LiveGiftToastCard key={`studio-hidden-${toast.id}-${toast.comboCount}`} toast={toast} />)}
              </div>
            )}
            {activeLiveGiftEvent && (
              <div className="pointer-events-none absolute bottom-0 left-0 z-40 h-1/2 w-full overflow-hidden">
                <ChromaKeyAnimation
                  key={activeLiveGiftEvent.id}
                  src={activeLiveGiftEvent.url}
                  mimeType={activeLiveGiftEvent.mimeType}
                  transparencyMode={activeLiveGiftEvent.transparencyMode}
                  edgeFade={activeLiveGiftEvent.edgeFade ?? "top-bottom"}
                  onEnded={() => setActiveLiveGiftEvent(liveGiftAnimationQueueRef.current.shift() ?? null)}
                  className="live-gift-animation absolute inset-0 h-full w-full object-cover"
                />
              </div>
            )}
            <div className="absolute left-2 top-[8rem] z-40 flex max-h-[calc(100%-18rem)] flex-col items-center gap-2 sm:left-5">
              <button type="button" onClick={() => setStudioControlsOpen((open) => !open)} aria-label={studioControlsOpen ? "Yayın araçlarını daralt" : "Yayın araçlarını genişlet"} aria-expanded={studioControlsOpen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-fuchsia-200/25 bg-[#1b0d26]/90 text-white shadow-lg backdrop-blur">
                <MoreVertical className="h-5 w-5" />
              </button>
              {studioControlsOpen && <div className="flex max-h-[calc(100vh-15rem)] flex-col items-center gap-2 overflow-y-auto rounded-2xl bg-black/35 p-1.5 pb-2 backdrop-blur-md">
              {!liveStarted && <button type="button" onClick={closeLiveStudio} aria-label="Önizlemeyi kapat" className="flex w-14 flex-col items-center gap-1 text-white/80"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45"><X className="h-4 w-4" /></span><span className="text-[9px] font-bold">Kapat</span></button>}
              {liveStarted && liveType === "chat" && (
                <button type="button" onClick={() => { setLiveQuestionOpen((open) => !open); setLiveQuestionError(""); }} aria-label="İzleyicilere soru sor" className="flex w-14 flex-col items-center gap-1 text-white/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200/25 bg-[#1b0d26]/80 shadow-lg backdrop-blur"><MessageCircle className="h-5 w-5 text-fuchsia-200" /></span><span className="text-center text-[9px] font-bold">Soru sor</span>
                </button>
              )}
              {liveStarted && (
                <button type="button" onClick={() => { setStudioStatsTab("audience"); setStudioRankingOpen(true); }} aria-label="İzleyici istatistiklerini aç" className="flex w-14 flex-col items-center gap-1 text-white/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200/25 bg-[#1b0d26]/80 shadow-lg backdrop-blur"><Users className="h-5 w-5 text-fuchsia-200" /></span><span className="text-center text-[9px] font-bold">İzleyici</span>
                </button>
              )}
              {liveStarted && (
                <button type="button" onClick={() => { const nextMuted = !liveMicMuted; setLiveMicMuted(nextMuted); liveStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; }); }} aria-label={liveMicMuted ? "Mikrofonu aç" : "Mikrofonu kapat"} className="flex w-14 flex-col items-center gap-1 text-white/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur">{liveMicMuted ? <VolumeX className="h-5 w-5 text-rose-200" /> : <Volume2 className="h-5 w-5 text-fuchsia-100" />}</span><span className="text-center text-[9px] font-bold">{liveMicMuted ? "Mikrofonu aç" : "Mikrofon"}</span>
                </button>
              )}
              {liveStarted && liveType === "game" && (
                <button type="button" onClick={() => void shareGameScreen()} aria-label="Ekran paylaşımını aç" className="flex w-14 flex-col items-center gap-1 text-white/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur"><Video className="h-5 w-5 text-fuchsia-100" /></span><span className="text-center text-[9px] font-bold">Ekran paylaş</span>
                </button>
              )}
              {liveStarted && (
                <button type="button" onClick={() => document.querySelector<HTMLInputElement>(".live-comment-panel-creator input")?.focus()} aria-label="Yorum alanına git" className="flex w-14 flex-col items-center gap-1 text-white/90">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur"><MessageSquare className="h-5 w-5 text-fuchsia-100" /></span><span className="text-center text-[9px] font-bold">Yorum yaz</span>
                </button>
              )}
              <button type="button" onClick={toggleLiveCamera} aria-label={liveCamOff ? "Kamerayı aç" : "Kamerayı kapat"} className="flex w-14 flex-col items-center gap-1 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur"><Camera className={`h-5 w-5 ${liveCamOff ? "text-white/50" : "text-fuchsia-100"}`} /></span><span className="text-center text-[9px] font-bold">Kamera</span>
              </button>
              <button type="button" onClick={() => setLiveFilterIndex((index) => (index + 1) % 3)} aria-label="Kamera filtresini değiştir" className="flex w-14 flex-col items-center gap-1 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur"><SlidersHorizontal className="h-5 w-5 text-fuchsia-100" /></span><span className="text-center text-[9px] font-bold">Filtreler</span>
              </button>
              <button type="button" onClick={() => { setStudioStatsTab("supporters"); setStudioRankingOpen(true); }} aria-label="Hediye destekçilerini aç" className="flex w-14 flex-col items-center gap-1 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200/25 bg-[#1b0d26]/80 shadow-lg backdrop-blur"><Gift className="h-5 w-5 text-fuchsia-100" /></span><span className="text-[9px] font-bold">Hediyeler</span>
              </button>
              {liveStarted && (
                <button type="button" onClick={() => { if (liveBattle?.active) void endStudioBattle(); else { setBattleInviteMessage(""); setBattleInviteOpen((open) => !open); } }} disabled={liveBattleStarting} aria-label={liveBattle?.active ? "Kapışmayı kapat" : "Canlı yayınla Kapışma daveti gönder"} className="flex w-14 flex-col items-center gap-1 text-white/90 disabled:opacity-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200/25 bg-[#1b0d26]/80 text-lg shadow-lg backdrop-blur">{liveBattle?.active ? <X className="h-4 w-4" /> : <Swords className="h-5 w-5" />}</span><span className="text-center text-[9px] font-bold">{liveBattle?.active ? "Kapışmayı bitir" : liveBattleStarting ? "Gönderiliyor" : "Kapışma davet et"}</span>
                </button>
              )}
              <button type="button" onClick={() => void navigator.share?.({ title: liveTitle, text: liveContent }).catch(() => {})} aria-label="Yayını paylaş" className="flex w-14 flex-col items-center gap-1 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur"><Share2 className="h-5 w-5" /></span><span className="text-[9px] font-bold">Paylaş</span>
              </button>
              </div>}
            </div>
            {liveQuestionOpen && liveStarted && liveType === "chat" && (
              <section className="absolute left-14 top-[8rem] z-[55] w-[min(76vw,21rem)] rounded-2xl border border-fuchsia-200/20 bg-[#10091b]/95 p-3 text-white shadow-2xl backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div><p className="text-xs font-black">İzleyicilere soru sor</p><p className="mt-0.5 text-[10px] text-white/55">Soru canlı sohbette belirgin şekilde paylaşılır.</p></div>
                  <button type="button" onClick={() => setLiveQuestionOpen(false)} aria-label="Soru panelini kapat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/75"><X className="h-4 w-4" /></button>
                </div>
                <textarea value={liveQuestionDraft} onChange={(event) => setLiveQuestionDraft(event.target.value)} maxLength={450} rows={3} placeholder="İzleyicilere ne sormak istersin?" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-fuchsia-300/50" />
                {liveQuestionError && <p role="alert" className="mt-2 text-[10px] text-rose-200">{liveQuestionError}</p>}
                <button type="button" onClick={() => void sendLiveQuestion()} disabled={!liveQuestionDraft.trim() || liveCommentSending} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> {liveCommentSending ? "Gönderiliyor..." : "Soruyu paylaş"}
                </button>
              </section>
            )}
            {liveStarted && battleInviteOpen && !liveBattle?.active && (
              <section className="absolute left-14 top-[8rem] z-[55] max-h-[min(65vh,32rem)] w-[min(76vw,20rem)] overflow-y-auto rounded-2xl border border-fuchsia-200/20 bg-[#10091b]/95 p-3 text-white shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div><p className="text-xs font-black">Çoklu PK ve davetler</p><p className="mt-0.5 text-[10px] text-white/55">En fazla 6 kişi, kırmızı ve mavi takımlara ayrılır</p></div>
                  <button type="button" onClick={() => setBattleInviteOpen(false)} aria-label="Kapışma davetlerini kapat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/75"><X className="h-4 w-4" /></button>
                </div>
                {battleInviteMessage && <p className="mb-2 text-xs font-semibold text-fuchsia-100">{battleInviteMessage}</p>}
                {liveParticipants.length > 0 && (
                  <button type="button" onClick={() => void startStudioGroupBattle()} disabled={liveBattleStarting} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-cyan-600 px-3 py-2.5 text-xs font-black text-white shadow-lg disabled:opacity-50">
                    <Swords className="h-4 w-4" />
                    Katılanlarla takım PK başlat ({Math.min(6, liveParticipants.length + 1)}/6)
                  </button>
                )}
                <div className="space-y-1.5">
                  {battleInviteTargets.filter((item) => item.id !== liveBroadcastId && item.user.id !== user?.id).map((opponent) => (
                    <div key={opponent.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.06] p-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fuchsia-500/20 text-xs font-black">{opponent.user.avatarUrl ? <img src={opponent.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (opponent.user.displayName || opponent.user.username).charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{opponent.user.displayName || `@${opponent.user.username}`}</span><span className="block truncate text-[10px] text-white/55">@{opponent.user.username}</span></span>
                      <button type="button" onClick={() => void startStudioBattle(opponent.id)} disabled={liveBattleStarting} className="shrink-0 rounded-full bg-fuchsia-600 px-2.5 py-1.5 text-[10px] font-black text-white disabled:opacity-50">Davet et</button>
                    </div>
                  ))}
                  {battleInviteTargets.filter((item) => item.id !== liveBroadcastId && item.user.id !== user?.id).length === 0 && <p className="rounded-lg border border-dashed border-white/15 p-3 text-center text-[11px] text-white/55">Şu anda Kapışma daveti gönderebileceğin başka bir canlı yayın yok.</p>}
                </div>
              </section>
            )}
            <button type="button" onClick={liveStarted ? closeLiveStudio : startLiveBroadcast} disabled={Boolean(liveError) || !liveStreamReady} aria-label={liveStarted ? "Yayını bitir" : "Canlı yayını başlat"} className="absolute bottom-[5.5rem] right-3 z-40 flex w-14 flex-col items-center gap-1 rounded-2xl border border-fuchsia-300/50 bg-gradient-to-b from-fuchsia-600 to-purple-800 px-1 py-2.5 text-white shadow-[0_0_24px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:opacity-60 sm:right-5">
              {liveStarted ? <X className="h-5 w-5" /> : <Radio className="h-5 w-5" />}<span className="text-center text-[9px] font-black leading-3">{liveStarted ? <>Yayını<br />Bitir</> : <>Yayını<br />Başlat</>}</span>
            </button>
            {liveStarted && (
              <div className="hidden live-comment-bar absolute bottom-[5.7rem] left-4 right-24 z-30 flex max-w-[34rem] items-center gap-2 rounded-2xl border border-white/15 bg-black/60 p-2 shadow-2xl backdrop-blur-xl sm:bottom-[7rem] sm:left-6 sm:right-28">
                <button type="button" aria-label="Abone ol" className="live-comment-action flex shrink-0 flex-col items-center gap-0.5 px-2 text-[9px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "subscribe")} fallback={<Sparkles className="h-6 w-6 text-amber-300" />} /><span>Abone ol</span></button>
                <div className="live-comment-input flex min-w-0 flex-1 items-center rounded-full bg-[#262735]/90 px-3 py-2">
                  <input value={liveCommentText} onChange={(event) => setLiveCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void sendLiveComment(); } }} placeholder="Yorum yaz..." disabled={liveCommentSending} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/55" />
                  <button type="button" aria-label="Emoji ekle" onClick={() => setLiveCommentText((value) => `${value} 🙂`)} className="text-white/75"><LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "comment")} fallback={<Smile className="h-6 w-6" />} /></button>
                </div>
                <button type="button" aria-label="Konuk isteklerini aç" onClick={() => setStudioRankingOpen(true)} className="live-comment-action flex shrink-0 flex-col items-center gap-0.5 text-[9px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "guests")} fallback={<Users className="h-6 w-6 text-cyan-300" />} /><span>Konuklar</span></button>
                <button type="button" aria-label="Hediye paneli" onClick={() => setStudioRankingOpen(true)} className="live-comment-action flex shrink-0 flex-col items-center gap-0.5 text-[9px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "gift")} fallback={<Sparkles className="h-6 w-6 text-pink-300" />} /><span>Gül</span></button>
                <button type="button" aria-label="Yayını paylaş" onClick={() => void navigator.share?.({ title: liveTitle, text: liveContent }).catch(() => {})} className="live-comment-action flex shrink-0 flex-col items-center gap-0.5 text-[9px] font-black text-white/85"><LiveButtonVisual asset={getLiveButtonAsset(liveButtonAssets, "share")} fallback={<Share2 className="h-6 w-6" />} /><span>Paylaş</span></button>
              </div>
            )}
            {!liveStarted && (
              <div className="absolute bottom-8 left-4 right-24 z-20 max-w-sm rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs leading-5 text-white/70 backdrop-blur-xl sm:left-6">
                <span className="font-bold text-white">
                  Hazır olduğunda yayına geç.
                </span>{" "}
                Kamera ve ses kontrolleri sağ tarafta.
              </div>
            )}
          </section>
        </div>
      )}
      <HomeStyleLoopComments
        open={commentsOpen}
        replies={commentReplies}
        commentText={commentText}
        onCommentTextChange={setCommentText}
        onSubmit={submitComment}
        submitting={commentSending}
        onClose={() => setCommentsOpen(false)}
        mediaUrl={commentMediaUrl}
        onImagePick={() => commentMediaRef.current?.click()}
        onGifPick={setCommentMediaUrl}
        onSticker={() => setCommentText((value) => `${value}✨`)}
        onClearMedia={() => setCommentMediaUrl(null)}
        onReply={(username) => {
          setReplyingTo(username);
          setCommentText(`@${username} `);
        }}
      />
      {false && commentsOpen && (
        <div
          className="absolute inset-0 z-[75] flex items-end bg-black/50"
          onClick={() => setCommentsOpen(false)}
        >
          <section
            className="flex max-h-[88vh] w-full flex-col rounded-t-[28px] bg-background text-foreground shadow-[0_-4px_32px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 pb-3 pt-2">
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                aria-label="Yorumları kapat"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 text-center">
                <p className="text-[15px] font-bold leading-tight">Yorumlar</p>
                <p className="text-[12px] text-muted-foreground">
                  {commentReplies.length} yorum
                </p>
              </div>
              <div className="h-8 w-8" />
            </header>
            <div className="mx-4 h-px bg-border/60" />
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {commentReplies.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <MessageCircle className="mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm">İlk yorumu sen yap!</p>
                </div>
              ) : (
                commentReplies.map((reply, index) => (
                  <div
                    key={`${reply.content}-${index}`}
                    className="flex gap-2.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {reply.user?.avatarUrl ? (
                        <img
                          src={reply.user.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        (reply.user?.displayName || reply.user?.username || "K")
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">
                          {reply.user?.displayName ||
                            reply.user?.username ||
                            "Kullanıcı"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ·{" "}
                          {new Date(
                            reply.createdAt || Date.now(),
                          ).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <p className="break-words whitespace-pre-wrap text-[14px] leading-[1.45] text-foreground">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {gifPanelOpen && (
              <GifPicker
                onSelect={(url) => {
                  setCommentMediaUrl(url);
                  setGifPanelOpen(false);
                }}
                onClose={() => setGifPanelOpen(false)}
              />
            )}
            <div className="relative flex items-center gap-2 border-t border-white/10 px-4 pb-7 pt-3">
              <input
                ref={commentMediaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCommentImage}
              />
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCommentsPlusOpen((value) => !value);
                    setGifPanelOpen(false);
                  }}
                  aria-label="Yorum eklerini aç"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10"
                >
                  <Plus className="h-5 w-5" />
                </button>
                {commentsPlusOpen && (
                  <div className="absolute bottom-full left-0 mb-2 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1528] shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        commentMediaRef.current?.click();
                        setCommentsPlusOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"
                    >
                      <ImagePlus className="h-4 w-4" /> Görüntü
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGifPanelOpen(true);
                        setCommentsPlusOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"
                    >
                      <span className="w-4 text-center text-[10px] font-black">
                        GIF
                      </span>{" "}
                      GIF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCommentText((value) => `${value}✨`);
                        setCommentsPlusOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"
                    >
                      <Smile className="h-4 w-4" /> Sticker
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                {replyingTo && (
                  <div className="mb-1 flex items-center justify-between text-[10px] text-violet-300">
                    @{replyingTo} kullanıcısına yanıt
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setCommentText("");
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {commentMediaUrl && (
                  <div className="relative mb-1 w-fit">
                    <img
                      src={commentMediaUrl}
                      alt="Seçilen görüntü"
                      className="max-h-20 max-w-32 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setCommentMediaUrl(null)}
                      aria-label="Ek görüntüyü kaldır"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-black/80 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitComment();
                  }}
                  placeholder="Yorum yaz..."
                  maxLength={500}
                  className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-slate-600"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => void submitComment()}
                disabled={!commentText.trim() || commentSending}
                aria-label="Yorum gönder"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 disabled:opacity-30"
              >
                {commentSending ? "..." : <Send className="h-4 w-4" />}
              </button>
            </div>
          </section>
        </div>
      )}
      {shareOpen && (
        <div
          className="absolute inset-0 z-[74] flex items-end bg-black/55"
          onClick={() => setShareOpen(false)}
        >
          <section
            className="flex max-h-[78%] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#171225] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pb-1 pt-2">
              <div className="h-1 w-9 rounded-full bg-white/25" />
            </div>
            <header className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-1">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">
                  Loop paylaş
                </p>
                <h2 className="mt-1 text-[15px] font-bold">
                  Kime göndermek istiyorsun?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Paylaşımı kapat"
                onClick={() => setShareOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={shareSearch}
                  onChange={(event) => setShareSearch(event.target.value)}
                  placeholder="Kişi ara..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {shareContacts
                .filter((contact) =>
                  `${contact.displayName ?? ""} ${contact.username}`
                    .toLocaleLowerCase("tr-TR")
                    .includes(shareSearch.toLocaleLowerCase("tr-TR")),
                )
                .map((contact) => {
                  const sent = shareSent.has(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 border-b border-white/5 py-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
                        {contact.avatarUrl ? (
                          <img
                            src={contact.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (contact.displayName ?? contact.username)
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {contact.displayName ?? contact.username}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          @{contact.username}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendLoopToContact(contact)}
                        disabled={sent || shareSending === contact.id}
                        className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold disabled:bg-white/10 disabled:text-slate-500"
                      >
                        {shareSending === contact.id
                          ? "..."
                          : sent
                            ? "Gönderildi"
                            : "Gönder"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

export default function Loops() {
  const { user } = useAuth();
  const liveButtonAssets = useLiveButtonAssets();
  const liveEvents = useLiveEvents();
  const [location] = useLocation();
  const canUpload = Boolean(user);
  const uploadedLoopsStorageKey = `loop-uploads:${user?.id ?? user?.username ?? "guest"}`;
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedCycle, setFeedCycle] = useState(0);
  const [liveOverlayOpen, setLiveOverlayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Akış");
  const [liveFeedStartId, setLiveFeedStartId] = useState<string | null>(null);
  const [feedScrolling, setFeedScrolling] = useState(false);
  const [uploadedLoops, setUploadedLoops] = useState<Loop[]>(() => {
    try {
      const saved = localStorage.getItem(uploadedLoopsStorageKey);
      return saved ? (JSON.parse(saved) as Loop[]) : [];
    } catch {
      return [];
    }
  });
  const [hiddenLoopIds, setHiddenLoopIds] = useState<Set<number>>(new Set());
  const [liveLoops, setLiveLoops] = useState<Loop[]>([]);
  const [liveBroadcasts, setLiveBroadcasts] = useState<LiveBroadcast[]>([]);
  const previousFeedFirstIdRef = useRef<number | undefined>(undefined);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("coming_soon");
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [followingLoading, setFollowingLoading] = useState(true);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(
    null,
  );
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState(false);
  const [emptyComposerOpen, setEmptyComposerOpen] = useState(false);
  const [emptyVideo, setEmptyVideo] = useState<File | null>(null);
  const [emptyVideos, setEmptyVideos] = useState<File[]>([]);
  const [emptyTitle, setEmptyTitle] = useState("");
  const [emptyCaption, setEmptyCaption] = useState("");
  const [emptyTags, setEmptyTags] = useState("");
  const [emptyAudio, setEmptyAudio] = useState("");
  const [emptyUploading, setEmptyUploading] = useState(false);
  const [emptyProgress, setEmptyProgress] = useState(0);
  const emptyInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const deepLinkTargetRef = useRef<number | null>(null);
  const liveRecommendationSeedRef = useRef(Math.random());

  useEffect(() => () => {
    if (scrollSettleTimerRef.current !== null)
      window.clearTimeout(scrollSettleTimerRef.current);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(uploadedLoopsStorageKey);
      setUploadedLoops(saved ? (JSON.parse(saved) as Loop[]) : []);
    } catch {
      setUploadedLoops([]);
    } finally {
      setHydratedStorageKey(uploadedLoopsStorageKey);
    }
  }, [uploadedLoopsStorageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== uploadedLoopsStorageKey) return;
    try {
      localStorage.setItem(
        uploadedLoopsStorageKey,
        JSON.stringify(uploadedLoops),
      );
    } catch {
      // The server remains the source of truth when storage is unavailable.
    }
  }, [uploadedLoops, uploadedLoopsStorageKey, hydratedStorageKey]);

  useEffect(() => {
    document.body.classList.add("loops-nav-hidden");
    return () => document.body.classList.remove("loops-nav-hidden");
  }, []);

  useEffect(() => {
    const handleInterestChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ loopId?: number; preference?: string }>
      ).detail;
      if (!detail?.loopId) return;
      setHiddenLoopIds((current) => {
        const next = new Set(current);
        if (detail.preference === "not-interested") next.add(detail.loopId!);
        else next.delete(detail.loopId!);
        return next;
      });
    };
    window.addEventListener("loop-interest-changed", handleInterestChange);
    return () =>
      window.removeEventListener("loop-interest-changed", handleInterestChange);
  }, []);

  const selectedTag = (() => {
    if (!location || !location.includes("?")) return "";
    const query = new URLSearchParams(
      location.slice(location.indexOf("?") + 1),
    );
    const value = query.get("tag") ?? "";
    return value.replace(/^#/, "").trim().toLowerCase();
  })();
  const selectedLoopId = (() => {
    const value = Number(
      new URLSearchParams(window.location.search).get("loop"),
    );
    return Number.isFinite(value) && value > 0 ? value : null;
  })();

  useEffect(() => {
    if (!user?.id) {
      setFollowingIds(new Set());
      setFollowingLoading(false);
      return;
    }
    setFollowingLoading(true);
    fetch(`/api/users/${user.id}/following`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((users: Array<{ id?: number }>) =>
        setFollowingIds(
          new Set(
            users
              .map((followedUser) => followedUser.id)
              .filter((id): id is number => typeof id === "number"),
          ),
        ),
      )
      .catch(() => setFollowingIds(new Set()))
      .finally(() => setFollowingLoading(false));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadLiveLoops = async () => {
      setLiveError(false);
      try {
        const response = await fetch("/api/loop/photos", {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          setLiveError(true);
          return;
        }
        const photos = (await response.json()) as Array<{
          id: number;
          mediaUrl: string;
          mediaItems?: Array<{ url: string; mediaType?: "video" | "image" }>;
          mediaType?: "video" | "image";
          title?: string;
          caption?: string;
          tags?: string;
          audio?: string;
          createdAt: string;
          reposted?: boolean;
          repostCount?: number;
          likeCount?: number;
          liked?: boolean;
          commentCount?: number;
          sender?: {
            id?: number;
            username?: string;
            displayName?: string;
            avatarUrl?: string;
            badge?: string | null;
            badgeAssetUrl?: string | null;
            emblemAssetUrl?: string | null;
            badgeLabel?: string | null;
          } | null;
        }>;
        if (cancelled) return;
        const videoLoops = photos
          .map((photo) => ({
            id: 1000000 + photo.id,
            sourceId: photo.id,
            reposted: Boolean(photo.reposted),
            repostCount: Number(photo.repostCount ?? 0),
            liked: Boolean(photo.liked),
            user: {
              id: photo.sender?.id,
              username: photo.sender?.username || "loop kullanıcısı",
              displayName: photo.sender?.displayName,
              avatar: photo.sender?.avatarUrl || "",
              badge: photo.sender?.badge,
              badgeAssetUrl: photo.sender?.badgeAssetUrl,
              emblemAssetUrl: photo.sender?.emblemAssetUrl,
              badgeLabel: photo.sender?.badgeLabel,
            },
            title: photo.title || "Yeni Loop",
            caption:
              [photo.caption, photo.tags].filter(Boolean).join(" ") ||
              "Takip ettiğin birinden yeni bir video",
            tags: photo.tags || "",
            location: "",
            audio: photo.audio || "Orijinal ses",
            likes: Number(photo.likeCount ?? 0),
            comments: Number(photo.commentCount ?? 0),
            saves: 0,
            shares: 0,
            repostFriends: [],
            cover: normalizeLoopMediaUrl(photo.mediaUrl),
            mediaItems: (photo.mediaItems ?? [])
              .map((item) => normalizeLoopMediaUrl(item.url))
              .filter(Boolean),
            isVideo:
              photo.mediaType === "video" || isVideoMediaUrl(photo.mediaUrl),
          }));
        const randomizedLoops = shuffleLoops(
          videoLoops,
          previousFeedFirstIdRef.current,
        );
        previousFeedFirstIdRef.current = randomizedLoops[0]?.id;
        setLiveLoops(randomizedLoops);
      } catch {
        setLiveError(true);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };
    loadLiveLoops();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (liveLoops.length === 0) return;
    setUploadedLoops((current) =>
      current.filter(
        (loop) => typeof loop.sourceId === "number" && loop.sourceId > 0,
      ),
    );
  }, [liveLoops.length]);

  useEffect(() => {
    let cancelled = false;
    setLiveStatus("coming_soon");
    fetch("/api/live/status", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { status?: LiveStatus } | null) => {
        if (!cancelled && data?.status) setLiveStatus(data.status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setLiveBroadcasts([]);
    const loadBroadcasts = async () => {
      try {
        const response = await fetch("/api/live/broadcasts", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const broadcasts = (await response.json()) as LiveBroadcast[];
        if (!cancelled) setLiveBroadcasts(broadcasts.filter((broadcast) => !broadcast.endedAt));
      } catch {
        if (!cancelled) setLiveBroadcasts([]);
      }
    };
    void loadBroadcasts();
    const timer = window.setInterval(() => void loadBroadcasts(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  const allLoops = useMemo(() => {
    const seen = new Set<string>();
    const uniqueLoops = [...liveLoops, ...uploadedLoops, ...LOOPS].filter(
      (loop) => {
        if (hiddenLoopIds.has(loop.id)) return false;
        const identity = loop.sourceId
          ? `source:${loop.sourceId}`
          : `media:${loop.cover || loop.id}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      },
    );
    return shuffleLoops(uniqueLoops, previousFeedFirstIdRef.current);
  }, [uploadedLoops, liveLoops, hiddenLoopIds]);
  const tagFilteredLoops = selectedTag
    ? allLoops.filter((loop) => {
        const haystack = [
          loop.title,
          loop.caption,
          loop.tags ?? "",
          loop.user.displayName ?? "",
          loop.user.username,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(selectedTag);
      })
    : allLoops;
  const tabFilteredLoops = useMemo(
    () =>
      activeTab === "Takip Edilenler"
        ? tagFilteredLoops.filter(
            (loop) =>
              typeof loop.user.id === "number" &&
              followingIds.has(loop.user.id),
          )
        : tagFilteredLoops,
    [activeTab, followingIds, tagFilteredLoops],
  );

  const continuousLoops = useMemo(() => {
    if (activeTab === "Canlı yayın" || tabFilteredLoops.length < 2) {
      return tabFilteredLoops;
    }
    return Array.from({ length: feedCycle + 1 }, (_, cycle) =>
      cycle === 0
        ? tabFilteredLoops
        : shuffleLoops(tabFilteredLoops, previousFeedFirstIdRef.current).map(
            (loop) => ({
              ...loop,
              id: loop.id + cycle * 10000000,
            }),
          ),
    ).flat();
  }, [activeTab, feedCycle, tabFilteredLoops]);

  const visibleLoops =
    activeTab === "Canlı yayın"
      ? [...tabFilteredLoops].sort((a, b) => b.likes - a.likes)
      : continuousLoops;

  const feedItems = useMemo(() => {
    const recommendations = activeTab === "Akış" && liveStatus === "enabled"
      ? liveBroadcasts.filter((broadcast) => broadcast.user.id !== user?.id)
      : [];
    if (recommendations.length === 0) return visibleLoops.map((loop) => ({ type: "loop" as const, loop }));

    const items: Array<
      | { type: "loop"; loop: Loop }
      | { type: "live"; broadcast: LiveBroadcast }
    > = [];
    let randomState = (liveRecommendationSeedRef.current * 0xffffffff) >>> 0 || 1;
    const nextRandom = () => {
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      return (randomState >>> 0) / 0x100000000;
    };
    let nextRecommendationAt = 15 + Math.floor(nextRandom() * 46);
    const recommendationSlots = new Set<number>();
    while (nextRecommendationAt <= visibleLoops.length) {
      if (nextRandom() < 0.72) recommendationSlots.add(nextRecommendationAt);
      nextRecommendationAt += 15 + Math.floor(nextRandom() * 46);
    }
    visibleLoops.forEach((loop, index) => {
      items.push({ type: "loop", loop });
      if (recommendationSlots.has(index + 1)) {
        items.push({
          type: "live",
          broadcast: recommendations[Math.floor(nextRandom() * recommendations.length)]!,
        });
      }
    });
    return items;
  }, [activeTab, liveBroadcasts, liveStatus, user?.id, visibleLoops]);

  useEffect(() => {
    setFeedCycle(0);
  }, [activeTab, selectedTag]);

  useEffect(() => {
    if (
      activeTab !== "Canlı yayın" &&
      tabFilteredLoops.length > 1 &&
      activeIndex >= feedItems.length - 3
    ) {
      setFeedCycle((cycle) => cycle + 1);
    }
  }, [activeIndex, activeTab, feedItems.length, tabFilteredLoops.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    [activeIndex - 2, activeIndex - 1, activeIndex + 1, activeIndex + 2].forEach((index) => {
      const video =
        container.children[index]?.querySelector<HTMLVideoElement>("video");
      if (video && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.preload = "auto";
        video.load();
      }
    });
  }, [activeIndex, visibleLoops.length]);

  useEffect(() => {
    if (selectedTag && visibleLoops.length > 0) {
      setActiveIndex(0);
      containerRef.current?.scrollTo({ top: 0 });
    }
  }, [selectedTag, visibleLoops.length]);

  useEffect(() => {
    if (!selectedLoopId || visibleLoops.length === 0) return;

    const sourceTargetIndex = visibleLoops.findIndex(
      (loop) => loop.sourceId === selectedLoopId,
    );
    const targetIndex =
      sourceTargetIndex >= 0
        ? sourceTargetIndex
        : visibleLoops.findIndex((loop) => {
            const normalizedLoopId = Number(loop.id);
            return (
              normalizedLoopId === selectedLoopId ||
              normalizedLoopId === selectedLoopId + 1000000 ||
              normalizedLoopId === selectedLoopId - 1000000
            );
          });

    if (targetIndex < 0) return;
    deepLinkTargetRef.current = targetIndex;
    setActiveIndex(targetIndex);

    const container = containerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const card = container.children[targetIndex] as HTMLElement | undefined;
      if (!card) return;
      container.scrollTo({ top: card.offsetTop, behavior: "auto" });
    });
    const unlockTimer = window.setTimeout(() => {
      deepLinkTargetRef.current = null;
    }, 700);
    return () => window.clearTimeout(unlockTimer);
  }, [selectedLoopId, visibleLoops.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.children.length > 0 && !selectedTag && !selectedLoopId) {
      setActiveIndex(0);
      container.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [
    uploadedLoops.length,
    liveLoops.length,
    activeTab,
    selectedTag,
    visibleLoops.length,
  ]);
  const handleEmptyMedia = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("video/") || file.type.startsWith("image/"))
      .slice(0, 10);
    event.target.value = "";
    if (files.length === 0) return;
    setEmptyVideos(files);
    setEmptyVideo(files[0] ?? null);
    setEmptyTitle((files[0]?.name ?? "Yeni Loop").replace(/\.[^/.]+$/, ""));
  };
  const publishEmptyLoop = () => {
    const files = emptyVideos.length > 0
      ? emptyVideos
      : emptyVideo ? [emptyVideo] : [];
    if (files.length === 0 || !emptyTitle.trim()) return;
    setEmptyUploading(true);
    const request = new XMLHttpRequest();
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("title", emptyTitle.trim());
    formData.append("caption", emptyCaption.trim());
    formData.append("tags", emptyTags.trim());
    formData.append("audio", emptyAudio.trim());
    request.open("POST", "/api/loop/photos");
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setEmptyProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = async () => {
      if (request.status >= 200 && request.status < 300) {
        const photo = JSON.parse(request.responseText).photo;
        const profileResponse = user?.id
          ? await fetch(`/api/users/${user.id}`, {
              credentials: "include",
              cache: "no-store",
            })
          : null;
        const profileDecorations = profileResponse?.ok
          ? await profileResponse.json()
          : null;
        const decoratedUser = user as
          | (typeof user & {
              badgeAssetUrl?: string | null;
              emblemAssetUrl?: string | null;
              badgeLabel?: string | null;
            })
          | null;
        const uploadedLoop: Loop = {
          id: 1000000 + Number(photo.id || Date.now()),
          sourceId: Number(photo.id),
          user: {
            id: user?.id,
            username: user?.username || "kullanıcı",
            avatar: user?.avatarUrl || "",
            badgeAssetUrl:
              profileDecorations?.badgeAssetUrl ?? decoratedUser?.badgeAssetUrl,
            emblemAssetUrl:
              profileDecorations?.emblemAssetUrl ??
              decoratedUser?.emblemAssetUrl,
            badgeLabel:
              profileDecorations?.badgeLabel ?? decoratedUser?.badgeLabel,
          },
          title: emptyTitle.trim(),
          caption: [emptyCaption.trim(), emptyTags.trim()]
            .filter(Boolean)
            .join(" "),
          tags: emptyTags.trim(),
          location: "",
          audio: emptyAudio.trim() || "Orijinal ses",
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          repostFriends: [],
          cover: normalizeLoopMediaUrl(photo.mediaUrl),
          mediaItems: Array.isArray(photo.mediaItems)
            ? photo.mediaItems.map((item: { url: string }) => normalizeLoopMediaUrl(item.url)).filter(Boolean)
            : [normalizeLoopMediaUrl(photo.mediaUrl)],
          isVideo: Boolean(files[0]?.type.startsWith("video/")),
        };
        setUploadedLoops((current) => [
          uploadedLoop,
          ...current.filter((item) => item.id !== uploadedLoop.id),
        ]);
        setLiveLoops((current) =>
          current.filter((item) => item.id !== uploadedLoop.id),
        );
        setEmptyComposerOpen(false);
        setEmptyVideo(null);
        setEmptyVideos([]);
        setEmptyProgress(0);
        setEmptyUploading(false);
        setActiveIndex(0);
      } else setEmptyUploading(false);
    };
    request.onerror = () => setEmptyUploading(false);
    request.send(formData);
  };

  return (
    <AppLayout hideHeader hideBottomNav>
      <style>
        {"@keyframes loop-progress { from { width: 0 } to { width: 100% } }"}
      </style>
      <div className="fixed inset-0 bg-[#050611] text-white">
        <LoopDock hidden={liveOverlayOpen || activeTab === "Canlı yayın"} />
        {activeTab !== "Canlı yayın" && <nav className={`pointer-events-auto fixed left-3 top-[4.5rem] z-[80] flex w-auto max-w-[calc(100%-1.5rem)] translate-x-0 transform-gpu items-center justify-start gap-1 transition-[opacity,transform] duration-200 will-change-transform md:left-1/2 md:top-[5rem] md:w-[calc(100%-1.5rem)] md:max-w-[28rem] md:-translate-x-1/2 md:justify-center ${feedScrolling ? "-translate-y-3 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setActiveIndex(0);
                  setFeedCycle(0);
                  setFeedScrolling(false);
                  containerRef.current?.scrollTo({ top: 0 });
                }}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 px-2 pb-1 text-[9px] font-bold transition-colors duration-200 md:text-[10px] ${active ? "text-white" : "text-violet-100/45 hover:text-violet-100"}`}
              >
                <span className={`relative flex h-5 w-5 items-center justify-center ${tab === "Canlı yayın" ? "" : "invisible"}`}>
                  <Orbit className={`h-5 w-5 ${active ? "text-rose-300" : "text-violet-100/55"}`} />
                  <span className={`absolute h-1.5 w-1.5 ${active ? "animate-pulse bg-rose-300 shadow-[0_0_8px_#fda4af]" : "bg-violet-100/55"}`} />
                </span>
                <span>{tab}</span>
                {active && (
                  <span className={`absolute bottom-0 h-px w-7 rounded-full shadow-[0_0_10px_currentColor] ${tab === "Canlı yayın" ? "bg-rose-300 text-rose-300" : "bg-violet-300 text-violet-300"}`} />
                )}
              </button>
            );
          })}
        </nav>}
        <div
          ref={containerRef}
          onScroll={(event) => {
            if (liveOverlayOpen) return;
            setFeedScrolling(true);
            const container = event.currentTarget;
            [activeIndex - 2, activeIndex - 1, activeIndex + 1, activeIndex + 2].forEach((index) => {
              const nearbyVideo =
                container.children[index]?.querySelector<HTMLVideoElement>(
                  "video",
                );
              if (
                nearbyVideo &&
                nearbyVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
              ) {
                nearbyVideo.preload = "auto";
                nearbyVideo.load();
              }
            });
            container.querySelectorAll("video").forEach((video) => {
              video.dataset.resumeAfterScroll = String(!video.paused);
              video.pause();
            });
            if (scrollSettleTimerRef.current !== null)
              window.clearTimeout(scrollSettleTimerRef.current);
            scrollSettleTimerRef.current = window.setTimeout(() => {
              scrollSettleTimerRef.current = null;
              const viewportCenter =
                container.scrollTop + container.clientHeight / 2;
              const nextIndex = Array.from(container.children).reduce(
                (closestIndex, child, index, children) => {
                  const distance = Math.abs(
                    (child as HTMLElement).offsetTop +
                      child.clientHeight / 2 -
                      viewportCenter,
                  );
                  const closestChild = children[closestIndex] as
                    | HTMLElement
                    | undefined;
                  const closestDistance = closestChild
                    ? Math.abs(
                        closestChild.offsetTop +
                          closestChild.clientHeight / 2 -
                          viewportCenter,
                      )
                    : Number.POSITIVE_INFINITY;
                  return distance < closestDistance ? index : closestIndex;
                },
                0,
              );
              if (nextIndex === activeIndex) {
                const currentVideo =
                  container.children[
                    nextIndex
                  ]?.querySelector<HTMLVideoElement>("video");
                if (currentVideo?.dataset.resumeAfterScroll === "true")
                  void currentVideo.play().catch(() => {});
                if (currentVideo) delete currentVideo.dataset.resumeAfterScroll;
                setFeedScrolling(false);
                return;
              }
              const nextVideo =
                container.children[nextIndex]?.querySelector<HTMLVideoElement>(
                  "video",
                );
              if (
                nextVideo &&
                nextVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
              ) {
                nextVideo.preload = "auto";
                nextVideo.load();
              }
              setActiveIndex(nextIndex);
              setFeedScrolling(false);
            }, 80);
          }}
          className={`mx-auto h-full w-full max-w-[28rem] snap-y snap-mandatory overscroll-contain ${liveOverlayOpen ? "overflow-hidden [touch-action:none]" : "overflow-y-scroll [touch-action:pan-y]"}`}
          style={{ scrollbarWidth: "none" }}
        >
          {activeTab === "Canlı yayın" && liveStatus !== "enabled" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Radio className="h-10 w-10 text-violet-300/60" />
              <p className="text-base font-bold text-violet-100">
                {liveStatus === "coming_soon"
                  ? "Canlı yayın yakında"
                  : "Canlı yayın şu anda kapalı"}
              </p>
              <p className="text-sm text-violet-100/55">
                Bu alan yönetici tarafından henüz kullanıma açılmadı.
              </p>
            </div>
          ) : liveLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-violet-100/70">
              Loops yükleniyor...
            </div>
          ) : liveError &&
            liveLoops.length === 0 &&
            uploadedLoops.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-semibold text-violet-100/80">
                Loops şu anda yüklenemedi.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full border border-violet-300/40 bg-violet-500/15 px-4 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/25"
              >
                Tekrar dene
              </button>
            </div>
          ) : selectedTag && activeTab !== "Canlı yayın" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Search className="h-10 w-10 text-violet-300/60" />
              <p className="text-base font-bold text-violet-100">
                # {selectedTag} etiketiyle eşleşen loop bulunamadı.
              </p>
              <p className="text-sm text-violet-100/55">
                Farklı bir etiketi seçip tekrar deneyebilirsin.
              </p>
            </div>
          ) : activeTab === "Takip Edilenler" && followingLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-violet-100/70">
              Takip ettiklerin yükleniyor...
            </div>
          ) : activeTab === "Canlı yayın" ? (
            <LiveBroadcastFeed broadcasts={liveBroadcasts} buttonAssets={liveButtonAssets} events={liveEvents} initialBroadcastId={liveFeedStartId} />
          ) : feedItems.length > 0 ? (
            feedItems.map((item, index) => item.type === "live" ? (
              <div key={`live-recommendation-${item.broadcast.id}-${index}`} className="h-full w-full shrink-0 snap-start [scroll-snap-stop:always]" style={{ scrollSnapStop: "always" }}>
                <LiveRecommendationCard
                  broadcast={item.broadcast}
                  onWatch={(broadcastId) => {
                    setLiveFeedStartId(broadcastId);
                    setActiveTab("Canlı yayın");
                    setActiveIndex(0);
                    setFeedCycle(0);
                    setFeedScrolling(false);
                    containerRef.current?.scrollTo({ top: 0 });
                  }}
                />
              </div>
            ) : (
              <div
                key={item.loop.id}
                className="h-full w-full shrink-0 snap-start [scroll-snap-stop:always]"
                style={{ scrollSnapStop: "always" }}
              >
                <LoopScene
                  loop={item.loop}
                  active={activeIndex === index}
                  canUpload={canUpload}
                  initiallyFollowing={
                    typeof item.loop.user.id === "number" &&
                    followingIds.has(item.loop.user.id)
                  }
                  liveStatus={liveStatus}
                  liveBroadcasts={liveBroadcasts}
                  liveButtonAssets={liveButtonAssets}
                  liveEvents={liveEvents}
                  onLiveModeChange={setLiveOverlayOpen}
                  onLoopUploaded={(uploadedLoop) => {
                    setUploadedLoops((current) =>
                      current.some((item) => item.id === uploadedLoop.id)
                        ? current
                        : [uploadedLoop, ...current],
                    );
                    setActiveIndex(0);
                    containerRef.current?.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                />
              </div>
            ))
          ) : activeTab === "Takip Edilenler" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Users className="h-10 w-10 text-violet-300/60" />
              <p className="text-base font-bold text-violet-100">
                Takip ettiklerinin henüz Loop paylaşımı yok.
              </p>
              <p className="text-sm text-violet-100/55">
                Yeni videolar ve fotoğraf serileri burada görünecek.
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              {canUpload ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEmptyComposerOpen(true)}
                    className="rounded-full border border-violet-300/40 bg-violet-500/15 px-5 py-3 text-sm font-bold text-violet-100 hover:bg-violet-500/25"
                  >
                    Loop ekle
                  </button>
                  <input
                    ref={emptyInputRef}
                    type="file"
                    accept="video/*,image/*"
                    multiple
                    className="hidden"
                    onChange={handleEmptyMedia}
                  />
                  {emptyComposerOpen && (
                    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#f6f7ff] px-4 py-5 sm:px-8 sm:py-8">
                      <div className="mx-auto flex min-h-full w-full max-w-5xl items-start justify-center">
                        <LoopsComposer
                          files={emptyVideos.length > 0 ? emptyVideos : emptyVideo ? [emptyVideo] : []}
                          title={emptyTitle}
                          caption={emptyCaption}
                          tags={emptyTags}
                          audio={emptyAudio}
                          uploading={emptyUploading}
                          progress={emptyProgress}
                          onTitleChange={setEmptyTitle}
                          onCaptionChange={setEmptyCaption}
                          onTagsChange={setEmptyTags}
                          onAudioChange={setEmptyAudio}
                          onPublish={publishEmptyLoop}
                          onChooseVideo={() => emptyInputRef.current?.click()}
                          onClose={() => { setEmptyComposerOpen(false); setEmptyVideo(null); setEmptyVideos([]); }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-violet-100/70">
                  Loops yakında sizlerle
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
