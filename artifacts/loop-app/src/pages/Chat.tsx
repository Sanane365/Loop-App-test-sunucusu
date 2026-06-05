import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListChatMessages, useSendChatMessage, getListChatMessagesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Image as ImageIcon, Smile, SquareSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Chat() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const { data: messages, isLoading } = useListChatMessages({ query: { queryKey: getListChatMessagesQueryKey() } });
  const sendMutation = useSendChatMessage();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<string[]>([]);
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

  const searchGifs = async () => {
    try {
      const q = gifSearch || "trending";
      const res = await fetch(`https://api.tenor.com/v1/search?q=${q}&key=LIVDSRZULELA&limit=12`);
      const data = await res.json();
      setGifs(data.results.map((r: any) => r.media[0].gif.url));
    } catch (e) {
      // fallback
      setGifs([
        "https://media.tenor.com/images/3f1d43a50bc0c5d6e2e5050f2a74c3d8/tenor.gif",
        "https://media.tenor.com/images/84777e5d8ffae8d76a26df01fc8b2611/tenor.gif"
      ]);
    }
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
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
          }
        } catch (error) {
          console.error("Voice upload failed", error);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error", err);
    }
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
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={msg.user?.avatarUrl || ""} />
                    <AvatarFallback>{msg.user?.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold">{msg.user?.displayName}</span>
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
                      <img src={msg.gifUrl} alt="GIF" className="rounded-xl max-w-full h-auto border border-border" />
                    )}
                    
                    {msg.type === "voice" && msg.voiceUrl && (
                      <div className={`px-4 py-3 rounded-2xl flex items-center gap-2 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                        <Button size="icon" variant={isMe ? "secondary" : "default"} className="w-8 h-8 rounded-full flex-shrink-0 bg-background/20 hover:bg-background/30 text-current">
                          <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-current border-b-4 border-b-transparent ml-1" />
                        </Button>
                        <div className="w-24 h-1.5 bg-primary-foreground/30 rounded-full overflow-hidden flex-shrink-0">
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

        <div className="p-3 bg-background border-t border-border flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full flex-shrink-0" onClick={() => searchGifs()}>
                <SquareSquare className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex gap-2 mb-2">
                <Input value={gifSearch} onChange={e => setGifSearch(e.target.value)} placeholder="GIF ara..." onKeyDown={e => e.key === 'Enter' && searchGifs()} className="h-8" />
                <Button size="sm" className="h-8" onClick={searchGifs}><Search className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {gifs.map((url, i) => (
                  <img key={i} src={url} alt="GIF" className="rounded cursor-pointer hover:opacity-80" onClick={() => handleSendGif(url)} />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1 relative">
            <Input 
              placeholder={isRecording ? "Kaydediliyor..." : "Mesaj yaz..."} 
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="rounded-full pr-10 bg-secondary/50 border-transparent focus-visible:ring-1 focus-visible:bg-background"
              disabled={isRecording}
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground rounded-full">
              <Smile className="w-5 h-5" />
            </Button>
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

// Needed missing import
import { Search } from "lucide-react";
