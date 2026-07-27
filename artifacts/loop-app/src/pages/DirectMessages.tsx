import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, ImagePlus, ArrowLeft, MessageCircle,
  Search, SlidersHorizontal, Mic, Pin,
  MessageSquarePlus, BadgeCheck, X,
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

  // Düşünce balonu state — localStorage ile kalıcı
  const [thought, setThought] = useState<string>(() => localStorage.getItem("loop_thought") ?? "");
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thoughtDraft, setThoughtDraft] = useState("");
  const thoughtInputRef = useRef<HTMLTextAreaElement>(null);

  const openThought = () => {
    setThoughtDraft(thought);
    setThoughtOpen(true);
    setTimeout(() => thoughtInputRef.current?.focus(), 50);
  };
  const saveThought = () => {
    const val = thoughtDraft.trim();
    setThought(val);
    localStorage.setItem("loop_thought", val);
    setThoughtOpen(false);
  };
  const clearThought = () => {
    setThought("");
    localStorage.removeItem("loop_thought");
    setThoughtOpen(false);
  };

  const fetchConversations = async () => {
    const res = await fetch("/api/dm/conversations");
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

  useEffect(() => { fetchConversations(); }, []);

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

  const filteredConvs = conversations.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.user?.displayName?.toLowerCase().includes(q) ||
        c.user?.username?.toLowerCase().includes(q) ||
        c.lastMessage.content?.toLowerCase().includes(q)
      );
    }
    if (activeTab === "okunmamis") return c.unreadCount > 0;
    return true;
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

              {/* ── My own card with thought bubble ── */}
              <div className="flex-shrink-0 w-[72px] flex flex-col">
                {/* Speech bubble — tıklanabilir */}
                <button
                  onClick={openThought}
                  className="relative flex justify-center mb-1.5 z-10 group"
                >
                  <div className="relative bg-card border border-border shadow-md rounded-2xl px-2 py-1.5 w-[88px] hover:border-primary/50 transition-colors">
                    <p className="text-[7.5px] font-medium text-foreground/70 text-center leading-tight line-clamp-2">
                      {thought || "Düşüncelerini Loop diye paylaş :)"}
                    </p>
                    {/* tail */}
                    <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-card border-b border-r border-border rotate-45" />
                  </div>
                </button>

                {/* Card body */}
                <button
                  onClick={openThought}
                  className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden hover:border-primary/40 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="h-7 bg-gradient-to-r from-violet-500/40 via-purple-500/30 to-fuchsia-400/30" />
                  <div className="flex justify-center -mt-4 mb-1.5">
                    <div className="relative">
                      <Avatar className="border-[2px] border-card shadow-md ring-1 ring-primary/30" style={{ width: 36, height: 36 }}>
                        <AvatarImage src={me?.avatarUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-violet-400/40 text-primary font-bold text-sm">
                          {me?.displayName?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold text-primary truncate text-center px-1.5 pb-2 leading-tight">
                    Sen
                  </p>
                </button>
              </div>

              {conversations.map((c, idx) => {
                const isOnline = idx < 4;
                return (
                  <button
                    key={c.user?.id ?? idx}
                    onClick={() => setLocation(`/dm/${c.user?.id}`)}
                    className="flex-shrink-0 w-[72px] rounded-2xl bg-card border border-border shadow-sm overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group active:scale-95"
                  >
                    <div className="h-7 bg-gradient-to-r from-violet-500/30 via-purple-400/20 to-pink-400/20" />
                    <div className="flex justify-center -mt-4 mb-1.5 relative">
                      <div className="relative">
                        <Avatar className="border-[2px] border-card shadow-md" style={{ width: 36, height: 36 }}>
                          <AvatarImage src={c.user?.avatarUrl || ""} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-violet-400/40 text-primary font-bold text-sm">
                            {c.user?.displayName?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                        )}
                        {c.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold text-foreground truncate text-center px-1.5 pb-2 leading-tight">
                      {c.user?.displayName?.split(" ")[0] ?? "?"}
                    </p>
                  </button>
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
                const preview = lastMsgPreview(c.lastMessage);
                const isSpecial = isSpecialPreview(c.lastMessage);
                const isAudio = c.lastMessage.mediaType === "audio";
                const time = formatMsgTime(c.lastMessage.createdAt);
                const isOnline = idx < 3; // decorative online indicator for first few

                return (
                  <button
                    key={c.user?.id ?? idx}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left border-b border-border/30 last:border-0"
                    onClick={() => setLocation(`/dm/${c.user?.id}`)}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-13 h-13 border-2 border-background shadow-sm" style={{ width: 52, height: 52 }}>
                        <AvatarImage src={c.user?.avatarUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-400/30 text-primary font-bold text-base">
                          {c.user?.displayName?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-bold text-[15px] truncate ${c.unreadCount > 0 ? "text-foreground" : "text-foreground/90"}`}>
                            {c.user?.displayName ?? "Bilinmiyor"}
                          </span>
                          {idx % 3 === 0 && (
                            <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">{time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${
                          c.unreadCount > 0
                            ? "text-foreground font-medium"
                            : isSpecial
                              ? "text-muted-foreground italic"
                              : "text-muted-foreground"
                        }`}>
                          {preview}
                        </p>
                        <div className="flex-shrink-0">
                          {c.unreadCount > 0 ? (
                            <span className="w-5 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                              {c.unreadCount > 9 ? "9+" : c.unreadCount}
                            </span>
                          ) : isAudio ? (
                            <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : idx % 5 === 0 ? (
                            <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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
