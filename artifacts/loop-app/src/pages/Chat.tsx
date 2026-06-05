import { useState, useEffect, useRef } from "react";
import { Search, Mic, Send, SquareSquare, Smile, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListChatMessages, useSendChatMessage, getListChatMessagesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";

const TENOR_KEY = "LIVDSRZULELA";

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const { data: messages, isLoading } = useListChatMessages({ query: { queryKey: getListChatMessagesQueryKey() } });
  const sendMutation = useSendChatMessage();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{ url: string; preview: string }[]>([]);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifLoading, setGifLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    } catch {
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  };

  const openGifPicker = () => {
    setGifOpen(true);
    if (gifs.length === 0) searchGifs("");
  };

  const handleSend = () => {
    if (!content.trim()) return;
    sendMutation.mutate({ data: { type: "text", content } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      }
    });
  };

  const handleSendGif = (url: string) => {
    sendMutation.mutate({ data: { type: "gif", gifUrl: url } }, {
      onSuccess: () => {
        setGifOpen(false);
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob);
        try {
          const res = await fetch("/api/chat/voice", { method: "POST", body: formData });
          if (res.ok) queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
        } catch { /* ignore */ }
      };

      recorder.start();
      setIsRecording(true);
    } catch { /* microphone denied */ }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {isLoading ? (
            <div className="text-center text-muted-foreground p-4">Yükleniyor...</div>
          ) : (
            messages?.map(msg => {
              const isMe = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <button
                    className="flex-shrink-0"
                    onClick={() => setLocation(`/profile/${msg.userId}`)}
                  >
                    <Avatar className="w-8 h-8 hover:opacity-80 transition-opacity">
                      <AvatarImage src={msg.user?.avatarUrl || ""} />
                      <AvatarFallback>{msg.user?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <button
                        className="text-xs font-semibold hover:underline"
                        onClick={() => setLocation(`/profile/${msg.userId}`)}
                      >
                        {msg.user?.displayName}
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.createdAt), { locale: tr, addSuffix: true })}
                      </span>
                    </div>

                    {msg.type === "text" && (
                      <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}

                    {msg.type === "gif" && msg.gifUrl && (
                      <img src={msg.gifUrl} alt="GIF" className="rounded-xl max-w-[200px] h-auto border border-border" />
                    )}

                    {msg.type === "voice" && msg.voiceUrl && (
                      <div className={`px-4 py-3 rounded-2xl flex items-center gap-2 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                        <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-current border-b-4 border-b-transparent ml-1" />
                        <div className="w-24 h-1.5 bg-current/30 rounded-full overflow-hidden flex-shrink-0">
                          <div className="w-1/3 h-full bg-current rounded-full" />
                        </div>
                        <span className="text-[10px] flex-shrink-0">{msg.voiceDuration || 0}s</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {gifOpen && (
          <div className="border-t border-border bg-background p-3">
            <div className="flex gap-2 mb-2 items-center">
              <div className="flex-1 relative">
                <Input
                  value={gifSearch}
                  onChange={e => setGifSearch(e.target.value)}
                  placeholder="GIF ara... (Tenor)"
                  onKeyDown={e => e.key === 'Enter' && searchGifs()}
                  className="h-8 pr-8"
                  autoFocus
                />
              </div>
              <Button size="sm" className="h-8 px-3" onClick={() => searchGifs()}>
                <Search className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setGifOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
              {gifLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <div key={i} className="aspect-square bg-muted rounded animate-pulse" />
                ))
              ) : gifs.length === 0 ? (
                <p className="col-span-4 text-center text-xs text-muted-foreground py-4">Sonuç bulunamadı</p>
              ) : (
                gifs.map((gif, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendGif(gif.url)}
                    className="aspect-square rounded overflow-hidden hover:opacity-80 transition-opacity bg-muted"
                  >
                    <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">Tenor tarafından desteklenmektedir</p>
          </div>
        )}

        <div className="p-3 bg-background border-t border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`text-muted-foreground rounded-full flex-shrink-0 ${gifOpen ? 'text-primary bg-primary/10' : ''}`}
            onClick={openGifPicker}
          >
            <SquareSquare className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative">
            <Input
              placeholder={isRecording ? "Kaydediliyor..." : "Mesaj yaz..."}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="rounded-full pr-10 bg-secondary/50 border-transparent focus-visible:ring-1 focus-visible:bg-background"
              disabled={isRecording}
            />
          </div>

          {content.trim() ? (
            <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleSend} disabled={sendMutation.isPending}>
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="secondary"
              className={`rounded-full flex-shrink-0 ${isRecording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
