import {
  createContext, useContext, useRef, useState, useEffect,
  useCallback, ReactNode,
} from "react";
import { Phone, Video, Mic, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// ── Types ──────────────────────────────────────────────────────────────────
export interface CallUser {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

interface CallState {
  type: "voice" | "video";
  status: "calling" | "connected";
}

interface CallContextValue {
  callState: CallState | null;
  callMinimized: boolean;
  otherCallUser: CallUser | null;
  callDuration: number;
  micMuted: boolean;
  camOff: boolean;
  startCall: (type: "voice" | "video", targetUserId: number, targetUser: CallUser) => Promise<string | null>;
  joinCall: (callId: string, type: "voice" | "video", targetUser: CallUser) => Promise<void>;
  endCall: () => void;
  minimizeCall: () => void;
  maximizeCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

// ── STUN config ────────────────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

const fmtDuration = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── Provider ───────────────────────────────────────────────────────────────
export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState]         = useState<CallState | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [otherCallUser, setOtherCallUser] = useState<CallUser | null>(null);
  const [callDuration, setCallDuration]   = useState(0);
  const [micMuted, setMicMuted]           = useState(false);
  const [camOff, setCamOff]               = useState(false);

  // Media element refs — always in DOM
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement | null>(null);

  // WebRTC refs
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callIdRef       = useRef<string>("");
  const icePollerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIceRef      = useRef<Set<string>>(new Set());

  // Duration counter
  useEffect(() => {
    if (callState?.status !== "connected") return;
    setCallDuration(0);
    const t = setInterval(() => setCallDuration(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState?.status]);

  // Re-attach streams to video elements whenever overlay becomes visible
  useEffect(() => {
    if (!callState || callMinimized) return;
    if (remoteStreamRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [callState, callMinimized]);

  // ── Attach remote stream ──────────────────────────────────────────────────
  const attachRemoteStream = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;

    // Enable all audio tracks explicitly
    stream.getAudioTracks().forEach(t => { t.enabled = true; });

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

  // ── Stable ref callbacks — prevent re-render flickering ──────────────────
  // These are created once; React calls them only when element mounts/unmounts.
  const remoteVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const localVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // ── endCall ────────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (callIdRef.current) {
      fetch("/api/calls/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: callIdRef.current }),
      }).catch(() => {});
      callIdRef.current = "";
    }
    if (icePollerRef.current) { clearInterval(icePollerRef.current); icePollerRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    seenIceRef.current = new Set();
    setCallState(null);
    setCallMinimized(false);
    setCallDuration(0);
    setOtherCallUser(null);
    setMicMuted(false);
    setCamOff(false);
  }, []);

  // ── ICE polling ────────────────────────────────────────────────────────────
  const startIcePolling = useCallback((callId: string, role: "caller" | "callee") => {
    if (icePollerRef.current) clearInterval(icePollerRef.current);
    seenIceRef.current = new Set();
    icePollerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.ended) { endCall(); return; }

        const candidates: RTCIceCandidateInit[] =
          role === "caller" ? (data.calleeIce ?? []) : (data.callerIce ?? []);
        for (const cand of candidates) {
          const key = JSON.stringify(cand);
          if (seenIceRef.current.has(key)) continue;
          seenIceRef.current.add(key);
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }

        if (role === "caller" && data.answer && pcRef.current?.remoteDescription === null) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallState(prev => prev ? { ...prev, status: "connected" } : null);
        }
      } catch { /* sessiz */ }
    }, 1000);
  }, [endCall]);

  // ── startCall — caller ────────────────────────────────────────────────────
  const startCall = useCallback(async (
    type: "voice" | "video",
    targetUserId: number,
    targetUser: CallUser,
  ): Promise<string | null> => {
    setMicMuted(false);
    setCamOff(false);
    setCallState({ type, status: "calling" });
    setCallMinimized(false);
    setOtherCallUser(targetUser);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;

      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        const incomingStream = e.streams[0] ?? (() => {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(e.track);
          return remoteStreamRef.current;
        })();
        attachRemoteStream(incomingStream);
        setCallState(prev => prev ? { ...prev, status: "connected" } : null);
      };

      const callId = crypto.randomUUID();
      callIdRef.current = callId;

      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        await fetch("/api/calls/ice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId, candidate, role: "caller" }),
        }).catch(() => {});
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch("/api/calls/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, callType: type, calleeId: targetUserId, sdp: offer }),
      });

      startIcePolling(callId, "caller");
      return callId;
    } catch (err) {
      endCall();
      throw err;
    }
  }, [attachRemoteStream, startIcePolling, endCall]);

  // ── joinCall — callee ─────────────────────────────────────────────────────
  const joinCall = useCallback(async (
    callId: string,
    type: "voice" | "video",
    targetUser: CallUser,
  ): Promise<void> => {
    setMicMuted(false);
    setCamOff(false);
    setCallState({ type, status: "calling" });
    setCallMinimized(false);
    setOtherCallUser(targetUser);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;

      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        const incomingStream = e.streams[0] ?? (() => {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(e.track);
          return remoteStreamRef.current;
        })();
        attachRemoteStream(incomingStream);
        setCallState({ type, status: "connected" });
      };

      callIdRef.current = callId;

      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        await fetch("/api/calls/ice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId, candidate, role: "callee" }),
        }).catch(() => {});
      };

      let data: { offer?: RTCSessionDescriptionInit | null; ended?: boolean } | null = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const res = await fetch(`/api/calls/${callId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Arama bilgisi alınamadı");
        data = await res.json() as { offer?: RTCSessionDescriptionInit | null; ended?: boolean };
        if (data.ended) throw new Error("Arama sonlandırıldı");
        if (data.offer) break;
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      if (!data?.offer) throw new Error("Arama teklifi alınamadı, lütfen tekrar deneyin");

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch("/api/calls/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, sdp: answer }),
      });

      startIcePolling(callId, "callee");
    } catch (err) {
      endCall();
      throw err;
    }
  }, [attachRemoteStream, startIcePolling, endCall]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = micMuted; });
    setMicMuted(v => !v);
  }, [micMuted]);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; });
    setCamOff(v => !v);
  }, [camOff]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <CallContext.Provider value={{
      callState, callMinimized, otherCallUser, callDuration,
      micMuted, camOff,
      startCall, joinCall, endCall,
      minimizeCall: () => setCallMinimized(true),
      maximizeCall: () => setCallMinimized(false),
      toggleMic, toggleCam,
    }}>
      {children}

      {/* ── Her zaman DOM'da bulunan ses elemanı ── */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={false}
        className="hidden"
      />

      {/* ── Global floating call indicator (arka planda) ── */}
      {callState && callMinimized && (
        <>
          <style>{`
            @keyframes callFloat {
              0%,100% { transform:scale(1); box-shadow:0 4px 24px rgba(139,92,246,.45); }
              50%      { transform:scale(1.03); box-shadow:0 8px 32px rgba(139,92,246,.7); }
            }
          `}</style>
          <button
            onClick={() => setCallMinimized(false)}
            className="fixed top-4 right-4 z-[200] flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-2xl text-white text-[13px] font-semibold select-none"
            aria-label="Aramaya dön"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #7c3aed 100%)",
              animation: "callFloat 2s ease-in-out infinite",
            }}
          >
            <span className="relative flex-shrink-0">
              {callState.type === "voice"
                ? <Phone className="w-4 h-4" />
                : <Video className="w-4 h-4" />}
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-300 animate-ping" />
            </span>
            <span>
              {callState.status === "connected"
                ? fmtDuration(callDuration)
                : "Arıyor…"}
            </span>
          </button>
        </>
      )}

      {/* ── Tam ekran arama modalı ── */}
      {callState && !callMinimized && (
        <div className="fixed inset-0 z-[150] flex flex-col bg-gradient-to-b from-violet-950 via-purple-900 to-fuchsia-900">

          {/* Görüntülü arama: uzak video tam ekran arka plan */}
          {callState.type === "video" && (
            <>
              {/* Remote video — stable ref callback, no flicker */}
              <video
                ref={remoteVideoCallbackRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: callState.status === "connected" ? 1 : 0, transition: "opacity 0.5s" }}
              />
              {/* Yerel video — küçük, sağ üst */}
              <div className="absolute top-14 right-4 w-28 aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl z-10 bg-black/60">
                {!camOff
                  ? <video
                      ref={localVideoCallbackRef}
                      autoPlay playsInline muted
                      className="w-full h-full object-cover"
                    />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-white/40" />
                    </div>
                }
              </div>
            </>
          )}

          {/* Üst: kullanıcı bilgisi */}
          <div className="relative z-10 flex flex-col items-center pt-20 gap-4">
            {callState.type === "voice" && (
              <div className="relative">
                <Avatar className="w-28 h-28 ring-4 ring-white/20 shadow-2xl">
                  <AvatarImage src={otherCallUser?.avatarUrl || ""} />
                  <AvatarFallback className="bg-violet-600 text-white text-4xl font-bold">
                    {otherCallUser?.displayName?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {callState.status === "calling" && (
                  <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
                )}
              </div>
            )}
            <div className="text-center">
              <p className="text-white text-xl font-bold drop-shadow">{otherCallUser?.displayName}</p>
              <p className="text-white/70 text-sm mt-1 drop-shadow">
                {callState.status === "calling"
                  ? (callState.type === "voice" ? "Sesli aranıyor…" : "Görüntülü aranıyor…")
                  : fmtDuration(callDuration)}
              </p>
            </div>
          </div>

          {/* Alt: kontrol butonları */}
          <div className="absolute bottom-14 left-0 right-0 z-10 flex items-center justify-center gap-4">
            {/* Küçült — Instagram gibi alta taşındı */}
            <button
              onClick={() => setCallMinimized(true)}
              className="w-14 h-14 rounded-full bg-white/20 flex flex-col items-center justify-center gap-0.5 transition-all hover:bg-white/30 active:scale-95"
              aria-label="Arka plana al"
            >
              <ChevronDown className="w-6 h-6 text-white" />
              <span className="text-[9px] text-white/70 font-medium">Küçült</span>
            </button>

            {/* Mikrofon */}
            <button
              onClick={toggleMic}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${micMuted ? "bg-white" : "bg-white/20"}`}
            >
              <Mic className={`w-6 h-6 ${micMuted ? "text-purple-900" : "text-white"}`} />
              <span className={`text-[9px] font-medium ${micMuted ? "text-purple-700" : "text-white/70"}`}>
                {micMuted ? "Sessiz" : "Mikrofon"}
              </span>
            </button>

            {/* Bitir */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 flex flex-col items-center justify-center gap-0.5 shadow-2xl hover:bg-red-600 active:scale-95 transition-all"
            >
              <Phone className="w-7 h-7 text-white rotate-[135deg]" />
              <span className="text-[9px] text-white/80 font-medium">Bitir</span>
            </button>

            {/* Kamera (görüntülü) */}
            {callState.type === "video" && (
              <button
                onClick={toggleCam}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${camOff ? "bg-white" : "bg-white/20"}`}
              >
                <Video className={`w-6 h-6 ${camOff ? "text-purple-900" : "text-white"}`} />
                <span className={`text-[9px] font-medium ${camOff ? "text-purple-700" : "text-white/70"}`}>
                  {camOff ? "Kapalı" : "Kamera"}
                </span>
              </button>
            )}

            {/* Hoparlör (sesli) */}
            {callState.type === "voice" && (
              <button className="w-14 h-14 rounded-full bg-white/20 flex flex-col items-center justify-center gap-0.5 active:scale-95">
                <span className="text-2xl leading-none">🔊</span>
                <span className="text-[9px] text-white/70 font-medium">Hoparlör</span>
              </button>
            )}
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}
