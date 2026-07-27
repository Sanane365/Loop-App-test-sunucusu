import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, ImagePlus, ArrowLeft, MessageCircle,
  Search, SlidersHorizontal, Mic, Pin,
  MessageSquarePlus, X, MoreVertical,
  BellOff, Heart, Trash2, CheckCircle2, Circle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow, format, isToday, isYesterday, isSameWeek } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  if (msg.content) return msg.content;
  if (msg.mediaUrl) {
    if (msg.mediaType === "video") return "video gönderdi";
    if (msg.mediaType === "audio") return "sesli mesaj gönderdi";
    return "fotoğraf gönderdi";
  }
  return "...";
}

function isSpecialPreview(msg: DmMessage) {
  return !msg.content && !!msg.mediaUrl;
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

export default function DirectMessages() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { user: me } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [otherUser, setOtherUser] = useState<DmUser | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("tumu");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Konuşma kart özellikleri (localStorage) ──
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dm_pinned") || "[]")); } catch { return new Set(); }
  });
  const [favIds, setFavIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dm_favs") || "[]")); } catch { return new Set(); }
  });
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
  const toggleFav = (id: number) => {
    setFavIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("dm_favs", JSON.stringify([...next]));
      return next;
    });
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

  useEffect(() => {
    fetchConversations();
    // Arkadaş thought'larını canlı tutmak için 10sn'de bir yenile
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!content.trim() || !userId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/dm/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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

  // ── Chat view ──────────────────────────────────────────────────────────────
  if (userId) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-background sticky top-0 z-10">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/dm")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {otherUser && (
              <button className="flex items-center gap-2.5 hover:opacity-80 flex-1 text-left" onClick={() => setLocation(`/profile/${otherUser.id}`)}>
                <div className="relative">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={otherUser.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{otherUser.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{otherUser.displayName}</p>
                  <p className="text-[11px] text-green-500 font-medium">çevrimiçi</p>
                </div>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/30" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-primary/40" />
                </div>
                <p className="text-sm font-medium">Henüz mesaj yok</p>
                <p className="text-xs text-muted-foreground/70">İlk mesajı gönder!</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.senderId === me?.id;
              const prevMsg = messages[idx - 1];
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {!isMe && (
                    <div className="w-7 flex-shrink-0">
                      {showAvatar && (
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={msg.sender?.avatarUrl || ""} />
                          <AvatarFallback className="text-xs">{msg.sender?.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {msg.content && (
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-md"
                          : "bg-card border border-border rounded-tl-md"
                      }`}>
                        {msg.content}
                      </div>
                    )}
                    {msg.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border border-border max-w-[200px]">
                        {msg.mediaType === "video"
                          ? <video src={msg.mediaUrl} controls className="w-full" />
                          : <img src={msg.mediaUrl} alt="medya" className="w-full h-auto object-cover" />
                        }
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(msg.createdAt), { locale: tr, addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input bar */}
          <div className="p-3 bg-background border-t border-border flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Input
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Mesaj yaz..."
              className="flex-1 rounded-full bg-secondary/50 border-transparent focus-visible:ring-primary/30"
            />
            <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleSend} disabled={!content.trim() || sending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Conversation list view ─────────────────────────────────────────────────
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;

  const filteredConvs = conversations
    .filter(c => {
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
      const rank = (id: number) =>
        pinnedIds.has(id) ? 0 : favIds.has(id) ? 1 : 2;
      return rank(a.user?.id ?? -1) - rank(b.user?.id ?? -1);
    });

  const TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: "tumu", label: "Tümü", count: totalUnread > 0 ? totalUnread : undefined },
    { id: "okunmamis", label: "Okunmamış", count: unreadCount > 0 ? unreadCount : undefined },
    { id: "gruplar", label: "Gruplar" },
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Friend profile cards — horizontal scroll, square card style */}
          <div className="pt-4 pb-3 border-b border-border/40">
            <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-1">

              {/* ── My own card ── */}
              <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 76 }}>
                {/* Bubble slot — sabit yükseklik, tüm kartlar hizalı */}
                <div className="h-[60px] flex items-end w-full mb-1.5">
                  <button onClick={openThought} className="w-full group text-left">
                    <ThoughtBubble
                      text={thought || thoughtPlaceholder}
                      isEmpty={!thought}
                      color="primary"
                    />
                  </button>
                </div>
                {/* Kart */}
                <button
                  onClick={openThought}
                  className="w-full rounded-2xl bg-card border-2 border-primary/40 shadow-md hover:border-primary/70 hover:shadow-lg transition-all active:scale-95 flex flex-col items-center pt-3 pb-2.5 gap-1.5"
                >
                  <div className="relative">
                    <Avatar className="ring-2 ring-primary/30 ring-offset-1 ring-offset-card" style={{ width: 40, height: 40 }}>
                      <AvatarImage src={me?.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {me?.displayName?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card shadow-sm" />
                  </div>
                  <p className="text-[10px] font-bold text-primary">Sen</p>
                </button>
              </div>

              {conversations.map((c, idx) => {
                const isOnline = idx < 4;
                const friendThought = c.user?.thought;
                const palettes = [
                  { border: "border-violet-400/50 hover:border-violet-500/70", ring: "ring-violet-400/40", color: "violet" as const },
                  { border: "border-pink-400/50 hover:border-pink-500/70",     ring: "ring-pink-400/40",   color: "pink" as const },
                  { border: "border-sky-400/50 hover:border-sky-500/70",       ring: "ring-sky-400/40",    color: "sky" as const },
                  { border: "border-emerald-400/50 hover:border-emerald-500/70", ring: "ring-emerald-400/40", color: "emerald" as const },
                  { border: "border-orange-400/50 hover:border-orange-500/70", ring: "ring-orange-400/40", color: "orange" as const },
                ];
                const p = palettes[idx % palettes.length];
                return (
                  <div key={c.user?.id ?? idx} className="flex-shrink-0 flex flex-col items-center" style={{ width: 76 }}>
                    {/* Bubble slot — arkadaşın düşüncesi veya boşluk */}
                    <div className="h-[60px] flex items-end w-full mb-1.5">
                      {friendThought && (
                        <ThoughtBubble text={friendThought} color={p.color} />
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
                          <AvatarFallback className="bg-muted text-foreground font-bold text-sm">
                            {c.user?.displayName?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card shadow-sm" />
                        )}
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

          {/* Conversations */}
          {filteredConvs.length === 0 ? (
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
              {filteredConvs.map((c, idx) => {
                const uid = c.user?.id ?? idx;
                const preview = lastMsgPreview(c.lastMessage);
                const isSpecial = isSpecialPreview(c.lastMessage);
                const isAudio = c.lastMessage.mediaType === "audio";
                const time = formatMsgTime(c.lastMessage.createdAt);
                const isOnline = idx < 3;
                const isPinned = pinnedIds.has(uid);
                const isFav = favIds.has(uid);
                const mutedUntil = mutedMap.get(uid);
                const isMuted = !!mutedUntil && mutedUntil > Date.now();
                const isSelected = selectedIds.has(uid);

                return (
                  <div
                    key={uid}
                    className={`relative transition-all duration-200
                      ${isFav
                        ? "mx-3 my-1.5 rounded-2xl overflow-hidden shadow-md shadow-violet-500/10"
                        : "border-b border-border/30 last:border-0"
                      }
                    `}
                  >
                    {/* Favori arka plan gradyanı */}
                    {isFav && (
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.08] via-purple-500/[0.06] to-fuchsia-500/[0.08] rounded-2xl pointer-events-none" />
                    )}
                    {isFav && (
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-violet-400/30 pointer-events-none" />
                    )}

                    {/* Sağ üst köşe — favori kalp rozeti */}
                    {isFav && (
                      <div className="absolute top-2 right-10 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shadow-violet-500/40">
                        <Heart className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    )}

                    {/* Kart içeriği */}
                    <div
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left select-none
                        ${isSelected ? "bg-primary/8" : isFav ? "hover:bg-violet-500/[0.06] active:bg-violet-500/10" : "hover:bg-muted/40 active:bg-muted/60"}
                        ${isSelecting ? "cursor-pointer" : ""}
                      `}
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
                          className={`shadow-sm ${isFav ? "border-2 border-violet-400/50" : "border-2 border-background"}`}
                          style={{ width: 52, height: 52 }}
                        >
                          <AvatarImage src={c.user?.avatarUrl || ""} />
                          <AvatarFallback className={`font-bold text-base ${isFav ? "bg-gradient-to-br from-violet-400/30 to-fuchsia-400/20 text-violet-600" : "bg-gradient-to-br from-primary/20 to-violet-400/30 text-primary"}`}>
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
                            <span className={`font-bold text-[15px] truncate ${isFav ? "text-violet-700 dark:text-violet-300" : c.unreadCount > 0 ? "text-foreground" : "text-foreground/90"}`}>
                              {c.user?.displayName ?? "Bilinmiyor"}
                            </span>
                            {isPinned && <Pin className="w-3 h-3 text-primary/60 flex-shrink-0" />}
                            {isMuted && <BellOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          </div>
                          <span className={`text-[11px] flex-shrink-0 ${isFav ? "text-violet-400" : "text-muted-foreground"}`}>{time}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${
                            c.unreadCount > 0
                              ? isFav ? "text-violet-600 dark:text-violet-300 font-medium" : "text-foreground font-medium"
                              : isSpecial ? "text-muted-foreground italic" : isFav ? "text-violet-500/80 dark:text-violet-400/80" : "text-muted-foreground"
                          }`}>
                            {preview}
                          </p>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            {c.unreadCount > 0 && !isMuted && (
                              <span className={`min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isFav ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white" : "bg-primary text-primary-foreground"}`}>
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
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors -mr-1 ${isFav ? "hover:bg-violet-500/10" : "hover:bg-muted"}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (menuId === uid) { setMenuId(null); setMenuPos(null); return; }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setMenuId(uid);
                          }}
                        >
                          <MoreVertical className={`w-4 h-4 ${isFav ? "text-violet-400" : "text-muted-foreground"}`} />
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
            const isFav    = favIds.has(uid);
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
                  onClick={() => toggleFav(uid)}
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
              {/* Grup sohbeti butonu — en az 3 kişi seçilince görünür */}
              {selectedIds.size >= 3 && (
                <button
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                  onClick={() => {
                    // ileriye dönük: grup sohbeti oluştur
                    alert(`Grup sohbeti: ${selectedIds.size} kişiyle`);
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

        {/* FAB */}
        <button
          onClick={() => {}}
          className="fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-xl shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all z-20"
        >
          <MessageSquarePlus className="w-6 h-6 text-primary-foreground" />
        </button>

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
