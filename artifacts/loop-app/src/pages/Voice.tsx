import { useListVoiceRooms, useJoinVoiceRoom, useLeaveVoiceRoom, useCreateVoiceRoom, getListVoiceRoomsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, Users, Plus, Radio, PhoneOff, Crown, MonitorUp, MonitorOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Voice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListVoiceRooms({ query: { queryKey: getListVoiceRoomsQueryKey(), refetchInterval: 4000 } });
  const joinMutation = useJoinVoiceRoom();
  const leaveMutation = useLeaveVoiceRoom();
  const createMutation = useCreateVoiceRoom();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);

  // Media state
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  // Streams
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Video elements
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const activeRoom = rooms?.find(r => r.id === activeRoomId);

  // Cleanup all streams on leave
  const stopAllStreams = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setMicOn(false);
    setCamOn(false);
    setScreenOn(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopAllStreams(), [stopAllStreams]);

  // Attach camera stream to video element
  useEffect(() => {
    if (camVideoRef.current && camStreamRef.current && camOn) {
      camVideoRef.current.srcObject = camStreamRef.current;
    }
  }, [camOn]);

  // Attach screen stream to video element
  useEffect(() => {
    if (screenVideoRef.current && screenStreamRef.current && screenOn) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [screenOn]);

  const handleJoin = (roomId: number) => {
    joinMutation.mutate({ roomId }, {
      onSuccess: () => {
        setActiveRoomId(roomId);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        // Auto-enable mic on join
        enableMic();
      },
      onError: () => {
        toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" });
      }
    });
  };

  const handleLeave = () => {
    if (!activeRoomId) return;
    stopAllStreams();
    leaveMutation.mutate({ roomId: activeRoomId }, {
      onSuccess: () => {
        setActiveRoomId(null);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
      }
    });
  };

  const handleCreate = () => {
    if (!newRoomName.trim()) return;
    createMutation.mutate({ data: { name: newRoomName, description: newRoomDesc } }, {
      onSuccess: (room) => {
        setIsDialogOpen(false);
        setNewRoomName("");
        setNewRoomDesc("");
        setActiveRoomId(room.id);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        enableMic();
      },
      onError: () => {
        toast({ title: "Hata", description: "Oda oluşturulamadı.", variant: "destructive" });
      }
    });
  };

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicOn(true);
    } catch {
      toast({ title: "Mikrofon erişimi reddedildi", description: "Tarayıcı ayarlarından mikrofon iznini etkinleştir.", variant: "destructive" });
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setMicOn(false);
    } else {
      await enableMic();
    }
  };

  const toggleCamera = async () => {
    if (camOn) {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      if (camVideoRef.current) camVideoRef.current.srcObject = null;
      setCamOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        camStreamRef.current = stream;
        setCamOn(true);
        // Attach after state update
        setTimeout(() => {
          if (camVideoRef.current) {
            camVideoRef.current.srcObject = stream;
            camVideoRef.current.play().catch(() => {});
          }
        }, 50);
      } catch {
        toast({ title: "Kamera erişimi reddedildi", description: "Tarayıcı ayarlarından kamera iznini etkinleştir.", variant: "destructive" });
      }
    }
  };

  const toggleScreen = async () => {
    if (screenOn) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      setScreenOn(false);
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setScreenOn(true);
        // Handle user stopping screen share via browser UI
        stream.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null;
          if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
          setScreenOn(false);
        };
        setTimeout(() => {
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
            screenVideoRef.current.play().catch(() => {});
          }
        }, 50);
      } catch {
        // User cancelled or permission denied — not an error to show
        setScreenOn(false);
      }
    }
  };

  if (activeRoom) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] p-4 gap-4">
          {/* Room header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary animate-pulse" />
                {activeRoom.name}
              </h2>
              {activeRoom.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{activeRoom.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              <span>{activeRoom.participantCount}</span>
            </div>
          </div>

          {/* Screen share preview */}
          {screenOn && (
            <div className="rounded-xl overflow-hidden bg-black border border-border relative">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-48 object-contain"
              />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <MonitorUp className="w-3 h-3" /> Ekran paylaşılıyor
              </div>
            </div>
          )}

          {/* Camera preview (self) */}
          {camOn && (
            <div className="rounded-xl overflow-hidden bg-black border border-primary/40 relative self-end w-32">
              <video
                ref={camVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">Sen</div>
            </div>
          )}

          {/* Participants grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              {activeRoom.participants?.map((p) => {
                const isHost = p.id === activeRoom.createdBy;
                const isCurrentUser = p.id === user?.id;
                return (
                  <div key={p.id} className={`flex flex-col items-center gap-2 p-3 bg-card border rounded-2xl relative transition-all ${isCurrentUser && micOn ? "border-primary/60 shadow-[0_0_12px_rgba(139,92,246,0.2)]" : "border-border"}`}>
                    {isHost && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-3.5 h-3.5 text-yellow-500" />
                      </div>
                    )}
                    <div className="relative">
                      <Avatar className={`w-16 h-16 border-2 transition-all ${isCurrentUser && micOn ? "border-primary animate-pulse" : "border-primary/20"}`}>
                        <AvatarImage src={p.avatarUrl || ""} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                          {p.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isCurrentUser && (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card ${micOn ? "bg-green-500" : "bg-destructive"}`}>
                          {micOn
                            ? <Mic className="w-2.5 h-2.5 text-white" />
                            : <MicOff className="w-2.5 h-2.5 text-white" />
                          }
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold truncate w-full">{p.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">@{p.username}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 flex-wrap pb-2">
            <button
              onClick={toggleMic}
              className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl transition-colors ${micOn ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{micOn ? "Açık" : "Kapalı"}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl transition-colors ${camOn ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
            >
              {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{camOn ? "Açık" : "Kamera"}</span>
            </button>

            <button
              onClick={handleLeave}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors scale-110"
            >
              <PhoneOff className="w-7 h-7" />
              <span className="text-[10px] font-medium">Ayrıl</span>
            </button>

            <button
              onClick={toggleScreen}
              className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl transition-colors ${screenOn ? "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
            >
              {screenOn ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{screenOn ? "Paylaşıyor" : "Ekran"}</span>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6 pb-20">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Sesli Odalar
          </h1>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full shadow-md gap-1">
                <Plus className="w-4 h-4" /> Yeni Oda
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl w-[90vw] max-w-md">
              <DialogHeader>
                <DialogTitle>Sesli Oda Oluştur</DialogTitle>
                <DialogDescription>Yeni bir sesli sohbet odası başlat</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Oda Adı</label>
                  <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Örn: Teknoloji Muhabbeti" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Açıklama (İsteğe bağlı)</label>
                  <Textarea value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} placeholder="Odanın konusu nedir?" className="resize-none" />
                </div>
                <Button onClick={handleCreate} className="w-full rounded-full" disabled={!newRoomName.trim() || createMutation.isPending}>
                  {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur ve Başlat"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-card rounded-2xl animate-pulse" />)}
          </div>
        ) : rooms?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Mic className="w-8 h-8 text-muted-foreground" />
            </div>
            <p>Şu an aktif bir sesli oda yok.<br />İlk odayı sen oluştur!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms?.map(room => (
              <div key={room.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/30 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors" />

                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-lg leading-tight truncate">{room.name}</h3>
                    {room.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{room.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full flex-shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    <span>{room.participantCount}</span>
                  </div>
                </div>

                <div className="flex -space-x-2 mb-4">
                  {room.participants?.slice(0, 5).map((p) => (
                    <Avatar key={p.id} className="w-8 h-8 border-2 border-card">
                      <AvatarImage src={p.avatarUrl || ""} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{p.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {(room.participantCount || 0) > 5 && (
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold z-10">
                      +{(room.participantCount || 0) - 5}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Canlı
                  </div>
                  <Button
                    onClick={() => handleJoin(room.id)}
                    variant={room.isJoined ? "secondary" : "default"}
                    size="sm"
                    className="rounded-full shadow-sm"
                    disabled={joinMutation.isPending}
                  >
                    {room.isJoined ? "Gir" : "Katıl"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
