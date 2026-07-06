import {
  useListVoiceRooms, useJoinVoiceRoom, useLeaveVoiceRoom, useCreateVoiceRoom, getListVoiceRoomsQueryKey
} from "@workspace/api-client-react";
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

const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

interface PeerEntry {
  pc: RTCPeerConnection;
  isInitiator: boolean;
}

export default function Voice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListVoiceRooms({ query: { queryKey: getListVoiceRoomsQueryKey(), refetchInterval: 3000 } });
  const joinMutation = useJoinVoiceRoom();
  const leaveMutation = useLeaveVoiceRoom();
  const createMutation = useCreateVoiceRoom();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const activeRoomIdRef = useRef<number | null>(null);

  // Media on/off state
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  // Local streams
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Local video refs
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);

  // WebRTC
  const peersRef = useRef<Map<number, PeerEntry>>(new Map());
  const knownPeersRef = useRef<Set<number>>(new Set());
  // Remote screens: peerId → stream
  const [remoteScreens, setRemoteScreens] = useState<Map<number, { stream: MediaStream; displayName: string }>>(new Map());
  const remoteScreensRef = useRef<Map<number, { stream: MediaStream; displayName: string }>>(new Map());
  // Remote screen video elements: peerId → HTMLVideoElement
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const activeRoom = rooms?.find(r => r.id === activeRoomId);

  // Keep ref in sync
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);

  // Cleanup on unmount
  useEffect(() => () => { doLeave(); }, []);

  // Attach local camera to video element
  useEffect(() => {
    if (camVideoRef.current && camStreamRef.current && camOn) {
      camVideoRef.current.srcObject = camStreamRef.current;
      camVideoRef.current.play().catch(() => {});
    }
  }, [camOn]);

  // Attach local screen to video element
  useEffect(() => {
    if (localScreenVideoRef.current && screenStreamRef.current && screenOn) {
      localScreenVideoRef.current.srcObject = screenStreamRef.current;
      localScreenVideoRef.current.play().catch(() => {});
    }
  }, [screenOn]);

  // Attach remote screen streams to video elements
  useEffect(() => {
    remoteScreens.forEach(({ stream }, peerId) => {
      const el = remoteVideoRefs.current.get(peerId);
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    });
  }, [remoteScreens]);

  // ─── Signaling ────────────────────────────────────────────────────────────
  const sendSignal = useCallback(async (targetUserId: number, type: string, data: unknown) => {
    const roomId = activeRoomIdRef.current;
    if (!roomId) return;
    await fetch(`/api/voice-rooms/${roomId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, type, data }),
    }).catch(() => {});
  }, []);

  // ─── Peer Connection ──────────────────────────────────────────────────────
  const createPeerConnection = useCallback((peerId: number, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(STUN);

    // Add local mic track
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = micOn;
        pc.addTrack(track, micStreamRef.current!);
      });
    }

    // Add local screen tracks
    // Add local screen tracks (Sadece gerçekten ekran paylaşımı açıksa track ekle)
    if (screenOn && screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => pc.addTrack(t, screenStreamRef.current!));
    }


    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, "ice-candidate", e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const track = e.track;
      const stream = e.streams[0] || new MediaStream([track]);

      if (track.kind === "audio") {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.play().catch(() => {});
      } else if (track.kind === "video") {
        const participant = activeRoom?.participants?.find(p => p.id === peerId);
        const displayName = participant?.displayName ?? `Kullanıcı ${peerId}`;
        remoteScreensRef.current.set(peerId, { stream, displayName });
        setRemoteScreens(new Map(remoteScreensRef.current));
      }
    };

    // Renegotiation for screen share or camera added later (initiator only)
    pc.onnegotiationneeded = async () => {
      if (!isInitiator) return;
      if (pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        sendSignal(peerId, "offer", pc.localDescription);
      } catch (error) {
        console.error(error);
      }
    };

    peersRef.current.set(peerId, { pc, isInitiator });
    return pc;
  }, [sendSignal, activeRoom, micOn]);





  // ─── Handle incoming signals ──────────────────────────────────────────────
  const handleSignal = useCallback(async (signal: { fromUserId: number; type: string; data: any }) => {
     const { fromUserId, type, data } = signal;
    if (type === "screen-share-stopped") {
      remoteScreensRef.current.delete(fromUserId);
      setRemoteScreens(new Map(remoteScreensRef.current));
      return;
    }


    if (type === "offer") {
      let entry = peersRef.current.get(fromUserId);
      if (!entry) {
        // Responder creates PC (isInitiator = false)
        const pc = createPeerConnection(fromUserId, false);
        entry = { pc, isInitiator: false };
      }
      const { pc } = entry;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(fromUserId, "answer", pc.localDescription);
      } catch {}
    } else if (type === "answer") {
      const entry = peersRef.current.get(fromUserId);
      if (entry && entry.pc.signalingState !== "stable") {
        try { await entry.pc.setRemoteDescription(new RTCSessionDescription(data)); } catch {}
      }
    } else if (type === "ice-candidate") {
      const entry = peersRef.current.get(fromUserId);
      if (entry && entry.pc.remoteDescription) {
        try { await entry.pc.addIceCandidate(new RTCIceCandidate(data)); } catch {}
      }
    }
  }, [createPeerConnection, sendSignal]);

  // ─── Poll signals every 1s when in a room ────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/voice-rooms/${activeRoomId}/signals`);
        if (!res.ok) return;
        const signals: { fromUserId: number; type: string; data: unknown }[] = await res.json();
        for (const s of signals) await handleSignal(s as any);
      } catch {}
    };
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [activeRoomId, user, handleSignal]);

  // ─── Connect to new participants ──────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom || !user) return;
    const others = activeRoom.participants?.filter(p => p.id !== user.id) ?? [];

    for (const p of others) {
      if (knownPeersRef.current.has(p.id)) continue;
      knownPeersRef.current.add(p.id);

      if (user.id < p.id) {
        // I'm the initiator: create PC, tracks added, then send offer
        const pc = createPeerConnection(p.id, true);
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          sendSignal(p.id, "offer", offer);
        }).catch(() => {});
      } else {
        // I'm the responder: just create PC and add tracks, wait for offer
        createPeerConnection(p.id, false);
      }
    }

    // Remove departed peers
    const currentIds = new Set(others.map(p => p.id));
    knownPeersRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        peersRef.current.get(id)?.pc.close();
        peersRef.current.delete(id);
        knownPeersRef.current.delete(id);
        remoteScreensRef.current.delete(id);
        setRemoteScreens(new Map(remoteScreensRef.current));
      }
    });
  }, [activeRoom?.participants, user, createPeerConnection, sendSignal]);

  // ─── Media controls ───────────────────────────────────────────────────────
  const enableMic = async () => {
    try {
      // Hem mikrofonu hem de kamerayı aynı anda istiyoruz
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 320, height: 240, frameRate: 15 }
      });

      micStreamRef.current = stream;

      setMicOn(true);
      setCamOn(false);

      // İlk girişte kamera kapalı başlasın diye video izini pasif yapıyoruz
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      setCamOn(false);

      // Hem ses hem video izlerini mevcut tüm bağlantılara (odadaki diğer kişilere) gönderiyoruz
      peersRef.current.forEach(({ pc }) => {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      });
    } catch (error) {
      toast({ 
        title: "Medya erişimi reddedildi", 
        description: "Tarayıcı ayarlarından mikrofon ve kamera izinlerini etkinleştirin.", 
        variant: "destructive" 
      });
    }
  };

  
  const toggleMic = () => {
    if (!micStreamRef.current) {
      enableMic();
      return;
    }

    const nextState = !micOn;

    micStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = nextState;
    });

    setMicOn(nextState);
  };

 

const toggleCamera = async () => {
  if (camOn) {
    camStreamRef.current?.getVideoTracks().forEach((t: MediaStreamTrack) => {
      t.enabled = false;
    });

    setCamOn(false);
    return;
  }

  try {
    if (
      camStreamRef.current &&
      camStreamRef.current.getVideoTracks().length > 0
    ) {
      camStreamRef.current.getVideoTracks().forEach((t: MediaStreamTrack) => {
        t.enabled = true;
      });

      setCamOn(true);

      if (camVideoRef.current) {
        camVideoRef.current.srcObject = camStreamRef.current;
        camVideoRef.current.play().catch(() => {});
      }
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      camStreamRef.current = stream;
      setCamOn(true);

      if (camVideoRef.current) {
        camVideoRef.current.srcObject = stream;
        camVideoRef.current.play().catch(() => {});
      }

      peersRef.current.forEach(({ pc }) => {
        stream.getVideoTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });
    }
  } catch (error) {
    toast({
      title: "Kamera erişimi reddedildi",
      description: "Tarayıcı ayarlarından izni etkinleştirin.",
      variant: "destructive"
    });
  }
};// toggleCamera fonksiyonunun asıl bitişi burası olmalı




  const toggleScreen = async () => {
    if (screenOn) {
      // 1. Kendi ekranımızdaki akışı durduruyoruz
      screenStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      screenStreamRef.current = null;
      setScreenOn(false);

      if (localScreenVideoRef.current) {
        localScreenVideoRef.current.srcObject = null;
      }

      // 2. ÖNEMLİ: Odadaki diğer herkesin bağlantısından bu ekran izini tamamen söküyoruz
      peersRef.current.forEach(({ pc }) => {
        pc.getSenders().forEach(sender => {
          // Eğer gönderilen iz video ise ve mikrofon/kamera akışına ait değilse (yani ekransa) kaldırıyoruz
          if (sender.track?.kind === "video" && sender.track !== camStreamRef.current?.getVideoTracks()[0]) {
            pc.removeTrack(sender);
          }
        });
      });

      // 3. Karşı tarafların ekranından tamamen yok olmak için odaya sinyal gönderiyoruz
      // Not: Projendeki tam fonksiyon adına göre 'sendSignal' kullanıyoruz
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) {
          sendSignal(p.id, "screen-share-stopped", {});
        }
      });

    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setScreenOn(true);

        setTimeout(() => {
          if (localScreenVideoRef.current) {
            localScreenVideoRef.current.srcObject = stream;
            localScreenVideoRef.current.play().catch(() => {});
          }
        }, 50);

        // Ekran kapandığında otomatik olarak tetiklenmesi için dinleyici ekliyoruz
        stream.getVideoTracks()[0].onended = () => {
          toggleScreen();
        };

        // Mevcut bağlantılara ekran akışını ekliyoruz
        peersRef.current.forEach(({ pc }) => {
          stream.getTracks().forEach((t: MediaStreamTrack) => pc.addTrack(t, stream));
        });
      } catch (error) {
        console.error("Ekran paylaşımı başlatılamadı:", error);
      }
    }
  };


  // ─── Join / Leave ─────────────────────────────────────────────────────────
  const doLeave = () => {
    // Close all peer connections
    peersRef.current.forEach(({ pc }) => pc.close());
    peersRef.current.clear();
    knownPeersRef.current.clear();
    remoteScreensRef.current.clear();
    setRemoteScreens(new Map());
    // Stop all local streams
    micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); micStreamRef.current = null;
    camStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); camStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); screenStreamRef.current = null;
    setMicOn(false); setCamOn(false); setScreenOn(false);
  };

  const handleJoin = (roomId: number) => {
    joinMutation.mutate({ roomId }, {
      onSuccess: () => {
        setActiveRoomId(roomId);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        enableMic(); // Auto-enable mic on join
      },
      onError: () => toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" }),
    });
  };

  const handleLeave = () => {
    if (!activeRoomId) return;
    doLeave();
    leaveMutation.mutate({ roomId: activeRoomId }, {
      onSuccess: () => { setActiveRoomId(null); queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() }); }
    });
  };

  const handleCreate = () => {
    if (!newRoomName.trim()) return;
    createMutation.mutate({ data: { name: newRoomName, description: newRoomDesc } }, {
      onSuccess: (room) => {
        setIsDialogOpen(false); setNewRoomName(""); setNewRoomDesc("");
        setActiveRoomId(room.id);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        enableMic();
      },
      onError: () => toast({ title: "Hata", description: "Oda oluşturulamadı.", variant: "destructive" }),
    });
  };

  // ─── Active Room UI ───────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] p-4 gap-3 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary animate-pulse" />
                {activeRoom.name}
              </h2>
              {activeRoom.description && <p className="text-sm text-muted-foreground">{activeRoom.description}</p>}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              <span>{activeRoom.participantCount}</span>
            </div>
          </div>

          {/* Remote screens (from other users) */}
          {remoteScreens.size > 0 && (
            <div className="space-y-2 flex-shrink-0">
              {Array.from(remoteScreens.entries()).map(([peerId, { displayName }]) => (
                <div key={peerId} className="relative rounded-xl overflow-hidden bg-black border border-primary/30">
                  <video
                    ref={el => { if (el) remoteVideoRefs.current.set(peerId, el); }}
                    autoPlay
                    playsInline
                    className="w-full max-h-40 object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <MonitorUp className="w-3 h-3" /> {displayName} ekranını paylaşıyor
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Local screen preview */}
          {screenOn && (
            <div className="relative rounded-xl overflow-hidden bg-black border border-orange-400/40 flex-shrink-0">
              <video ref={localScreenVideoRef} autoPlay playsInline muted className="w-full max-h-36 object-contain" />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <MonitorUp className="w-3 h-3 text-orange-400" /> Ekranın paylaşılıyor
              </div>
            </div>
          )}

          {/* Local camera (self-view) */}
          {camOn && (
            <div className="self-end w-28 rounded-xl overflow-hidden bg-black border border-blue-400/40 relative flex-shrink-0">
              <video ref={camVideoRef} autoPlay playsInline muted className="w-full aspect-video object-cover scale-x-[-1]" />
              <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/50 px-1 rounded">Sen</div>
            </div>
          )}

          {/* Participants */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              {activeRoom.participants?.map((p) => {
                const isHost = p.id === activeRoom.createdBy;
                const isMe = p.id === user?.id;
                const isConnected = isMe || peersRef.current.get(p.id)?.pc.connectionState === "connected";
                return (
                  <div key={p.id} className={`flex flex-col items-center gap-2 p-3 bg-card border rounded-2xl relative transition-all ${isMe && micOn ? "border-primary/60 shadow-[0_0_10px_rgba(139,92,246,0.15)]" : "border-border"}`}>
                    {isHost && <div className="absolute top-2 right-2"><Crown className="w-3.5 h-3.5 text-yellow-500" /></div>}
                    <div className="relative">
                      <Avatar className={`w-14 h-14 border-2 transition-all ${isMe && micOn ? "border-primary" : isConnected && !isMe ? "border-green-500/60" : "border-primary/20"}`}>
                        <AvatarImage src={p.avatarUrl || ""} />
                        <AvatarFallback className="text-lg bg-primary/10 text-primary">{p.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {isMe && (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card ${micOn ? "bg-green-500" : "bg-destructive"}`}>
                          {micOn ? <Mic className="w-2.5 h-2.5 text-white" /> : <MicOff className="w-2.5 h-2.5 text-white" />}
                        </div>
                      )}
                      {!isMe && isConnected && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-card">
                          <Mic className="w-2.5 h-2.5 text-white" />
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
          <div className="flex items-center justify-center gap-3 flex-shrink-0 pb-1">
            <button
              onClick={toggleMic}
              className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-colors ${micOn ? "bg-green-500/15 text-green-600 ring-1 ring-green-500/30" : "bg-destructive/10 text-destructive"}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{micOn ? "Mikrofon" : "Sessiz"}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-colors ${camOn ? "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30" : "bg-secondary text-muted-foreground"}`}
            >
              {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{camOn ? "Kamera" : "Kamera"}</span>
            </button>

            <button
              onClick={handleLeave}
              className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors scale-110"
            >
              <PhoneOff className="w-7 h-7" />
              <span className="text-[10px] font-medium">Ayrıl</span>
            </button>

            <button
              onClick={toggleScreen}
              className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-colors ${screenOn ? "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30" : "bg-secondary text-muted-foreground"}`}
            >
              {screenOn ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{screenOn ? "Paylaşıyor" : "Ekran"}</span>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Room List ────────────────────────────────────────────────────────────
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
              <Button size="sm" className="rounded-full shadow-md gap-1"><Plus className="w-4 h-4" /> Yeni Oda</Button>
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
          <div className="space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-card rounded-2xl animate-pulse" />)}</div>
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
                    <Users className="w-3.5 h-3.5" /><span>{room.participantCount}</span>
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
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Canlı
                  </div>
                  <Button onClick={() => handleJoin(room.id)} variant={room.isJoined ? "secondary" : "default"} size="sm" className="rounded-full shadow-sm" disabled={joinMutation.isPending}>
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
