import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, ImagePlus, ArrowLeft, MessageCircle,
  Search, SlidersHorizontal, Mic, StopCircle, Pin,
  MessageSquarePlus, X, MoreVertical,
  BellOff, Heart, Trash2, CheckCircle2, Circle,
  Camera, Users, Phone, Video, Info, Smile, BadgeCheck, Reply,
  Bookmark, Palette, ChevronRight, Copy, ExternalLink,
  ImageIcon, ShieldOff, Flag,
} from "lucide-react";
import GifPicker from "@/components/shared/GifPicker";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mapGiphyResults = (data: any[]) =>
  (data ?? []).map((g: any) => ({
    id: g.id,
    url: g.images?.original?.url ?? g.images?.fixed_height?.url ?? "",
    preview: g.images?.fixed_height_still?.url ?? g.images?.downsized_still?.url ?? g.images?.fixed_height?.url ?? "",
  })).filter((g: any) => g.url);
import { useAuth } from "@/lib/auth";

// ── Favori sistemi ──────────────────────────────────────────────────────────
interface FavEntry { emoji?: string; color: string; glow: string }
const FAV_EMOJIS: { emoji: string; color: string; glow: string; label: string }[] = [
  { emoji: "🔥", color: "#ff4500", glow: "#ff4500", label: "Ateş" },
  { emoji: "⚡", color: "#facc15", glow: "#facc15", label: "Şimşek" },
  { emoji: "💜", color: "#a855f7", glow: "#a855f7", label: "Mor kalp" },
  { emoji: "💙", color: "#3b82f6", glow: "#3b82f6", label: "Mavi kalp" },
  { emoji: "💚", color: "#22c55e", glow: "#22c55e", label: "Yeşil kalp" },
  { emoji: "❤️", color: "#ef4444", glow: "#ef4444", label: "Kırmızı kalp" },
  { emoji: "🌙", color: "#818cf8", glow: "#818cf8", label: "Ay" },
  { emoji: "⭐", color: "#fbbf24", glow: "#fbbf24", label: "Yıldız" },
  { emoji: "🌊", color: "#06b6d4", glow: "#06b6d4", label: "Dalga" },
  { emoji: "🌸", color: "#f472b6", glow: "#f472b6", label: "Çiçek" },
  { emoji: "💎", color: "#67e8f9", glow: "#67e8f9", label: "Elmas" },
  { emoji: "🎯", color: "#fb923c", glow: "#fb923c", label: "Hedef" },
  { emoji: "🦋", color: "#c084fc", glow: "#c084fc", label: "Kelebek" },
  { emoji: "🌈", color: "#f9a8d4", glow: "#f9a8d4", label: "Gökkuşağı" },
  { emoji: "🍀", color: "#4ade80", glow: "#4ade80", label: "Yonca" },
  { emoji: "🎸", color: "#fde68a", glow: "#fde68a", label: "Gitar" },
];
const DEFAULT_FAV: FavEntry = { color: "#a855f7", glow: "#a855f7" };

// ── DM Tema sistemi ─────────────────────────────────────────────────────────
interface DmTheme { bubble: string; bgStyle: string }
const BUBBLE_THEMES = [
  { id: "violet",  label: "Mor",      light: "#EAE4FF", dark: "rgba(109,40,217,0.28)",  dot: "#a78bfa" },
  { id: "blue",    label: "Mavi",     light: "#DBEAFE", dark: "rgba(37,99,235,0.28)",   dot: "#60a5fa" },
  { id: "rose",    label: "Gül",      light: "#FCE7F3", dark: "rgba(190,18,60,0.28)",   dot: "#fb7185" },
  { id: "green",   label: "Yeşil",    light: "#D1FAE5", dark: "rgba(5,150,105,0.28)",   dot: "#34d399" },
  { id: "orange",  label: "Turuncu",  light: "#FFEDD5", dark: "rgba(194,65,12,0.28)",   dot: "#fb923c" },
  { id: "teal",    label: "Turkuaz",  light: "#CCFBF1", dark: "rgba(13,148,136,0.28)",  dot: "#2dd4bf" },
  { id: "yellow",  label: "Sarı",     light: "#FEF9C3", dark: "rgba(161,98,7,0.28)",    dot: "#facc15" },
  { id: "zinc",    label: "Gri",      light: "#F4F4F5", dark: "rgba(82,82,91,0.35)",    dot: "#a1a1aa" },
];
const DM_BG_STYLES = [
  { id: "none",         label: "Sade",          css: {} },
  { id: "violet-glow",  label: "Mor Işık",      css: { background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.09) 0%, transparent 70%)" } },
  { id: "ocean",        label: "Okyanus",        css: { background: "linear-gradient(180deg, rgba(14,165,233,0.06) 0%, rgba(20,184,166,0.06) 100%)" } },
  { id: "sunset",       label: "Gün Batımı",     css: { background: "linear-gradient(160deg, rgba(251,146,60,0.07) 0%, rgba(244,114,182,0.07) 100%)" } },
  { id: "stars",        label: "Yıldızlar",      css: { backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)", backgroundSize: "36px 36px" } },
];
import { formatDistanceToNow, format, isToday, isYesterday, isSameWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useCall } from "@/lib/callContext";

interface DmUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  thought?: string | null;
}

interface DmMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  voiceUrl: string | null;
  voiceDuration: number | null;
  isRead: boolean;
  sender: DmUser | null;
  createdAt: string;
}

interface Conversation {
  user: DmUser | null;
  lastMessage: DmMessage;
  unreadCount: number;
}

type FilterTab = "tumu" | "okunmamis" | "gruplar" | "sabitlenen" | "arsivlenen";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Dün";
  if (isSameWeek(d, new Date(), { locale: tr }))
    return format(d, "EEE", { locale: tr }).charAt(0).toUpperCase() + format(d, "EEE", { locale: tr }).slice(1, 3);
  return format(d, "dd.MM");
}

function lastMsgPreview(msg: DmMessage) {
  if (msg.voiceUrl) return "🎤 sesli mesaj gönderdi";
  if (msg.content) {
    if (msg.content.startsWith("__STORY_REACTION__:")) {
      const emoji = msg.content.split(":")[2] ?? "❤️";
      return `${emoji} hikayene tepki verdi`;
    }
    if (msg.content.startsWith("__STORY_REPLY__:")) {
      const text = msg.content.split(":").slice(2).join(":");
      return `📖 hikaye yanıtı: ${text}`;
    }
    if (msg.content.startsWith("__LOOP_POST_SHARE__:")) {
      return "📎 bir gönderi paylaştı";
    }
    if (msg.content.startsWith("__LOOP_GIF__:")) return "🖼 GIF gönderdi";
    if (msg.content.startsWith("__LOOP_CALL_VOICE__")) return "📞 sesli arama";
    if (msg.content.startsWith("__LOOP_CALL_VIDEO__")) return "📹 görüntülü arama";
    return msg.content;
  }
  if (msg.mediaUrl) {
    if (msg.mediaType === "video") return "video gönderdi";
    if (msg.mediaType === "audio") return "sesli mesaj gönderdi";
    return "fotoğraf gönderdi";
  }
  return "...";
}

function isSpecialPreview(msg: DmMessage) {
  return !msg.content && (!!msg.mediaUrl || !!msg.voiceUrl);
}

// Mock active users (decorative)
const ACTIVE_USERS = [
  { id: 0, initial: "S", color: "from-violet-500 to-purple-600" },
  { id: 1, initial: "A", color: "from-pink-500 to-rose-500" },
  { id: 2, initial: "E", color: "from-blue-500 to-indigo-500" },
  { id: 3, initial: "M", color: "from-green-500 to-emerald-500" },
];

// ── Sevimli Düşünce Balonu ──────────────────────────────────────────
type BubbleColor = "primary" | "violet" | "pink" | "sky" | "emerald" | "orange";

const BUBBLE_COLORS: Record<BubbleColor, { border: string; text: string }> = {
  primary: { border: "rgba(124,58,237,0.45)", text: "#7c3aed" },
  violet:  { border: "rgba(139,92,246,0.45)", text: "#8b5cf6" },
  pink:    { border: "rgba(236,72,153,0.45)", text: "#ec4899" },
  sky:     { border: "rgba(14,165,233,0.45)", text: "#0ea5e9" },
  emerald: { border: "rgba(16,185,129,0.45)", text: "#10b981" },
  orange:  { border: "rgba(249,115,22,0.45)", text: "#f97316" },
};

function ThoughtBubble({ text, color = "primary", isEmpty = false }: {
  text: string;
  color?: BubbleColor;
  isEmpty?: boolean;
}) {
  const c = BUBBLE_COLORS[color];
  return (
    <div className="relative w-full" style={{ paddingBottom: 9 }}>
      {/* Balon gövdesi — bg-card ile tam opak, kenarlık inline */}
      <div
        className="relative w-full bg-card rounded-2xl rounded-bl-none px-2.5 py-2 shadow-sm"
        style={{ border: `2px solid ${c.border}` }}
      >
        <p
          className={`text-[8px] font-semibold leading-snug line-clamp-3 tracking-tight ${isEmpty ? "italic" : ""}`}
          style={{ color: isEmpty ? `${c.text}80` : c.text }}
        >
          {text}
        </p>
      </div>
      {/* Kuyruk — döndürülmüş kare, sol alt köşeden çıkıyor */}
      <div
        className="absolute bg-card"
        style={{
          width: 10,
          height: 10,
          bottom: 4,
          left: 11,
          border: `2px solid ${c.border}`,
          borderTop: "none",
          borderRight: "none",
          transform: "rotate(-45deg)",
        }}
      />
    </div>
  );
}

// ── Group avatar stack (overlapping half-circles) ─────────────────────────────
function GroupAvatarStack({ members }: { members: { id: number; displayName: string; avatarUrl: string | null }[] }) {
  const shown = members.slice(0, 3);
  const offsets = [0, 18, 36];
  const sizes = shown.length === 1 ? [52] : shown.length === 2 ? [34, 34] : [28, 28, 28];
  const totalWidth = shown.length === 1 ? 52 : shown.length === 2 ? 46 : 52;
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      {shown.map((m, i) => {
        const size = sizes[i] ?? 28;
        const left = offsets[i] ?? 0;
        const top = shown.length === 3
          ? (i === 0 ? 12 : i === 1 ? 0 : 12)
          : (52 - size) / 2;
        return (
          <div
            key={m.id}
            className="absolute rounded-full border-2 border-background overflow-hidden bg-gradient-to-br from-primary/30 to-violet-400/30 flex items-center justify-center"
            style={{ width: size, height: size, left, top, zIndex: shown.length - i }}
          >
            {m.avatarUrl
              ? <img src={m.avatarUrl} className="w-full h-full object-cover" alt={m.displayName} />
              : <span className="text-primary font-bold" style={{ fontSize: size * 0.38 }}>{m.displayName.charAt(0)}</span>}
          </div>
        );
      })}
      {/* Grup rozeti */}
      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background z-10">
        <Users className="w-2.5 h-2.5 text-white" />
      </div>
    </div>
  );
}

// ── Group row bileşeni (Gruplar ve Tümü sekmesinde kullanılır) ─────────────────
function GroupRow({ g, onClick }: { g: { id: number; name: string; members: any[]; lastMessage: any | null; createdAt: string }; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <GroupAvatarStack members={g.members} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[15px] truncate">{g.name}</span>
            <Users className="w-3 h-3 text-primary/50 flex-shrink-0" />
          </div>
          {g.lastMessage && (
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {(() => {
                const d = new Date(g.lastMessage.createdAt);
                if (isToday(d)) return format(d, "HH:mm");
                if (isYesterday(d)) return "Dün";
                return format(d, "dd.MM");
              })()}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {g.lastMessage?.content
            ? `${g.members.find((m: any) => m.id === g.lastMessage.senderId)?.displayName?.split(" ")[0] ?? ""}: ${g.lastMessage.content}`
            : g.members.map((m: any) => m.displayName.split(" ")[0]).join(", ")}
        </p>
      </div>
    </div>
  );
}

// ── Group DM types ────────────────────────────────────────────────────────────
interface DmGroup {
  id: number;
  name: string;
  avatarUrl: string | null;
  createdBy: number;
  createdAt: string;
  members: { id: number; displayName: string; avatarUrl: string | null }[];
  lastMessage: DmGroupMessage | null;
}

interface DmGroupMessage {
  id: number;
  groupId: number;
  senderId: number;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  sender: { id: number; displayName: string; avatarUrl: string | null; username: string } | null;
}

export default function DirectMessages() {
  const { userId, groupId } = useParams<{ userId?: string; groupId?: string }>();
  const [, setLocation] = useLocation();
  const { user: me } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [otherUser, setOtherUser] = useState<DmUser | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Swipe to reply
  const [dmReplyTo, setDmReplyTo] = useState<{ id: number; content: string; displayName: string } | null>(null);
  const [groupReplyTo, setGroupReplyTo] = useState<{ id: number; content: string; displayName: string } | null>(null);
  const swipeTouchStartX = useRef<number>(0);
  const swipeTouchMsgId = useRef<number | null>(null);
  const [swipingMsgId, setSwipingMsgId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice playback state (DM)
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const dmAudioRef = useRef<HTMLAudioElement | null>(null);

  // GIF picker state
  const [gifOpen, setGifOpen] = useState(false);

  // Friendship series state — { msgId: "accepted" | "rejected" | "pending" }
  const [friendshipStatus, setFriendshipStatus] = useState<Record<number, "accepted" | "rejected" | "pending">>({});
  const friendshipKey = userId ? `dm_friendship_${userId}` : null;

  // ── Info paneli & Tema & Kayıtlı Anlar ──────────────────────────────────
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoSection, setInfoSection] = useState<"genel"|"tema"|"anlar"|"medya">("genel");
  const [dmTheme, setDmTheme] = useState<DmTheme>({ bubble: "violet", bgStyle: "none" });
  const [savedMsgsCache, setSavedMsgsCache] = useState<DmMessage[]>([]);
  const [savedMsgIds, setSavedMsgIds] = useState<Set<number>>(new Set());
  const [msgCtxMenu, setMsgCtxMenu] = useState<{ msg: DmMessage; x: number; y: number } | null>(null);
  const msgLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Group DM state ─────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<DmGroup[]>([]);
  const [groupMessages, setGroupMessages] = useState<DmGroupMessage[]>([]);
  const [groupContent, setGroupContent] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const groupScrollRef = useRef<HTMLDivElement>(null);

  // Group media state
  const [groupShowPlusMenu, setGroupShowPlusMenu] = useState(false);
  const [groupGifOpen, setGroupGifOpen] = useState(false);
  const groupFileInputRef = useRef<HTMLInputElement>(null);

  // Group creation dialog
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<Set<number>>(new Set());
  const [newGroupSelectedUsers, setNewGroupSelectedUsers] = useState<any[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState<any[]>([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);

  const openGroupPanel = () => {
    setNewGroupName("");
    setNewGroupMemberIds(new Set());
    setNewGroupSelectedUsers([]);
    setGroupMemberSearch("");
    setGroupSearchResults([]);
    setNewGroupOpen(true);
  };

  const closeGroupPanel = () => {
    setNewGroupOpen(false);
    setNewGroupName("");
    setNewGroupMemberIds(new Set());
    setNewGroupSelectedUsers([]);
    setGroupMemberSearch("");
    setGroupSearchResults([]);
  };

  const toggleGroupMember = (user: any) => {
    const id = user.id;
    setNewGroupMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setNewGroupSelectedUsers(u => u.filter(x => x.id !== id));
      } else {
        next.add(id);
        setNewGroupSelectedUsers(u => [...u, user]);
      }
      return next;
    });
  };

  const searchGroupMembers = async (q: string) => {
    setGroupMemberSearch(q);
    if (!q.trim()) { setGroupSearchResults([]); return; }
    setGroupSearchLoading(true);
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setGroupSearchResults(Array.isArray(data) ? data : []);
    } catch { setGroupSearchResults([]); }
    finally { setGroupSearchLoading(false); }
  };

  // Arama işlemleri global context'ten
  const call = useCall();

  const [activeTab, setActiveTab] = useState<FilterTab>("tumu");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMsgCountRef = useRef(0);
  const isAtGroupBottomRef = useRef(true);
  const prevGroupMsgCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Grup ayarları paneli ──
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupInfoMemberSearch, setGroupInfoMemberSearch] = useState("");
  const [groupInfoMemberResults, setGroupInfoMemberResults] = useState<any[]>([]);
  const [groupInfoMemberSearchLoading, setGroupInfoMemberSearchLoading] = useState(false);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);


  // ── Konuşma kart özellikleri (localStorage) ──
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dm_pinned") || "[]")); } catch { return new Set(); }
  });
  const [favMap, setFavMap] = useState<Map<number, FavEntry>>(() => {
    try { return new Map(JSON.parse(localStorage.getItem("dm_favs2") || "[]")); } catch { return new Map(); }
  });
  const [favEmojiDialogId, setFavEmojiDialogId] = useState<number | null>(null);
  const [mutedMap, setMutedMap] = useState<Map<number, number>>(() => {
    try { return new Map(JSON.parse(localStorage.getItem("dm_muted") || "[]")); } catch { return new Map(); }
  });
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dm_hidden") || "[]")); } catch { return new Set(); }
  });
  const [menuId, setMenuId]           = useState<number | null>(null);
  const [menuPos, setMenuPos]         = useState<{ top: number; right: number } | null>(null);
  const [muteDialogId, setMuteDialogId] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Loop Anlık Fotoğraf (Polaroid) — gerçek API ──────────────────────
  interface LoopPhoto {
    id: number;
    mediaUrl: string;
    createdAt: string;
    viewed: boolean;
    sender: { id: number; displayName: string; avatarUrl: string | null; username: string } | null;
  }
  interface LoopPhotoDetail {
    id: number;
    mediaUrl: string;
    reactions: { emoji: string; user: { id: number; displayName: string; avatarUrl: string | null } | null }[];
    replies: { content: string; user: { id: number; displayName: string; avatarUrl: string | null } | null; createdAt: string }[];
  }

  const [loopPhotos,     setLoopPhotos]     = useState<LoopPhoto[]>([]);
  const [loopViewerOpen, setLoopViewerOpen] = useState(false);
  const [loopViewIdx,    setLoopViewIdx]    = useState(0);
  const [loopViewDetail, setLoopViewDetail] = useState<LoopPhotoDetail | null>(null);
  const [loopViewReply,  setLoopViewReply]  = useState("");
  const [loopShareOpen,  setLoopShareOpen]  = useState(false);
  const [loopSharePreview, setLoopSharePreview] = useState<string | null>(null);
  const [loopShareFile,  setLoopShareFile]  = useState<File | null>(null);
  const [loopSharing,    setLoopSharing]    = useState(false);
  const loopCamRef = useRef<HTMLInputElement>(null);

  const unviewedPhotos = loopPhotos.filter(p => !p.viewed);

  const fetchLoopPhotos = async () => {
    try {
      const res = await fetch("/api/loop/photos", { cache: "no-store" });
      if (res.ok) setLoopPhotos(await res.json());
    } catch { /* silent */ }
  };

  const openLoopViewer = () => {
    if (unviewedPhotos.length === 0) return;
    setLoopViewIdx(0);
    setLoopViewDetail(null);
    setLoopViewReply("");
    setLoopViewerOpen(true);
    loadPhotoDetail(unviewedPhotos[0]!.id);
  };

  const loadPhotoDetail = async (photoId: number) => {
    try {
      const res = await fetch(`/api/loop/photos/${photoId}`, { cache: "no-store" });
      if (res.ok) setLoopViewDetail(await res.json());
    } catch { /* silent */ }
  };

  const markAndAdvance = async () => {
    const photo = unviewedPhotos[loopViewIdx];
    if (photo) {
      // Sunucuda görüldü olarak işaretle
      await fetch(`/api/loop/photos/${photo.id}/view`, { method: "POST" }).catch(() => {});
      setLoopPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, viewed: true } : p));
    }
    if (loopViewIdx < unviewedPhotos.length - 1) {
      const nextIdx = loopViewIdx + 1;
      setLoopViewIdx(nextIdx);
      setLoopViewDetail(null);
      setLoopViewReply("");
      loadPhotoDetail(unviewedPhotos[nextIdx]!.id);
    } else {
      setLoopViewerOpen(false);
      setLoopViewDetail(null);
    }
  };

  const sendLoopReact = async (emoji: string) => {
    const photo = unviewedPhotos[loopViewIdx];
    if (!photo) return;
    await fetch(`/api/loop/photos/${photo.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).catch(() => {});
    loadPhotoDetail(photo.id);
  };

  const sendLoopReply = async () => {
    const photo = unviewedPhotos[loopViewIdx];
    if (!photo || !loopViewReply.trim()) return;
    await fetch(`/api/loop/photos/${photo.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: loopViewReply.trim() }),
    }).catch(() => {});
    setLoopViewReply("");
    loadPhotoDetail(photo.id);
    toast({ title: "Yanıt gönderildi ✨" });
  };

  const handleLoopShareFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoopShareFile(file);
    setLoopSharePreview(URL.createObjectURL(file));
  };

  const submitLoopShare = async () => {
    if (!loopShareFile) return;
    setLoopSharing(true);
    try {
      const fd = new FormData();
      fd.append("file", loopShareFile);
      const res = await fetch("/api/loop/photos", { method: "POST", body: fd });
      if (res.ok) {
        toast({ title: "Anlık fotoğraf paylaşıldı! 📸", description: "Arkadaşların tek seferlik görebilir." });
        setLoopShareOpen(false);
        setLoopSharePreview(null);
        setLoopShareFile(null);
      } else {
        toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
      }
    } finally {
      setLoopSharing(false);
    }
  };

  // ── Düşünce Beğeni sistemi ──────────────────────────────────────────
  interface ThoughtLiker { id: number; displayName: string; avatarUrl: string | null }
  // Kendi thought'ımı beğenenler
  const [myThoughtLikers, setMyThoughtLikers] = useState<ThoughtLiker[]>([]);
  // Arkadaşların thought'larını beğenenler { userId -> likers[] }
  const [friendThoughtLikers, setFriendThoughtLikers] = useState<Map<number, ThoughtLiker[]>>(new Map());
  // Hangi arkadaşın thought'ını beğendim { userId -> boolean }
  const [myLikes, setMyLikes] = useState<Set<number>>(new Set());
  // Thought yanıt sheet
  const [thoughtSheet, setThoughtSheet] = useState<{ userId: number; displayName: string; thought: string; avatarUrl: string | null } | null>(null);
  const [thoughtReply,  setThoughtReply]  = useState("");

  const fetchMyThoughtLikers = async () => {
    if (!me?.id) return;
    try {
      const res = await fetch(`/api/thoughts/${me.id}/likes`, { cache: "no-store" });
      if (res.ok) setMyThoughtLikers(await res.json());
    } catch { /* silent */ }
  };

  const fetchFriendThoughtLikers = async (friendId: number) => {
    try {
      const res = await fetch(`/api/thoughts/${friendId}/likes`, { cache: "no-store" });
      if (res.ok) {
        const likers: ThoughtLiker[] = await res.json();
        setFriendThoughtLikers(prev => new Map(prev).set(friendId, likers));
        // Benim beğeni durumumu güncelle
        if (me?.id && likers.some(l => l.id === me.id)) {
          setMyLikes(prev => new Set([...prev, friendId]));
        }
      }
    } catch { /* silent */ }
  };

  const toggleThoughtLike = async (friendId: number) => {
    const res = await fetch(`/api/thoughts/${friendId}/like`, { method: "POST" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json() as { liked: boolean };
    setMyLikes(prev => {
      const next = new Set(prev);
      data.liked ? next.add(friendId) : next.delete(friendId);
      return next;
    });
    fetchFriendThoughtLikers(friendId);
  };

  const sendThoughtReply = async () => {
    if (!thoughtSheet || !thoughtReply.trim()) return;
    // Düşünce yanıtı = DM olarak gönder
    await fetch(`/api/dm/${thoughtSheet.userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `💭 "${thoughtSheet.thought}"\n\n${thoughtReply.trim()}` }),
    }).catch(() => {});
    setThoughtReply("");
    setThoughtSheet(null);
    toast({ title: "Yanıt gönderildi 💬" });
  };

  const startLongPress = (id: number) => {
    longPressTimer.current = setTimeout(() => {
      setIsSelecting(true);
      setSelectedIds(new Set([id]));
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePin = (id: number) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("dm_pinned", JSON.stringify([...next]));
      return next;
    });
    setMenuId(null);
  };
  const removeFav = (id: number) => {
    setFavMap(prev => {
      const next = new Map(prev);
      next.delete(id);
      localStorage.setItem("dm_favs2", JSON.stringify([...next]));
      return next;
    });
    setMenuId(null);
  };
  const addFav = (id: number, entry: FavEntry) => {
    setFavMap(prev => {
      const next = new Map(prev);
      next.set(id, entry);
      localStorage.setItem("dm_favs2", JSON.stringify([...next]));
      return next;
    });
    setFavEmojiDialogId(null);
    setMenuId(null);
  };
  const muteFor = (id: number, hours: number) => {
    setMutedMap(prev => {
      const next = new Map(prev);
      next.set(id, Date.now() + hours * 3600_000);
      localStorage.setItem("dm_muted", JSON.stringify([...next]));
      return next;
    });
    setMuteDialogId(null);
    setMenuId(null);
  };
  const hideConvs = (ids: Set<number>) => {
    setHiddenIds(prev => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem("dm_hidden", JSON.stringify([...next]));
      return next;
    });
    setSelectedIds(new Set());
    setIsSelecting(false);
    setMenuId(null);
  };

  const THOUGHT_PROMPTS = [
    "Bugün ne düşünüyorsun? 🌙",
    "Nasıl hissediyorsun? 💫",
    "Aklında ne var? ✨",
    "Düşüncelerini Loop diye paylaş :)",
    "Bugün bir şey keşfettin mi? 🔍",
    "Şu an ne dinliyorsun? 🎵",
    "Bugün iyi bir şey oldu mu? 🌸",
    "Neler oluyor hayatında? 💜",
    "Bugün kendini nasıl tanımlarsın? 🌈",
    "Loop'a ne söylemek istersin? 🤍",
  ];
  const [thoughtPlaceholder] = useState(
    () => THOUGHT_PROMPTS[Math.floor(Math.random() * THOUGHT_PROMPTS.length)]
  );

  // Düşünce balonu state — localStorage + server sync
  const [thought, setThought] = useState<string>(() => localStorage.getItem("loop_thought") ?? "");
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thoughtDraft, setThoughtDraft] = useState("");
  const thoughtInputRef = useRef<HTMLTextAreaElement>(null);

  // Server'dan gelen thought ile senkronize et (localStorage yoksa)
  useEffect(() => {
    const serverThought = (me as { thought?: string | null } | null)?.thought;
    if (serverThought && !localStorage.getItem("loop_thought")) {
      setThought(serverThought);
      localStorage.setItem("loop_thought", serverThought);
    }
  }, [me]);

  const openThought = () => {
    setThoughtDraft(thought);
    setThoughtOpen(true);
    setTimeout(() => thoughtInputRef.current?.focus(), 50);
  };
  const saveThought = async () => {
    const val = thoughtDraft.trim();
    setThought(val);
    localStorage.setItem("loop_thought", val);
    setThoughtOpen(false);
    // persist to server so friends can see it
    try {
      await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought: val || null }),
      });
    } catch { /* silent */ }
  };
  const clearThought = async () => {
    setThought("");
    localStorage.removeItem("loop_thought");
    setThoughtOpen(false);
    try {
      await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought: null }),
      });
    } catch { /* silent */ }
  };

  const fetchConversations = async () => {
    const res = await fetch("/api/dm/conversations", { cache: "no-store" });
    if (res.ok) setConversations(await res.json());
  };

  const fetchMessages = async (uid: number) => {
    const res = await fetch(`/api/dm/${uid}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
      const other = data.find((m: DmMessage) => m.senderId !== me?.id);
      if (other?.sender) setOtherUser(other.sender);
    }
  };

  const fetchOtherUser = async (uid: number) => {
    const res = await fetch(`/api/users/${uid}`);
    if (res.ok) {
      const data = await res.json();
      setOtherUser({ id: data.id, username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl });
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/dm/groups", { cache: "no-store" });
      if (res.ok) setGroups(await res.json());
    } catch { /* silent */ }
  };

  const fetchGroupMessages = async (gid: number) => {
    try {
      const res = await fetch(`/api/dm/groups/${gid}/messages`, { cache: "no-store" });
      if (res.ok) setGroupMessages(await res.json());
    } catch { /* silent */ }
  };

  const sendGroupMessage = async () => {
    if (!groupContent.trim() || !groupId) return;
    setGroupSending(true);
    const finalContent = groupReplyTo
      ? `__LOOP_REPLY__:${groupReplyTo.displayName}:${groupReplyTo.content.slice(0, 100)}\n${groupContent}`
      : groupContent;
    setGroupReplyTo(null);
    try {
      const res = await fetch(`/api/dm/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalContent }),
      });
      if (res.ok) {
        setGroupContent("");
        fetchGroupMessages(parseInt(groupId));
        fetchGroups();
      } else {
        toast({ title: "Mesaj gönderilemedi", variant: "destructive" });
      }
    } catch {
      toast({ title: "Mesaj gönderilemedi", variant: "destructive" });
    } finally {
      setGroupSending(false);
    }
  };

  const handleGroupFileUpload = async (file: File) => {
    if (!groupId) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/dm/groups/${groupId}/media`, { method: "POST", body: formData });
      if (res.ok) {
        fetchGroupMessages(parseInt(groupId));
        fetchGroups();
      } else {
        toast({ title: "Hata", description: "Dosya gönderilemedi.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hata", description: "Dosya gönderilemedi.", variant: "destructive" });
    }
  };


  const handleGroupSendGif = async (url: string) => {
    if (!groupId) return;
    setGroupGifOpen(false);
    try {
      const res = await fetch(`/api/dm/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `__LOOP_GIF__:${url}` }),
      });
      if (res.ok) {
        fetchGroupMessages(parseInt(groupId));
        fetchGroups();
      }
    } catch { /* sessiz */ }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMemberIds.size === 0) return;
    setCreatingGroup(true);
    try {
      const memberIds = [...newGroupMemberIds];
      const res = await fetch("/api/dm/groups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), memberIds }),
      });
      const data = await res.json();
      if (res.ok) {
        closeGroupPanel();
        await fetchGroups();
        setLocation(`/dm/group/${data.id}`);
        toast({ title: "Grup oluşturuldu! 🎉" });
      } else {
        toast({ title: "Hata", description: data?.error || "Grup oluşturulamadı.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Bağlantı hatası", description: e?.message, variant: "destructive" });
    } finally {
      setCreatingGroup(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchLoopPhotos();
    fetchGroups();
    if (me?.id) fetchMyThoughtLikers();
    const interval = setInterval(() => {
      fetchConversations();
      fetchLoopPhotos();
      fetchGroups();
      if (me?.id) fetchMyThoughtLikers();
    }, 10000);
    return () => clearInterval(interval);
  }, [me?.id]);

  // Konuşmalar gelince thought likerlarını da çek
  useEffect(() => {
    conversations.forEach(c => {
      if (c.user?.id && c.user.thought) {
        fetchFriendThoughtLikers(c.user.id);
      }
    });
  }, [conversations.map(c => c.user?.id).join(","), me?.id]);

  useEffect(() => {
    if (userId) {
      const uid = parseInt(userId);
      fetchMessages(uid);
      fetchOtherUser(uid);
      const interval = setInterval(() => fetchMessages(uid), 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [userId]);

  // Kullanıcı değişince tema & kayıtlı anları yükle
  useEffect(() => {
    if (!userId) return;
    try {
      const t = JSON.parse(localStorage.getItem(`dm_theme_${userId}`) || "null");
      setDmTheme(t ?? { bubble: "violet", bgStyle: "none" });
    } catch { setDmTheme({ bubble: "violet", bgStyle: "none" }); }
    try {
      const saved: DmMessage[] = JSON.parse(localStorage.getItem(`dm_saved_msgs_${userId}`) || "[]");
      setSavedMsgsCache(saved);
      setSavedMsgIds(new Set(saved.map(m => m.id)));
    } catch { setSavedMsgsCache([]); setSavedMsgIds(new Set()); }
    setShowInfoPanel(false);
    setMsgCtxMenu(null);
  }, [userId]);

  useEffect(() => {
    if (groupId) {
      const gid = parseInt(groupId);
      fetchGroupMessages(gid);
      const interval = setInterval(() => fetchGroupMessages(gid), 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [groupId]);

  // DM: scroll to bottom only when user is already there OR new messages arrived
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const newCount = messages.length;
    const wasAtBottom = isAtBottomRef.current;
    const hasNewMessages = newCount > prevMsgCountRef.current;
    prevMsgCountRef.current = newCount;
    if (wasAtBottom || hasNewMessages) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Group: same logic
  useEffect(() => {
    const el = groupScrollRef.current;
    if (!el) return;
    const newCount = groupMessages.length;
    const wasAtBottom = isAtGroupBottomRef.current;
    const hasNewMessages = newCount > prevGroupMsgCountRef.current;
    prevGroupMsgCountRef.current = newCount;
    if (wasAtBottom || hasNewMessages) {
      el.scrollTop = el.scrollHeight;
    }
  }, [groupMessages]);

  // Friendship status localStorage sync
  useEffect(() => {
    if (!friendshipKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(friendshipKey) ?? "{}");
      setFriendshipStatus(saved);
    } catch { setFriendshipStatus({}); }
  }, [friendshipKey]);

  const respondFriendship = (msgId: number, response: "accepted" | "rejected") => {
    setFriendshipStatus(prev => {
      const next = { ...prev, [msgId]: response };
      if (friendshipKey) localStorage.setItem(friendshipKey, JSON.stringify(next));
      return next;
    });
  };

  const handleSendFriendshipRequest = async () => {
    setShowPlusMenu(false);
    if (!userId || !me) return;
    const newMsgId = Date.now(); // temporary optimistic id
    try {
      const res = await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "__LOOP_FRIENDSHIP__" }),
        credentials: "include",
      });
      if (res.ok) {
        const sent = await res.json();
        setFriendshipStatus(prev => {
          const next = { ...prev, [sent.id]: "pending" as const };
          if (friendshipKey) localStorage.setItem(friendshipKey, JSON.stringify(next));
          return next;
        });
      }
    } catch { /* silent */ void newMsgId; }
  };

  // ── Tema & Kayıtlı Anlar yardımcıları ──────────────────────────────────
  const saveDmTheme = (t: DmTheme) => {
    setDmTheme(t);
    if (userId) localStorage.setItem(`dm_theme_${userId}`, JSON.stringify(t));
  };
  const toggleSaveMsg = (msg: DmMessage) => {
    setSavedMsgsCache(prev => {
      const exists = prev.some(m => m.id === msg.id);
      const next = exists ? prev.filter(m => m.id !== msg.id) : [...prev, msg];
      if (userId) localStorage.setItem(`dm_saved_msgs_${userId}`, JSON.stringify(next));
      setSavedMsgIds(new Set(next.map(m => m.id)));
      return next;
    });
    setMsgCtxMenu(null);
    toast({ title: savedMsgIds.has(msg.id) ? "Anlardan çıkarıldı" : "Ana kayıt edildi ✨", duration: 1500 });
  };
  const getBubbleBg = (): string => {
    const t = BUBBLE_THEMES.find(b => b.id === dmTheme.bubble) ?? BUBBLE_THEMES[0];
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    return isDark ? t.dark : t.light;
  };
  const getBgStyleCss = (): React.CSSProperties => {
    return DM_BG_STYLES.find(s => s.id === dmTheme.bgStyle)?.css ?? {};
  };

  // ── Arama başlat (header'daki telefon/video butonları) ──────────────────
  const handleStartCall = async (type: "voice" | "video") => {
    if (!userId || !otherUser) return;
    try {
      const callId = await call.startCall(type, parseInt(userId), otherUser);
      if (!callId) return;
      const marker = type === "voice"
        ? `__LOOP_CALL_VOICE__:${callId}`
        : `__LOOP_CALL_VIDEO__:${callId}`;
      await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: marker }),
      }).catch(() => {});
      fetchMessages(parseInt(userId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast({ title: "Arama başlatılamadı", description: msg, variant: "destructive" });
    }
  };

  // ── Aramaya katıl (sohbet balonundaki Katıl butonu) ───────────────────
  const handleJoinCall = async (callId: string, type: "voice" | "video") => {
    if (!otherUser) return;
    try {
      await call.joinCall(callId, type, otherUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast({ title: "Aramaya katılınamadı", description: msg, variant: "destructive" });
    }
  };

  const openGifPicker = () => {
    setShowPlusMenu(false);
    setGifOpen(true);
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!userId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: "Mikrofon erişimi reddedildi", variant: "destructive" });
    }
  };

  const handlePlayDmVoice = (msgId: number, voiceUrl: string) => {
    if (playingVoiceId === msgId) {
      dmAudioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }
    if (dmAudioRef.current) dmAudioRef.current.pause();
    const audio = new Audio(voiceUrl);
    dmAudioRef.current = audio;
    audio.play();
    setPlayingVoiceId(msgId);
    audio.onended = () => setPlayingVoiceId(null);
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    const mr = mediaRecorderRef.current;
    if (mr) {
      mediaRecorderRef.current = null;
      try {
        mr.ondataavailable = null;
        mr.onstop = null;
        if (mr.state !== "inactive") mr.stop();
        mr.stream.getTracks().forEach(t => t.stop());
      } catch {}
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !userId) return;
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    const mr = mediaRecorderRef.current;
    const duration = recordingSeconds;
    mediaRecorderRef.current = null;
    const mimeType = mr.mimeType || "audio/webm";
    mr.onstop = async () => {
      mr.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 100) return;
      const formData = new FormData();
      formData.append("file", blob, "voice.webm");
      formData.append("duration", String(duration));
      try {
        const res = await fetch(`/api/dm/${userId}/voice`, { method: "POST", body: formData });
        if (res.ok) {
          fetchMessages(parseInt(userId));
          fetchConversations();
        } else {
          toast({ title: "Sesli mesaj gönderilemedi", variant: "destructive" });
        }
      } catch {
        toast({ title: "Sesli mesaj gönderilemedi", variant: "destructive" });
      }
    };
    if (mr.state !== "inactive") mr.stop();
  };

  const stopGroupRecording = async () => {
    if (!mediaRecorderRef.current || !groupId) return;
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    const mr = mediaRecorderRef.current;
    const duration = recordingSeconds;
    const currentGroupId = groupId;
    mediaRecorderRef.current = null;
    const mimeType = mr.mimeType || "audio/webm";
    mr.onstop = async () => {
      mr.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 100) return;
      const formData = new FormData();
      formData.append("file", blob, "voice.webm");
      formData.append("duration", String(duration));
      try {
        const res = await fetch(`/api/dm/groups/${currentGroupId}/voice`, { method: "POST", body: formData });
        if (res.ok) fetchGroupMessages(parseInt(currentGroupId));
        else toast({ title: "Sesli mesaj gönderilemedi", variant: "destructive" });
      } catch {
        toast({ title: "Sesli mesaj gönderilemedi", variant: "destructive" });
      }
    };
    if (mr.state !== "inactive") mr.stop();
  };

  const handleSendGif = async (url: string) => {
    if (!userId) return;
    setGifOpen(false);
    try {
      await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `__LOOP_GIF__:${url}` }),
      });
      fetchMessages(parseInt(userId));
      fetchConversations();
    } catch { /* sessiz */ }
  };

  const handleSend = async () => {
    if (!content.trim() || !userId) return;
    setSending(true);
    const finalContent = dmReplyTo
      ? `__LOOP_REPLY__:${dmReplyTo.displayName}:${dmReplyTo.content.slice(0, 100)}\n${content}`
      : content;
    setDmReplyTo(null);
    try {
      const res = await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalContent }),
      });
      if (res.ok) {
        setContent("");
        fetchMessages(parseInt(userId));
        fetchConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!userId) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/dm/${userId}/media`, { method: "POST", body: formData });
      if (res.ok) {
        fetchMessages(parseInt(userId));
        fetchConversations();
      }
    } catch {
      toast({ title: "Hata", description: "Dosya gönderilemedi.", variant: "destructive" });
    }
  };

  // ── Group chat view ───────────────────────────────────────────────────────
  if (groupId) {
    const gid = parseInt(groupId);
    const activeGroup = groups.find(g => g.id === gid);

    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
          {/* Header */}
          <div className="flex items-center gap-2 px-2 py-2 bg-background border-b border-border/40 sticky top-0 z-10">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors flex-shrink-0"
              onClick={() => { setShowGroupInfo(false); setActiveTab("gruplar"); setLocation("/dm"); }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {/* Avatar + isim — tıkla, grup bilgisi aç */}
            <button onClick={() => { setShowGroupInfo(v => !v); setGroupNameDraft(activeGroup?.name ?? ""); }} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {activeGroup?.avatarUrl
                  ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" alt="" />
                  : <Users className="w-5 h-5 text-white" />}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[15px] leading-tight truncate block">
                  {activeGroup?.name ?? "Grup"}
                </span>
                {activeGroup && (
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    {activeGroup.members.map(m => m.displayName.split(" ")[0]).join(", ")}
                  </p>
                )}
              </div>
            </button>
            {/* Sesli arama */}
            <button
              onClick={() => { if (activeGroup?.members[0]) call.startCall("voice", activeGroup.members.find(m => m.id !== me?.id)?.id ?? gid, { id: gid, displayName: activeGroup.name, avatarUrl: activeGroup.avatarUrl ?? null } as any); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors flex-shrink-0"
            >
              <Phone className="w-5 h-5" />
            </button>
            {/* Görüntülü arama */}
            <button
              onClick={() => { if (activeGroup?.members[0]) call.startCall("video", activeGroup.members.find(m => m.id !== me?.id)?.id ?? gid, { id: gid, displayName: activeGroup.name, avatarUrl: activeGroup.avatarUrl ?? null } as any); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors flex-shrink-0"
            >
              <Video className="w-5 h-5" />
            </button>
          </div>

          {/* ── Grup bilgi paneli — sağdan kayar ── */}
          {showGroupInfo && activeGroup && (
            <div className="absolute inset-0 z-30 flex">
              <div className="flex-1" onClick={() => setShowGroupInfo(false)} />
              <div
                className="w-[min(320px,90%)] h-full flex flex-col bg-background border-l border-border/50 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40">
                  <button onClick={() => setShowGroupInfo(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60">
                    <X className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm">Grup Bilgisi</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Fotoğraf */}
                  <div className="flex flex-col items-center py-6 gap-2 border-b border-border/40">
                    <button
                      onClick={() => groupPhotoInputRef.current?.click()}
                      className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center group"
                    >
                      {activeGroup.avatarUrl
                        ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" alt="" />
                        : <Users className="w-9 h-9 text-white" />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </button>
                    <input ref={groupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append("photo", file);
                      const r = await fetch(`/api/dm/groups/${gid}/photo`, { method: "POST", body: fd });
                      if (r.ok) { const updated = await r.json(); setGroups(prev => prev.map(g => g.id === gid ? { ...g, avatarUrl: updated.avatarUrl } : g)); }
                    }} />
                    {/* Grup adı */}
                    {editingGroupName ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={groupNameDraft}
                          onChange={e => setGroupNameDraft(e.target.value)}
                          className="border border-primary/40 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none"
                          onKeyDown={async e => {
                            if (e.key === "Enter") {
                              const r = await fetch(`/api/dm/groups/${gid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupNameDraft }) });
                              if (r.ok) { setGroups(prev => prev.map(g => g.id === gid ? { ...g, name: groupNameDraft } : g)); setEditingGroupName(false); }
                            }
                            if (e.key === "Escape") setEditingGroupName(false);
                          }}
                          autoFocus
                        />
                        <button onClick={async () => {
                          const r = await fetch(`/api/dm/groups/${gid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupNameDraft }) });
                          if (r.ok) { setGroups(prev => prev.map(g => g.id === gid ? { ...g, name: groupNameDraft } : g)); setEditingGroupName(false); }
                        }} className="text-xs text-primary font-semibold">Kaydet</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingGroupName(true)} className="font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1">
                        {activeGroup.name}
                        <span className="text-[11px] text-muted-foreground font-normal ml-1">düzenle</span>
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">{activeGroup.members.length} üye</p>
                  </div>

                  {/* Üye listesi */}
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Üyeler</p>
                    {activeGroup.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 py-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
                          {m.avatarUrl ? <img src={m.avatarUrl} className="w-full h-full object-cover" alt={m.displayName} /> : <span className="text-primary font-bold text-sm">{m.displayName.charAt(0)}</span>}
                        </div>
                        <span className="flex-1 text-sm font-medium">{m.displayName}</span>
                        {activeGroup.createdBy === me?.id && m.id !== me?.id && (
                          <button
                            onClick={async () => {
                              const r = await fetch(`/api/dm/groups/${gid}/members/${m.id}`, { method: "DELETE" });
                              if (r.ok) setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: g.members.filter(x => x.id !== m.id) } : g));
                            }}
                            className="text-[11px] text-destructive font-semibold hover:opacity-80 transition-opacity"
                          >Çıkar</button>
                        )}
                      </div>
                    ))}

                    {/* Üye ekle */}
                    {activeGroup.createdBy === me?.id && (
                      <div className="mt-3">
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            value={groupMemberSearch}
                            onChange={async e => {
                              setGroupInfoMemberSearch(e.target.value);
                              if (!e.target.value.trim()) { setGroupInfoMemberResults([]); return; }
                              setGroupInfoMemberSearchLoading(true);
                              try {
                                const r = await fetch(`/api/users/search?q=${encodeURIComponent(e.target.value)}`);
                                const data = await r.json();
                                setGroupInfoMemberResults((Array.isArray(data) ? data : []).filter((u: any) => !activeGroup.members.some(m => m.id === u.id)));
                              } finally { setGroupInfoMemberSearchLoading(false); }
                            }}
                            placeholder="Üye ekle..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/60 text-sm focus:outline-none"
                          />
                        </div>
                        {groupInfoMemberResults.map((u: any) => (
                          <button key={u.id} onClick={async () => {
                            const r = await fetch(`/api/dm/groups/${gid}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id }) });
                            if (r.ok) {
                              setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: [...g.members, { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }] } : g));
                              setGroupInfoMemberResults(prev => prev.filter(x => x.id !== u.id));
                              setGroupInfoMemberSearch("");
                            }
                          }} className="flex items-center gap-2.5 w-full px-2 py-2 hover:bg-muted/60 rounded-xl transition-colors">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
                              {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt={u.displayName} /> : <span className="text-primary text-xs font-bold">{u.displayName?.charAt(0)}</span>}
                            </div>
                            <span className="text-sm">{u.displayName}</span>
                            <span className="ml-auto text-xs text-primary font-semibold">Ekle</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto bg-background px-3 py-2"
            ref={groupScrollRef}
            onScroll={() => {
              const el = groupScrollRef.current;
              if (!el) return;
              isAtGroupBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {groupMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary/40" />
                </div>
                <p className="text-sm font-medium">Henüz mesaj yok</p>
                <p className="text-xs opacity-70">İlk mesajı sen gönder ✨</p>
              </div>
            )}
            {groupMessages.map((msg, idx) => {
              const isMe = msg.senderId === me?.id;
              const next = groupMessages[idx + 1];
              const isLastInRun = !next || next.senderId !== msg.senderId;
              const msgTime = format(new Date(msg.createdAt), "HH:mm");
              const groupMsgPreview = msg.content
                ? msg.content.replace(/^__LOOP_REPLY__:[^\n]+\n/, "").slice(0, 100)
                : msg.mediaUrl ? "Medya" : "";
              return (
                <div key={msg.id} className="relative">
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                    style={{ opacity: swipingMsgId === msg.id ? Math.min(swipeOffset / 48, 1) : 0, transition: swipingMsgId === msg.id ? "none" : "opacity 0.15s" }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${swipeOffset >= 48 && swipingMsgId === msg.id ? "bg-primary/20" : "bg-muted"}`}>
                      <Reply className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className={`relative z-10 flex items-end gap-1.5 ${isLastInRun ? "mb-3" : "mb-0.5"} ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    style={swipingMsgId === msg.id ? { transform: `translateX(${swipeOffset}px)`, transition: "none" } : { transform: "translateX(0)", transition: "transform 0.2s ease" }}
                    onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; swipeTouchMsgId.current = msg.id; setSwipingMsgId(msg.id); setSwipeOffset(0); }}
                    onTouchMove={(e) => { if (swipeTouchMsgId.current !== msg.id) return; const dx = e.touches[0].clientX - swipeTouchStartX.current; if (dx > 4) setSwipeOffset(Math.min(dx, 72)); }}
                    onTouchEnd={() => { if (swipingMsgId === msg.id && swipeOffset >= 48) { setGroupReplyTo({ id: msg.id, content: groupMsgPreview, displayName: msg.sender?.displayName ?? "Kullanıcı" }); if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25); } setSwipingMsgId(null); setSwipeOffset(0); swipeTouchMsgId.current = null; }}
                  >
                  <div className="w-8 flex-shrink-0 self-end">
                    {!isMe && isLastInRun ? (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={msg.sender?.avatarUrl || ""} />
                        <AvatarFallback className="text-[10px] font-bold bg-muted/80">
                          {msg.sender?.displayName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : <div className="w-8" />}
                  </div>
                  <div className={`flex flex-col max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && isLastInRun && (
                      <span className="text-[10px] text-muted-foreground font-medium mb-0.5 ml-1">
                        {msg.sender?.displayName}
                      </span>
                    )}
                    {/* GIF */}
                    {msg.content?.startsWith("__LOOP_GIF__:") ? (
                      <div className="overflow-hidden rounded-[16px] shadow-sm" style={{ maxWidth: 220 }}>
                        <img src={msg.content.slice("__LOOP_GIF__:".length)} alt="GIF" className="w-full h-auto block" loading="lazy" />
                      </div>
                    ) : msg.content?.startsWith("__STORY_REACTION__:") ? (
                      /* Hikaye emoji tepkisi */
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-[16px] ${isMe ? "bg-[#EAE4FF] dark:bg-violet-900/40" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 200 }}>
                        <span className="text-2xl">{msg.content.split(":")[2]}</span>
                        <span className="text-xs text-muted-foreground">hikayene tepki verdi</span>
                      </div>
                    ) : msg.content?.startsWith("__STORY_REPLY__:") ? (
                      /* Hikaye metin yanıtı */
                      <div className={`px-3 py-2 rounded-[16px] ${isMe ? "bg-[#EAE4FF] dark:bg-violet-900/40" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 220 }}>
                        <p className="text-[10px] text-muted-foreground font-medium mb-1">📖 Hikaye yanıtı</p>
                        <p className="text-[14px] text-foreground break-words">{msg.content.split(":").slice(2).join(":")}</p>
                      </div>
                    ) : msg.content?.startsWith("__LOOP_POST_SHARE__:") ? (
                      /* Paylaşılan gönderi kartı — overlay açar */
                      (() => {
                        const parts = msg.content.split(":");
                        const postId = parseInt(parts[1]);
                        const snippet = parts.slice(2).join(":");
                        return (
                          <button onClick={() => setLocation(`/?post=${postId}`)} className={`flex flex-col px-3 py-2.5 rounded-[16px] hover:opacity-90 transition-opacity text-left ${isMe ? "bg-[#EAE4FF] dark:bg-violet-900/40" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 220 }}>
                            <p className="text-[10px] text-primary font-semibold mb-0.5">📎 Gönderi</p>
                            <p className="text-[13px] text-foreground line-clamp-3 break-words">{snippet || "Gönderiyi görüntüle"}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Görüntülemek için dokun</p>
                          </button>
                        );
                      })()
                    ) : msg.content ? (
                      <div
                        className={`px-4 py-2.5 text-[14px] leading-[1.5] break-words whitespace-pre-wrap ${
                          isMe
                            ? "bg-[#EAE4FF] dark:bg-violet-900/40 text-foreground"
                            : "bg-white dark:bg-zinc-800/90 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                        }`}
                        style={{ borderRadius: "18px", overflowWrap: "anywhere" }}
                      >
                        {(() => {
                          const c = msg.content;
                          if (c.startsWith("__LOOP_REPLY__:")) {
                            const wp = c.slice("__LOOP_REPLY__:".length);
                            const nl = wp.indexOf("\n");
                            const header = nl !== -1 ? wp.slice(0, nl) : wp;
                            const actual = nl !== -1 ? wp.slice(nl + 1) : "";
                            const ci = header.indexOf(":");
                            const refName = ci !== -1 ? header.slice(0, ci) : header;
                            const refSnippet = ci !== -1 ? header.slice(ci + 1) : "";
                            return (<><div className={`border-l-2 border-primary/60 pl-2 py-0.5 mb-2 rounded-sm overflow-hidden max-w-full ${isMe ? "bg-[#d8c8ff]/40 dark:bg-violet-700/20" : "bg-muted/50"}`}><p className="text-[10px] font-bold text-primary leading-none truncate">{refName}</p><p className="text-[10px] text-muted-foreground leading-snug mt-0.5 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{refSnippet}</p></div>{actual}</>);
                          }
                          return c;
                        })()}
                      </div>
                    ) : null}
                    {/* Image / Video */}
                    {msg.mediaUrl && (
                      <div className="overflow-hidden rounded-[16px] shadow-sm" style={{ maxWidth: 220 }}>
                        {msg.mediaType === "video"
                          ? <video src={msg.mediaUrl} controls className="w-full block" />
                          : <img src={msg.mediaUrl} alt="medya" className="w-full h-auto block" />
                        }
                      </div>
                    )}
                    {isLastInRun && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">{msgTime}</span>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="relative">
            {/* Reply preview bar — group */}
            {groupReplyTo && (
              <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center gap-3">
                <div className="w-0.5 h-9 bg-primary rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary truncate leading-tight">{groupReplyTo.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate leading-tight">{groupReplyTo.content}</p>
                </div>
                <button onClick={() => setGroupReplyTo(null)} className="text-muted-foreground p-1 hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* GIF picker — grup */}
            {groupGifOpen && (
              <GifPicker
                onSelect={(url) => { handleGroupSendGif(url); setGroupGifOpen(false); }}
                onClose={() => setGroupGifOpen(false)}
              />
            )}

            {/* + popup menü */}
            {groupShowPlusMenu && (
              <>
                <div className="absolute inset-x-0 bottom-full z-20" onClick={() => setGroupShowPlusMenu(false)} />
                <div className="absolute bottom-[calc(100%+8px)] left-3 z-30 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden w-44 animate-in slide-in-from-bottom-2">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={() => { setGroupShowPlusMenu(false); groupFileInputRef.current?.click(); }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ImagePlus className="w-4 h-4 text-primary" />
                    </div>
                    Görüntü
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={() => { setGroupShowPlusMenu(false); setGroupGifOpen(true); }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
                      <span className="text-pink-500 text-[11px] font-black tracking-tight">GIF</span>
                    </div>
                    GIF
                  </button>
                </div>
              </>
            )}

            <div className="border-t border-border/40 bg-background/95 backdrop-blur-sm px-3 py-2.5">
              <input ref={groupFileInputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleGroupFileUpload(f); e.target.value = ""; }} />
              <div className="flex items-center gap-2">
                {isRecording ? (
                  /* ── Grup kayıt modu ── */
                  <>
                    <button
                      onClick={cancelRecording}
                      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 hover:bg-muted/70 active:scale-95 transition-all"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div className="flex-1 flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-full px-4 h-10">
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                      <span className="text-sm font-semibold text-red-500 tabular-nums min-w-[2.2rem]">
                        {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                      </span>
                      <div className="flex items-center gap-[3px] flex-1">
                        {[0.6,1,0.75,1,0.5,0.85,1,0.65,0.9,0.7].map((h, i) => (
                          <span key={i} className="rounded-full bg-red-400/70 flex-shrink-0 animate-pulse"
                            style={{ width: 3, height: `${h * 18}px`, animationDelay: `${i * 80}ms` }} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">Kayıt yapılıyor</span>
                    </div>
                    <button
                      onClick={stopGroupRecording}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : (
                  /* ── Normal grup modu ── */
                  <>
                    {/* + butonu */}
                    <button
                      onClick={() => { setGroupShowPlusMenu(v => !v); setGroupGifOpen(false); }}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <span className="text-primary-foreground text-[22px] font-light leading-none" style={{ marginTop: -2 }}>+</span>
                    </button>
                    <div className="flex-1 flex items-center bg-muted/50 rounded-full px-4 h-10 border border-border/30">
                      <input
                        value={groupContent}
                        onChange={e => { setGroupContent(e.target.value); if (groupShowPlusMenu) setGroupShowPlusMenu(false); }}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGroupMessage(); } }}
                        placeholder="Mesaj yaz…"
                        className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    {groupContent.trim() ? (
                      <button
                        onClick={sendGroupMessage}
                        disabled={!groupContent.trim() || groupSending}
                        className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
                      >
                        <Send className="w-4 h-4 text-white" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={startRecording}
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                        <button
                          onClick={sendGroupMessage}
                          disabled={!groupContent.trim() || groupSending}
                          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
                        >
                          <Send className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────
  if (userId) {
    // Mesajları tarihe göre grupla
    type MsgGroup = { dateLabel: string; messages: DmMessage[] };
    const grouped: MsgGroup[] = [];
    messages.forEach(msg => {
      const d = new Date(msg.createdAt);
      const label = isToday(d) ? "Bugün" : isYesterday(d) ? "Dün" : format(d, "d MMMM", { locale: tr });
      const last = grouped[grouped.length - 1];
      if (last && last.dateLabel === label) last.messages.push(msg);
      else grouped.push({ dateLabel: label, messages: [msg] });
    });

    // İlk okunmamış mesajın indexi (karşıdan gelen)
    const firstUnreadIdx = messages.findIndex(m => m.senderId !== me?.id && !m.isRead);

    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">

          {/* ── Header ── */}
          <div className="flex items-center gap-2 px-2 py-2 bg-background border-b border-border/40 sticky top-0 z-10">
            {/* Geri */}
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors flex-shrink-0"
              onClick={() => setLocation("/dm")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar + İsim */}
            {otherUser && (
              <button
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                onClick={() => setLocation(`/profile/${otherUser.id}`)}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherUser.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {otherUser.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[15px] leading-tight truncate">{otherUser.displayName}</span>
                    <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-green-500 font-semibold leading-tight">Çevrimiçi</p>
                </div>
              </button>
            )}

            {/* Sağ aksiyonlar */}
            <div className="flex items-center flex-shrink-0">
              <button
                onClick={() => handleStartCall("voice")}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors text-primary"
              >
                <Phone style={{ width: 18, height: 18 }} />
              </button>
              <button
                onClick={() => handleStartCall("video")}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors text-primary"
              >
                <Video style={{ width: 20, height: 20 }} />
              </button>
              <button
                onClick={() => { setShowInfoPanel(true); setInfoSection("genel"); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors text-primary"
              >
                <Info style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>

          {/* ── Mesajlar ── */}
          <div
            className="flex-1 overflow-y-auto bg-background"
            ref={scrollRef}
            style={getBgStyleCss()}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            <div className="px-3 py-2">

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-primary/40" />
                  </div>
                  <p className="text-sm font-medium">Henüz mesaj yok</p>
                  <p className="text-xs text-muted-foreground/60">İlk mesajı sen gönder ✨</p>
                </div>
              )}

              {grouped.map(group => (
                <div key={group.dateLabel}>
                  {/* Tarih bölücü */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[11px] text-muted-foreground font-medium">{group.dateLabel}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  {group.messages.map((msg, idx) => {
                    const isMe = msg.senderId === me?.id;
                    const nextMsg = group.messages[idx + 1];
                    const isLastInRun = !nextMsg || nextMsg.senderId !== msg.senderId;
                    const msgTime = format(new Date(msg.createdAt), "HH:mm");
                    const globalIdx = messages.indexOf(msg);
                    const showUnread = firstUnreadIdx !== -1 && globalIdx === firstUnreadIdx;

                    // WhatsApp tik mantığı: isRead → ✓✓ mor, değilse → ✓ gri
                    const tickEl = isMe ? (
                      msg.isRead
                        ? <span className="text-[12px] text-primary font-bold leading-none">✓✓</span>
                        : <span className="text-[12px] text-muted-foreground/60 leading-none">✓</span>
                    ) : null;

                    const dmMsgPreview = msg.content
                      ? msg.content.replace(/^__LOOP_REPLY__:[^\n]+\n/, "").slice(0, 100)
                      : msg.mediaUrl ? "Medya" : msg.voiceUrl ? "Sesli mesaj" : "";
                    return (
                      <div key={msg.id} className="relative">
                        {/* Reply icon (fixed, revealed behind sliding row) */}
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                          style={{ opacity: swipingMsgId === msg.id ? Math.min(swipeOffset / 48, 1) : 0, transition: swipingMsgId === msg.id ? "none" : "opacity 0.15s" }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${swipeOffset >= 48 && swipingMsgId === msg.id ? "bg-primary/20" : "bg-muted"}`}>
                            <Reply className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        {showUnread && (
                          <div className="flex items-center gap-2 my-4">
                            <div className="flex-1 h-px bg-muted-foreground/20" />
                            <span className="text-[11px] text-muted-foreground/70 font-medium">
                              — {messages.filter(m => m.senderId !== me?.id && !m.isRead).length} okunmamış mesaj —
                            </span>
                            <div className="flex-1 h-px bg-muted-foreground/20" />
                          </div>
                        )}

                        {/* Satır: avatar + (balon + saat/tik altında) */}
                        <div className={`relative z-10 flex items-end gap-1.5 ${isLastInRun ? "mb-3" : "mb-0.5"} ${isMe ? "flex-row-reverse" : "flex-row"}`}
                          style={swipingMsgId === msg.id ? { transform: `translateX(${swipeOffset}px)`, transition: "none" } : { transform: "translateX(0)", transition: "transform 0.2s ease" }}
                          onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; swipeTouchMsgId.current = msg.id; setSwipingMsgId(msg.id); setSwipeOffset(0); }}
                          onTouchMove={(e) => { if (swipeTouchMsgId.current !== msg.id) return; const dx = e.touches[0].clientX - swipeTouchStartX.current; if (dx > 4) setSwipeOffset(Math.min(dx, 72)); }}
                          onTouchEnd={() => { if (swipingMsgId === msg.id && swipeOffset >= 48) { const dn = msg.senderId === me?.id ? (me?.displayName ?? "Sen") : (msg.sender?.displayName ?? "Kullanıcı"); setDmReplyTo({ id: msg.id, content: dmMsgPreview, displayName: dn }); if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25); } setSwipingMsgId(null); setSwipeOffset(0); swipeTouchMsgId.current = null; }}
                        >

                          {/* Avatar — karşı taraf, serinin son mesajı */}
                          <div className="w-8 flex-shrink-0 self-end">
                            {!isMe && isLastInRun ? (
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={msg.sender?.avatarUrl || ""} />
                                <AvatarFallback className="text-[10px] font-bold bg-muted/80">
                                  {msg.sender?.displayName?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="w-8" />
                            )}
                          </div>

                          {/* Balon + saat-tik altında */}
                          <div
                            className={`flex flex-col max-w-[68%] ${isMe ? "items-end" : "items-start"} relative`}
                            onContextMenu={(e) => { e.preventDefault(); setMsgCtxMenu({ msg, x: e.clientX, y: e.clientY }); }}
                            onTouchStart={(e) => {
                              const sx = e.touches[0].clientX; const sy = e.touches[0].clientY;
                              if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current);
                              msgLongPressRef.current = setTimeout(() => { msgLongPressRef.current = null; setMsgCtxMenu({ msg, x: sx, y: sy }); if (navigator.vibrate) navigator.vibrate(20); }, 600);
                            }}
                            onTouchEnd={() => { if (msgLongPressRef.current) { clearTimeout(msgLongPressRef.current); msgLongPressRef.current = null; } }}
                            onTouchMove={() => { if (msgLongPressRef.current) { clearTimeout(msgLongPressRef.current); msgLongPressRef.current = null; } }}
                          >
                            {/* Kayıtlı an rozeti */}
                            {savedMsgIds.has(msg.id) && (
                              <div className={`absolute -top-1 z-20 ${isMe ? "-left-5" : "-right-5"}`}>
                                <Bookmark className="w-3.5 h-3.5 text-primary fill-primary drop-shadow-sm" />
                              </div>
                            )}
                            {msg.content && (() => {
                              const voiceMatch = msg.content.match(/^__LOOP_CALL_VOICE__(?::(.+))?$/);
                              const videoMatch = msg.content.match(/^__LOOP_CALL_VIDEO__(?::(.+))?$/);
                              const isCallMsg  = !!(voiceMatch || videoMatch);

                              if (isCallMsg) {
                                const callType  = voiceMatch ? "voice" : "video" as "voice" | "video";
                                const callId    = (voiceMatch?.[1] ?? videoMatch?.[1]) ?? "";
                                const callIcon  = callType === "voice"
                                  ? <Phone className="w-5 h-5" />
                                  : <Video className="w-5 h-5" />;
                                const callLabel = callType === "voice" ? "Sesli Arama" : "Görüntülü Arama";
                                return (
                                  <div
                                    className={`flex items-center gap-3 px-4 py-3 min-w-[200px] ${isMe ? "" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`}
                                    style={{ borderRadius: "18px", ...(isMe ? { background: getBubbleBg() } : {}) }}
                                  >
                                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-primary">
                                      {callIcon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-foreground leading-tight">{callLabel}</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                        {isMe ? "Başlattın" : "Seni arıyor"}
                                      </p>
                                    </div>
                                    {!isMe && callId && (
                                      <button
                                        onClick={() => handleJoinCall(callId, callType)}
                                        className="flex-shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary/90 active:scale-95 transition-all"
                                      >
                                        Katıl
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              // Arkadaşlık Serisi teklifi
                              if (msg.content === "__LOOP_FRIENDSHIP__") {
                                const status = friendshipStatus[msg.id];
                                const canRespond = !isMe && !status;
                                return (
                                  <div className="flex flex-col items-center select-none" style={{ maxWidth: 220 }}>
                                    {/* Köpek görseli */}
                                    <div className="relative">
                                      <img
                                        src="/friendship-pup.png"
                                        alt="Arkadaşlık köpeği"
                                        className="w-44 h-44 object-contain drop-shadow-xl"
                                        style={{ filter: "drop-shadow(0 8px 24px rgba(251,191,36,0.35))" }}
                                      />
                                      {/* Parlayan halka efekti */}
                                      <div className="absolute inset-0 rounded-full pointer-events-none animate-ping opacity-10"
                                        style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)", animationDuration: "2.5s" }} />
                                    </div>

                                    {/* Animasyonlu levha */}
                                    <div
                                      className="relative -mt-3 w-[210px] rounded-2xl border-2 border-amber-400/60 shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-2"
                                      style={{
                                        background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)",
                                        boxShadow: "0 4px 20px rgba(251,191,36,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
                                      }}
                                    >
                                      {/* Üst dekorasyon şeridi */}
                                      <div className="h-1.5 w-full" style={{ background: "repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 8px, #fbbf24 8px, #fbbf24 16px)" }} />

                                      <div className="px-4 py-3 text-center">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-amber-600/70 mb-0.5">🐾 Teklif</p>
                                        <p className="text-sm font-black text-amber-900 leading-snug">
                                          {isMe ? "Arkadaşlık Serisi" : `${otherUser?.displayName ?? "Biri"} Arkadaşlık`}
                                        </p>
                                        <p className="text-[11px] text-amber-700/80 font-medium mt-0.5">
                                          {isMe ? "Teklifin gönderildi 🐕" : "Seriye davet ediyor!"}
                                        </p>

                                        {/* Durum / Butonlar */}
                                        {status === "accepted" && (
                                          <div className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300">
                                            <span className="text-sm">🎉</span>
                                            <span className="text-xs font-bold text-emerald-700">Kabul Edildi!</span>
                                          </div>
                                        )}
                                        {status === "rejected" && (
                                          <div className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
                                            <span className="text-sm">😔</span>
                                            <span className="text-xs font-bold text-rose-500">Reddedildi</span>
                                          </div>
                                        )}
                                        {(status === "pending" || (isMe && !status)) && (
                                          <div className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300">
                                            <span className="text-xs">⏳</span>
                                            <span className="text-xs font-bold text-amber-700">Yanıt bekleniyor…</span>
                                          </div>
                                        )}
                                        {canRespond && (
                                          <div className="mt-3 flex gap-2">
                                            <button
                                              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm"
                                              style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", boxShadow: "0 2px 8px rgba(16,185,129,0.4)" }}
                                              onClick={() => respondFriendship(msg.id, "accepted")}
                                            >
                                              <span>✅</span> Kabul Et
                                            </button>
                                            <button
                                              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm"
                                              style={{ background: "linear-gradient(135deg,#f87171,#ef4444)", color: "#fff", boxShadow: "0 2px 8px rgba(239,68,68,0.4)" }}
                                              onClick={() => respondFriendship(msg.id, "rejected")}
                                            >
                                              <span>❌</span> Reddet
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Alt dekorasyon şeridi */}
                                      <div className="h-1.5 w-full" style={{ background: "repeating-linear-gradient(90deg, #fbbf24 0px, #fbbf24 8px, #f59e0b 8px, #f59e0b 16px)" }} />
                                    </div>
                                  </div>
                                );
                              }

                              // GIF mesajı
                              if (msg.content?.startsWith("__LOOP_GIF__:")) {
                                const gifUrl = msg.content.slice("__LOOP_GIF__:".length);
                                return (
                                  <div className="overflow-hidden rounded-[16px] shadow-sm" style={{ maxWidth: 220 }}>
                                    <img src={gifUrl} alt="GIF" className="w-full h-auto block" loading="lazy" />
                                  </div>
                                );
                              }

                              // Hikaye emoji tepkisi
                              if (msg.content?.startsWith("__STORY_REACTION__:")) {
                                const emoji = msg.content.split(":")[2] ?? "❤️";
                                return (
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-[16px] ${isMe ? "" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 200, ...(isMe ? { background: getBubbleBg() } : {}) }}>
                                    <span className="text-2xl">{emoji}</span>
                                    <span className="text-xs text-muted-foreground">hikayene tepki verdi</span>
                                  </div>
                                );
                              }

                              // Hikaye metin yanıtı
                              if (msg.content?.startsWith("__STORY_REPLY__:")) {
                                const text = msg.content.split(":").slice(2).join(":");
                                return (
                                  <div className={`px-3 py-2 rounded-[16px] ${isMe ? "" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 220, ...(isMe ? { background: getBubbleBg() } : {}) }}>
                                    <p className="text-[10px] text-muted-foreground font-medium mb-1">📖 Hikaye yanıtı</p>
                                    <p className="text-[14px] text-foreground break-words">{text}</p>
                                  </div>
                                );
                              }

                              // Paylaşılan gönderi kartı — overlay açar
                              if (msg.content?.startsWith("__LOOP_POST_SHARE__:")) {
                                const parts = msg.content.split(":");
                                const postId = parseInt(parts[1]);
                                const snippet = parts.slice(2).join(":");
                                return (
                                  <button onClick={() => setLocation(`/?post=${postId}`)} className={`flex flex-col px-3 py-2.5 rounded-[16px] hover:opacity-90 transition-opacity text-left ${isMe ? "" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`} style={{ maxWidth: 220, ...(isMe ? { background: getBubbleBg() } : {}) }}>
                                    <p className="text-[10px] text-primary font-semibold mb-0.5">📎 Gönderi</p>
                                    <p className="text-[13px] text-foreground line-clamp-3 break-words">{snippet || "Gönderiyi görüntüle"}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Görüntülemek için dokun</p>
                                  </button>
                                );
                              }

                              return (
                                <div
                                  className={`px-4 py-2.5 text-[14px] leading-[1.5] break-words whitespace-pre-wrap ${isMe ? "text-foreground" : "bg-white dark:bg-zinc-800/90 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"}`}
                                  style={{ borderRadius: "18px", overflowWrap: "anywhere", ...(isMe ? { background: getBubbleBg() } : {}) }}
                                >
                                  {(() => {
                                    const c = msg.content ?? "";
                                    if (c.startsWith("__LOOP_REPLY__:")) {
                                      const wp = c.slice("__LOOP_REPLY__:".length);
                                      const nl = wp.indexOf("\n");
                                      const header = nl !== -1 ? wp.slice(0, nl) : wp;
                                      const actual = nl !== -1 ? wp.slice(nl + 1) : "";
                                      const ci = header.indexOf(":");
                                      const refName = ci !== -1 ? header.slice(0, ci) : header;
                                      const refSnippet = ci !== -1 ? header.slice(ci + 1) : "";
                                      return (<><div className={`border-l-2 border-primary/60 pl-2 py-0.5 mb-2 rounded-sm ${isMe ? "bg-[#d8c8ff]/40 dark:bg-violet-700/20" : "bg-muted/50"}`}><p className="text-[10px] font-bold text-primary leading-tight">{refName}</p><p className="text-[10px] text-muted-foreground truncate leading-tight">{refSnippet}</p></div>{actual}</>);
                                    }
                                    return c;
                                  })()}
                                </div>
                              );
                            })()}
                            {msg.mediaUrl && (
                              <div className="overflow-hidden rounded-[16px] shadow-sm" style={{ maxWidth: 220 }}>
                                {msg.mediaType === "video"
                                  ? <video src={msg.mediaUrl} controls className="w-full block" />
                                  : <img src={msg.mediaUrl} alt="medya" className="w-full h-auto block" />
                                }
                              </div>
                            )}
                            {/* Sesli mesaj balonu */}
                            {msg.voiceUrl && (
                              <button
                                onClick={() => handlePlayDmVoice(msg.id, msg.voiceUrl!)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-[18px] shadow-sm transition-colors text-foreground ${
                                  isMe ? "rounded-br-md hover:opacity-90" : "bg-white dark:bg-zinc-800/90 shadow-[0_1px_4px_rgba(0,0,0,0.08)] rounded-bl-md hover:bg-muted/60"
                                }`}
                                style={{ minWidth: 180, ...(isMe ? { background: getBubbleBg() } : {}) }}
                              >
                                {playingVoiceId === msg.id ? (
                                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                                    <div className="w-3 h-3 rounded-sm bg-primary" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-primary border-b-[6px] border-b-transparent ml-0.5" />
                                  </div>
                                )}
                                <div className="flex gap-0.5 items-center h-5 flex-1">
                                  {Array(16).fill(0).map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-0.5 rounded-full transition-all ${playingVoiceId === msg.id ? "bg-primary animate-pulse" : "bg-primary/50"}`}
                                      style={{ height: `${22 + Math.sin(i * 0.9 + 1) * 65}%` }}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                                  {msg.voiceDuration ? `${msg.voiceDuration}s` : "🎤"}
                                </span>
                              </button>
                            )}
                            {/* Saat + tik — balonun altında */}
                            {isLastInRun && (
                              <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                <span className="text-[11px] text-muted-foreground/60 leading-none">{msgTime}</span>
                                {tickEl}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

            </div>
          </div>

          {/* ── Input Bar ── */}
          <div className="relative">
            {/* Reply preview bar — 1:1 DM */}
            {dmReplyTo && (
              <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center gap-3">
                <div className="w-0.5 h-9 bg-primary rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary truncate leading-tight">{dmReplyTo.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate leading-tight">{dmReplyTo.content}</p>
                </div>
                <button onClick={() => setDmReplyTo(null)} className="text-muted-foreground p-1 hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* GIF picker — 1:1 DM */}
            {gifOpen && (
              <GifPicker
                onSelect={(url) => { handleSendGif(url); setGifOpen(false); }}
                onClose={() => setGifOpen(false)}
              />
            )}

            {/* + popup menü */}
            {showPlusMenu && (
              <>
                <div className="absolute inset-x-0 bottom-full z-20" onClick={() => setShowPlusMenu(false)} />
                <div className="absolute bottom-[calc(100%+8px)] left-3 z-30 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden w-44 animate-in slide-in-from-bottom-2">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={() => { setShowPlusMenu(false); fileInputRef.current?.click(); }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ImagePlus className="w-4 h-4 text-primary" />
                    </div>
                    Görüntü
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={openGifPicker}
                  >
                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
                      <span className="text-pink-500 text-[11px] font-black tracking-tight">GIF</span>
                    </div>
                    GIF
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={() => { setShowPlusMenu(false); toast({ title: "Sticker yakında geliyor 🎨" }); }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                      <span className="text-lg">😊</span>
                    </div>
                    Sticker
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors"
                    onClick={handleSendFriendshipRequest}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-400/15 flex items-center justify-center overflow-hidden">
                      <img src="/friendship-pup.png" alt="pup" className="w-full h-full object-cover scale-110" />
                    </div>
                    <span className="leading-tight">Arkadaşlık<br /><span className="text-[11px] text-muted-foreground font-normal">Serisi Teklifi</span></span>
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 px-3 py-2.5 bg-background border-t border-border/40">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />

              {isRecording ? (
                /* ── Kayıt modu — tam input bar'ı kaplar ── */
                <>
                  {/* İptal */}
                  <button
                    onClick={cancelRecording}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 hover:bg-muted/70 active:scale-95 transition-all"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Kayıt göstergesi */}
                  <div className="flex-1 flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-full px-4 h-10">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                    <span className="text-sm font-semibold text-red-500 tabular-nums min-w-[2.2rem]">
                      {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                    </span>
                    {/* Dalga animasyonu */}
                    <div className="flex items-center gap-[3px] flex-1">
                      {[0.6,1,0.75,1,0.5,0.85,1,0.65,0.9,0.7].map((h, i) => (
                        <span key={i} className="rounded-full bg-red-400/70 flex-shrink-0 animate-pulse"
                          style={{ width: 3, height: `${h * 18}px`, animationDelay: `${i * 80}ms` }} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">Kayıt yapılıyor</span>
                  </div>

                  {/* Gönder */}
                  <button
                    onClick={stopRecording}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4 text-primary-foreground" />
                  </button>
                </>
              ) : (
                /* ── Normal mod ── */
                <>
                  {/* + butonu */}
                  <button
                    onClick={() => setShowPlusMenu(v => !v)}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <span className="text-primary-foreground text-[22px] font-light leading-none" style={{ marginTop: -2 }}>+</span>
                  </button>

                  {/* Yazı alanı */}
                  <div className="flex-1 flex items-center bg-muted/50 rounded-full px-4 h-10 border border-border/30">
                    <input
                      value={content}
                      onChange={e => { setContent(e.target.value); if (showPlusMenu) setShowPlusMenu(false); }}
                      onKeyDown={e => e.key === "Enter" && handleSend()}
                      placeholder="Mesaj yaz..."
                      className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>

                  {/* Sağ butonlar */}
                  {content.trim() ? (
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4 text-primary-foreground" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground">
                        <Smile className="w-5 h-5" />
                      </button>
                      <button
                        onClick={startRecording}
                        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted text-muted-foreground"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* ── Mesaj Bağlam Menüsü ── */}
        {msgCtxMenu !== null && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setMsgCtxMenu(null)} />
            <div
              className="fixed z-[71] bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden min-w-[180px] animate-in fade-in-0 zoom-in-95"
              style={{
                left: Math.min(msgCtxMenu.x, window.innerWidth - 196),
                top: Math.min(msgCtxMenu.y, window.innerHeight - 200),
              }}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors text-left"
                onClick={() => {
                  const m = msgCtxMenu.msg;
                  const dn = m.senderId === me?.id ? (me?.displayName ?? "Sen") : (m.sender?.displayName ?? "Kullanıcı");
                  const preview = m.content ? m.content.replace(/^__LOOP_REPLY__:[^\n]+\n/, "").slice(0, 100) : m.mediaUrl ? "Medya" : m.voiceUrl ? "Sesli mesaj" : "";
                  setDmReplyTo({ id: m.id, content: preview, displayName: dn });
                  setMsgCtxMenu(null);
                }}
              >
                <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Reply className="w-3.5 h-3.5 text-primary" />
                </div>
                Yanıtla
              </button>
              <div className="h-px bg-border/40 mx-3" />
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors text-left"
                onClick={() => toggleSaveMsg(msgCtxMenu.msg)}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${savedMsgIds.has(msgCtxMenu.msg.id) ? "bg-primary/15" : "bg-muted"}`}>
                  <Bookmark className={`w-3.5 h-3.5 ${savedMsgIds.has(msgCtxMenu.msg.id) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                </div>
                {savedMsgIds.has(msgCtxMenu.msg.id) ? "Anlardan Çıkar" : "Ana Kaydet ✨"}
              </button>
              {msgCtxMenu.msg.content && !msgCtxMenu.msg.content.startsWith("__") && (
                <>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors text-left"
                    onClick={() => {
                      navigator.clipboard?.writeText(msgCtxMenu.msg.content ?? "").catch(() => {});
                      setMsgCtxMenu(null);
                      toast({ title: "Kopyalandı", duration: 1500 });
                    }}
                  >
                    <div className="w-7 h-7 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    Kopyala
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Info Paneli ── */}
        {showInfoPanel && otherUser && (
          <div className="fixed inset-0 z-[60] flex">
            <div className="flex-1 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowInfoPanel(false)} />
            <div className="w-[88vw] max-w-sm h-full bg-card shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-300 overflow-hidden">

              {/* Panel başlık */}
              <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border/40 flex-shrink-0">
                <button
                  onClick={() => setShowInfoPanel(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="font-bold text-base">Kişi Detayları</p>
              </div>

              {/* Kişi kartı */}
              <div className="flex flex-col items-center px-6 pt-6 pb-4 gap-3 flex-shrink-0">
                <Avatar className="w-20 h-20 border-4 border-background shadow-md">
                  <AvatarImage src={otherUser.avatarUrl || ""} />
                  <AvatarFallback className="text-2xl font-black bg-gradient-to-br from-primary/20 to-violet-400/30 text-primary">
                    {otherUser.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <p className="font-black text-xl leading-tight">{otherUser.displayName}</p>
                    <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">@{otherUser.username}</p>
                </div>
                <button
                  onClick={() => { setShowInfoPanel(false); setLocation(`/profile/${otherUser.id}`); }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border/60 text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Profili Gör
                </button>
              </div>

              {/* Sekme navigasyonu */}
              <div className="flex gap-1 px-4 pb-3 flex-shrink-0 overflow-x-auto">
                {(["genel", "tema", "anlar", "medya"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setInfoSection(tab)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                      infoSection === tab
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab === "genel" ? "Genel" : tab === "tema" ? "Tema 🎨" : tab === "anlar" ? `Anlar ${savedMsgsCache.length > 0 ? `(${savedMsgsCache.length})` : ""}` : "Medya"}
                  </button>
                ))}
              </div>

              {/* Sekme içeriği */}
              <div className="flex-1 overflow-y-auto px-4 pb-8">

                {/* ── Genel ── */}
                {infoSection === "genel" && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-2xl border border-border/40 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => {
                          const uid = otherUser.id;
                          const isFav = favMap.has(uid);
                          if (isFav) { removeFav(uid); toast({ title: "Favorilerden çıkarıldı", duration: 1500 }); }
                          else { setShowInfoPanel(false); setFavEmojiDialogId(uid); }
                        }}
                      >
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                          <Heart className={`w-4 h-4 ${favMap.has(otherUser.id) ? "text-rose-500 fill-rose-500" : "text-rose-500"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{favMap.has(otherUser.id) ? "Favorilerden Çıkar" : "Favorilere Ekle"}</p>
                          <p className="text-xs text-muted-foreground">Özel neon çerçeve ve emoji</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                      <div className="h-px bg-border/30 mx-4" />
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => { setShowInfoPanel(false); setInfoSection("tema"); setTimeout(() => setShowInfoPanel(true), 0); setInfoSection("tema"); }}
                      >
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <Palette className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">Sohbet Temasını Düzenle</p>
                          <p className="text-xs text-muted-foreground">Balon rengi ve arka plan</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                      <div className="h-px bg-border/30 mx-4" />
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => setInfoSection("anlar")}
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <Bookmark className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">Kayıtlı Anlar</p>
                          <p className="text-xs text-muted-foreground">{savedMsgsCache.length > 0 ? `${savedMsgsCache.length} an kayıtlı` : "Henüz kaydedilen an yok"}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    </div>

                    {/* Bildirim / Sessize Al */}
                    <div className="rounded-2xl border border-border/40 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => { setShowInfoPanel(false); setMuteDialogId(otherUser.id); }}
                      >
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <BellOff className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            {mutedMap.has(otherUser.id) && mutedMap.get(otherUser.id)! > Date.now() ? "Sessize Alındı" : "Sessize Al"}
                          </p>
                          <p className="text-xs text-muted-foreground">Bildirim ayarları</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    </div>

                    {/* Tehlikeli Bölge */}
                    <div className="rounded-2xl border border-destructive/20 overflow-hidden mt-2">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
                        onClick={() => toast({ title: "Engelleme yakında geliyor 🔒", duration: 2000 })}
                      >
                        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                          <ShieldOff className="w-4 h-4 text-destructive" />
                        </div>
                        <p className="text-sm font-semibold text-destructive">Engelle</p>
                      </button>
                      <div className="h-px bg-destructive/10 mx-4" />
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
                        onClick={() => toast({ title: "Şikayet gönderildi", duration: 2000 })}
                      >
                        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                          <Flag className="w-4 h-4 text-destructive" />
                        </div>
                        <p className="text-sm font-semibold text-destructive">Şikayet Et</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Tema ── */}
                {infoSection === "tema" && (
                  <div className="flex flex-col gap-5">
                    {/* Balon rengi */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Mesaj Balonu Rengi</p>
                      <div className="grid grid-cols-4 gap-2.5">
                        {BUBBLE_THEMES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => saveDmTheme({ ...dmTheme, bubble: t.id })}
                            className="flex flex-col items-center gap-1.5 group"
                          >
                            <div
                              className="w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center shadow-sm"
                              style={{
                                background: t.light,
                                borderColor: dmTheme.bubble === t.id ? t.dot : "transparent",
                                boxShadow: dmTheme.bubble === t.id ? `0 0 0 3px ${t.dot}44` : undefined,
                              }}
                            >
                              {dmTheme.bubble === t.id && (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.dot }} />
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Arka plan */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Sohbet Arka Planı</p>
                      <div className="flex flex-col gap-2">
                        {DM_BG_STYLES.map(s => (
                          <button
                            key={s.id}
                            onClick={() => saveDmTheme({ ...dmTheme, bgStyle: s.id })}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all hover:bg-muted/30 text-left"
                            style={{ borderColor: dmTheme.bgStyle === s.id ? "hsl(var(--primary))" : "hsl(var(--border) / 0.4)" }}
                          >
                            <div
                              className="w-10 h-10 rounded-xl border border-border/30 flex-shrink-0"
                              style={s.css as React.CSSProperties}
                            />
                            <span className="text-sm font-medium">{s.label}</span>
                            {dmTheme.bgStyle === s.id && (
                              <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Kayıtlı Anlar ── */}
                {infoSection === "anlar" && (
                  <div>
                    {savedMsgsCache.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Bookmark className="w-7 h-7 text-amber-500/60" />
                        </div>
                        <p className="font-semibold text-sm">Henüz kayıtlı an yok</p>
                        <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                          Bir mesaja uzun bas → <strong>Ana Kaydet</strong> ile özel anları buraya ekle
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground font-medium mb-1">{savedMsgsCache.length} an kayıtlı</p>
                        {savedMsgsCache.map(m => {
                          const isMe = m.senderId === me?.id;
                          const preview = m.content
                            ? m.content.replace(/^__LOOP_REPLY__:[^\n]+\n/, "").replace(/^__[A-Z_]+__(:.*)?/, "📎 Medya içeriği").slice(0, 120)
                            : m.mediaUrl ? "📷 Görsel" : m.voiceUrl ? "🎤 Sesli mesaj" : "";
                          const timeStr = format(new Date(m.createdAt), "d MMM, HH:mm", { locale: tr });
                          return (
                            <div
                              key={m.id}
                              className="relative flex flex-col gap-1.5 px-4 py-3.5 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-primary">{isMe ? "Sen" : otherUser.displayName}</span>
                                <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                              </div>
                              <p className="text-[13px] text-foreground/90 leading-relaxed line-clamp-3">{preview}</p>
                              <button
                                className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors"
                                onClick={() => toggleSaveMsg(m)}
                              >
                                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Ortak Medya ── */}
                {infoSection === "medya" && (
                  <div>
                    {messages.filter(m => m.mediaUrl).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                        </div>
                        <p className="font-semibold text-sm">Paylaşılan medya yok</p>
                        <p className="text-xs text-muted-foreground/70">Bu sohbette henüz görsel paylaşılmadı</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-3">{messages.filter(m => m.mediaUrl).length} görsel</p>
                        <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">
                          {messages.filter(m => m.mediaUrl).map(m => (
                            <div key={m.id} className="aspect-square overflow-hidden bg-muted">
                              {m.mediaType === "video"
                                ? <video src={m.mediaUrl!} className="w-full h-full object-cover" />
                                : <img src={m.mediaUrl!} alt="Medya" className="w-full h-full object-cover" loading="lazy" />
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </AppLayout>
    );
  }

  // ── Conversation list view ─────────────────────────────────────────────────
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;

  const filteredConvs = conversations
    .filter(c => {
      if (activeTab === "gruplar") return false; // gruplar sekmesinde bireysel DM gizle
      const id = c.user?.id ?? -1;
      if (hiddenIds.has(id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.user?.displayName?.toLowerCase().includes(q) ||
          c.user?.username?.toLowerCase().includes(q) ||
          c.lastMessage.content?.toLowerCase().includes(q)
        );
      }
      if (activeTab === "okunmamis") return c.unreadCount > 0;
      if (activeTab === "sabitlenen") return pinnedIds.has(id);
      return true;
    })
    .sort((a, b) => {
      if (activeTab !== "tumu") {
        const rank = (id: number) => pinnedIds.has(id) ? 0 : favMap.has(id) ? 1 : 2;
        return rank(a.user?.id ?? -1) - rank(b.user?.id ?? -1);
      }
      // Tümü: zaman sırasına göre
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

  const filteredGroups = groups.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) ||
      g.members.some(m => m.displayName.toLowerCase().includes(q));
  });

  // Tümü sekmesinde gruplar + DM'ler zamana göre birleşik liste
  type TumuItem = { kind: "conv"; data: (typeof filteredConvs)[0]; time: number } | { kind: "group"; data: (typeof filteredGroups)[0]; time: number };
  const tumuItems: TumuItem[] = activeTab === "tumu" ? [
    ...filteredConvs.map(c => ({ kind: "conv" as const, data: c, time: new Date(c.lastMessage.createdAt).getTime() })),
    ...filteredGroups.map(g => ({ kind: "group" as const, data: g, time: g.lastMessage ? new Date(g.lastMessage.createdAt).getTime() : new Date(g.createdAt).getTime() })),
  ].sort((a, b) => b.time - a.time) : [];

  const TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: "tumu", label: "Tümü", count: totalUnread > 0 ? totalUnread : undefined },
    { id: "okunmamis", label: "Okunmamış", count: unreadCount > 0 ? unreadCount : undefined },
    { id: "gruplar", label: "Gruplar", count: groups.length > 0 ? groups.length : undefined },
    { id: "sabitlenen", label: "Sabitlenen" },
    { id: "arsivlenen", label: "Arşivlenen" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full pb-20">
        {/* Search bar — sticky */}
        <div className="px-4 pt-4 pb-3 bg-background sticky top-0 z-10 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sohbetlerde ara..."
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-muted/60 border border-transparent focus:border-primary/30 focus:outline-none text-sm placeholder:text-muted-foreground transition-colors"
              />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* ── Polaroid Kamera — filtre butonunun sağına taşındı ── */}
            <button
              onClick={openLoopViewer}
              className="relative flex-shrink-0 focus:outline-none"
              style={{ width: 40, height: 40, overflow: "visible" }}
            >
              {/* Polaroid fotoğraflar — butonun üstünden dışarıya çıkıyor */}
              <div
                className="absolute left-0 w-10"
                style={{
                  bottom: "100%",
                  height: unviewedPhotos.length > 0 ? 44 : 0,
                  transition: "height 0.3s",
                  overflow: "visible",
                }}
              >
                {unviewedPhotos.slice(0, 3).map((photo, i) => {
                  const rotations = [-14, 8, -5];
                  const translateY = [0, -6, -12];
                  const gradients = ["from-violet-400 to-purple-500", "from-pink-400 to-rose-500", "from-sky-400 to-blue-500"];
                  return (
                    <div
                      key={photo.id}
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        transform: `rotate(${rotations[i % 3]}deg) translateY(${translateY[i % 3]}px)`,
                        zIndex: 3 - i,
                      }}
                    >
                      <div className="bg-white shadow-lg rounded-[3px] p-0.5 pb-2.5 w-10">
                        {photo.mediaUrl ? (
                          <img src={`/api${photo.mediaUrl}`} alt="" className="w-9 h-9 object-cover rounded-[2px]" />
                        ) : (
                          <div className={`w-9 h-9 bg-gradient-to-br ${gradients[i % 3]} rounded-[2px] flex items-center justify-center`}>
                            <span className="text-white font-bold text-xs drop-shadow">{photo.sender?.displayName?.charAt(0) ?? "?"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kamera gövdesi */}
              <div className="absolute bottom-0 left-0 w-10 overflow-hidden rounded-t-xl" style={{ height: 28 }}>
                <div className="absolute inset-0 bg-zinc-800 rounded-t-xl" />
                <div className="absolute top-0 left-1.5 right-1.5 h-1.5 bg-zinc-700 rounded-t-sm" />
                <div className="absolute inset-0 flex items-center justify-center mt-2">
                  <div className="w-4 h-4 rounded-full bg-zinc-900 border-[1.5px] border-zinc-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 border border-zinc-500/60" />
                  </div>
                </div>
                <div className="absolute top-2 right-1.5 w-1.5 h-1 bg-amber-300/80 rounded-full" />
              </div>

              {/* Okunmamış rozet */}
              {unviewedPhotos.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[8px] font-bold text-primary-foreground flex items-center justify-center shadow-sm z-20">
                  {unviewedPhotos.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Friend profile cards — horizontal scroll, square card style */}
          <div className="pt-4 pb-3 border-b border-border/40 relative">

            <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-1">

              {/* ── My own card ── */}
              <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 76 }}>
                {/* Bubble slot */}
                <div className="h-[60px] flex items-end w-full mb-1.5 relative">
                  <button onClick={openThought} className="w-full group text-left">
                    <ThoughtBubble text={thought || thoughtPlaceholder} isEmpty={!thought} color="primary" />
                  </button>
                  {/* Beni beğenenler — kalp avatarın sol köşesine bitişik */}
                  {myThoughtLikers.length > 0 && (
                    <div className="absolute bottom-0 left-[4px] flex items-center z-10 pointer-events-none">
                      <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500 flex-shrink-0 z-10" style={{ marginRight: -4 }} />
                      {myThoughtLikers.slice(0, 3).map(l => (
                        <Avatar key={l.id} className="ring-1 ring-white flex-shrink-0" style={{ width: 13, height: 13 }}>
                          <AvatarImage src={l.avatarUrl || ""} />
                          <AvatarFallback className="bg-primary text-white text-[5px] font-bold">{l.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>
                {/* Kart — kamera butonu relative sarmalında */}
                <div className="relative w-full">
                  <button onClick={openThought} className="w-full rounded-2xl bg-card border-2 border-primary/40 shadow-md hover:border-primary/70 hover:shadow-lg transition-all active:scale-95 flex flex-col items-center pt-3 pb-2.5 gap-1.5">
                    <div className="relative">
                      <Avatar className="ring-2 ring-primary/30 ring-offset-1 ring-offset-card" style={{ width: 40, height: 40 }}>
                        <AvatarImage src={me?.avatarUrl || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{me?.displayName?.charAt(0) ?? "?"}</AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card shadow-sm" />
                    </div>
                    <p className="text-[10px] font-bold text-primary">Sen</p>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setLoopShareOpen(true); }}
                    className="absolute -top-1.5 -right-1.5 z-10 w-[22px] h-[22px] bg-primary rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 active:scale-90 transition-all"
                  >
                    <Camera className="w-2.5 h-2.5 text-primary-foreground" />
                  </button>
                </div>
              </div>

              {conversations.map((c, idx) => {
                const isOnline = idx < 4;
                const friendThought = c.user?.thought;
                const fid = c.user?.id ?? -1;
                const likers = friendThoughtLikers.get(fid) ?? [];
                const iLiked = myLikes.has(fid);
                const palettes = [
                  { border: "border-violet-400/50 hover:border-violet-500/70", ring: "ring-violet-400/40", color: "violet" as const },
                  { border: "border-pink-400/50 hover:border-pink-500/70",     ring: "ring-pink-400/40",   color: "pink" as const },
                  { border: "border-sky-400/50 hover:border-sky-500/70",       ring: "ring-sky-400/40",    color: "sky" as const },
                  { border: "border-emerald-400/50 hover:border-emerald-500/70", ring: "ring-emerald-400/40", color: "emerald" as const },
                  { border: "border-orange-400/50 hover:border-orange-500/70", ring: "ring-orange-400/40", color: "orange" as const },
                ];
                const p = palettes[idx % palettes.length];
                return (
                  <div key={fid} className="flex-shrink-0 flex flex-col items-center" style={{ width: 76 }}>
                    {/* Bubble slot — tıklanabilir + liker avatarları */}
                    <div className="h-[60px] flex items-end w-full mb-1.5 relative">
                      {friendThought ? (
                        <button
                          className="w-full text-left"
                          onClick={() => setThoughtSheet({ userId: fid, displayName: c.user?.displayName ?? "", thought: friendThought, avatarUrl: c.user?.avatarUrl ?? null })}
                        >
                          <ThoughtBubble text={friendThought} color={p.color} />
                        </button>
                      ) : null}
                      {/* Beğenenler — kalp avatarın sol köşesine bitişik */}
                      {likers.length > 0 && (
                        <div className="absolute bottom-0 left-[4px] flex items-center z-10 pointer-events-none">
                          <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500 flex-shrink-0 z-10" style={{ marginRight: -4 }} />
                          {likers.slice(0, 3).map(l => (
                            <Avatar key={l.id} className="ring-1 ring-white flex-shrink-0" style={{ width: 13, height: 13 }}>
                              <AvatarImage src={l.avatarUrl || ""} />
                              <AvatarFallback className="bg-violet-500 text-white text-[5px] font-bold">{l.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Kart */}
                    <button
                      onClick={() => setLocation(`/dm/${c.user?.id}`)}
                      className={`w-full rounded-2xl bg-card border-2 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center pt-3 pb-2.5 gap-1.5 ${p.border}`}
                    >
                      <div className="relative">
                        <Avatar className={`ring-2 ring-offset-1 ring-offset-card ${p.ring}`} style={{ width: 40, height: 40 }}>
                          <AvatarImage src={c.user?.avatarUrl || ""} />
                          <AvatarFallback className="bg-muted text-foreground font-bold text-sm">{c.user?.displayName?.charAt(0) ?? "?"}</AvatarFallback>
                        </Avatar>
                        {isOnline && <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card shadow-sm" />}
                        {c.unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary rounded-full border-2 border-card text-[8px] font-bold text-primary-foreground flex items-center justify-center px-1 shadow-sm">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-foreground/80 truncate text-center px-1" style={{ maxWidth: 68 }}>
                        {c.user?.displayName?.split(" ")[0] ?? "?"}
                      </p>
                    </button>
                    {/* Beğen butonu — balon varsa balonun sağ alt köşesi */}
                    {friendThought && (
                      <button
                        className={`mt-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${iLiked ? "bg-rose-100 text-rose-500 dark:bg-rose-950" : "bg-muted/60 text-muted-foreground hover:bg-rose-50 hover:text-rose-400"}`}
                        onClick={() => toggleThoughtLike(fid)}
                      >
                        <Heart className={`w-2.5 h-2.5 ${iLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                        {likers.length > 0 ? likers.length : ""}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter tabs — above conversation list */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto hide-scrollbar border-b border-border/40 bg-background/80">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? "bg-white/20" : "bg-primary/10 text-primary"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Conversations — Gruplar sekmesi */}
          {activeTab === "gruplar" ? (
            <div>
              {/* Yeni Grup butonu */}
              <div className="px-4 py-3 border-b border-border/30">
                <button
                  onClick={openGroupPanel}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 hover:bg-primary/15 text-primary transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">Yeni Grup Oluştur</p>
                    <p className="text-xs text-primary/70">Arkadaşlarınla grup sohbeti başlat</p>
                  </div>
                </button>
              </div>
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground px-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-primary/30" />
                  </div>
                  <p className="font-medium text-sm">Henüz grup yok</p>
                  <p className="text-xs text-center opacity-70">Yeni grup oluşturarak arkadaşlarınla sohbet et</p>
                </div>
              ) : (
                filteredGroups.map(g => (
                  <GroupRow key={g.id} g={g} onClick={() => setLocation(`/dm/group/${g.id}`)} />
                ))
              )}
            </div>
          ) : filteredConvs.length === 0 && filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground px-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-primary/30" />
              </div>
              <p className="font-medium text-sm">
                {searchQuery ? "Sonuç bulunamadı" : "Henüz mesajlaşma yok"}
              </p>
              <p className="text-xs text-center opacity-70">
                {searchQuery ? "Farklı bir arama dene" : "Bir kullanıcının profiline gidip mesaj gönder!"}
              </p>
            </div>
          ) : (
            <div>
              {/* Tümü: gruplar + DM'ler, zaman sırasına göre interleaved */}
              {activeTab === "tumu" ? (
                tumuItems.map(item => {
                  if (item.kind === "group") {
                    return <GroupRow key={`g-${item.data.id}`} g={item.data} onClick={() => setLocation(`/dm/group/${item.data.id}`)} />;
                  }
                  const c = item.data;
                  const uid = c.user?.id ?? 0;
                  const time = formatMsgTime(c.lastMessage.createdAt);
                  const preview = lastMsgPreview(c.lastMessage);
                  return (
                    <div
                      key={uid}
                      className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                      onClick={() => {
                        if (menuId !== null) { setMenuId(null); return; }
                        setLocation(`/dm/${c.user?.id}`);
                      }}
                    >
                      <Avatar className="border-2 border-background shadow-sm" style={{ width: 52, height: 52 }}>
                        <AvatarImage src={c.user?.avatarUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-400/30 text-primary font-bold text-base">
                          {c.user?.displayName?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-bold text-[15px] truncate">{c.user?.displayName ?? "Bilinmiyor"}</span>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">{time}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground truncate">{preview}</p>
                          {c.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground flex-shrink-0">
                              {c.unreadCount > 9 ? "9+" : c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Üç nokta menü */}
                      <button
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors -mr-1"
                        onClick={e => {
                          e.stopPropagation();
                          if (menuId === uid) { setMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setMenuId(uid);
                        }}
                      >
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })
              ) : null}
              {filteredConvs.filter(() => activeTab !== "tumu").map((c, idx) => {
                const uid = c.user?.id ?? idx;
                const preview = lastMsgPreview(c.lastMessage);
                const isSpecial = isSpecialPreview(c.lastMessage);
                const isAudio = c.lastMessage.mediaType === "audio";
                const time = formatMsgTime(c.lastMessage.createdAt);
                const isOnline = idx < 3;
                const isPinned = pinnedIds.has(uid);
                const favEntry = favMap.get(uid);
                const isFav = !!favEntry;
                const favColor = favEntry?.color ?? DEFAULT_FAV.color;
                const favGlow  = favEntry?.glow  ?? DEFAULT_FAV.glow;
                const mutedUntil = mutedMap.get(uid);
                const isMuted = !!mutedUntil && mutedUntil > Date.now();
                const isSelected = selectedIds.has(uid);

                return (
                  <div
                    key={uid}
                    className={`relative transition-all duration-300 ${isFav ? "mx-3 my-1.5 rounded-2xl overflow-hidden" : "border-b border-border/30 last:border-0"}`}
                    style={isFav ? {
                      boxShadow: `0 0 0 1.5px ${favColor}55, 0 0 18px ${favGlow}28, 0 4px 16px ${favGlow}14`,
                    } : undefined}
                  >
                    {/* Favori neon arka plan */}
                    {isFav && (
                      <div
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ background: `linear-gradient(135deg, ${favColor}0d 0%, transparent 60%, ${favColor}08 100%)` }}
                      />
                    )}

                    {/* Favori emoji rozeti */}
                    {isFav && favEntry?.emoji && (
                      <div
                        className="absolute top-1.5 right-10 z-10 flex items-center justify-center"
                        style={{ width: 28, height: 28 }}
                      >
                        {/* Dış parlama halkası */}
                        <div
                          className="absolute inset-0 rounded-full animate-pulse"
                          style={{ boxShadow: `0 0 10px ${favGlow}cc, 0 0 20px ${favGlow}55`, background: `${favColor}22` }}
                        />
                        {/* İç zemin */}
                        <div
                          className="absolute inset-[3px] rounded-full"
                          style={{ background: `radial-gradient(circle at 40% 35%, ${favColor}88, ${favColor}33)`, backdropFilter: "blur(4px)" }}
                        />
                        {/* Emoji */}
                        <span className="relative z-10 text-[13px] leading-none select-none drop-shadow-sm">{favEntry.emoji}</span>
                      </div>
                    )}
                    {/* Emoji olmayan favori: neon kalp rozeti */}
                    {isFav && !favEntry?.emoji && (
                      <div
                        className="absolute top-1.5 right-10 z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center"
                        style={{ background: `radial-gradient(circle at 40% 35%, ${favColor}cc, ${favColor}66)`, boxShadow: `0 0 8px ${favGlow}cc` }}
                      >
                        <Heart className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    )}

                    {/* Kart içeriği */}
                    <div
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left select-none ${isSelected ? "bg-primary/8" : "hover:bg-white/[0.03] active:bg-white/[0.06]"} ${isSelecting ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (menuId !== null) { setMenuId(null); return; }
                        if (isSelecting) { toggleSelect(uid); return; }
                        setLocation(`/dm/${c.user?.id}`);
                      }}
                      onTouchStart={() => !isSelecting && startLongPress(uid)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onMouseDown={() => !isSelecting && startLongPress(uid)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                    >
                      {/* Seçim checkbox */}
                      {isSelecting && (
                        <div className="flex-shrink-0 mr-1">
                          {isSelected
                            ? <CheckCircle2 className="w-5 h-5 text-primary" />
                            : <Circle className="w-5 h-5 text-muted-foreground/50" />}
                        </div>
                      )}

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <Avatar
                          className="shadow-sm border-2"
                          style={{ width: 52, height: 52, borderColor: isFav ? `${favColor}88` : "hsl(var(--background))" }}
                        >
                          <AvatarImage src={c.user?.avatarUrl || ""} />
                          <AvatarFallback className="font-bold text-base bg-gradient-to-br from-primary/20 to-violet-400/30 text-primary">
                            {c.user?.displayName?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="font-bold text-[15px] truncate"
                              style={isFav ? { color: favColor } : undefined}
                            >
                              {c.user?.displayName ?? "Bilinmiyor"}
                            </span>
                            {isPinned && <Pin className="w-3 h-3 text-primary/60 flex-shrink-0" />}
                            {isMuted && <BellOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          </div>
                          <span
                            className="text-[11px] flex-shrink-0"
                            style={isFav ? { color: `${favColor}bb` } : { color: "hsl(var(--muted-foreground))" }}
                          >{time}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${c.unreadCount > 0 ? "font-medium text-foreground" : isSpecial ? "text-muted-foreground italic" : "text-muted-foreground"}`}>
                            {preview}
                          </p>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            {c.unreadCount > 0 && !isMuted && (
                              <span
                                className="min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                                style={isFav
                                  ? { background: `linear-gradient(135deg, ${favColor}, ${favColor}bb)`, boxShadow: `0 0 8px ${favGlow}88` }
                                  : { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                                }
                              >
                                {c.unreadCount > 9 ? "9+" : c.unreadCount}
                              </span>
                            )}
                            {isAudio && <Mic className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>

                      {/* Üç nokta butonu */}
                      {!isSelecting && (
                        <button
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors -mr-1 hover:bg-muted/60"
                          onClick={e => {
                            e.stopPropagation();
                            if (menuId === uid) { setMenuId(null); setMenuPos(null); return; }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setMenuId(uid);
                          }}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fixed açılır menü (liste overflow'undan kaçmak için dışarıda) */}
          {menuId !== null && menuPos !== null && (() => {
            const uid = menuId;
            const isPinned = pinnedIds.has(uid);
            const isFav    = favMap.has(uid);
            const mutedUntil = mutedMap.get(uid);
            const isMuted  = !!mutedUntil && mutedUntil > Date.now();
            return (
              <div
                className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm hover:bg-muted/60 transition-colors text-left"
                  onClick={() => togglePin(uid)}
                >
                  <Pin className="w-4 h-4 text-primary" />
                  {isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm hover:bg-muted/60 transition-colors text-left border-t border-border/40"
                  onClick={() => {
                    if (isFav) { removeFav(uid); }
                    else { setMenuId(null); setMenuPos(null); setFavEmojiDialogId(uid); }
                  }}
                >
                  <Heart className={`w-4 h-4 ${isFav ? "text-rose-400 fill-rose-400" : "text-rose-400"}`} />
                  {isFav ? "Favoriden çıkar" : "Favori ekle"}
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm hover:bg-muted/60 transition-colors text-left border-t border-border/40"
                  onClick={() => { setMuteDialogId(uid); setMenuId(null); setMenuPos(null); }}
                >
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                  {isMuted ? "Sesi aç" : "Sessize al"}
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm hover:bg-muted/60 transition-colors text-left border-t border-border/40 text-destructive"
                  onClick={() => hideConvs(new Set([uid]))}
                >
                  <Trash2 className="w-4 h-4" />
                  Sohbeti temizle
                </button>
              </div>
            );
          })()}

          {/* ── Favori Emoji Seçici Dialog ── */}
          {favEmojiDialogId !== null && (
            <div className="fixed inset-0 z-[60] flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setFavEmojiDialogId(null)}
              />
              <div className="relative bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 animate-in slide-in-from-bottom-4">
                {/* Tutamaç */}
                <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

                {/* Başlık */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  </div>
                  <div>
                    <p className="font-bold text-base leading-tight">Favori Ekle</p>
                    <p className="text-xs text-muted-foreground">Bir emoji seç (isteğe bağlı)</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/70 mb-5 ml-[52px]">
                  Seçtiğin emoji bu kişiyi yansıtır ve kart çerçevesi o emojinin rengine göre parlar.
                </p>

                {/* Emoji grid */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {FAV_EMOJIS.map(({ emoji, color, glow, label }) => (
                    <button
                      key={emoji}
                      aria-label={label}
                      className="relative flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 group"
                      style={{ background: `${color}14` }}
                      onClick={() => addFav(favEmojiDialogId, { emoji, color, glow })}
                    >
                      {/* Dış parlama halkası */}
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                        style={{ boxShadow: `0 0 0 1.5px ${color}88, 0 0 14px ${glow}44` }}
                      />
                      {/* Emoji kabı */}
                      <div
                        className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: `radial-gradient(circle at 38% 32%, ${color}55, ${color}22)`,
                          boxShadow: `0 0 12px ${glow}55, inset 0 1px 0 ${color}44`,
                        }}
                      >
                        {/* İnce iç halka */}
                        <div
                          className="absolute inset-0 rounded-xl"
                          style={{ boxShadow: `inset 0 0 0 1px ${color}44` }}
                        />
                        <span className="text-2xl leading-none select-none drop-shadow">{emoji}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium truncate w-full text-center px-1">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Emojisiz favori / vazgeç */}
                <div className="flex gap-2">
                  <button
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-border/60 text-muted-foreground hover:bg-muted/40 transition-colors"
                    onClick={() => setFavEmojiDialogId(null)}
                  >
                    Vazgeç
                  </button>
                  <button
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                    onClick={() => addFav(favEmojiDialogId, DEFAULT_FAV)}
                  >
                    Emojisiz Ekle
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Çoklu seçim alt çubuğu — nav barının üstünde (bottom-16 = 64px) */}
          {isSelecting && (
            <div className="fixed bottom-16 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <button
                  className="text-sm text-muted-foreground font-medium px-2 py-1"
                  onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
                >
                  İptal
                </button>
                <span className="text-sm font-semibold text-foreground">
                  {selectedIds.size} kişi seçildi
                </span>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-40"
                  disabled={selectedIds.size === 0}
                  onClick={() => hideConvs(selectedIds)}
                >
                  <Trash2 className="w-4 h-4" />
                  Temizle
                </button>
              </div>
              {/* Grup sohbeti butonu — en az 2 kişi seçilince görünür */}
              {selectedIds.size >= 2 && (
                <button
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                  onClick={() => {
                    openGroupPanel();
                    setIsSelecting(false);
                    setSelectedIds(new Set());
                  }}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  Grup Sohbeti Oluştur ({selectedIds.size} kişi)
                </button>
              )}
            </div>
          )}

          {/* ── Yeni Grup Oluştur Bottom Sheet ── */}
          {newGroupOpen && (
            <div className="fixed inset-0 z-[55] flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeGroupPanel} />
              <div className="relative bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 animate-in slide-in-from-bottom-4 max-h-[85vh] flex flex-col">
                <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 flex-shrink-0" />
                <div className="flex items-center gap-2.5 mb-4 flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-base leading-tight">Yeni Grup Oluştur</p>
                    <p className="text-xs text-muted-foreground">Arkadaşlarınla grup sohbeti başlat</p>
                  </div>
                </div>

                {/* Grup adı */}
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Grup adı…"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-2xl bg-muted/60 border border-transparent focus:border-primary/30 focus:outline-none text-sm mb-3 flex-shrink-0"
                />

                {/* Seçilen üyeler — chips */}
                {newGroupSelectedUsers.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-2 flex-shrink-0 hide-scrollbar">
                    {newGroupSelectedUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => toggleGroupMember(u)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex-shrink-0"
                      >
                        {u.displayName}
                        <span className="text-[10px] opacity-70">✕</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Üye seçimi başlığı */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex-shrink-0">
                  Üye Ara & Seç
                </p>

                {/* Arama kutusu */}
                <div className="relative mb-2 flex-shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={groupMemberSearch}
                    onChange={e => searchGroupMembers(e.target.value)}
                    placeholder="İsim veya kullanıcı adı ara…"
                    autoComplete="off"
                    className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-muted/60 border border-transparent focus:border-primary/30 focus:outline-none text-sm"
                  />
                </div>

                {/* Kullanıcı listesi */}
                <div className="flex-1 overflow-y-auto min-h-0 mb-4">
                  {groupSearchLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aranıyor…</p>
                  ) : !groupMemberSearch.trim() ? (
                    /* Mevcut konuşmalar veya hint */
                    conversations.length > 0 ? (
                      <div className="space-y-0.5">
                        {conversations.map(c => {
                          if (!c.user) return null;
                          const isSelected = newGroupMemberIds.has(c.user.id);
                          return (
                            <button key={c.user.id} onClick={() => toggleGroupMember(c.user)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"}`}
                            >
                              <Avatar style={{ width: 38, height: 38 }}>
                                <AvatarImage src={c.user.avatarUrl || ""} />
                                <AvatarFallback className="bg-muted text-foreground font-bold text-sm">{c.user.displayName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{c.user.displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">@{c.user.username}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                                {isSelected && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">Üye eklemek için yukarıdan ara</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Herhangi bir kullanıcıyı arayabilirsin</p>
                      </div>
                    )
                  ) : groupSearchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Kullanıcı bulunamadı</p>
                  ) : (
                    <div className="space-y-0.5">
                      {groupSearchResults.map(u => {
                        const isSelected = newGroupMemberIds.has(u.id);
                        return (
                          <button key={u.id} onClick={() => toggleGroupMember(u)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"}`}
                          >
                            <Avatar style={{ width: 38, height: 38 }}>
                              <AvatarImage src={u.avatarUrl || ""} />
                              <AvatarFallback className="bg-muted text-foreground font-bold text-sm">{u.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{u.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                              {isSelected && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 flex-shrink-0">
                  <button className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted transition-colors" onClick={closeGroupPanel}>
                    İptal
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim() || newGroupMemberIds.size === 0 || creatingGroup}
                    className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    {creatingGroup ? "Oluşturuluyor…" : newGroupMemberIds.size > 0 ? `Grup Oluştur (${newGroupMemberIds.size} üye)` : "Grup Oluştur"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sessize al süresi seçici */}
          {muteDialogId !== null && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMuteDialogId(null)} />
              <div className="relative w-full max-w-sm bg-card rounded-t-3xl shadow-2xl px-4 pt-5 pb-10">
                <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
                <p className="text-base font-bold text-center mb-4">Sessiz Süresi</p>
                {[
                  { label: "1 saat",  hours: 1 },
                  { label: "8 saat",  hours: 8 },
                  { label: "24 saat", hours: 24 },
                  { label: "1 hafta", hours: 168 },
                ].map(opt => (
                  <button
                    key={opt.hours}
                    className="w-full py-3.5 text-sm font-semibold text-center rounded-2xl hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                    onClick={() => muteFor(muteDialogId, opt.hours)}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  className="w-full mt-3 py-3 text-sm text-muted-foreground font-medium"
                  onClick={() => setMuteDialogId(null)}
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Menü kapatma backdrop */}
          {menuId !== null && (
            <div className="fixed inset-0 z-40" onClick={() => { setMenuId(null); setMenuPos(null); }} />
          )}
        </div>

        {/* ── Loop Anlık Fotoğraf Görüntüleyici ── */}
        {loopViewerOpen && (() => {
          const photo = unviewedPhotos[loopViewIdx];
          if (!photo) return null;
          const minAgo = Math.max(0, Math.round((Date.now() - new Date(photo.createdAt).getTime()) / 60000));
          return (
            <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
              {/* Üst bar */}
              <div className="flex items-center justify-between px-4 pt-10 pb-3">
                <div className="flex items-center gap-2">
                  <Avatar style={{ width: 28, height: 28 }}>
                    <AvatarImage src={photo.sender?.avatarUrl || ""} />
                    <AvatarFallback className="bg-violet-600 text-white text-[10px] font-bold">
                      {photo.sender?.displayName?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white text-xs font-semibold leading-tight">{photo.sender?.displayName ?? "Biri"}</p>
                    <p className="text-white/50 text-[10px]">{minAgo < 1 ? "Az önce" : `${minAgo} dk önce`}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {unviewedPhotos.map((_, i) => (
                    <div key={i} className={`h-1 w-6 rounded-full ${i === loopViewIdx ? "bg-white" : "bg-white/30"}`} />
                  ))}
                </div>
              </div>

              {/* Polaroid fotoğraf */}
              <div className="flex-1 flex items-center justify-center px-8">
                <div className="bg-white rounded-sm shadow-2xl p-3 pb-10 w-full max-w-xs" style={{ transform: "rotate(-1.5deg)" }}>
                  {photo.mediaUrl ? (
                    <img src={`/api${photo.mediaUrl}`} alt="" className="w-full aspect-square object-cover rounded-[2px]" />
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-violet-400 to-fuchsia-500 rounded-[2px] flex items-center justify-center">
                      <span className="text-white font-bold text-5xl drop-shadow-lg">
                        {photo.sender?.displayName?.charAt(0) ?? "?"}
                      </span>
                    </div>
                  )}
                  {/* Daha önce gelen tepkiler */}
                  {loopViewDetail && loopViewDetail.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 justify-center">
                      {loopViewDetail.reactions.map((r, i) => (
                        <span key={i} className="text-lg">{r.emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Alt — tepki + yanıt */}
              <div className="px-4 pb-10 space-y-3" onClick={e => e.stopPropagation()}>
                {/* Emoji tepki row */}
                <div className="flex justify-center gap-3">
                  {["❤️","😂","😮","🔥","👏"].map(emoji => (
                    <button
                      key={emoji}
                      className="text-2xl active:scale-125 transition-transform"
                      onClick={() => sendLoopReact(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {/* Yanıt yazma */}
                <div className="flex gap-2">
                  <input
                    value={loopViewReply}
                    onChange={e => setLoopViewReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendLoopReply(); }}
                    placeholder="Yanıtla…"
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                  />
                  <button
                    onClick={sendLoopReply}
                    disabled={!loopViewReply.trim()}
                    className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
                {/* İlerle butonu */}
                <button
                  className="w-full py-2.5 rounded-2xl bg-white/10 text-white/80 text-sm font-semibold"
                  onClick={markAndAdvance}
                >
                  {loopViewIdx < unviewedPhotos.length - 1 ? "Sonraki →" : "Kapat"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Loop Anlık Paylaş Bottom Sheet ── */}
        {loopShareOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setLoopShareOpen(false); setLoopSharePreview(null); setLoopShareFile(null); }} />
            <div className="relative bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 animate-in slide-in-from-bottom-4">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">Loop diye anlık paylaş</p>
                  <p className="text-xs text-muted-foreground">Arkadaşların tek seferlik görebilir</p>
                </div>
              </div>

              {loopSharePreview ? (
                <div className="flex flex-col items-center gap-4 mb-5">
                  <div className="bg-white rounded-sm shadow-xl p-3 pb-10 w-52" style={{ transform: "rotate(-1.5deg)" }}>
                    <img src={loopSharePreview} alt="Preview" className="w-full aspect-square object-cover rounded-[2px]" />
                  </div>
                  <button className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() => { setLoopSharePreview(null); setLoopShareFile(null); loopCamRef.current?.click(); }}>
                    Başka fotoğraf seç
                  </button>
                </div>
              ) : (
                <button
                  className="w-full h-36 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 flex flex-col items-center justify-center gap-2 mb-5 transition-colors"
                  onClick={() => loopCamRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Fotoğraf seç veya çek</span>
                </button>
              )}

              <input ref={loopCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleLoopShareFile} />

              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
                  onClick={() => { setLoopShareOpen(false); setLoopSharePreview(null); setLoopShareFile(null); }}>
                  İptal
                </button>
                <button
                  disabled={!loopShareFile || loopSharing}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  onClick={submitLoopShare}
                >
                  {loopSharing ? "Paylaşılıyor…" : "Paylaş ✨"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Düşünce Balonu Yanıt / Beğeni Sheet ── */}
        {thoughtSheet && (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setThoughtSheet(null); setThoughtReply(""); }} />
            <div className="relative bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-10 animate-in slide-in-from-bottom-4">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />

              {/* Kimin düşüncesi */}
              <div className="flex items-center gap-2.5 mb-4">
                <Avatar className="ring-2 ring-primary/20" style={{ width: 36, height: 36 }}>
                  <AvatarImage src={thoughtSheet.avatarUrl || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {thoughtSheet.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight">{thoughtSheet.displayName}</p>
                  <p className="text-xs text-muted-foreground italic truncate">"{thoughtSheet.thought}"</p>
                </div>
                {/* Beğen butonu */}
                <button
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    myLikes.has(thoughtSheet.userId)
                      ? "bg-rose-100 text-rose-500 dark:bg-rose-950"
                      : "bg-muted text-muted-foreground hover:bg-rose-50 hover:text-rose-400"
                  }`}
                  onClick={() => toggleThoughtLike(thoughtSheet.userId)}
                >
                  <Heart className={`w-4 h-4 ${myLikes.has(thoughtSheet.userId) ? "fill-rose-500 text-rose-500" : ""}`} />
                  {myLikes.has(thoughtSheet.userId) ? "Beğenildi" : "Beğen"}
                </button>
              </div>

              {/* Beğenenler listesi */}
              {(friendThoughtLikers.get(thoughtSheet.userId) ?? []).length > 0 && (
                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">Beğenenler:</p>
                  {(friendThoughtLikers.get(thoughtSheet.userId) ?? []).map(l => (
                    <div key={l.id} className="flex items-center gap-1">
                      <Avatar style={{ width: 20, height: 20 }}>
                        <AvatarImage src={l.avatarUrl || ""} />
                        <AvatarFallback className="bg-violet-500 text-white text-[8px]">{l.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{l.displayName.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Yanıt yaz */}
              <p className="text-xs text-muted-foreground mb-2">DM olarak yanıtla:</p>
              <div className="flex gap-2">
                <input
                  value={thoughtReply}
                  onChange={e => setThoughtReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendThoughtReply(); }}
                  placeholder={`${thoughtSheet.displayName.split(" ")[0]}'e yanıt yaz…`}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={sendThoughtReply}
                  disabled={!thoughtReply.trim()}
                  className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Thought input bottom sheet ── */}
        {thoughtOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setThoughtOpen(false)} />

            {/* Sheet */}
            <div className="relative bg-background rounded-t-3xl shadow-2xl px-4 pt-5 pb-8 animate-in slide-in-from-bottom-4">
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Avatar className="border-2 border-primary/20" style={{ width: 36, height: 36 }}>
                    <AvatarImage src={me?.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {me?.displayName?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold leading-tight">{me?.displayName ?? "Sen"}</p>
                    <p className="text-[11px] text-muted-foreground">Düşünceni paylaş</p>
                  </div>
                </div>
                <button onClick={() => setThoughtOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={thoughtInputRef}
                value={thoughtDraft}
                onChange={e => setThoughtDraft(e.target.value)}
                placeholder="Aklından ne geçiyor?"
                maxLength={120}
                rows={3}
                className="w-full resize-none rounded-2xl bg-muted/60 border border-transparent focus:border-primary/30 focus:outline-none px-4 py-3 text-sm placeholder:text-muted-foreground leading-relaxed"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveThought(); }}
              />
              <p className="text-[10px] text-muted-foreground text-right mt-1 mb-4">{thoughtDraft.length}/120</p>

              {/* Actions */}
              <div className="flex gap-2">
                {thought && (
                  <button
                    onClick={clearThought}
                    className="px-4 py-2.5 rounded-2xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
                  >
                    Kaldır
                  </button>
                )}
                <button
                  onClick={() => setThoughtOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={saveThought}
                  disabled={!thoughtDraft.trim()}
                  className="flex-1 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  Paylaş
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </AppLayout>
  );
}
