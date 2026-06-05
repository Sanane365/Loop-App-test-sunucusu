import { useListVoiceRooms, useJoinVoiceRoom, useLeaveVoiceRoom, useCreateVoiceRoom, getListVoiceRoomsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff, Users, Plus, Radio, PhoneOff, Crown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);

  const activeRoom = rooms?.find(r => r.id === activeRoomId);

  const handleJoin = (roomId: number) => {
    joinMutation.mutate({ roomId }, {
      onSuccess: () => {
        setActiveRoomId(roomId);
        setMicOn(true);
        setCamOn(false);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
      },
      onError: () => {
        toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" });
      }
    });
  };

  const handleLeave = () => {
    if (!activeRoomId) return;
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
        setMicOn(true);
        setCamOn(false);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
      },
      onError: () => {
        toast({ title: "Hata", description: "Oda oluşturulamadı.", variant: "destructive" });
      }
    });
  };

  if (activeRoom) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] p-4">
          <div className="flex items-center justify-between mb-6">
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

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              {activeRoom.participants?.map((p) => {
                const isHost = p.id === activeRoom.createdBy;
                const isCurrentUser = p.id === user?.id;
                return (
                  <div key={p.id} className="flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-2xl relative">
                    {isHost && (
                      <div className="absolute top-2 right-2">
                        <Crown className="w-3.5 h-3.5 text-yellow-500" />
                      </div>
                    )}
                    <div className="relative">
                      <Avatar className="w-16 h-16 border-2 border-primary/20">
                        <AvatarImage src={p.avatarUrl || ""} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                          {p.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isCurrentUser && (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card ${micOn ? 'bg-green-500' : 'bg-destructive'}`}>
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

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setMicOn(v => !v)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-colors ${micOn ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{micOn ? "Mikrofon" : "Kapalı"}</span>
            </button>

            <button
              onClick={handleLeave}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors scale-110"
            >
              <PhoneOff className="w-7 h-7" />
              <span className="text-[10px] font-medium">Ayrıl</span>
            </button>

            <button
              onClick={() => setCamOn(v => !v)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-colors ${camOn ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary/80'}`}
            >
              {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{camOn ? "Kamera" : "Kapalı"}</span>
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
