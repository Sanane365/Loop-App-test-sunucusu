import { useState, useEffect, useRef } from "react";
import { Search, Mic, Send, SquareSquare, X, Users, ImagePlus, StopCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListChatMessages, useSendChatMessage, getListChatMessagesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const TENOR_KEY = "LIVDSRZULELA";

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
  const { data: messages, isLoading } = useListChatMessages({ query: { queryKey: getListChatMessagesQueryKey() } });
  const sendMutation = useSendChatMessage();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GIF state
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{ url: string; preview: string }[]>([]);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active users
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [activeOpen, setActiveOpen] = useState(false);

  // @mention state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Map username → userId for click navigation
  const mentionMapRef = useRef<Record<string, number>>({});

  // Playing voice
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const fetchActiveUsers = async () => {
    const res = await fetch("/api/chat/active-users");
    if (res.ok) setActiveUsers(await res.json());
  };

  // @mention autocomplete
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);

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
      const newContent = `${before}@${u.username} ${after}`;
      setContent(newContent);
    }
    setMentionSearch(null);
    setMentionUsers([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSearch !== null && mentionUsers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionUsers.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === "Tab") { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === "Enter") { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionSearch(null); setMentionUsers([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const searchGifs = async (q?: string) => {
    setGifLoading(true);
    try {
      const query = (q ?? gifSearch) || "trending";
      const endpoint = (q === undefined && !gifSearch)
        ? `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=16&media_filter=minimal`
        : `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=16&media_filter=minimal`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results?.map((r: any) => ({
        url: r.media[0]?.gif?.url ?? r.media[0]?.tinygif?.url,
        preview: r.media[0]?.tinygif?.url ?? r.media[0]?.gif?.url,
      })).filter((g: any) => g.url) ?? []);
    } catch { setGifs([]); }
    finally { setGifLoading(false); }
  };

  const openGifPicker = () => {
    setGifOpen(true);
    if (gifs.length === 0) searchGifs("");
  };

  const handleSend = () => {
    const text = content.trim();
    if (!text) return;
    const toSend = text;
    setContent("");
    setMentionSearch(null);
    setMentionUsers([]);
    sendMutation.mutate({ data: { type: "text", content: toSend } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      },
      onError: () => {
        setContent(toSend);
        toast({ title: "Hata", description: "Mesaj gönderilemedi.", variant: "destructive" });
      }
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
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      } else {
        toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) return; // Empty recording
        const ext = mimeType.includes("ogg") ? ".ogg" : ".webm";
        const formData = new FormData();
        formData.append("file", audioBlob, `voice${ext}`);
        try {
          const res = await fetch("/api/chat/voice", { method: "POST", body: formData });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
          }
        } catch { /* ignore */ }
      };

      recorder.start(200); // collect data every 200ms
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
    if (playingId === msgId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }
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

  const renderMessage = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span
          key={i}
          className="text-primary font-semibold cursor-pointer hover:underline"
          onClick={() => navigateToMentionedUser(part.slice(1))}
        >
          {part}
        </span>
      ) : part
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
          <span className="font-semibold text-sm">Genel Sohbet</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { fetchActiveUsers(); setActiveOpen(true); }}
          >
            <Users className="w-4 h-4" />
            Aktif Kullanıcılar
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {isLoading ? (
            <div className="text-center text-muted-foreground p-4">Yükleniyor...</div>
          ) : (
            messages?.map(msg => {
              const isMe = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <button className="flex-shrink-0" onClick={() => setLocation(`/profile/${msg.userId}`)}>
                    <Avatar className="w-8 h-8 hover:opacity-80 transition-opacity">
                      <AvatarImage src={msg.user?.avatarUrl || ""} />
                      <AvatarFallback>{msg.user?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <button className="text-xs font-semibold hover:underline" onClick={() => setLocation(`/profile/${msg.userId}`)}>
                        {msg.user?.displayName}
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.createdAt), { locale: tr, addSuffix: true })}
                      </span>
                    </div>
                    {msg.type === "text" && (
                      <div className={`px-4 py-2 rounded-2xl ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{renderMessage(msg.content ?? "")}</p>
                      </div>
                    )}
                    {msg.type === "image" && msg.content && (
                      <div className="rounded-2xl overflow-hidden border border-border max-w-[220px]">
                        <img src={msg.content} alt="görsel" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    {msg.type === "gif" && msg.gifUrl && (
                      <img src={msg.gifUrl} alt="GIF" className="rounded-xl max-w-[200px] h-auto border border-border" />
                    )}
                    {msg.type === "voice" && msg.voiceUrl && (
                      <button
                        onClick={() => handlePlayVoice(msg.id, msg.voiceUrl!)}
                        className={`px-4 py-3 rounded-2xl flex items-center gap-3 transition-colors ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm hover:bg-primary/90" : "bg-card border border-border rounded-tl-sm hover:bg-muted"}`}
                      >
                        {playingId === msg.id ? (
                          <StopCircle className="w-5 h-5 flex-shrink-0" />
                        ) : (
                          <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-current border-b-[6px] border-b-transparent ml-0.5 flex-shrink-0" />
                        )}
                        <div className="flex gap-0.5 items-center h-4">
                          {Array(12).fill(0).map((_, i) => (
                            <div key={i} className={`w-0.5 rounded-full bg-current transition-all ${playingId === msg.id ? "animate-pulse" : ""}`}
                              style={{ height: `${20 + Math.sin(i * 1.2) * 14}%` }} />
                          ))}
                        </div>
                        <span className="text-xs font-mono">{msg.voiceDuration || 0}s</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* GIF panel */}
        {gifOpen && (
          <div className="border-t border-border bg-background p-3">
            <div className="flex gap-2 mb-2 items-center">
              <Input
                value={gifSearch}
                onChange={e => setGifSearch(e.target.value)}
                placeholder="GIF ara... (Tenor)"
                onKeyDown={e => e.key === "Enter" && searchGifs()}
                className="flex-1 h-8"
                autoFocus
              />
              <Button size="sm" className="h-8 px-3" onClick={() => searchGifs()}><Search className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setGifOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
              {gifLoading ? Array(8).fill(0).map((_, i) => <div key={i} className="aspect-square bg-muted rounded animate-pulse" />) :
                gifs.length === 0 ? <p className="col-span-4 text-center text-xs text-muted-foreground py-4">Sonuç bulunamadı</p> :
                  gifs.map((gif, i) => (
                    <button key={i} onClick={() => handleSendGif(gif.url)} className="aspect-square rounded overflow-hidden hover:opacity-80 bg-muted">
                      <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))
              }
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">Tenor tarafından desteklenmektedir</p>
          </div>
        )}

        {/* Input area */}
        <div className="p-3 bg-background border-t border-border relative">
          {/* @mention dropdown */}
          {mentionSearch !== null && mentionUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-20">
              {mentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent transition-colors text-left ${i === mentionIndex ? "bg-accent" : ""}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={u.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{u.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{u.displayName}</span>
                  <span className="text-xs text-muted-foreground">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-2 pb-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs text-destructive font-medium">Kaydediliyor... {recordingSeconds}s</span>
              <span className="text-xs text-muted-foreground ml-auto">Dur butonuna bas</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
            />
            <Button
              variant="ghost" size="icon"
              className="text-muted-foreground rounded-full flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`text-muted-foreground rounded-full flex-shrink-0 ${gifOpen ? "text-primary bg-primary/10" : ""}`}
              onClick={openGifPicker}
            >
              <SquareSquare className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder={isRecording ? "Kaydediliyor..." : "Mesaj yaz... (@kullanıcı)"}
                value={content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="rounded-full bg-secondary/50 border-transparent focus-visible:ring-1 focus-visible:bg-background"
                disabled={isRecording}
              />
            </div>
            {content.trim() ? (
              <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleSend} disabled={sendMutation.isPending}>
                <Send className="w-5 h-5" />
              </Button>
            ) : isRecording ? (
              <Button
                size="icon"
                className="rounded-full flex-shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={stopRecording}
              >
                <StopCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                size="icon" variant="secondary"
                className="rounded-full flex-shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                onClick={startRecording}
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active Users Sheet */}
      <Sheet open={activeOpen} onOpenChange={setActiveOpen}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Aktif Kullanıcılar
            </SheetTitle>
            <SheetDescription>Son 5 dakikada aktif olanlar</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {activeUsers.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Şu an aktif kullanıcı yok</p>
            ) : (
              activeUsers.map(u => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                  onClick={() => { setActiveOpen(false); setLocation(`/profile/${u.id}`); }}
                >
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatarUrl || ""} />
                      <AvatarFallback className="text-xs">{u.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
