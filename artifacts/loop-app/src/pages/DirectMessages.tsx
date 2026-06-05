import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = async () => {
    const res = await fetch("/api/dm/conversations");
    if (res.ok) setConversations(await res.json());
  };

  const fetchMessages = async (uid: number) => {
    const res = await fetch(`/api/dm/${uid}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
      if (data[0]?.sender) {
        const other = data.find((m: DmMessage) => m.senderId !== me?.id);
        if (other?.sender) setOtherUser(other.sender);
      }
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
  }, []);

  useEffect(() => {
    if (userId) {
      const uid = parseInt(userId);
      fetchMessages(uid);
      fetchOtherUser(uid);
      const interval = setInterval(() => fetchMessages(uid), 3000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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

  if (userId) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
          <div className="flex items-center gap-3 p-3 border-b border-border bg-background">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/dm")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {otherUser && (
              <button className="flex items-center gap-2 hover:opacity-80" onClick={() => setLocation(`/profile/${otherUser.id}`)}>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={otherUser.avatarUrl || ""} />
                  <AvatarFallback>{otherUser.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-semibold">{otherUser.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">@{otherUser.username}</p>
                </div>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <MessageCircle className="w-12 h-12 opacity-30" />
                <p className="text-sm">Henüz mesaj yok. İlk mesajı gönder!</p>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.senderId === me?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={msg.sender?.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{msg.sender?.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {msg.content && (
                      <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
                        {msg.content}
                      </div>
                    )}
                    {msg.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border border-border max-w-[200px]">
                        {msg.mediaType === "video" ? (
                          <video src={msg.mediaUrl} controls className="w-full" />
                        ) : (
                          <img src={msg.mediaUrl} alt="medya" className="w-full h-auto object-cover" />
                        )}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(msg.createdAt), { locale: tr, addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-background border-t border-border flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-5 h-5" />
            </Button>
            <Input
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Mesaj yaz..."
              className="flex-1 rounded-full bg-secondary/50 border-transparent"
            />
            <Button size="icon" className="rounded-full" onClick={handleSend} disabled={!content.trim() || sending}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 pb-24">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
          <MessageCircle className="w-6 h-6 text-primary" />
          Mesajlar
        </h1>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <MessageCircle className="w-12 h-12 opacity-30" />
            <p>Henüz mesajlaşma yok. Bir kullanıcının profiline gidip mesaj gönder!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => (
              <button
                key={c.user?.id}
                className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors text-left"
                onClick={() => setLocation(`/dm/${c.user?.id}`)}
              >
                <Avatar className="w-11 h-11">
                  <AvatarImage src={c.user?.avatarUrl || ""} />
                  <AvatarFallback>{c.user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{c.user?.displayName}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(c.lastMessage.createdAt), { locale: tr, addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.lastMessage.content ?? (c.lastMessage.mediaUrl ? "📷 Medya" : "...")}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {c.unreadCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
