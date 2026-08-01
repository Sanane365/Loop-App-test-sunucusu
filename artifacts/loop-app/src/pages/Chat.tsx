import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Send, SquareSquare, X, Users, ImagePlus,
  StopCircle, Plus, Smile, ArrowRight, MessageCircle, Reply,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListChatMessages,
  useSendChatMessage,
  getListChatMessagesQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import GifPicker from "@/components/shared/GifPicker";

interface ActiveUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
}

interface MentionUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const { data: messages, isLoading } = useListChatMessages(undefined, {
    query: { queryKey: getListChatMessagesQueryKey() },
  });
  const sendMutation = useSendChatMessage();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GIF state
  const [gifOpen, setGifOpen] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active users panel
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  // @mention state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMapRef = useRef<Record<string, number>>({});

  // Playing voice
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<{ username: string; displayName: string }[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Swipe to reply
  const [replyTo, setReplyTo] = useState<{ id: number; content: string; displayName: string } | null>(null);
  const swipeTouchStartX = useRef<number>(0);
  const swipeTouchMsgId = useRef<number | null>(null);
  const [swipingMsgId, setSwipingMsgId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Swipe state for panel
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
    }, 3000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const fetchActiveUsers = useCallback(async () => {
    const res = await fetch("/api/chat/active-users");
    if (res.ok) setActiveUsers(await res.json());
  }, []);

  // Auto-refresh active users every 30s
  useEffect(() => {
    fetchActiveUsers();
    const t = setInterval(fetchActiveUsers, 30000);
    return () => clearInterval(t);
  }, [fetchActiveUsers]);

  // Poll typing state every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/chat/typing", { credentials: "include" });
        if (r.ok) setTypingUsers(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, []);

  const openPanel = useCallback(() => {
    fetchActiveUsers();
    setPanelOpen(true);
  }, [fetchActiveUsers]);

  // Swipe gesture: start in the middle 40% of screen, drag left → open panel
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = touchStartX.current - t.clientX;   // positive = swipe left
    const dy = Math.abs(t.clientY - touchStartY.current);
    const screenW = window.innerWidth;
    const startedMiddle = touchStartX.current > screenW * 0.3 && touchStartX.current < screenW * 0.8;
    if (startedMiddle && dx > 60 && dy < 60) {
      openPanel();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // @mention autocomplete
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);
    // Typing signal — throttled to once per 2.5s
    const now = Date.now();
    if (val.trim() && now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      fetch("/api/chat/typing", { method: "POST", credentials: "include" }).catch(() => {});
    }
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionSearch(query);
      setMentionIndex(0);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const users: MentionUser[] = await res.json();
          setMentionUsers(users.slice(0, 6));
          users.forEach(u => { mentionMapRef.current[u.username] = u.id; });
        }
      } catch { setMentionUsers([]); }
    } else {
      setMentionSearch(null);
      setMentionUsers([]);
    }
  };

  const insertMention = (u: MentionUser) => {
    mentionMapRef.current[u.username] = u.id;
    const cursor = inputRef.current?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const before = textBeforeCursor.slice(0, textBeforeCursor.length - mentionMatch[0].length);
      const after = content.slice(cursor);
      setContent(`${before}@${u.username} ${after}`);
    }
    setMentionSearch(null);
    setMentionUsers([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSearch !== null && mentionUsers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionUsers.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionSearch(null); setMentionUsers([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openGifPicker = () => { setGifOpen(true); };

  const handleSend = () => {
    const text = content.trim();
    if (!text) return;
    const finalContent = replyTo
      ? `__LOOP_REPLY__:${replyTo.displayName}:${replyTo.content.slice(0, 100)}\n${text}`
      : text;
    setContent("");
    setMentionSearch(null);
    setMentionUsers([]);
    setReplyTo(null);
    sendMutation.mutate({ data: { type: "text", content: finalContent } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }),
      onError: () => {
        setContent(text);
        toast({ title: "Hata", description: "Mesaj gönderilemedi.", variant: "destructive" });
      },
    });
  };

  const handleSendGif = (url: string) => {
    sendMutation.mutate({ data: { type: "gif", gifUrl: url } }, {
      onSuccess: () => { setGifOpen(false); queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }); }
    });
  };

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/chat/media", { method: "POST", body: formData });
      if (res.ok) queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      else toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
    } catch {
      toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) return;
        const ext = mimeType.includes("ogg") ? ".ogg" : ".webm";
        const formData = new FormData();
        formData.append("file", audioBlob, `voice${ext}`);
        try {
          const res = await fetch("/api/chat/voice", { method: "POST", body: formData });
          if (res.ok) queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
        } catch { /* ignore */ }
      };
      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: "Mikrofon erişimi reddedildi", description: "Tarayıcı ayarlarından mikrofon iznini etkinleştir.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  const handlePlayVoice = (msgId: number, voiceUrl: string) => {
    if (playingId === msgId) { audioRef.current?.pause(); setPlayingId(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(voiceUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(msgId);
    audio.onended = () => setPlayingId(null);
  };

  const navigateToMentionedUser = async (username: string) => {
    const cached = mentionMapRef.current[username];
    if (cached) { setLocation(`/profile/${cached}`); return; }
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(username)}`);
      if (res.ok) {
        const users: { id: number; username: string }[] = await res.json();
        const exact = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (exact) { mentionMapRef.current[username] = exact.id; setLocation(`/profile/${exact.id}`); }
      }
    } catch { /* ignore */ }
  };

  const renderMessage = (text: string) =>
    text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-semibold cursor-pointer hover:underline"
          onClick={() => navigateToMentionedUser(part.slice(1))}>{part}</span>
      ) : part
    );

  const formatMsgTime = (iso: string) => {
    try { return format(new Date(iso), "HH:mm", { locale: tr }); } catch { return ""; }
  };

  return (
    <AppLayout>
      {/* Overlay for panel backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Sliding Users Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-50 flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-semibold text-base">Çevrimiçi</span>
            <span className="text-muted-foreground text-sm font-medium">{activeUsers.length || 87}</span>
          </div>
          <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeUsers.length === 0 ? (
            /* Placeholder users while loading / empty */
            [
              { name: "yosun", status: "Sohbette" },
              { name: "ceraunopile", status: "Sohbette" },
              { name: "elifx", status: "Sohbette" },
              { name: "mert_07", status: "Sohbette" },
              { name: "zeynep", status: "Sohbette" },
              { name: "arda", status: "Sohbette" },
              { name: "berkx", status: "Sohbette" },
              { name: "defne", status: "Sohbette" },
            ].map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-default">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-base font-bold text-muted-foreground">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.status}</p>
                </div>
              </div>
            ))
          ) : (
            activeUsers.map(u => (
              <button
                key={u.id}
                onClick={() => { setPanelOpen(false); setLocation(`/profile/${u.id}`); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="relative">
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={u.avatarUrl || ""} />
                    <AvatarFallback className="font-bold">{u.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">Sohbette</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* See all */}
        <div className="p-4 border-t border-border">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors">
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div
        className="flex flex-col h-[calc(100vh-3.5rem-4rem)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Header ── */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-background">
          {/* Left: menu icon */}
          <button className="p-1.5 -ml-1 text-foreground hover:bg-muted rounded-xl transition-colors mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Center: title + online count */}
          <div className="flex-1">
            <h1 className="font-black italic text-xl leading-tight tracking-tight">Genel Sohbet</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">{activeUsers.length > 0 ? `${activeUsers.length} çevrimiçi` : "Yükleniyor..."}</span>
            </div>
          </div>

          {/* Right: users + chat icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={openPanel}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={openPanel}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
          ref={scrollRef}
          style={{ background: "hsl(var(--background))" }}
        >
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className={`flex gap-2 items-end ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0 animate-pulse" />
                <div className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "w-48" : "w-36"}`} />
              </div>
            ))
          ) : (
            messages?.map((msg, idx) => {
              const isMe = msg.userId === user?.id;
              const prevMsg = messages[idx - 1];
              const sameUserAsPrev = prevMsg?.userId === msg.userId;

              const msgPreview = msg.type === "text" ? (msg.content ?? "").replace(/^__LOOP_REPLY__:[^\n]+\n/, "").slice(0, 100) : msg.type === "gif" ? "GIF" : msg.voiceUrl ? "Sesli mesaj" : "Medya";
              return (
                <div key={msg.id} className={`relative ${sameUserAsPrev ? "mt-0.5" : "mt-4"}`}>
                  {/* Reply icon (fixed, revealed behind sliding row) */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                    style={{ opacity: swipingMsgId === msg.id ? Math.min(swipeOffset / 48, 1) : 0, transition: swipingMsgId === msg.id ? "none" : "opacity 0.15s" }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${swipeOffset >= 48 && swipingMsgId === msg.id ? "bg-primary/20" : "bg-muted"}`}>
                      <Reply className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Sliding row */}
                  <div className={`relative z-10 flex gap-2.5 items-end ${isMe ? "flex-row-reverse" : ""}`}
                    style={swipingMsgId === msg.id ? { transform: `translateX(${swipeOffset}px)`, transition: "none" } : { transform: "translateX(0)", transition: "transform 0.2s ease" }}
                    onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; swipeTouchMsgId.current = msg.id; setSwipingMsgId(msg.id); setSwipeOffset(0); }}
                    onTouchMove={(e) => { if (swipeTouchMsgId.current !== msg.id) return; const dx = e.touches[0].clientX - swipeTouchStartX.current; if (dx > 4) setSwipeOffset(Math.min(dx, 72)); }}
                    onTouchEnd={() => { if (swipingMsgId === msg.id && swipeOffset >= 48) { setReplyTo({ id: msg.id, content: msgPreview, displayName: msg.user?.displayName ?? "Kullanıcı" }); if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25); } setSwipingMsgId(null); setSwipeOffset(0); swipeTouchMsgId.current = null; }}
                  >
                  {/* Avatar — hide if same user as previous */}
                  <button
                    className={`flex-shrink-0 self-end ${sameUserAsPrev ? "opacity-0 pointer-events-none" : ""}`}
                    onClick={() => !sameUserAsPrev && setLocation(`/profile/${msg.userId}`)}
                  >
                    <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                      <AvatarImage src={msg.user?.avatarUrl || ""} />
                      <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                        {msg.user?.displayName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[72%]`}>
                    {/* Sender name (only first in group) */}
                    {!isMe && !sameUserAsPrev && (
                      <button
                        className="text-xs font-bold text-primary mb-1 ml-1 hover:underline"
                        onClick={() => setLocation(`/profile/${msg.userId}`)}
                      >
                        {msg.user?.displayName}
                      </button>
                    )}

                    {/* Text bubble */}
                    {msg.type === "text" && (
                      <>
                        <div
                          className={`px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm overflow-hidden ${
                            isMe
                              ? "bg-primary/10 dark:bg-primary/20 text-foreground rounded-3xl rounded-br-md"
                              : "bg-card border border-border text-foreground rounded-3xl rounded-bl-md"
                          }`}
                          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                        >
                          {(() => {
                            const c = msg.content ?? "";
                            if (c.startsWith("__LOOP_REPLY__:")) {
                              const withoutPrefix = c.slice("__LOOP_REPLY__:".length);
                              const nl = withoutPrefix.indexOf("\n");
                              const header = nl !== -1 ? withoutPrefix.slice(0, nl) : withoutPrefix;
                              const actual = nl !== -1 ? withoutPrefix.slice(nl + 1) : "";
                              const colon = header.indexOf(":");
                              const refName = colon !== -1 ? header.slice(0, colon) : header;
                              const refSnippet = colon !== -1 ? header.slice(colon + 1) : "";
                              return (
                                <>
                                  <div className={`border-l-2 border-primary/60 pl-2 py-0.5 mb-2 rounded-sm overflow-hidden ${isMe ? "bg-primary/10" : "bg-muted/50"}`} style={{ maxWidth: "100%" }}>
                                    <p className="text-[11px] font-bold text-primary leading-none truncate">{refName}</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{refSnippet}</p>
                                  </div>
                                  {renderMessage(actual)}
                                </>
                              );
                            }
                            return renderMessage(c);
                          })()}
                        </div>
                        {/* Like count if any */}
                        {(msg as any).likeCount > 0 && (
                          <div className="flex items-center gap-1 mt-1 ml-1">
                            <span className="text-rose-500 text-xs">♥</span>
                            <span className="text-xs text-muted-foreground">{(msg as any).likeCount}</span>
                          </div>
                        )}
                        {/* Timestamp */}
                        <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      </>
                    )}

                    {/* Image */}
                    {(msg.type as string) === "image" && msg.content && (
                      <div className="rounded-2xl overflow-hidden border border-border max-w-[220px] shadow-sm">
                        <img src={msg.content} alt="görsel" className="w-full h-auto object-cover" />
                        <div className="text-[10px] text-muted-foreground px-3 py-1">{formatMsgTime(msg.createdAt)}</div>
                      </div>
                    )}

                    {/* GIF */}
                    {msg.type === "gif" && msg.gifUrl && (
                      <div>
                        <img src={msg.gifUrl} alt="GIF" className="rounded-2xl max-w-[200px] h-auto border border-border shadow-sm" />
                        <span className="text-[10px] text-muted-foreground ml-1">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}

                    {/* Voice */}
                    {msg.type === "voice" && msg.voiceUrl && (
                      <div>
                        <button
                          onClick={() => handlePlayVoice(msg.id, msg.voiceUrl!)}
                          className={`px-4 py-3 rounded-3xl flex items-center gap-3 transition-colors shadow-sm ${
                            isMe
                              ? "bg-primary/10 text-foreground rounded-br-md hover:bg-primary/20"
                              : "bg-card border border-border text-foreground rounded-bl-md hover:bg-muted"
                          }`}
                        >
                          {playingId === msg.id ? (
                            <StopCircle className="w-5 h-5 flex-shrink-0 text-primary" />
                          ) : (
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-primary border-b-[6px] border-b-transparent ml-0.5 flex-shrink-0" />
                          )}
                          <div className="flex gap-0.5 items-center h-4">
                            {Array(14).fill(0).map((_, i) => (
                              <div key={i} className={`w-0.5 rounded-full bg-primary/60 transition-all ${playingId === msg.id ? "animate-pulse" : ""}`}
                                style={{ height: `${20 + Math.sin(i * 1.1) * 60}%` }} />
                            ))}
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{msg.voiceDuration || 0}s</span>
                        </button>
                        <span className="text-[10px] text-muted-foreground ml-1">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator — only when someone is actually typing */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 pt-2 pl-4">
              <div className="flex items-center gap-0.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                  />
                ))}
              </div>
              <span className="text-sm text-primary font-medium italic">
                {typingUsers.length === 1
                  ? `${typingUsers[0].displayName} yazıyor...`
                  : `${typingUsers.map(u => u.displayName).join(", ")} yazıyor...`}
              </span>
            </div>
          )}
        </div>

        {/* Reply preview bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center gap-3">
            <div className="w-0.5 h-9 bg-primary rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary truncate leading-tight">{replyTo.displayName}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground p-1 hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* GIF picker */}
        {gifOpen && (
          <GifPicker
            onSelect={(url) => { handleSendGif(url); setGifOpen(false); }}
            onClose={() => setGifOpen(false)}
          />
        )}

        {/* ── Input bar ── */}
        <div className="px-3 py-3 bg-background border-t border-border relative">
          {/* @mention dropdown */}
          {mentionSearch !== null && mentionUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-2xl shadow-lg overflow-hidden z-20">
              {mentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left ${i === mentionIndex ? "bg-accent" : ""}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={u.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{u.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{u.displayName}</span>
                  <span className="text-xs text-muted-foreground">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-1 pb-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs text-destructive font-medium">Kaydediliyor... {recordingSeconds}s</span>
              <span className="text-xs text-muted-foreground ml-auto">Dur butonuna bas</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
          />

          <div className="flex items-center gap-2">
            {/* + button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Emoji / GIF */}
            <button
              onClick={openGifPicker}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors flex-shrink-0 ${gifOpen ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder={isRecording ? "Kaydediliyor..." : "Mesajını yaz..."}
                value={content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="rounded-full h-11 bg-muted/60 border-transparent focus-visible:ring-1 focus-visible:ring-primary/30 pr-4 pl-5 text-sm"
                disabled={isRecording}
              />
            </div>

            {/* Send / Mic / Stop */}
            {content.trim() ? (
              <Button
                size="icon"
                className="rounded-full w-11 h-11 flex-shrink-0 bg-primary hover:bg-primary/90 shadow-md"
                onClick={handleSend}
                disabled={sendMutation.isPending}
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md flex-shrink-0 transition-colors"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex-shrink-0 transition-colors"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
