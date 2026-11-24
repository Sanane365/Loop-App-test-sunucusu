import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Send, SquareSquare, X, Users, ImagePlus,
  StopCircle, Plus, Smile, ArrowRight, MessageCircle, Reply, ShieldAlert, Bot,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListChatMessages,
  useSendChatMessage,
  getListChatMessagesQueryKey,
  useListStories,
  getListStoriesQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import GifPicker from "@/components/shared/GifPicker";
import { UserNameWithDecorations } from "@/components/shared/UserNameWithDecorations";

interface ActiveUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  badgeAssetUrl?: string | null;
  emblemAssetUrl?: string | null;
  badgeLabel?: string | null;
  lastSeenAt: string | null;
}

interface MentionUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ChatRoom {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
}

interface ModiPoll {
  id: number;
  targetUserId: number;
  roomId: number | null;
  targetUsername: string;
  targetDisplayName: string;
  endsAt: string;
  muteMinutes: number;
  isTest?: boolean;
  canVote: boolean;
  voteCount: number;
  yesCount: number;
  noCount: number;
  hasVoted: boolean | null;
  myVoteYes: boolean | null;
  pollMinVotes: number;
}

function formatChatBanWarning(reason?: string, expiresAt?: string | null) {
  const message = reason || "Genel sohbet alanında erişimin kısıtlandı.";
  if (!expiresAt) return `${message} Süre: Süresiz.`;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return message;
  const minutes = Math.ceil(remaining / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const duration = `${days > 0 ? `${days} gün ` : ""}${hours > 0 ? `${hours} saat ` : ""}${mins > 0 || (days === 0 && hours === 0) ? `${mins} dakika` : ""}`.trim();
  return `${message} Kalan süre: ${duration}.`;
}

export default function Chat() {
  const { user } = useAuth();
  const { data: storyGroups } = useListStories({
    query: { queryKey: getListStoriesQueryKey(), refetchOnMount: "always" },
  });
  const storyUserIds = new Set((storyGroups ?? []).filter(group => group.hasUnviewed).map((group) => group.user.id));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [content, setContent] = useState("");
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(null);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const [chatRoomsError, setChatRoomsError] = useState("");
  const [chatBanWarning, setChatBanWarning] = useState<string | null>(null);
  const [modiPolls, setModiPolls] = useState<ModiPoll[]>([]);
  const [modiAssetUrl, setModiAssetUrl] = useState<string | null>(null);
  const [modiProfileUrl, setModiProfileUrl] = useState<string | null>(null);
  const [expandedModiPollIds, setExpandedModiPollIds] = useState<Set<number>>(() => new Set());
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<number>>(() => new Set());
  const [modiPendingAction, setModiPendingAction] = useState<number | null>(null);
  const chatMessagesParams = selectedChatRoom ? { roomId: selectedChatRoom.id } : undefined;
  const { data: messages, isLoading, error: chatError } = useListChatMessages(chatMessagesParams, {
    query: { queryKey: getListChatMessagesQueryKey(chatMessagesParams), retry: false },
  });
  const sendMutation = useSendChatMessage();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshModiPolls = useCallback(async () => {
    const roomQuery = selectedChatRoom ? `?roomId=${selectedChatRoom.id}` : "";
    const response = await fetch(`/api/chat/modi/polls${roomQuery}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Modi oylamaları alınamadı.");
    setModiPolls(await response.json() as ModiPoll[]);
  }, [selectedChatRoom]);

  const reportChatMessage = async (messageId: number) => {
    setModiPendingAction(messageId);
    try {
      const response = await fetch(`/api/chat/messages/${messageId}/report`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({})) as { error?: string; duplicate?: boolean; pollStarted?: boolean };
      if (!response.ok) throw new Error(data.error || "Bildirim gönderilemedi.");
      setReportedMessageIds(current => new Set(current).add(messageId));
      toast({
        title: data.duplicate ? "Bu hesabı zaten bildirdin" : "Bildirim Modi’ye iletildi",
        description: data.pollStarted ? `Yeterli farklı bildirim alındı; ${selectedChatRoom ? "bu odada" : "genel sohbette"} oylama başladı.` : undefined,
      });
      await refreshModiPolls();
      queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
    } catch (error) {
      toast({ title: "Bildirim gönderilemedi", description: error instanceof Error ? error.message : "Bir hata oluştu.", variant: "destructive" });
    } finally {
      setModiPendingAction(null);
    }
  };

  const castModiVote = async (pollId: number, voteYes: boolean) => {
    setModiPendingAction(-pollId);
    try {
      const response = await fetch(`/api/chat/modi/polls/${pollId}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteYes }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Oy kaydedilemedi.");
      await refreshModiPolls();
      toast({ title: "Oyun kaydedildi" });
    } catch (error) {
      toast({ title: "Oy kaydedilemedi", description: error instanceof Error ? error.message : "Bir hata oluştu.", variant: "destructive" });
    } finally {
      setModiPendingAction(null);
    }
  };

  const reopenModiPoll = (pollId: number) => {
    setExpandedModiPollIds(current => new Set(current).add(pollId));
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  };

  // GIF state
  const [gifOpen, setGifOpen] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);

  useEffect(() => {
    const error = chatError as { status?: number; message?: string; data?: { error?: string; reason?: string; expiresAt?: string | null } } | null;
    const isForbidden = error?.status === 403 || error?.message?.startsWith("HTTP 403");
    if (isForbidden) {
      const data = error?.data;
      setChatBanWarning(formatChatBanWarning(data?.reason, data?.expiresAt));
    } else if (!chatError) {
      setChatBanWarning(null);
    }
  }, [chatError]);


  // Active users panel
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  // @mention state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMapRef = useRef<Record<string, number>>({});

  // Playing voice
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<{ username: string; displayName: string }[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Swipe to reply
  const [replyTo, setReplyTo] = useState<{ id: number; content: string; displayName: string } | null>(null);
  const swipeTouchStartX = useRef<number>(0);
  const swipeTouchMsgId = useRef<number | null>(null);
  const [swipingMsgId, setSwipingMsgId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [composerShift, setComposerShift] = useState(0);
  const doubleTapEnabled = localStorage.getItem("loop-setting-doubleTap") !== "false";
  const doubleTapEmoji = localStorage.getItem("loop-setting-doubleTapEmoji") || "❤️";

  const shouldRevealComposer = content.trim().length > 0 || isRecording || composerShift === 0;

  const toggleMessageLike = async (messageId: number) => {
    if (!doubleTapEnabled) return;
    await fetch(`/api/chat/messages/${messageId}/like`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: doubleTapEmoji }),
    });
    queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
  };

  // Swipe state for panel
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  useEffect(() => {
    if (!selectedChatRoom) return;
    const roomId = selectedChatRoom.id;
    let roomClosed = false;
    let lastInteractionAt = Date.now();
    const markRoomInteraction = () => {
      if (document.visibilityState !== "hidden") lastInteractionAt = Date.now();
    };
    const pulseRoomActivity = async () => {
      if (document.visibilityState === "hidden" || Date.now() - lastInteractionAt > 30_000) return;
      try {
        const response = await fetch(`/api/chat/rooms/${roomId}/activity`, {
          method: "POST",
          credentials: "include",
        });
        if (response.status === 410) {
          if (roomClosed) return;
          roomClosed = true;
          setChatRooms(current => current.filter(room => room.id !== roomId));
          setSelectedChatRoom(current => current?.id === roomId ? null : current);
          toast({
            title: "Sohbet odası arşivlendi",
            description: "Odada 30 dakika aktif kimse kalmadı. Sohbet geçmişi 2 gün saklanıp sonra silinecek.",
          });
          return;
        }
        if (!response.ok) throw new Error(`Oda etkinliği kaydedilemedi (${response.status}).`);
      } catch (error) {
        console.error("Sohbet odası etkinliği yenilenemedi:", error);
      }
    };
    document.addEventListener("pointerdown", markRoomInteraction);
    document.addEventListener("keydown", markRoomInteraction);
    document.addEventListener("touchstart", markRoomInteraction, { passive: true });
    document.addEventListener("scroll", markRoomInteraction, true);
    window.addEventListener("focus", markRoomInteraction);
    document.addEventListener("visibilitychange", markRoomInteraction);
    void pulseRoomActivity();
    const interval = setInterval(() => void pulseRoomActivity(), 15_000);
    return () => {
      clearInterval(interval);
      document.removeEventListener("pointerdown", markRoomInteraction);
      document.removeEventListener("keydown", markRoomInteraction);
      document.removeEventListener("touchstart", markRoomInteraction);
      document.removeEventListener("scroll", markRoomInteraction, true);
      window.removeEventListener("focus", markRoomInteraction);
      document.removeEventListener("visibilitychange", markRoomInteraction);
    };
  }, [selectedChatRoom, toast]);

  useEffect(() => {
    const refresh = () => { void refreshModiPolls().catch(error => console.error("Modi oylamaları yenilenemedi", error)); };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refreshModiPolls]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/modi/asset", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Modi görseli yüklenemedi.");
        return await response.json() as { assetUrl?: string | null; profileUrl?: string | null };
      })
      .then(asset => {
        if (!cancelled) {
          setModiAssetUrl(asset.assetUrl ?? null);
          setModiProfileUrl(asset.profileUrl ?? null);
        }
      })
      .catch(error => console.error("Modi oylama görseli yüklenemedi", error));
    return () => { cancelled = true; };
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    const res = await fetch("/api/chat/active-users");
    if (res.ok) setActiveUsers(await res.json());
  }, []);

  // Auto-refresh active users every 30s
  useEffect(() => {
    fetchActiveUsers();
    const t = setInterval(fetchActiveUsers, 30000);
    return () => clearInterval(t);
  }, [fetchActiveUsers]);

  // Poll typing state every 2s
  useEffect(() => {
    const poll = async () => {
      if (selectedChatRoom) {
        setTypingUsers([]);
        return;
      }
      try {
        const r = await fetch("/api/chat/typing", { credentials: "include" });
        if (r.ok) setTypingUsers(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [selectedChatRoom]);

  const openPanel = useCallback(() => {
    fetchActiveUsers();
    setPanelOpen(true);
  }, [fetchActiveUsers]);

  const openRoomsPanel = useCallback(async () => {
    setPanelOpen(false);
    setRoomPanelOpen(true);
    setChatRoomsLoading(true);
    setChatRoomsError("");
    try {
      const response = await fetch("/api/chat/rooms", { credentials: "include" });
      const result = await response.json() as ChatRoom[] | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error || "Sohbet odaları yüklenemedi." : "Sohbet odaları yüklenemedi.");
      }
      setChatRooms(result as ChatRoom[]);
    } catch (cause) {
      setChatRoomsError(cause instanceof Error ? cause.message : "Sohbet odaları yüklenemedi.");
    } finally {
      setChatRoomsLoading(false);
    }
  }, []);

  const createChatRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = roomNameDraft.trim();
    if (name.length < 2 || name.length > 40 || !user) return;
    setChatRoomsError("");
    try {
      const response = await fetch("/api/chat/rooms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json() as ChatRoom | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error || "Oda oluşturulamadı." : "Oda oluşturulamadı.");
      }
      const created = result as ChatRoom;
      setChatRooms((current) => [created, ...current]);
      setSelectedChatRoom(created);
      setRoomNameDraft("");
      setRoomPanelOpen(false);
    } catch (cause) {
      setChatRoomsError(cause instanceof Error ? cause.message : "Sohbet odası oluşturulamadı.");
    }
  };

  // Swipe gesture: start in the middle 40% of screen, drag left → open panel
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (gifOpen) { touchStartX.current = null; touchStartY.current = null; return; }
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = touchStartX.current - t.clientX;   // positive = swipe left
    const dy = Math.abs(t.clientY - touchStartY.current);
    const screenW = window.innerWidth;
    const startedMiddle = touchStartX.current > screenW * 0.3 && touchStartX.current < screenW * 0.8;
    if (startedMiddle && dx > 60 && dy < 60) {
      openPanel();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // @mention autocomplete
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);
    // Typing signal — throttled to once per 2.5s
    const now = Date.now();
    if (!selectedChatRoom && val.trim() && now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      fetch("/api/chat/typing", { method: "POST", credentials: "include" }).catch(() => {});
    }
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
      setContent(`${before}@${u.username} ${after}`);
    }
    setMentionSearch(null);
    setMentionUsers([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSearch !== null && mentionUsers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionUsers.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionSearch(null); setMentionUsers([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openGifPicker = () => { setGifOpen(true); };

  const handleSend = () => {
    if (chatBanWarning) return;
    const text = content.trim();
    if (!text) return;
    const finalContent = replyTo
      ? `__LOOP_REPLY__:${replyTo.displayName}:${replyTo.content.slice(0, 100)}\n${text}`
      : text;
    setContent("");
    setMentionSearch(null);
    setMentionUsers([]);
    setReplyTo(null);
    sendMutation.mutate({ data: { type: "text", content: finalContent, roomId: selectedChatRoom?.id } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }),
      onError: (error: any) => {
        setContent(text);
        if (error?.data?.error === "modi_warning") {
          if (error.data.expiresAt) setChatBanWarning(formatChatBanWarning(error.data.reason, error.data.expiresAt));
          toast({ title: "Modi uyarısı", description: error.data.reason || "Mesaj topluluk kurallarına uymadığı için gönderilmedi.", variant: "destructive" });
          return;
        }
        if (error?.status === 403 || error?.message?.startsWith("HTTP 403")) {
          setChatBanWarning(formatChatBanWarning(error.data?.reason, error.data?.expiresAt));
        }
        toast({ title: "Hata", description: error?.data?.reason || "Mesaj gönderilemedi.", variant: "destructive" });
      },
    });
  };

  const handleSendGif = (url: string) => {
    sendMutation.mutate({ data: { type: "gif", gifUrl: url, roomId: selectedChatRoom?.id } }, {
      onSuccess: () => { setGifOpen(false); queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }); },
      onError: (error: any) => {
        if (error?.status === 403 || error?.message?.startsWith("HTTP 403")) {
          setChatBanWarning(formatChatBanWarning(error.data?.reason, error.data?.expiresAt));
        }
        toast({ title: "GIF gönderilemedi", description: error?.data?.reason || "Genel sohbet erişimin kısıtlı olabilir.", variant: "destructive" });
      },
    });
  };

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    if (selectedChatRoom) formData.append("roomId", String(selectedChatRoom.id));
    try {
      const res = await fetch("/api/chat/media", { method: "POST", body: formData });
      if (res.ok) queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
      else {
        const data = await res.json().catch(() => ({})) as { reason?: string; expiresAt?: string | null };
        if (res.status === 403) setChatBanWarning(formatChatBanWarning(data.reason, data.expiresAt));
        toast({ title: "Hata", description: data.reason || "Fotoğraf gönderilemedi.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hata", description: "Fotoğraf gönderilemedi.", variant: "destructive" });
    }
  };

  const isStartingRecordingRef = useRef(false);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setRecordingSeconds(0);
  };

  const startRecording = async () => {
    if (isRecording || isStartingRecordingRef.current) return;
    isStartingRecordingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) return;
        const duration = Math.max(1, recordingDurationRef.current);
        const ext = mimeType.includes("ogg") ? ".ogg" : ".webm";
        const formData = new FormData();
        formData.append("file", audioBlob, `voice${ext}`);
        formData.append("duration", String(duration));
        if (selectedChatRoom) formData.append("roomId", String(selectedChatRoom.id));
        try {
          const res = await fetch("/api/chat/voice", { method: "POST", body: formData });
          if (res.ok) queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
          else {
            const data = await res.json().catch(() => ({})) as { reason?: string; expiresAt?: string | null };
            if (res.status === 403) setChatBanWarning(formatChatBanWarning(data.reason, data.expiresAt));
            toast({ title: "Sesli mesaj gönderilemedi", description: data.reason || "Bir hata oluştu.", variant: "destructive" });
          }
        } catch {
          toast({ title: "Sesli mesaj gönderilemedi", description: "Sunucuya bağlanılamadı.", variant: "destructive" });
        }
      };
      recorder.start(200);
      stopTimer();
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
      setIsRecording(true);
    } catch {
      stopTimer();
      toast({ title: "Mikrofon erişimi reddedildi", description: "Tarayıcı ayarlarından mikrofon iznini etkinleştir.", variant: "destructive" });
    } finally {
      isStartingRecordingRef.current = false;
    }
  };

  const cancelRecording = () => {
    stopTimer();
    const mr = mediaRecorderRef.current;
    if (mr) {
      mediaRecorderRef.current = null;
      try {
        mr.ondataavailable = null;
        mr.onstop = null;
        if (mr.state !== "inactive") mr.stop();
        mr.stream.getTracks().forEach(t => t.stop());
      } catch {}
    }
    audioChunksRef.current = [];
    recordingDurationRef.current = 0;
    setIsRecording(false);
  };

  const stopRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current && isRecording) {
      recordingDurationRef.current = recordingSeconds;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePlayVoice = (msgId: number, voiceUrl: string) => {
    if (playingId === msgId) { audioRef.current?.pause(); setPlayingId(null); return; }
    if (audioRef.current) audioRef.current.pause();
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

  const renderMessage = (text: string) =>
    text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-semibold cursor-pointer hover:underline"
          onClick={() => navigateToMentionedUser(part.slice(1))}>{part}</span>
      ) : part
    );

  const formatMsgTime = (iso: string) => {
    try { return format(new Date(iso), "HH:mm", { locale: tr }); } catch { return ""; }
  };

  return (
    <AppLayout>
      {roomPanelOpen && (
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[1px]" onClick={() => setRoomPanelOpen(false)} />
      )}
      <aside
        aria-label="Genel sohbet odaları"
        aria-hidden={!roomPanelOpen}
        className={`fixed inset-y-0 left-0 z-[70] flex w-[min(21rem,88vw)] flex-col border-r border-white/10 bg-[#11131d] text-white shadow-2xl transition-transform duration-300 ease-out ${roomPanelOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4 pt-12">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Genel sohbet</p>
            <h2 className="mt-1 text-lg font-black">Sohbet odaları</h2>
          </div>
          <button type="button" aria-label="Oda menüsünü kapat" onClick={() => setRoomPanelOpen(false)} className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2 border-b border-white/10 p-3">
          <button type="button" onClick={() => { setSelectedChatRoom(null); setRoomPanelOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-white transition ${selectedChatRoom ? "hover:bg-white/[0.06]" : "bg-violet-500/15 hover:bg-violet-500/20"}`}>
            <MessageCircle className="h-4 w-4 text-violet-300" />
            Genel sohbet odası
          </button>
          {user && <form onSubmit={(event) => void createChatRoom(event)} className="flex gap-2">
            <input value={roomNameDraft} onChange={(event) => setRoomNameDraft(event.target.value.slice(0, 40))} minLength={2} maxLength={40} required placeholder="Yeni sohbet odası" aria-label="Yeni sohbet odasının adı" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-violet-400/60" />
            <button type="submit" disabled={roomNameDraft.trim().length < 2} aria-label="Sohbet odası oluştur" title="Sohbet odası oluştur" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </form>}
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Oluşturulan odalar</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {chatRoomsLoading ? (
            <p className="px-3 py-4 text-sm text-white/50">Sohbet odaları yükleniyor...</p>
          ) : chatRoomsError ? (
            <p role="alert" className="px-3 py-4 text-sm text-rose-300">{chatRoomsError}</p>
          ) : chatRooms.length === 0 ? (
            <div className="mx-2 mt-2 rounded-xl border border-dashed border-white/15 p-4 text-center">
              <MessageCircle className="mx-auto h-6 w-6 text-white/35" />
              <p className="mt-2 text-xs leading-5 text-white/55">Henüz ek sohbet odası yok. İstersen yeni bir oda oluştur.</p>
            </div>
          ) : (
            chatRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => { setSelectedChatRoom(room); setRoomPanelOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${selectedChatRoom?.id === room.id ? "bg-violet-500/15" : "hover:bg-white/[0.07]"}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-violet-200">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white/90">{room.name}</span>
                  <span className="block text-[10px] text-white/45">30 dk inaktiflikte arşivlenir</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Overlay for panel backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Sliding Users Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-50 flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-semibold text-base">Çevrimiçi</span>
            <span className="text-muted-foreground text-sm font-medium">{activeUsers.length || 87}</span>
          </div>
          <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeUsers.length === 0 ? (
            /* Placeholder users while loading / empty */
            [
              { name: "yosun", status: "Sohbette" },
              { name: "ceraunopile", status: "Sohbette" },
              { name: "elifx", status: "Sohbette" },
              { name: "mert_07", status: "Sohbette" },
              { name: "zeynep", status: "Sohbette" },
              { name: "arda", status: "Sohbette" },
              { name: "berkx", status: "Sohbette" },
              { name: "defne", status: "Sohbette" },
            ].map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-default">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-base font-bold text-muted-foreground">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.status}</p>
                </div>
              </div>
            ))
          ) : (
            activeUsers.map(u => (
              <button
                key={u.id}
                onClick={() => { setPanelOpen(false); setLocation(`/profile/${u.id}`); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="relative">
                  <Avatar data-story-user-id={u.id} className={`w-11 h-11 ${storyUserIds.has(u.id) ? "story-avatar-ring" : ""}`}>
                    <AvatarImage src={u.avatarUrl || ""} />
                    <AvatarFallback className="font-bold">{u.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                </div>
                <div className="min-w-0">
                  <UserNameWithDecorations user={u} className="font-semibold text-sm" />
                  <p className="text-xs text-muted-foreground">Sohbette</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* See all */}
        <div className="p-4 border-t border-border">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors">
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div
        className="flex flex-col h-[calc(100vh-3.5rem-4rem)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-20 flex items-center px-4 py-3 border-b border-border bg-background/90 backdrop-blur-md shadow-sm">
          {/* Left: menu icon */}
          <button type="button" aria-label="Sohbet odaları menüsünü aç" aria-expanded={roomPanelOpen} onClick={() => void openRoomsPanel()} className="p-1.5 -ml-1 text-foreground hover:bg-muted rounded-xl transition-colors mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Center: title + online count */}
          <div className="flex-1">
            <h1 className="font-black italic text-xl leading-tight tracking-tight">{selectedChatRoom?.name ?? "Genel Sohbet"}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">{selectedChatRoom ? "Sohbet odası" : activeUsers.length > 0 ? `${activeUsers.length} çevrimiçi` : "Yükleniyor..."}</span>
            </div>
          </div>

          {/* Right: users + chat icons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void openRoomsPanel()}
              aria-label="Sohbet odaları"
              title="Sohbet odaları"
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 px-3 text-violet-600 transition hover:border-violet-400/45 hover:from-violet-500/20 hover:to-fuchsia-500/15"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden text-xs font-bold sm:inline">Odalar</span>
            </button>
            <button
              onClick={openPanel}
              disabled={!!chatBanWarning}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={openPanel}
              disabled={!!chatBanWarning}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const atBottom = distanceFromBottom < 80;
            setComposerShift(atBottom ? 0 : 38);
          }}
          style={{
            background: "hsl(var(--background))",
            scrollPaddingBottom: "calc(7.25rem + env(safe-area-inset-bottom))",
          }}
        >
          {chatBanWarning && (
            <div role="alert" className="mx-auto mb-4 max-w-md rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center shadow-sm">
              <div className="mb-1 flex items-center justify-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
                <p className="text-sm font-bold">Sistem mesajı</p>
              </div>
              <p className="text-sm font-semibold text-foreground">Genel sohbet erişimi kısıtlandı</p>
              <p className="mt-1 text-xs text-muted-foreground">{chatBanWarning}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Bu alanda mesaj gönderemezsin.</p>
            </div>
          )}
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className={`flex gap-2 items-end ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0 animate-pulse" />
                <div className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "w-48" : "w-36"}`} />
              </div>
            ))
          ) : (
            messages?.map((msg, idx) => {
              const isMe = msg.userId === user?.id;
              const isBobi = String(msg.type) === "bobi" || msg.user?.username?.toLowerCase() === "bobi";
              const isModi = String(msg.type) === "modi" || msg.user?.username?.toLowerCase() === "modi";
              const prevMsg = messages[idx - 1];
              const sameUserAsPrev = prevMsg?.userId === msg.userId;

              const msgPreview = (msg.type === "text" || isBobi || isModi) ? (msg.content ?? "").replace(/^__LOOP_REPLY__:[^\n]+\n/, "").slice(0, 100) : msg.type === "gif" ? "GIF" : msg.voiceUrl ? "Sesli mesaj" : "Medya";
              return (
                <div key={msg.id} className={`relative ${sameUserAsPrev ? "mt-0.5" : "mt-4"}`}>
                  {/* Reply icon (fixed, revealed behind sliding row) */}
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                    style={{ opacity: swipingMsgId === msg.id ? Math.min(swipeOffset / 48, 1) : 0, transition: swipingMsgId === msg.id ? "none" : "opacity 0.15s" }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${swipeOffset >= 48 && swipingMsgId === msg.id ? "bg-primary/20" : "bg-muted"}`}>
                      <Reply className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Sliding row */}
                  <div className={`relative z-10 flex gap-2.5 items-end ${isMe ? "flex-row-reverse" : ""}`}
                    onDoubleClick={() => void toggleMessageLike(msg.id)}
                    style={swipingMsgId === msg.id ? { transform: `translateX(${swipeOffset}px)`, transition: "none" } : { transform: "translateX(0)", transition: "transform 0.2s ease" }}
                    onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; swipeTouchMsgId.current = msg.id; setSwipingMsgId(msg.id); setSwipeOffset(0); }}
                    onTouchMove={(e) => { if (swipeTouchMsgId.current !== msg.id) return; const dx = e.touches[0].clientX - swipeTouchStartX.current; if (dx > 4) setSwipeOffset(Math.min(dx, 72)); }}
                    onTouchEnd={() => { if (swipingMsgId === msg.id && swipeOffset >= 48) { setReplyTo({ id: msg.id, content: msgPreview, displayName: msg.user?.displayName ?? "Kullanıcı" }); if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25); } setSwipingMsgId(null); setSwipeOffset(0); swipeTouchMsgId.current = null; }}
                  >
                  {/* Avatar — hide if same user as previous */}
                    <button
                    className={`flex-shrink-0 self-end ${sameUserAsPrev ? "opacity-0 pointer-events-none" : ""}`}
                    onClick={() => !sameUserAsPrev && setLocation(`/profile/${msg.userId}`)}
                  >
                    <Avatar data-story-user-id={msg.userId ?? undefined} className={`w-9 h-9 border-2 border-background shadow-sm ${msg.userId && storyUserIds.has(msg.userId) ? "story-avatar-ring" : ""}`}>
                      <AvatarImage src={isModi ? modiProfileUrl || msg.user?.avatarUrl || "" : msg.user?.avatarUrl || ""} />
                      <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                        {msg.user?.displayName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[72%]`}>
                    {/* Sender name (only first in group) */}
                    {!isMe && !sameUserAsPrev && (
                      <button
                        className="text-xs font-bold text-primary mb-1 ml-1 hover:underline"
                        onClick={() => setLocation(`/profile/${msg.userId}`)}
                      >
                        {isBobi || isModi ? (
                          <span className="inline-flex items-center gap-1">
                            <span>{isModi ? "Modi" : "Bobi"}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${isModi ? "bg-violet-500/10 text-violet-600" : "bg-primary/10 text-primary"}`}>{isModi ? "MODERATÖR" : "BOT"}</span>
                          </span>
                        ) : <UserNameWithDecorations user={msg.user} />}
                      </button>
                    )}

                    {/* Text bubble */}
                    {(msg.type === "text" || isBobi || isModi) && (
                      <>
                        <div
                          className={`px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm overflow-hidden ${
                            isMe
                              ? "bg-primary/10 dark:bg-primary/20 text-foreground rounded-3xl rounded-br-md"
                              : isModi
                                ? "bg-violet-500/[0.06] border border-violet-400/30 text-foreground rounded-3xl rounded-bl-md"
                              : isBobi
                                ? "bg-primary/[0.07] border border-primary/30 text-foreground rounded-3xl rounded-bl-md shadow-[0_2px_12px_rgba(99,102,241,0.12)]"
                                : "bg-card border border-border text-foreground rounded-3xl rounded-bl-md"
                          }`}
                          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                        >
                          {(() => {
                            const c = msg.content ?? "";
                            if (c.startsWith("__LOOP_REPLY__:")) {
                              const withoutPrefix = c.slice("__LOOP_REPLY__:".length);
                              const nl = withoutPrefix.indexOf("\n");
                              const header = nl !== -1 ? withoutPrefix.slice(0, nl) : withoutPrefix;
                              const actual = nl !== -1 ? withoutPrefix.slice(nl + 1) : "";
                              const colon = header.indexOf(":");
                              const refName = colon !== -1 ? header.slice(0, colon) : header;
                              const refSnippet = colon !== -1 ? header.slice(colon + 1) : "";
                              return (
                                <>
                                  <div className={`border-l-2 border-primary/60 pl-2 py-0.5 mb-2 rounded-sm overflow-hidden ${isMe ? "bg-primary/10" : "bg-muted/50"}`} style={{ maxWidth: "100%" }}>
                                    <p className="text-[11px] font-bold text-primary leading-none truncate">{refName}</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{refSnippet}</p>
                                  </div>
                                  {renderMessage(actual)}
                                </>
                              );
                            }
                            return renderMessage(c);
                          })()}
                        </div>
                        {/* Like count if any */}
                        {(msg as any).likeCount > 0 && (
                          <div className="flex items-center gap-1 mt-1 ml-1">
                            <span className="text-sm leading-none">{(msg as any).reactionEmoji || doubleTapEmoji}</span>
                            <span className="text-xs text-muted-foreground">{(msg as any).likeCount}</span>
                          </div>
                        )}
                        {/* Timestamp */}
                        <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      </>
                    )}

                    {/* Image */}
                    {(msg.type as string) === "image" && msg.content && (
                      <div className="rounded-2xl overflow-hidden border border-border max-w-[220px] shadow-sm">
                        <img src={msg.content} alt="görsel" className="w-full h-auto object-cover" />
                        <div className="text-[10px] text-muted-foreground px-3 py-1">{formatMsgTime(msg.createdAt)}</div>
                      </div>
                    )}

                    {/* GIF */}
                    {msg.type === "gif" && msg.gifUrl && (
                      <div>
                        <img src={msg.gifUrl} alt="GIF" className="rounded-2xl max-w-[200px] h-auto border border-border shadow-sm" />
                        <span className="text-[10px] text-muted-foreground ml-1">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}

                    {/* Voice */}
                    {msg.type === "voice" && msg.voiceUrl && (
                      <div>
                        <button
                          onClick={() => handlePlayVoice(msg.id, msg.voiceUrl!)}
                          className={`px-4 py-3 rounded-3xl flex items-center gap-3 transition-colors shadow-sm ${
                            isMe
                              ? "bg-primary/10 text-foreground rounded-br-md hover:bg-primary/20"
                              : "bg-card border border-border text-foreground rounded-bl-md hover:bg-muted"
                          }`}
                        >
                          {playingId === msg.id ? (
                            <StopCircle className="w-5 h-5 flex-shrink-0 text-primary" />
                          ) : (
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-primary border-b-[6px] border-b-transparent ml-0.5 flex-shrink-0" />
                          )}
                          <div className="flex gap-0.5 items-center h-4">
                            {Array(14).fill(0).map((_, i) => (
                              <div key={i} className={`w-0.5 rounded-full bg-primary/60 transition-all ${playingId === msg.id ? "animate-pulse" : ""}`}
                                style={{ height: `${20 + Math.sin(i * 1.1) * 60}%` }} />
                            ))}
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{msg.voiceDuration || 0}s</span>
                        </button>
                        <span className="text-[10px] text-muted-foreground ml-1">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}
                    {user && !isMe && !isBobi && !isModi && ["text", "gif", "image", "voice"].includes(String(msg.type)) && (
                      <button
                        type="button"
                        disabled={reportedMessageIds.has(msg.id) || modiPendingAction === msg.id}
                        onClick={() => void reportChatMessage(msg.id)}
                        className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        aria-label="Mesajı Modi’ye bildir"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        {reportedMessageIds.has(msg.id) ? "Bildirildi" : "Bildir"}
                      </button>
                    )}
                  </div>
                  </div>
                </div>
              );
            })
          )}

          {modiPolls.map(poll => {
            const isExpanded = !poll.hasVoted || expandedModiPollIds.has(poll.id);
            if (!isExpanded) return null;
            return (
              <div key={poll.id} className="mt-4 flex items-end gap-2.5" data-modi-poll={poll.id}>
                <div className="flex w-16 shrink-0 flex-col items-center pb-1">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-200/50 bg-slate-950 text-fuchsia-100 shadow-[0_0_16px_rgba(217,70,239,0.4)]">
                    {modiProfileUrl
                      ? <img src={modiProfileUrl} alt="Modi profil fotoğrafı" className="h-full w-full rounded-full object-cover" />
                      : <Bot className="h-5 w-5" />}
                  </div>
                  {modiAssetUrl
                    ? <img src={modiAssetUrl} alt="Modi" className="-mt-1 h-16 w-16 object-contain object-bottom drop-shadow-[0_0_12px_rgba(192,132,252,0.55)]" />
                    : <div className="-mt-1 flex h-16 w-16 items-center justify-center text-fuchsia-200/60"><Bot className="h-10 w-10" /></div>}
                </div>
                <section
                  aria-label="Modi oylama mesajı"
                  className="relative mb-1 min-w-0 max-w-[25rem] flex-1 overflow-hidden rounded-2xl rounded-bl-sm border border-fuchsia-300/35 bg-gradient-to-br from-[#211333]/95 via-[#160f26]/95 to-[#101528]/95 p-3 text-white shadow-[0_0_24px_rgba(168,85,247,0.24),inset_0_0_22px_rgba(217,70,239,0.08)] before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-fuchsia-200/80 before:to-transparent"
                >
                  <div className="relative space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-fuchsia-200/30 bg-fuchsia-300/10 text-fuchsia-100">
                          {modiProfileUrl ? <img src={modiProfileUrl} alt="" className="h-full w-full object-cover" /> : <Bot className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold tracking-wide text-fuchsia-100">Modi</p>
                          <p className="truncate text-[9px] text-fuchsia-50/55">Topluluk moderatörü</p>
                        </div>
                      </div>
                      {poll.hasVoted
                        ? <span className="shrink-0 text-[10px] font-medium text-emerald-200">{isExpanded ? `Oylama · ${Math.max(0, Math.ceil((new Date(poll.endsAt).getTime() - Date.now()) / 1000))} sn` : "Oyun kaydedildi"}</span>
                        : <span className="shrink-0 rounded-full border border-fuchsia-200/20 bg-fuchsia-100/5 px-2 py-1 text-[10px] tabular-nums text-fuchsia-100/80">{Math.max(0, Math.ceil((new Date(poll.endsAt).getTime() - Date.now()) / 1000))} sn kaldı</span>}
                    </div>
                    {poll.isTest ? (
                      <>
                        <p className="text-xs font-semibold leading-snug text-white">@{poll.targetUsername} için test oylaması</p>
                        <p className="text-[10px] leading-snug text-fuchsia-50/70">Bu oylama deneme amaçlıdır; yaptırım uygulanmayacak.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold leading-snug text-white">@{poll.targetUsername} kullanıcısının {selectedChatRoom ? `${selectedChatRoom.name} odasında` : "genel sohbette"} {poll.muteMinutes} dakika susturulmasını onaylıyor musun?</p>
                        <p className="text-[10px] leading-snug text-fuchsia-50/70">{poll.yesCount} evet · {poll.noCount} hayır · En az {poll.pollMinVotes} oy ve evet çoğunluğu gerekir.</p>
                      </>
                    )}
                    {poll.canVote ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 border border-emerald-200/20 bg-emerald-400/15 px-3 text-xs text-emerald-50 hover:bg-emerald-400/25" variant={poll.myVoteYes ? "default" : "outline"} disabled={modiPendingAction === -poll.id} onClick={() => void castModiVote(poll.id, true)}>{poll.hasVoted && poll.myVoteYes ? "Evet · kaydedildi" : "Evet"}</Button>
                        <Button size="sm" className="h-8 border border-rose-200/20 bg-rose-400/10 px-3 text-xs text-rose-50 hover:bg-rose-400/20" variant={poll.hasVoted && poll.myVoteYes === false ? "default" : "outline"} disabled={modiPendingAction === -poll.id} onClick={() => void castModiVote(poll.id, false)}>{poll.hasVoted && poll.myVoteYes === false ? "Hayır · kaydedildi" : "Hayır"}</Button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-fuchsia-50/60">Test oylamasında oy kullanamazsın.</p>
                    )}
                    {poll.hasVoted && <button type="button" className="text-[10px] text-fuchsia-200/70 underline decoration-fuchsia-300/30 underline-offset-2 hover:text-fuchsia-100" onClick={() => setExpandedModiPollIds(current => { const next = new Set(current); next.delete(poll.id); return next; })}>Oylamayı gizle</button>}
                  </div>
                </section>
              </div>
            );
          })}

          {/* Typing indicator — only when someone is actually typing */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 pt-2 pl-4">
              <div className="flex items-center gap-0.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                  />
                ))}
              </div>
              <span className="text-sm text-primary font-medium italic">
                {typingUsers.length === 1
                  ? `${typingUsers[0].displayName} yazıyor...`
                  : `${typingUsers.map(u => u.displayName).join(", ")} yazıyor...`}
              </span>
            </div>
          )}
        </div>

        {/* Reply preview bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center gap-3">
            <div className="w-0.5 h-9 bg-primary rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary truncate leading-tight">{replyTo.displayName}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground p-1 hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* GIF picker */}
        {gifOpen && (
          <GifPicker
            onSelect={(url) => { handleSendGif(url); setGifOpen(false); }}
            onClose={() => setGifOpen(false)}
          />
        )}

        {/* ── Input bar ── */}
        <div
          className="relative z-20 border-t border-border bg-background/85 px-3 py-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-10px_25px_rgba(0,0,0,0.08)]"
          style={{
            marginTop: "-0.35rem",
            marginBottom: isMobile && !shouldRevealComposer ? -composerShift : 0,
            transform: isMobile ? `translateY(${shouldRevealComposer ? 0 : composerShift}px)` : undefined,
            transition: isMobile ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), margin-bottom 220ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        >
          {/* @mention dropdown */}
          {mentionSearch !== null && mentionUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-2xl shadow-lg overflow-hidden z-20">
              {mentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left ${i === mentionIndex ? "bg-accent" : ""}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                >
                  <Avatar data-story-user-id={u.id} className={`w-7 h-7 ${storyUserIds.has(u.id) ? "story-avatar-ring" : ""}`}>
                    <AvatarImage src={u.avatarUrl || ""} />
                    <AvatarFallback className="text-xs">{u.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{u.displayName}</span>
                  <span className="text-xs text-muted-foreground">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
          />

          <div className="flex items-center gap-2">
            {isRecording ? (
              /* ── Kayıt modu ── */
              <>
                {/* İptal */}
                <button
                  onClick={cancelRecording}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Kayıt göstergesi */}
                <div className="flex-1 flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-full px-4 h-11">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                  <span className="text-sm font-semibold text-red-500 tabular-nums min-w-[2.4rem]">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span>
                  {/* Dalga animasyonu */}
                  <div className="flex items-center gap-[3px] flex-1">
                    {[0.5,0.9,0.65,1,0.75,0.55,1,0.8,0.6,0.95,0.7].map((h, i) => (
                      <span key={i} className="rounded-full bg-red-400/70 flex-shrink-0 animate-pulse"
                        style={{ width: 3, height: `${h * 20}px`, animationDelay: `${i * 70}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">Kayıt yapılıyor</span>
                </div>

                {/* Gönder */}
                <Button
                  size="icon"
                  className="rounded-full w-11 h-11 flex-shrink-0 bg-primary hover:bg-primary/90 shadow-md"
                  onClick={stopRecording}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </>
            ) : (
              /* ── Normal mod ── */
              <>
                {/* + button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!chatBanWarning}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* Emoji / GIF */}
                <button
                  onClick={openGifPicker}
                  disabled={!!chatBanWarning}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors flex-shrink-0 ${gifOpen ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    placeholder={`${selectedChatRoom?.name ?? "Genel sohbet"} odasına mesaj yaz...`}
                    value={content}
                    disabled={!!chatBanWarning}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="rounded-full h-11 bg-muted/60 border-transparent focus-visible:ring-1 focus-visible:ring-primary/30 pr-4 pl-5 text-sm"
                  />
                </div>

                {/* Send / Mic */}
                {content.trim() ? (
                  <Button
                    size="icon"
                    className="rounded-full w-11 h-11 flex-shrink-0 bg-primary hover:bg-primary/90 shadow-md"
                    onClick={handleSend}
                    disabled={sendMutation.isPending || !!chatBanWarning}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={!!chatBanWarning}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex-shrink-0 transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {!selectedChatRoom && modiPolls.some(poll => poll.hasVoted && !expandedModiPollIds.has(poll.id)) && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 z-40 flex flex-col gap-2 md:bottom-5 md:left-5">
          {modiPolls.filter(poll => poll.hasVoted && !expandedModiPollIds.has(poll.id)).map(poll => (
            <button
              key={poll.id}
              type="button"
              aria-label="Devam eden Modi oylamasını yeniden aç"
              title="Oylamayı yeniden aç"
              onClick={() => reopenModiPoll(poll.id)}
              className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-fuchsia-200/35 bg-[#171024]/95 text-fuchsia-100 shadow-[0_0_22px_rgba(192,132,252,0.35)] backdrop-blur-md transition hover:scale-105"
            >
              <span className="absolute -inset-1 rounded-full border-2 border-fuchsia-300/80 border-b-transparent border-l-violet-300/35 animate-spin [animation-duration:2.2s]" />
              <span className="absolute -inset-1 rounded-full border border-violet-200/25 shadow-[0_0_14px_rgba(217,70,239,0.45)]" />
              {modiProfileUrl
                ? <img src={modiProfileUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                : modiAssetUrl
                  ? <img src={modiAssetUrl} alt="" className="h-10 w-10 rounded-full object-contain" />
                  : <Bot className="h-7 w-7" />}
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-400 text-[9px] font-bold text-white shadow">1</span>
            </button>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
