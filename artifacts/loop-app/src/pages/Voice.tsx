import { useListVoiceRooms, useJoinVoiceRoom, useCreateVoiceRoom, getListVoiceRoomsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, Users, Plus, Radio } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Voice() {
  const { data: rooms, isLoading } = useListVoiceRooms({ query: { queryKey: getListVoiceRoomsQueryKey() } });
  const joinMutation = useJoinVoiceRoom();
  const createMutation = useCreateVoiceRoom();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  const handleJoin = (roomId: number) => {
    joinMutation.mutate({ roomId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() })
    });
  };

  const handleCreate = () => {
    if (!newRoomName.trim()) return;
    createMutation.mutate({ data: { name: newRoomName, description: newRoomDesc } }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewRoomName("");
        setNewRoomDesc("");
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
      }
    });
  };

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
                  Oluştur ve Başlat
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
            <p>Şu an aktif bir sesli oda yok.<br/>İlk odayı sen oluştur!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms?.map(room => (
              <div key={room.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:border-primary/30 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{room.name}</h3>
                    {room.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{room.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                    <Users className="w-3.5 h-3.5" />
                    <span>{room.participantCount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <div className="flex -space-x-2">
                    {room.participants?.slice(0, 4).map((p, i) => (
                      <Avatar key={p.id} className="w-8 h-8 border-2 border-card">
                        <AvatarImage src={p.avatarUrl || ""} />
                        <AvatarFallback>{p.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {(room.participantCount || 0) > 4 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold z-10">
                        +{(room.participantCount || 0) - 4}
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => handleJoin(room.id)}
                    variant={room.isJoined ? "secondary" : "default"}
                    className="rounded-full shadow-sm"
                    disabled={room.isJoined}
                  >
                    {room.isJoined ? "Odadasın" : "Katıl"}
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
