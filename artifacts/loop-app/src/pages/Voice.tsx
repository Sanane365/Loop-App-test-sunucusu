import {
  useListVoiceRooms, useJoinVoiceRoom, useLeaveVoiceRoom, useCreateVoiceRoom, getListVoiceRoomsQueryKey
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AudioLines, Mic, MicOff, Video, VideoOff, Users, Plus, Radio, PhoneOff, Crown, MonitorUp, MonitorOff, Music2, Vote, X, Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
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

type CassetteStatus = { name: string; status: "playing" | "changing" };
type RemoteVideo = { stream: MediaStream; displayName: string; kind: "camera" | "screen" };

export default function Voice() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListVoiceRooms({ query: { queryKey: getListVoiceRoomsQueryKey(), refetchInterval: 3000 } });
  type VoiceRoom = NonNullable<typeof rooms>[number];
  const joinMutation = useJoinVoiceRoom();
  const leaveMutation = useLeaveVoiceRoom();
  const createMutation = useCreateVoiceRoom();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinMode, setJoinMode] = useState<"list" | "code">("list");
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [communityRoom, setCommunityRoom] = useState<VoiceRoom | null>(null);
  const activeRoomIdRef = useRef<number | null>(null);
  const autoJoinRoomRef = useRef<number | null>(null);

  // Media on/off state
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [cassetteOn, setCassetteOn] = useState(false);
  const [cassetteName, setCassetteName] = useState("");
  const [poll, setPoll] = useState<{ question: string; options: string[]; votes: number[]; voted: boolean } | null>(null);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const pollVotersRef = useRef<Set<number>>(new Set());

  // Local streams
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cassetteAudioRef = useRef<HTMLAudioElement | null>(null);
  const cassetteStreamRef = useRef<MediaStream | null>(null);
  const cassetteTrackRefs = useRef<Set<MediaStreamTrack>>(new Set());
  const cassetteInputRef = useRef<HTMLInputElement>(null);

  // Local video refs
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);

  // WebRTC
  const peersRef = useRef<Map<number, PeerEntry>>(new Map());
  const knownPeersRef = useRef<Set<number>>(new Set());
  // Remote screens: peerId → stream
  const [remoteScreens, setRemoteScreens] = useState<Map<number, RemoteVideo>>(new Map());
  const remoteScreensRef = useRef<Map<number, RemoteVideo>>(new Map());
  const [remoteMicStates, setRemoteMicStates] = useState<Map<number, boolean>>(new Map());
  const [cassetteByUser, setCassetteByUser] = useState<Map<number, CassetteStatus>>(new Map());
  const remoteCassetteAudioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());
  const remoteCameraIdsRef = useRef<Set<number>>(new Set());
  const previousParticipantIdsRef = useRef<Set<number>>(new Set());
  const previousParticipantNamesRef = useRef<Map<number, string>>(new Map());
  // Remote screen video elements: peerId → HTMLVideoElement
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const activeRoom = communityRoom ?? rooms?.find(r => r.id === activeRoomId);
  const voiceSearch = new URLSearchParams(window.location.search);
  const communityId = Number(voiceSearch.get("communityId"));
  const requestedRoomId = Number(voiceSearch.get("roomId"));
  const isVoiceRoute = location.startsWith("/voice") || location === "/community/voice";
  const isCommunityVoiceRoute = location === "/community/voice" && Number.isSafeInteger(communityId) && communityId > 0;
  const visibleActiveRoom = isCommunityVoiceRoute
    ? communityRoom?.id === requestedRoomId ? communityRoom : null
    : communityRoom ? null : rooms?.find(room => room.id === activeRoomId);

  // Keep ref in sync
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);

  // Cleanup on unmount
  useEffect(() => () => {
    const roomId = activeRoomIdRef.current;
    if (roomId) {
      void fetch(`/api/voice-rooms/${roomId}/leave`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
      });
    }
    doLeave();
  }, []);

  // Attach local camera to video element
  useEffect(() => {
    if (camVideoRef.current && camStreamRef.current && camOn) {
      camVideoRef.current.srcObject = camStreamRef.current;
      camVideoRef.current.play().catch(() => {});
    }
  }, [camOn]);

  useEffect(() => {
    if (!communityRoom) return;
    let cancelled = false;
    const refreshCommunityRoom = async () => {
      try {
        const response = await fetch(`/api/voice-rooms/${communityRoom.id}`, { credentials: "include" });
        if (!response.ok) throw new Error("Topluluk ses odası yenilenemedi.");
        const room = await response.json() as VoiceRoom;
        if (!cancelled) setCommunityRoom(room);
      } catch (error) {
        console.error("Topluluk ses odası güncellenemedi:", error);
      }
    };
    const interval = window.setInterval(() => void refreshCommunityRoom(), 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [communityRoom?.id]);

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
        el.muted = true;
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
  const addTrackOnce = (pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream) => {
    if (!pc.getSenders().some(sender => sender.track === track)) {
      pc.addTrack(track, stream);
    }
  };

  const createPeerConnection = useCallback((peerId: number, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(STUN);

    // Add local mic track
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = micOn;
        addTrackOnce(pc, track, micStreamRef.current!);
      });
    }
    if (cassetteStreamRef.current) {
      pc.getSenders().forEach(sender => {
        if (sender.track && cassetteTrackRefs.current.has(sender.track)) pc.removeTrack(sender);
      });
      cassetteStreamRef.current.getAudioTracks().forEach(track => {
        if (!cassetteTrackRefs.current.has(track)) {
          cassetteTrackRefs.current.add(track);
        }
        addTrackOnce(pc, track, cassetteStreamRef.current!);
      });
    }

    // Add local screen tracks
    // Add local screen tracks (Sadece gerçekten ekran paylaşımı açıksa track ekle)
    if (screenOn && screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => addTrackOnce(pc, t, screenStreamRef.current!));
    }


    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, "ice-candidate", e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const track = e.track;
      const stream = e.streams[0] || new MediaStream([track]);

      if (track.kind === "audio") {
        const previousAudio = remoteCassetteAudioRefs.current.get(peerId);
        if (previousAudio) {
          previousAudio.pause();
          previousAudio.srcObject = null;
        }
        const audio = previousAudio ?? new Audio();
        audio.srcObject = new MediaStream([track]);
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audio.volume = 1;
        audio.muted = false;
        if (!audio.isConnected) {
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
        remoteCassetteAudioRefs.current.set(peerId, audio);
        audio.play().catch(() => {});
      } else if (track.kind === "video") {
        const participant = activeRoom?.participants?.find(p => p.id === peerId);
        const displayName = participant?.displayName ?? `Kullanıcı ${peerId}`;
        remoteScreensRef.current.set(peerId, { stream, displayName, kind: remoteCameraIdsRef.current.has(peerId) ? "camera" : "screen" });
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
    if (type === "camera-stopped") {
      remoteCameraIdsRef.current.delete(fromUserId);
      if (remoteScreensRef.current.get(fromUserId)?.kind === "camera") {
        remoteScreensRef.current.delete(fromUserId);
      }
      setRemoteScreens(new Map(remoteScreensRef.current));
      return;
    }
    if (type === "camera-started") {
      remoteCameraIdsRef.current.add(fromUserId);
      const current = remoteScreensRef.current.get(fromUserId);
      if (current && current.kind === "camera") {
        remoteScreensRef.current.set(fromUserId, { ...current, kind: "camera" });
        setRemoteScreens(new Map(remoteScreensRef.current));
      }
      return;
    }
    if (type === "mic-state") {
      setRemoteMicStates(current => new Map(current).set(fromUserId, Boolean(data?.micOn)));
      return;
    }
    if (type === "cassette-state") {
      if (user?.id && fromUserId !== user.id && (data?.playing || data?.changing)) {
        const localHasCassette = Boolean(cassetteAudioRef.current || cassetteStreamRef.current || cassetteOn);
        if (localHasCassette) {
          stopCassette(false, false);
        }
      }

      setCassetteByUser(current => {
        const next = new Map();
        if ((data?.playing || data?.changing) && typeof data?.name === "string") {
          next.set(fromUserId, { name: data.name, status: data.changing ? "changing" : "playing" });
          return next;
        }
        if (!data?.playing && !data?.changing) {
          const fallback = new Map(current);
          fallback.delete(fromUserId);
          return fallback;
        }
        return current;
      });
      return;
    }
    if (type === "poll-start" || type === "poll-update") {
      if (!data?.question || !Array.isArray(data?.options) || !Array.isArray(data?.votes)) return;
      setPoll(current => ({ question: String(data.question), options: data.options.map(String), votes: data.votes.map(Number), voted: type === "poll-update" ? Boolean(current?.voted) : false }));
      return;
    }
    if (type === "poll-vote") {
      if (!activeRoom || !user || user.id !== activeRoom.createdBy || !poll || pollVotersRef.current.has(Number(data?.voterId))) return;
      const optionIndex = Number(data?.optionIndex);
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) return;
      const votes = [...poll.votes];
      votes[optionIndex] = (votes[optionIndex] ?? 0) + 1;
      pollVotersRef.current.add(Number(data?.voterId));
      const nextPoll = { ...poll, votes };
      setPoll(nextPoll);
      activeRoom.participants?.forEach(p => {
        if (p.id !== user.id) sendSignal(p.id, "poll-update", nextPoll);
      });
      return;
    }
    if (type === "renegotiate") {
      const entry = peersRef.current.get(fromUserId);
      if (entry?.isInitiator && entry.pc.signalingState === "stable") {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        sendSignal(fromUserId, "offer", entry.pc.localDescription);
      }
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
        sendSignal(fromUserId, "mic-state", { micOn });
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
  }, [createPeerConnection, sendSignal, micOn, poll, user, activeRoom]);

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
          sendSignal(p.id, "mic-state", { micOn });
          if (cassetteStreamRef.current && cassetteName) sendSignal(p.id, "cassette-state", { playing: true, name: cassetteName });
        }).catch(() => {});
      } else {
        // I'm the responder: just create PC and add tracks, wait for offer
        createPeerConnection(p.id, false);
        sendSignal(p.id, "mic-state", { micOn });
        if (cassetteStreamRef.current && cassetteName) sendSignal(p.id, "cassette-state", { playing: true, name: cassetteName });
      }
    }

    // Remove departed peers
    const currentIds = new Set(others.map(p => p.id));
    knownPeersRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        peersRef.current.get(id)?.pc.close();
        peersRef.current.delete(id);
        knownPeersRef.current.delete(id);
        remoteCameraIdsRef.current.delete(id);
        const remoteAudio = remoteCassetteAudioRefs.current.get(id);
        if (remoteAudio) {
          remoteAudio.pause();
          remoteAudio.srcObject = null;
          remoteAudio.remove();
          remoteCassetteAudioRefs.current.delete(id);
        }
        remoteScreensRef.current.delete(id);
        setRemoteMicStates(current => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
        setRemoteScreens(new Map(remoteScreensRef.current));
      }
    });
    const participantIds = new Set(others.map(p => p.id));
    if (previousParticipantIdsRef.current.size > 0) {
      previousParticipantIdsRef.current.forEach(id => {
        if (!participantIds.has(id)) {
          toast({ title: `${previousParticipantNamesRef.current.get(id) ?? "Bir kullanıcı"} odadan ayrıldı`, duration: 1800 });
        }
      });
    }
    previousParticipantIdsRef.current = participantIds;
    previousParticipantNamesRef.current = new Map(others.map(p => [p.id, p.displayName]));
  }, [activeRoom?.participants, user, createPeerConnection, sendSignal, micOn, cassetteName, toast]);

  // ─── Media controls ───────────────────────────────────────────────────────
  const enableMic = async () => {
    try {
      // Hem mikrofonu hem de kamerayı aynı anda istiyoruz
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = stream;

      setMicOn(true);
      peersRef.current.forEach(({ pc }) => {
        const peerId = [...peersRef.current.entries()].find(([, entry]) => entry.pc === pc)?.[0];
        if (peerId) sendSignal(peerId, "mic-state", { micOn: true });
      });
      setCamOn(false);

      // Only the microphone track is added on room entry. Camera and screen are opt-in.
      peersRef.current.forEach(({ pc }) => {
        stream.getAudioTracks().forEach(track => addTrackOnce(pc, track, stream));
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
    peersRef.current.forEach((_, peerId) => sendSignal(peerId, "mic-state", { micOn: nextState }));
  };

 

const toggleCamera = async () => {
  if (camOn) {
    const cameraTracks = new Set(camStreamRef.current?.getVideoTracks() ?? []);
    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().forEach(sender => {
        if (sender.track && cameraTracks.has(sender.track)) pc.removeTrack(sender);
      });
    });
    peersRef.current.forEach((_, peerId) => sendSignal(peerId, "renegotiate", {}));
    camStreamRef.current?.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop());
    camStreamRef.current = null;
    if (camVideoRef.current) camVideoRef.current.srcObject = null;
    activeRoom?.participants?.forEach(p => {
      if (p.id !== user?.id) sendSignal(p.id, "camera-stopped", {});
    });
    setCamOn(false);
    return;
  }

  try {
    if (
      camStreamRef.current &&
      camStreamRef.current.getVideoTracks().length > 0
    ) {
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) sendSignal(p.id, "camera-started", {});
      });
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
        audio: false,
        video: true
      });

      camStreamRef.current = stream;
      setCamOn(true);
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) sendSignal(p.id, "camera-started", {});
      });

      if (camVideoRef.current) {
        camVideoRef.current.srcObject = stream;
        camVideoRef.current.play().catch(() => {});
      }

      peersRef.current.forEach(({ pc }) => {
        stream.getVideoTracks().forEach(track => {
          addTrackOnce(pc, track, stream);
        });
      });
    }
    peersRef.current.forEach((_, peerId) => sendSignal(peerId, "renegotiate", {}));
    activeRoom?.participants?.forEach(p => {
      if (p.id !== user?.id) sendSignal(p.id, "camera-started", {});
    });
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
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
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
          stream.getTracks().forEach((t: MediaStreamTrack) => addTrackOnce(pc, t, stream));
        });
      } catch (error) {
        console.error("Ekran paylaşımı başlatılamadı:", error);
      }
    }
  };

  const stopCassette = (notify = true, preserveLocalStatus = false) => {
    const cassetteTracks = cassetteStreamRef.current?.getTracks() ?? [];

    if (cassetteAudioRef.current) {
      cassetteAudioRef.current.pause();
      cassetteAudioRef.current.onended = null;
      cassetteAudioRef.current.src = "";
      cassetteAudioRef.current.load();
    }
    cassetteAudioRef.current = null;

    cassetteStreamRef.current?.getTracks().forEach(track => track.stop());
    cassetteStreamRef.current = null;

    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().forEach(sender => {
        if (sender.track && (cassetteTracks.includes(sender.track) || cassetteTrackRefs.current.has(sender.track))) {
          pc.removeTrack(sender);
        }
      });
    });
    cassetteTrackRefs.current.clear();
    remoteCassetteAudioRefs.current.clear();

    setCassetteOn(false);
    setCassetteName("");

    if (!preserveLocalStatus) {
      setCassetteByUser(current => {
        const next = new Map(current);
        if (user?.id) next.delete(user.id);
        return next;
      });
    }

    if (notify) {
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) sendSignal(p.id, "cassette-state", { playing: false });
      });
    }
  };

  const stopCurrentCassette = () => {
    if (!user?.id) return;

    const currentOwnerId = Array.from(cassetteByUser.entries()).find(([, cassette]) => cassette.status === "playing")?.[0] ?? null;

    if (!currentOwnerId) {
      stopCassette(false, false);
      return;
    }

    if (user.id === currentOwnerId) {
      setCassetteByUser(new Map());
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user.id) sendSignal(p.id, "cassette-state", { playing: false });
      });
      stopCassette(true, false);
      return;
    }

    const remoteAudio = remoteCassetteAudioRefs.current.get(currentOwnerId);
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      remoteAudio.currentTime = 0;
      remoteCassetteAudioRefs.current.delete(currentOwnerId);
    }

    setCassetteByUser(current => {
      const next = new Map(current);
      next.delete(user.id);
      return next;
    });
  };

  const playCassette = (file: File) => {
    const replacingCassette = Boolean(cassetteAudioRef.current || cassetteStreamRef.current || cassetteOn);

    if (replacingCassette && user?.id) {
      setCassetteByUser(new Map([[user.id, { name: file.name, status: "changing" }]]));
      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) sendSignal(p.id, "cassette-state", { changing: true, name: file.name });
      });
    }

    stopCassette(false, replacingCassette);

    const audio = new Audio(URL.createObjectURL(file));
    audio.loop = true;
    audio.autoplay = true;

    if (cassetteAudioRef.current) {
      cassetteAudioRef.current.pause();
      cassetteAudioRef.current.src = "";
    }

    cassetteAudioRef.current = audio;
    audio.addEventListener("ended", () => stopCassette());

    audio.play().then(() => {
      const capturableAudio = audio as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      const capture = typeof capturableAudio.captureStream === "function"
        ? capturableAudio.captureStream()
        : typeof capturableAudio.mozCaptureStream === "function"
          ? capturableAudio.mozCaptureStream()
          : null;

      if (!capture?.getAudioTracks().length) {
        toast({
          title: "Kaset sesi aktarılamadı",
          description: "Tarayıcı ses yakalamayı desteklemiyor.",
          variant: "destructive",
        });
        stopCassette(false, false);
        return;
      }

      peersRef.current.forEach(({ pc }) => {
        pc.getSenders().forEach(sender => {
          if (sender.track && cassetteTrackRefs.current.has(sender.track)) pc.removeTrack(sender);
        });
      });
      cassetteTrackRefs.current.clear();

      cassetteStreamRef.current = capture;
      capture.getAudioTracks().forEach((track: MediaStreamTrack) => {
        cassetteTrackRefs.current.add(track);
        peersRef.current.forEach(({ pc }) => pc.addTrack(track, capture));
      });

      peersRef.current.forEach(({ pc, isInitiator }, peerId) => {
        if (isInitiator && pc.signalingState === "stable") {
          void pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => sendSignal(peerId, "offer", pc.localDescription));
        } else {
          sendSignal(peerId, "renegotiate", {});
        }
      });

      setCassetteOn(true);
      setCassetteName(file.name);
      if (user?.id) setCassetteByUser(new Map([[user.id, { name: file.name, status: "playing" }]]));

      activeRoom?.participants?.forEach(p => {
        if (p.id !== user?.id) sendSignal(p.id, "cassette-state", { playing: true, name: file.name });
      });
    }).catch(() => {
      toast({
        title: "Kaset oynatılamadı",
        description: "Tarayıcı ses oynatmaya izin vermedi.",
        variant: "destructive",
      });
      stopCassette(false, false);
    });
  };

  const handleCassetteFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) playCassette(file);
  };

  const hasActiveCassette = cassetteOn || cassetteByUser.size > 0;

  const isRoomManager = Boolean(user && activeRoom && (user.id === activeRoom.createdBy || user.role === "admin"));
  const startPoll = () => {
    const options = pollOptions.map(option => option.trim()).filter(Boolean).slice(0, 4);
    if (!pollQuestion.trim() || options.length < 2 || !activeRoom) return;
    const nextPoll = { question: pollQuestion.trim(), options, votes: options.map(() => 0), voted: false };
    setPoll(nextPoll);
    pollVotersRef.current = new Set(user?.id ? [user.id] : []);
    setPollDialogOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    activeRoom.participants?.forEach(p => {
      if (p.id !== user?.id) sendSignal(p.id, "poll-start", nextPoll);
    });
  };

  const votePoll = (optionIndex: number) => {
    if (!poll || poll.voted || !activeRoom || user?.id === activeRoom.createdBy) return;
    setPoll(current => current ? { ...current, voted: true } : current);
    sendSignal(activeRoom.createdBy, "poll-vote", { optionIndex, voterId: user?.id });
  };


  // ─── Join / Leave ─────────────────────────────────────────────────────────
  const doLeave = () => {
    // Close all peer connections
    peersRef.current.forEach(({ pc }) => pc.close());
    peersRef.current.clear();
    knownPeersRef.current.clear();
    remoteCameraIdsRef.current.clear();
    remoteCassetteAudioRefs.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteCassetteAudioRefs.current.clear();
    remoteScreensRef.current.clear();
    setRemoteScreens(new Map());
    // Stop all local streams
    micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); micStreamRef.current = null;
    camStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); camStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); screenStreamRef.current = null;
    cassetteAudioRef.current?.pause();
    cassetteAudioRef.current = null;
    cassetteStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    cassetteStreamRef.current = null;
    cassetteTrackRefs.current.clear();
    setMicOn(false); setCamOn(false); setScreenOn(false); setCassetteOn(false); setCassetteName("");
    setRemoteMicStates(new Map());
    setCassetteByUser(new Map());
    previousParticipantIdsRef.current = new Set();
    previousParticipantNamesRef.current = new Map();
  };

  const handleJoin = (roomId: number, roomCode?: string | null) => {
    const join = () => joinMutation.mutate({ roomId }, {
      onSuccess: () => {
        screenStreamRef.current = null;
        setScreenOn(false);
        setActiveRoomId(roomId);
        setActiveRoomCode(roomCode ?? null);
        if (!isCommunityVoiceRoute) setCommunityRoom(null);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        enableMic(); // Auto-enable mic on join
      },
      onError: () => toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" }),
    });
    const previousRoomId = activeRoomIdRef.current;
    if (previousRoomId && previousRoomId !== roomId) {
      doLeave();
      leaveMutation.mutate({ roomId: previousRoomId }, {
        onSuccess: () => {
          setActiveRoomId(null);
          setCommunityRoom(null);
          join();
        },
        onError: () => toast({ title: "Hata", description: "Önceki ses odasından ayrılamadın.", variant: "destructive" }),
      });
      return;
    }
    join();
  };

  useEffect(() => {
    const roomId = Number(new URLSearchParams(window.location.search).get("roomId"));
    const requestedCommunityId = Number(new URLSearchParams(window.location.search).get("communityId"));
    if (!isVoiceRoute || !Number.isSafeInteger(roomId) || roomId < 1 || !user) {
      if (!isVoiceRoute) autoJoinRoomRef.current = null;
      return;
    }
    if (Number.isSafeInteger(requestedCommunityId) && requestedCommunityId > 0) {
      if (activeRoomId === roomId || autoJoinRoomRef.current === roomId) return;
      if (activeRoomId) {
        handleLeave();
        return;
      }
      autoJoinRoomRef.current = roomId;
      void fetch(`/api/voice-rooms/${roomId}`, { credentials: "include" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Bu topluluk ses odasına erişilemiyor.");
          return await response.json() as VoiceRoom;
        })
        .then((room) => {
          setCommunityRoom(room);
          handleJoin(room.id, room.roomCode);
        })
        .catch((error: unknown) => {
          autoJoinRoomRef.current = null;
          toast({
            title: "Sesli oda açılamadı",
            description: error instanceof Error ? error.message : "Topluluk ses odasına katılınamadı.",
            variant: "destructive",
          });
          setLocation(`/community?communityId=${requestedCommunityId}`);
        });
      return;
    }
    if (!rooms) return;
    if (activeRoomId === roomId) return;
    if (activeRoomId) {
      handleLeave();
      return;
    }
    if (autoJoinRoomRef.current === roomId) return;
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    autoJoinRoomRef.current = roomId;
    handleJoin(room.id, room.roomCode);
  }, [location, rooms, user, activeRoomId]);

  const handleLeave = () => {
    if (!activeRoomId) return;
    const roomToLeave = activeRoomId;
    doLeave();
    setActiveRoomCode(null);
    leaveMutation.mutate({ roomId: roomToLeave }, {
      onSuccess: () => {
        setActiveRoomId(null);
        setCommunityRoom(null);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
      }
    });
  };

  const handleCreate = () => {
    if (!newRoomName.trim()) return;
    createMutation.mutate({ data: { name: newRoomName, description: newRoomDesc } }, {
      onSuccess: (room) => {
        setIsDialogOpen(false); setNewRoomName(""); setNewRoomDesc("");
        screenStreamRef.current = null;
        setScreenOn(false);
        setActiveRoomId(room.id);
        setActiveRoomCode(typeof room.roomCode === "string" ? room.roomCode : null);
        queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
        enableMic();
      },
      onError: () => toast({ title: "Hata", description: "Oda oluşturulamadı.", variant: "destructive" }),
    });
  };

  const handleJoinByCode = async () => {
    const codeWithoutHash = joinRoomCode.trim().replace(/^#+/, "").toUpperCase();
    const normalizedCode = codeWithoutHash ? `#${codeWithoutHash}` : "";
    if (!normalizedCode) {
      toast({ title: "Oda kodu gerekli", description: "Katılmak için oda kodunu girin.", variant: "destructive" });
      return;
    }

    try {
      const roomResponse = await fetch(`/api/voice-rooms/by-code/${encodeURIComponent(normalizedCode)}`, { credentials: "include" });
      if (!roomResponse.ok) {
        throw new Error();
      }

      const room = await roomResponse.json();
      const id = Number(room?.id);
      if (!id) throw new Error();

      joinMutation.mutate({ roomId: id }, {
        onSuccess: () => {
          setJoinRoomCode("");
          setJoinMode("list");
          screenStreamRef.current = null;
          setScreenOn(false);
          setActiveRoomId(id);
          setActiveRoomCode(typeof room.roomCode === "string" ? room.roomCode : null);
          queryClient.invalidateQueries({ queryKey: getListVoiceRoomsQueryKey() });
          enableMic();
        },
        onError: () => toast({ title: "Hata", description: "Oda kodu ile katılırken bir sorun oluştu.", variant: "destructive" }),
      });
    } catch {
      toast({ title: "Oda bulunamadı", description: "Girdiğiniz kodla aktif bir oda yok veya oda kapatılmış olabilir.", variant: "destructive" });
    }
  };

  const copyRoomCode = async () => {
    const roomCode = activeRoom?.roomCode ?? activeRoomCode;
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedRoomCode(true);
      toast({ title: "Oda kodu kopyalandı" });
      window.setTimeout(() => setCopiedRoomCode(false), 1800);
    } catch {
      toast({ title: "Kopyalanamadı", description: "Oda kodunu elle seçip kopyalayabilirsiniz.", variant: "destructive" });
    }
  };

  // ─── Active Room UI ───────────────────────────────────────────────────────
  if (visibleActiveRoom) {
    const displayedRoomCode = visibleActiveRoom.roomCode ?? activeRoomCode;
    return (
      <AppLayout className={isVoiceRoute ? "" : "hidden"} hideHeader={isCommunityVoiceRoute} hideBottomNav={isCommunityVoiceRoute} fullHeight={isCommunityVoiceRoute} wide={isCommunityVoiceRoute}>
          <div className={`relative flex flex-col gap-3 overflow-hidden p-4 ${isCommunityVoiceRoute ? "h-full" : "h-[calc(100vh-3.5rem-4rem)]"}`}>
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary animate-pulse" />
                {visibleActiveRoom.name}
              </h2>
              {visibleActiveRoom.description && <p className="text-sm text-muted-foreground">{visibleActiveRoom.description}</p>}
              {displayedRoomCode && (
                <button type="button" onClick={copyRoomCode} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20" title="Oda kodunu kopyala">
                  {copiedRoomCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {displayedRoomCode}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isCommunityVoiceRoute && (
                <Button variant="outline" size="sm" onClick={() => { handleLeave(); setLocation(`/community?communityId=${new URLSearchParams(window.location.search).get("communityId")}`); }}>
                  Topluluğa dön
                </Button>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                <Users className="w-3.5 h-3.5" />
                <span>{visibleActiveRoom.participantCount}</span>
              </div>
            </div>
          </div>

          {/* Remote screens (from other users) */}
          {remoteScreens.size > 0 && (
            <div className="space-y-2 flex-shrink-0">
              {Array.from(remoteScreens.entries()).map(([peerId, { displayName, kind }]) => (
                <div key={peerId} className="relative rounded-xl overflow-hidden bg-black border border-primary/30">
                  <video
                    ref={el => { if (el) remoteVideoRefs.current.set(peerId, el); }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-40 object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {kind === "camera" ? <Video className="w-3 h-3" /> : <MonitorUp className="w-3 h-3" />}
                    {kind === "camera" ? `${displayName} kamerayı açtı` : `${displayName} ekranını paylaşıyor`}
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
              <video ref={camVideoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
              <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/50 px-1 rounded">Sen</div>
            </div>
          )}

          {/* Participants */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              {visibleActiveRoom.participants?.map((p) => {
                const isHost = p.id === visibleActiveRoom.createdBy;
                const isMe = p.id === user?.id;
                const isConnected = isMe || peersRef.current.get(p.id)?.pc.connectionState === "connected";
                const isRemoteMuted = !isMe && remoteMicStates.get(p.id) !== true;
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
                      {!isMe && isConnected && !isRemoteMuted && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-card">
                          <Mic className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {isRemoteMuted && <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center border-2 border-card"><MicOff className="w-2.5 h-2.5 text-white" /></div>}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold truncate w-full">{p.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">@{p.username}</p>
                      {isRemoteMuted && <p className="text-[10px] font-medium text-destructive">Sessiz</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {cassetteByUser.size > 0 && (
            <div className="pointer-events-none flex max-w-full flex-shrink-0 items-center gap-1.5 self-center rounded-full border border-pink-300/30 bg-gradient-to-r from-pink-950/90 via-fuchsia-900/90 to-violet-950/90 px-3 py-1.5 text-[11px] font-semibold text-pink-50 shadow-lg shadow-pink-950/20 backdrop-blur-sm">
              <Music2 className="h-3.5 w-3.5 shrink-0 animate-pulse text-pink-300" />
              <span className="truncate">
                {Array.from(cassetteByUser.entries()).slice(0, 1).map(([userId, cassette]) => {
                  const cassetteUser = visibleActiveRoom.participants?.find(participant => participant.id === userId); 
                  return <span key={userId}>{cassetteUser?.displayName ?? "Bir kullanıcı"} {cassette.status === "changing" ? `kaseti değiştiriyor: ${cassette.name}` : `şu an çalıyor: ${cassette.name}`}</span>;
                })}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-3 gap-2 flex-shrink-0 pb-1 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
            <button
              onClick={toggleMic}
              className={`min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl transition-colors ${micOn ? "bg-green-500/15 text-green-600 ring-1 ring-green-500/30" : "bg-destructive/10 text-destructive"}`}
            >
              {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{micOn ? "Mikrofon" : "Sessiz"}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl transition-colors ${camOn ? "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30" : "bg-secondary text-muted-foreground"}`}
            >
              {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{camOn ? "Kamera" : "Kamera"}</span>
            </button>

            <button
              onClick={handleLeave}
              className="min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-4 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <PhoneOff className="w-7 h-7" />
              <span className="text-[10px] font-medium">Ayrıl</span>
            </button>

            <button
              onClick={toggleScreen}
              className={`min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl transition-colors ${screenOn ? "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30" : "bg-secondary text-muted-foreground"}`}
            >
              {screenOn ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
              <span className="text-[10px] font-medium">{screenOn ? "Paylaşıyor" : "Ekran"}</span>
            </button>

            <button
              onClick={() => cassetteInputRef.current?.click()}
              className={`min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl transition-colors ${hasActiveCassette ? "bg-pink-500/15 text-pink-600 ring-1 ring-pink-500/30" : "bg-secondary text-muted-foreground"}`}
              title={hasActiveCassette ? (cassetteName || "Kaseti değiştir") : "Ses dosyası seç"}
            >
              <Music2 className="w-6 h-6" />
              <span className="text-[10px] font-medium">{hasActiveCassette ? "Kaseti değiştir" : "Kaset koy"}</span>
            </button>

            {hasActiveCassette && (
              <button
                onClick={stopCurrentCassette}
                className="min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl bg-secondary text-muted-foreground transition-colors"
                title="Kaseti kapat"
              >
                <X className="w-6 h-6" />
                <span className="text-[10px] font-medium">Kaseti kapat</span>
              </button>
            )}

            {isRoomManager && (
              <button
                onClick={() => setPollDialogOpen(true)}
                className="min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl bg-secondary text-muted-foreground transition-colors"
                title="Oylama başlat"
              >
                <Vote className="w-6 h-6" />
                <span className="text-[10px] font-medium">Oylama</span>
              </button>
            )}

            <button
              onClick={() => toast({ title: "Mobi yakında", description: "Bu özellik hazırlanıyor." })}
              className="min-w-0 flex flex-col items-center gap-1 p-2.5 sm:p-3.5 rounded-2xl bg-secondary text-muted-foreground transition-colors"
              title="Mobi yakında"
            >
              <Radio className="w-6 h-6" />
              <span className="text-[10px] font-medium">Mobi</span>
            </button>
            <input ref={cassetteInputRef} type="file" accept="audio/*" className="hidden" onChange={handleCassetteFile} />
          </div>

          {poll && (
            <div className="absolute bottom-20 left-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-xl backdrop-blur-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Oda oylaması</p><p className="mt-1 text-sm font-bold">{poll.question}</p></div>
                <button type="button" onClick={() => setPoll(null)} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Oylamayı kapat"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2">
                {poll.options.map((option, index) => {
                  const total = poll.votes.reduce((sum, value) => sum + value, 0);
                  const percent = total ? Math.round((poll.votes[index] / total) * 100) : 0;
                  return <button key={`${option}-${index}`} type="button" disabled={poll.voted || isRoomManager} onClick={() => votePoll(index)} className="relative w-full overflow-hidden rounded-xl border border-border p-2 text-left text-xs disabled:cursor-default"><span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${percent}%` }} /><span className="relative flex justify-between gap-2"><span>{option}</span><span className="font-bold text-primary">{percent}%</span></span></button>;
                })}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">{poll.voted || isRoomManager ? "Oylar güncelleniyor" : "Bir seçenek seç"}</p>
            </div>
          )}

          <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Vote className="h-5 w-5 text-primary" />Oylama başlat</DialogTitle><DialogDescription>Odadakilerin hızlıca katılabileceği eğlenceli bir soru hazırla.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} placeholder="Örn. Bu akşam hangi filmi izleyelim?" />
                {pollOptions.map((option, index) => <Input key={index} value={option} onChange={event => setPollOptions(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Seçenek ${index + 1}`} />)}
                {pollOptions.length < 4 && <Button type="button" variant="outline" onClick={() => setPollOptions(current => [...current, ""])}>Seçenek ekle</Button>}
                <Button type="button" className="w-full" onClick={startPoll} disabled={!pollQuestion.trim() || pollOptions.filter(option => option.trim()).length < 2}>Oylamayı başlat</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }

  // ─── Room List ────────────────────────────────────────────────────────────
  return (
    <AppLayout className={isVoiceRoute ? "" : "hidden"} hideHeader={isCommunityVoiceRoute} hideBottomNav={isCommunityVoiceRoute} fullHeight={isCommunityVoiceRoute} wide={isCommunityVoiceRoute}>
      {isCommunityVoiceRoute ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#11131d] p-6 text-center text-white">
          <AudioLines className="h-10 w-10 animate-pulse text-emerald-400" />
          <p className="text-sm font-semibold">Topluluk ses odasına bağlanılıyor...</p>
          <Button variant="outline" onClick={() => setLocation(`/community?communityId=${communityId}`)}>Topluluğa dön</Button>
        </div>
      ) : (
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

        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Button variant={joinMode === "list" ? "default" : "secondary"} size="sm" className="rounded-full" onClick={() => setJoinMode("list")}>Aktif Odalar</Button>
            <Button variant={joinMode === "code" ? "default" : "secondary"} size="sm" className="rounded-full" onClick={() => setJoinMode("code")}>Oda Kodu Gir</Button>
          </div>

          {joinMode === "code" && (
            <div className="flex gap-2">
              <Input value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())} placeholder="Örn: #AB12CD" className="uppercase" />
              <Button onClick={handleJoinByCode} disabled={!joinRoomCode.trim() || joinMutation.isPending}>Katıl</Button>
            </div>
          )}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg leading-tight truncate">{room.name}</h3>
                      {room.roomCode && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{room.roomCode}</span>}
                    </div>
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
                  <Button onClick={() => handleJoin(room.id, room.roomCode)} variant={room.isJoined ? "secondary" : "default"} size="sm" className="rounded-full shadow-sm" disabled={joinMutation.isPending}>
                    {room.isJoined ? "Gir" : "Katıl"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </AppLayout>
  );
}
