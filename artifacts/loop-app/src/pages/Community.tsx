import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  CirclePlus,
  Copy,
  ChevronDown,
  Crown,
  GripVertical,
  Hash,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Settings2,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";

type Permissions = {
  manageCommunity?: boolean;
  manageMembers?: boolean;
  manageRoles?: boolean;
  manageChannels?: boolean;
  manageMessages?: boolean;
  sendMessages?: boolean;
  connectVoice?: boolean;
  inviteMembers?: boolean;
};

type Channel = { id: number; communityId: number; name: string; type: "text" | "voice"; position: number; voiceRoomId: number | null };
type Role = { id: number; communityId: number; name: string; color: string; permissions: Permissions; position: number; isDefault: boolean };
type Member = { userId: number; username: string; displayName: string; avatarUrl: string | null; roleId: number | null; roleName: string | null; roleColor: string | null; joinedAt: string };
type PendingMember = { userId: number; username: string; displayName: string; avatarUrl: string | null; joinedAt: string };
type CommunityData = {
  id: number;
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
  coverImageUrl: string | null;
  accessMode: "public" | "approval";
  inviteCode?: string;
  createdBy: number;
  memberCount: number;
  membershipStatus: "none" | "active" | "pending";
  role?: Role | null;
  permissions: Permissions;
  channels: Channel[];
  roles?: Role[];
  members?: Member[];
  pendingMembers?: PendingMember[];
};
type CommunityMessage = {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

const communityEmojis = ["🌙", "🚀", "🎨", "🎮", "📚", "🎧", "🌿", "✨"];
const communityAccentColors = [
  { color: "#8b5cf6", label: "Menekşe" },
  { color: "#ec4899", label: "Pembe" },
  { color: "#f59e0b", label: "Altın" },
  { color: "#14b8a6", label: "Turkuaz" },
  { color: "#3b82f6", label: "Mavi" },
  { color: "#f97316", label: "Mercan" },
];
const permissionOptions: Array<{ key: keyof Permissions; label: string }> = [
  { key: "sendMessages", label: "Mesaj gönderebilir" },
  { key: "connectVoice", label: "Sesli odalara katılabilir" },
  { key: "inviteMembers", label: "Davet bağlantısı oluşturabilir" },
  { key: "manageMessages", label: "Mesajları yönetebilir" },
  { key: "manageMembers", label: "Üyeleri ve istekleri yönetebilir" },
  { key: "manageChannels", label: "Kanalları yönetebilir" },
  { key: "manageRoles", label: "Rolleri ve unvanları yönetebilir" },
  { key: "manageCommunity", label: "Topluluk ayarlarını yönetebilir" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}

export default function Community() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const inviteCode = useMemo(() => new URLSearchParams(window.location.search).get("invite"), []);
  const returnCommunityId = useMemo(() => new URLSearchParams(window.location.search).get("communityId"), []);
  const ownerId = useMemo(() => new URLSearchParams(window.location.search).get("ownerId"), []);
  const [communities, setCommunities] = useState<CommunityData[]>([]);
  const [communityOrder, setCommunityOrder] = useState<string[]>([]);
  const [communityOrderOwner, setCommunityOrderOwner] = useState<number | null | undefined>(undefined);
  const [community, setCommunity] = useState<CommunityData | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [view, setView] = useState<"home" | "create" | "server">("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEmoji, setCreateEmoji] = useState(communityEmojis[0]);
  const [createAccess, setCreateAccess] = useState<"public" | "approval">("public");
  const [messageDraft, setMessageDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"text" | "voice">("text");
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#8b5cf6");
  const [rolePermissions, setRolePermissions] = useState<Permissions>({ sendMessages: true, connectVoice: true });
  const [communityNameDraft, setCommunityNameDraft] = useState("");
  const [communityDescriptionDraft, setCommunityDescriptionDraft] = useState("");
  const [communityEmojiDraft, setCommunityEmojiDraft] = useState(communityEmojis[0]);
  const [communityAccentDraft, setCommunityAccentDraft] = useState(communityAccentColors[0]!.color);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [collapsedChannelGroups, setCollapsedChannelGroups] = useState<{ text: boolean; voice: boolean }>({ text: false, voice: false });
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(true);
  const [draggingCommunityId, setDraggingCommunityId] = useState<number | null>(null);
  const [draggingChannelId, setDraggingChannelId] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const orderedCommunities = useMemo(() => {
    const orderIndex = new Map(communityOrder.map((id, index) => [Number(id), index]));
    return [...communities].sort((a, b) =>
      (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name, "tr"),
    );
  }, [communities, communityOrder]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    setCommunityOrderOwner(undefined);
    try {
      const saved = localStorage.getItem(`loop-community-order:${ownerId ?? "guest"}`);
      setCommunityOrder(saved ? JSON.parse(saved) as string[] : []);
    } catch (cause) {
      console.error("Topluluk sıralaması yüklenemedi:", cause);
      setCommunityOrder([]);
    }
    setCommunityOrderOwner(ownerId);
  }, [user?.id]);

  useEffect(() => {
    if (communityOrderOwner !== (user?.id ?? null)) return;
    try {
      localStorage.setItem(`loop-community-order:${user?.id ?? "guest"}`, JSON.stringify(communityOrder));
    } catch (cause) {
      console.error("Topluluk sıralaması kaydedilemedi:", cause);
    }
  }, [communityOrder, communityOrderOwner, user?.id]);

  const loadCommunities = useCallback(async () => {
    const items = await api<CommunityData[]>("/api/communities");
    setCommunities(items);
  }, []);

  const openCommunity = useCallback(async (id: number) => {
    setBusy(true);
    setError("");
    try {
      const next = await api<CommunityData>(`/api/communities/${id}`);
      setCommunity(next);
      setCommunityNameDraft(next.name);
      setCommunityDescriptionDraft(next.description);
      setCommunityEmojiDraft(next.emoji);
      setCommunityAccentDraft(next.accentColor || communityAccentColors[0]!.color);
      setSelectedChannelId((current) => next.channels.some((channel) => channel.id === current)
        ? current
        : next.channels.find((channel) => channel.type === "text")?.id ?? next.channels[0]?.id ?? null);
      setView("server");
      setSettingsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topluluk açılamadı.");
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshCommunity = useCallback(async () => {
    if (!community) return;
    const next = await api<CommunityData>(`/api/communities/${community.id}`);
    setCommunity(next);
  }, [community]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const communitiesRequest = ownerId
      ? api<CommunityData[]>(`/api/communities/owner/${encodeURIComponent(ownerId)}`)
      : api<CommunityData[]>("/api/communities");
    void communitiesRequest
      .then((items) => {
        if (cancelled) return;
        setCommunities(items);
        if (ownerId && items.length === 1) void openCommunity(items[0]!.id);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Topluluklar yüklenemedi."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (inviteCode) {
      void api<CommunityData>(`/api/communities/invites/${encodeURIComponent(inviteCode)}`)
        .then((item) => {
          if (cancelled) return;
          if (item.membershipStatus === "active") void openCommunity(item.id);
          else { setCommunity(item); setView("server"); }
        })
        .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Davet bağlantısı açılamadı."); });
    } else if (returnCommunityId && Number.isSafeInteger(Number(returnCommunityId))) {
      void openCommunity(Number(returnCommunityId));
    }
    return () => { cancelled = true; };
  }, [inviteCode, returnCommunityId, ownerId, openCommunity]);

  const selectedChannel = community?.channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const isMember = community?.membershipStatus === "active";
  const canManage = Boolean(community?.permissions.manageCommunity || community?.permissions.manageChannels || community?.permissions.manageRoles || community?.permissions.manageMembers);

  useEffect(() => {
    if (!community || !isMember || !selectedChannel || selectedChannel.type !== "text") {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const loadMessages = async () => {
      try {
        const next = await api<CommunityMessage[]>(`/api/communities/${community.id}/channels/${selectedChannel.id}/messages`);
        if (!cancelled) setMessages(next);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Sohbet yüklenemedi.");
      }
    };
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [community, isMember, selectedChannel]);

  const createCommunity = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || createName.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<CommunityData>("/api/communities", {
        method: "POST",
        body: JSON.stringify({ name: createName, description: createDescription, emoji: createEmoji, accessMode: createAccess }),
      });
      await loadCommunities();
      await openCommunity(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topluluk oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const joinCommunity = async (viaInvite = false) => {
    if (!community || !user || busy) return;
    setBusy(true);
    setError("");
    try {
      if (viaInvite && inviteCode) {
        const joined = await api<CommunityData>(`/api/communities/invites/${encodeURIComponent(inviteCode)}/join`, { method: "POST", body: "{}" });
        await openCommunity(joined.id);
      } else {
        await api(`/api/communities/${community.id}/join`, { method: "POST", body: "{}" });
        await openCommunity(community.id);
      }
      await loadCommunities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topluluğa katılınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!community || !selectedChannel || !messageDraft.trim() || busy) return;
    setBusy(true);
    try {
      const sent = await api<CommunityMessage & { sender?: { username: string; displayName: string; avatarUrl: string | null } }>(
        `/api/communities/${community.id}/channels/${selectedChannel.id}/messages`,
        { method: "POST", body: JSON.stringify({ content: messageDraft }) },
      );
      setMessages((current) => [...current, {
        ...sent,
        username: sent.sender?.username ?? user?.username ?? "",
        displayName: sent.sender?.displayName ?? user?.displayName ?? "",
        avatarUrl: sent.sender?.avatarUrl ?? user?.avatarUrl ?? null,
      }].slice(-100));
      setMessageDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mesaj gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const createChannel = async (event: FormEvent) => {
    event.preventDefault();
    if (!community || channelName.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const channel = await api<Channel>(`/api/communities/${community.id}/channels`, {
        method: "POST",
        body: JSON.stringify({ name: channelName, type: channelType }),
      });
      setChannelName("");
      await refreshCommunity();
      setSelectedChannelId(channel.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kanal oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const createRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!community || roleName.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/communities/${community.id}/roles`, {
        method: "POST",
        body: JSON.stringify({ name: roleName, color: roleColor, permissions: rolePermissions }),
      });
      setRoleName("");
      await refreshCommunity();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rol oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const loadInvite = async () => {
    if (!community) return;
    try {
      const result = await api<{ inviteCode: string }>(`/api/communities/${community.id}/invite`);
      setInviteLink(`${window.location.origin}/community?invite=${encodeURIComponent(result.inviteCode)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Davet bağlantısı alınamadı.");
    }
  };

  const joinVoice = async (channel: Channel) => {
    if (!community || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ roomId: number }>(`/api/communities/${community.id}/voice/${channel.id}/join`, { method: "POST", body: "{}" });
      setSelectedChannelId(channel.id);
      setLocation(`/community/voice?roomId=${result.roomId}&communityId=${community.id}&channelId=${channel.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sesli odaya katılınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (memberId: number, action: "approve" | "reject") => {
    if (!community) return;
    try {
      await api(`/api/communities/${community.id}/requests/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await refreshCommunity();
      await loadCommunities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Katılım isteği güncellenemedi.");
    }
  };

  const deleteChannel = async (channel: Channel) => {
    if (!community || !window.confirm(`“${channel.name}” kanalı silinsin mi?`)) return;
    try {
      await api(`/api/communities/${community.id}/channels/${channel.id}`, { method: "DELETE" });
      setSelectedChannelId((current) => current === channel.id ? null : current);
      await refreshCommunity();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kanal silinemedi.");
    }
  };

  const deleteRole = async (role: Role) => {
    if (!community || !window.confirm(`“${role.name}” rolü silinsin mi? Atanmış üyeler varsayılan Üye rolüne alınır.`)) return;
    try {
      await api(`/api/communities/${community.id}/roles/${role.id}`, { method: "DELETE" });
      await refreshCommunity();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rol silinemedi.");
    }
  };

  const deleteMessage = async (message: CommunityMessage) => {
    if (!community || !selectedChannel) return;
    try {
      await api(`/api/communities/${community.id}/channels/${selectedChannel.id}/messages/${message.id}`, { method: "DELETE" });
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mesaj silinemedi.");
    }
  };

  const changeMemberRole = async (memberId: number, roleId: number) => {
    if (!community) return;
    try {
      await api(`/api/communities/${community.id}/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ roleId }),
      });
      await refreshCommunity();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Üye rolü değiştirilemedi.");
    }
  };

  const changeAccess = async (accessMode: "public" | "approval") => {
    if (!community) return;
    try {
      await api(`/api/communities/${community.id}`, { method: "PATCH", body: JSON.stringify({ accessMode }) });
      await refreshCommunity();
      await loadCommunities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Topluluk ayarı değiştirilemedi.");
    }
  };

  const saveCommunityDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!community) return;
    try {
      await api(`/api/communities/${community.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: communityNameDraft,
          description: communityDescriptionDraft,
          emoji: communityEmojiDraft,
          accentColor: communityAccentDraft,
        }),
      });
      await refreshCommunity();
      await loadCommunities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sunucu bilgileri kaydedilemedi.");
    }
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Bağlantı panoya kopyalanamadı. Bağlantıyı seçip kopyalayabilirsin.");
    }
  };

  const moveCommunity = (targetId: number) => {
    if (draggingCommunityId === null || draggingCommunityId === targetId) return;
    const active = orderedCommunities.filter((item) => item.membershipStatus === "active");
    const from = active.findIndex((item) => item.id === draggingCommunityId);
    const to = active.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...active];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setCommunityOrder(next.map((item) => String(item.id)));
    setDraggingCommunityId(null);
  };

  const moveChannel = async (targetId: number, type: "text" | "voice") => {
    if (!community || draggingChannelId === null || draggingChannelId === targetId) return;
    const channels = [...community.channels].sort((a, b) => a.position - b.position);
    const group = channels.filter((channel) => channel.type === type);
    const from = group.findIndex((channel) => channel.id === draggingChannelId);
    const to = group.findIndex((channel) => channel.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = group.splice(from, 1);
    group.splice(to, 0, moved!);
    let groupIndex = 0;
    const reordered = channels.map((channel) => channel.type === type ? group[groupIndex++]! : channel);
    setCommunity({ ...community, channels: reordered.map((channel, position) => ({ ...channel, position })) });
    setDraggingChannelId(null);
    try {
      await api(`/api/communities/${community.id}/channels/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ channelIds: reordered.map((channel) => channel.id) }),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kanal sırası kaydedilemedi.");
      await refreshCommunity();
    }
  };

  const uploadCover = async (file?: File) => {
    if (!community || !file) return;
    if (!file.type.startsWith("image/") || !/\.(jpe?g|png|webp|gif)$/i.test(file.name) || file.size > 8 * 1024 * 1024) {
      setError("JPG, PNG, WebP veya GIF biçiminde en fazla 8 MB bir görsel seç.");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/communities/${community.id}/cover`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json() as CommunityData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Kapak görseli yüklenemedi.");
      setCommunity(result);
      setCommunities((current) => current.map((item) => item.id === result.id ? { ...item, coverImageUrl: result.coverImageUrl } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kapak görseli yüklenemedi.");
    } finally {
      setBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const renderChannel = (channel: Channel) => {
    const active = selectedChannelId === channel.id;
    const Icon = channel.type === "voice" ? AudioLines : Hash;
    return (
      <div key={channel.id} style={active ? { backgroundColor: `${community?.accentColor || "#8b5cf6"}35` } : undefined} className={`group flex items-center rounded-lg pr-1 transition ${active ? "" : "hover:bg-white/[0.06]"}`}>
        <button
          type="button"
          draggable={Boolean(community?.permissions.manageChannels)}
          onDragStart={() => setDraggingChannelId(channel.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void moveChannel(channel.id, channel.type); }}
          onDragEnd={() => setDraggingChannelId(null)}
          onClick={() => {
            if (channel.type === "voice") void joinVoice(channel);
            else {
              setSelectedChannelId(channel.id);
              if (window.matchMedia("(max-width: 639px)").matches) setChannelSidebarOpen(false);
            }
          }}
          className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm ${active ? "font-bold text-white" : "text-white/60 hover:text-white"}`}
        >
          {community?.permissions.manageChannels && <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/25" />}
          <Icon className={`h-4 w-4 shrink-0 ${channel.type === "voice" ? "text-emerald-300" : ""}`} />
          <span className="min-w-0 flex-1 truncate">{channel.name}</span>
          {channel.type === "voice" && <Radio className="h-3 w-3 shrink-0 text-emerald-400" />}
        </button>
        {community?.permissions.manageChannels && (
          <button type="button" aria-label={`${channel.name} kanalını sil`} title="Kanalı sil" onClick={() => void deleteChannel(channel)} className="rounded p-1.5 text-white/40 opacity-0 transition hover:text-rose-300 group-hover:opacity-100 focus:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <AppLayout hideHeader={view === "server"} hideBottomNav={view === "server"} fullHeight={view === "server"} wide={view === "server"} className={view === "server" ? "bg-[#11131d]" : ""}>
      <div className={view === "server" ? "h-full min-h-0" : "min-h-[calc(100dvh-8rem)] px-3 pb-24 pt-5 sm:px-5"}>
        {view !== "server" && <button
          type="button"
          onClick={() => view === "home" ? setLocation("/chat") : setView("home")}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {view === "home" ? "Sohbete dön" : "Topluluklara dön"}
        </button>}

        {error && (
          <div role="alert" className={`${view === "server" ? "fixed left-1/2 top-3 z-[60] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 shadow-xl" : "mb-4"} flex items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700`}>
            <span>{error}</span><button type="button" aria-label="Uyarıyı kapat" onClick={() => setError("")}><X className="h-4 w-4" /></button>
          </div>
        )}

        {view === "home" && (
          <section className="space-y-5">
            {!ownerId && <div className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#111126] p-6 text-white shadow-[0_24px_80px_rgba(51,32,111,0.22)] sm:p-9">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
              <div className="relative">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-violet-950/30"><Users className="h-7 w-7 text-violet-200" /></div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200/75">LOOP · TOPLULUK SUNUCULARI</p>
                <h1 className="mt-2 max-w-lg text-3xl font-black tracking-tight sm:text-4xl">Kendi alanını kur.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Roller, yazı kanalları ve canlı sesli odalarla topluluğunu birlikte yönet.</p>
                <button type="button" onClick={() => user ? setView("create") : setLocation("/login")} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-950/30 transition hover:-translate-y-0.5 hover:brightness-110">
                  <Plus className="h-5 w-5" /> Topluluk sunucusu oluştur <ArrowRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>}
            <div>
              <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-black">{ownerId ? "Topluluk sunucuları" : "Toplulukların"}</h2><span className="text-xs text-muted-foreground">{communities.filter((item) => item.membershipStatus === "active").length} sunucu</span></div>
              {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Topluluklar yükleniyor...</p> : communities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-bold">{ownerId ? "Görüntülenebilir topluluk bulunamadı" : "Henüz bir topluluk sunucusunda değilsin"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ownerId ? "Bu profilin herkese açık veya katılım isteği kabul eden topluluğu bulunmuyor." : "Yeni sunucunu oluşturabilir veya bir davet bağlantısıyla katılabilirsin."}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {orderedCommunities.map((item) => (
                    <button key={item.id} type="button" onClick={() => void openCommunity(item.id)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-2xl">{item.emoji}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{item.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.membershipStatus === "pending" ? "Katılım isteğin bekliyor" : `${item.memberCount} üye · ${item.channels.length} kanal`}</span></span>
                      {item.membershipStatus === "pending" ? <LockKeyhole className="h-4 w-4 text-amber-500" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "create" && (
          <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
            <div className="border-b border-border bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent px-5 py-6 sm:px-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-500">YENİ BİR SUNUCU</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Topluluğunu tasarla</h1>
              <p className="mt-2 text-sm text-muted-foreground">Kurucu olarak tüm izinlere sahip olursun; rollerini ve kanallarını sonradan değiştirebilirsin.</p>
            </div>
            <form onSubmit={(event) => void createCommunity(event)} className="grid gap-6 p-5 sm:grid-cols-[1fr_0.8fr] sm:p-8">
              <div className="space-y-5">
                <label className="block"><span className="mb-2 block text-sm font-bold">Topluluk adı</span><input value={createName} onChange={(event) => setCreateName(event.target.value.slice(0, 32))} maxLength={32} required minLength={2} placeholder="Örn. Gece Okurları" className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15" /><span className="mt-1 block text-right text-[11px] text-muted-foreground">{createName.length}/32</span></label>
                <label className="block"><span className="mb-2 block text-sm font-bold">Kısa açıklama <span className="font-normal text-muted-foreground">(isteğe bağlı)</span></span><textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value.slice(0, 240))} maxLength={240} rows={3} placeholder="Topluluğunu özel yapan şey ne?" className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15" /></label>
                <div><span className="mb-2 block text-sm font-bold">Sunucu simgesi</span><div className="flex flex-wrap gap-2">{communityEmojis.map((option) => <button key={option} type="button" aria-label={`${option} simgesini seç`} aria-pressed={createEmoji === option} onClick={() => setCreateEmoji(option)} className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${createEmoji === option ? "border-violet-400 bg-violet-500/10 ring-2 ring-violet-500/20" : "border-border bg-background hover:bg-muted"}`}>{option}</button>)}</div></div>
                <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold">Katılım türü</legend>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${createAccess === "public" ? "border-violet-400 bg-violet-500/5" : "border-border"}`}><input type="radio" name="access" checked={createAccess === "public"} onChange={() => setCreateAccess("public")} className="mt-1 accent-violet-600" /><span><span className="block text-sm font-bold">Herkese açık</span><span className="text-xs text-muted-foreground">Herkes doğrudan katılabilir.</span></span></label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${createAccess === "approval" ? "border-violet-400 bg-violet-500/5" : "border-border"}`}><input type="radio" name="access" checked={createAccess === "approval"} onChange={() => setCreateAccess("approval")} className="mt-1 accent-violet-600" /><span><span className="block text-sm font-bold">İstek onayı</span><span className="text-xs text-muted-foreground">Katılım istekleri topluluk yönetiminde görünür; davet bağlantısı kullananlar da yönetici onayı olmadan katılamaz.</span></span></label>
                </fieldset>
                <div className="flex gap-2 pt-1"><button type="button" onClick={() => setView("home")} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold transition hover:bg-muted">Vazgeç</button><button type="submit" disabled={createName.trim().length < 2 || busy} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Oluşturuluyor..." : "Sunucuyu oluştur"} <ArrowRight className="h-4 w-4" /></button></div>
              </div>
              <div className="hidden sm:block"><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">SUNUCU ÖNİZLEMESİ</p><div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111126] p-4 text-white shadow-lg"><div className="flex items-center gap-3 border-b border-white/10 pb-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 text-2xl">{createEmoji}</span><div className="min-w-0"><p className="truncate font-extrabold">{createName.trim() || "Topluluğunun adı"}</p><p className="text-xs text-white/50">Sen · Kurucu</p></div></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-semibold text-white/75"><Hash className="h-4 w-4 text-violet-300" /> genel</div><div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-semibold text-white/75"><AudioLines className="h-4 w-4 text-fuchsia-300" /> sesli-sohbet</div><p className="mt-5 text-xs leading-5 text-white/45">{createDescription.trim() || "Açıklaman burada görünecek."}</p></div></div>
            </form>
          </section>
        )}

        {view === "server" && community && (
          <section className={`flex h-full min-h-0 flex-col overflow-hidden ${isMember ? "bg-[#11131d] text-white" : "mx-auto max-w-3xl rounded-3xl border border-border bg-card shadow-lg"}`}>
            {!isMember && <header className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 px-3 py-3 text-white sm:px-5">
              <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-2xl ${isMember ? "hidden sm:flex" : "flex"}`}>{community.emoji}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-base font-black sm:text-lg">{community.name}</h1>{community.accessMode === "approval" && <span className="rounded-full border border-white/20 bg-black/15 px-2 py-1 text-[10px] font-bold">İstek onaylı</span>}</div><p className="mt-0.5 truncate text-[11px] text-white/55">{community.description || "Topluluk sohbeti, roller ve sesli odalar."} · {community.memberCount} üye</p></div>
                {isMember && <div className="relative flex gap-1"><button type="button" aria-label="Davet bağlantısı oluştur" title="Davet bağlantısı" onClick={() => void loadInvite()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition hover:bg-white/20"><UserPlus className="h-4 w-4" /></button>{canManage && <button type="button" aria-label="Sunucu ayarları" title="Sunucu ayarları" onClick={() => setSettingsOpen((open) => !open)} className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 transition ${settingsOpen ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}><Settings2 className="h-4 w-4" /></button>}</div>}
              </div>
            </header>}

            {!isMember ? (
              <div className="px-5 py-12 text-center sm:px-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><Users className="h-7 w-7" /></div>
                <h2 className="mt-4 text-lg font-black">{community.membershipStatus === "pending" ? "İsteğin yöneticilere iletildi" : "Bu topluluğa katıl"}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{community.membershipStatus === "pending" ? "Onaylandığında kanalları ve sohbeti görebileceksin." : community.accessMode === "approval" ? "Katılım isteğin topluluk yöneticileri tarafından onaylanacak." : "Kanallara, yazılı sohbete ve sesli odalara erişmek için üye ol."}</p>
                {community.membershipStatus === "none" && <button type="button" disabled={!user || busy} onClick={() => void joinCommunity(Boolean(inviteCode))} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-violet-500 disabled:opacity-50">{user ? (busy ? "İşleniyor..." : community.accessMode === "approval" && !inviteCode ? "Katılım isteği gönder" : "Topluluğa katıl") : "Katılmak için giriş yap"}</button>}
              </div>
            ) : (
              <div className={`relative grid min-h-0 flex-1 grid-cols-1 ${channelSidebarOpen ? "sm:grid-cols-[64px_210px_minmax(0,1fr)] lg:grid-cols-[64px_230px_minmax(0,1fr)_220px]" : "sm:grid-cols-[64px_0_minmax(0,1fr)] lg:grid-cols-[64px_0_minmax(0,1fr)_220px]"}`}>
                <aside className="hidden flex-col items-center gap-2 border-r border-white/[0.06] bg-[#0c0d14] py-3 sm:flex">
                  <button type="button" aria-label="Topluluk listesi" title="Topluluk listesi" onClick={() => setView("home")} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-white/70 transition hover:rounded-xl hover:bg-violet-500/25 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
                  <div className="my-1 h-px w-8 bg-white/10" />
                  {orderedCommunities.filter((item) => item.membershipStatus === "active").map((item) => (
                    <button key={item.id} type="button" draggable aria-label={`${item.name} topluluğu, taşımak için sürükle`} title={`${item.name} · taşımak için sürükle`} onDragStart={() => setDraggingCommunityId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveCommunity(item.id); }} onDragEnd={() => setDraggingCommunityId(null)} onClick={() => void openCommunity(item.id)} style={item.id === community.id ? { backgroundImage: `linear-gradient(135deg, ${community.accentColor || "#8b5cf6"}, #d946ef)` } : undefined} className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl text-xl transition hover:rounded-xl ${draggingCommunityId === item.id ? "opacity-40" : ""} ${item.id === community.id ? "rounded-xl p-0.5 shadow-lg shadow-violet-950/30" : "bg-white/[0.07] hover:bg-white/[0.12]"}`}>{item.coverImageUrl ? <img src={item.coverImageUrl} alt="" className="h-full w-full rounded-[inherit] object-cover" /> : item.emoji}</button>
                  ))}
                  <button type="button" aria-label="Yeni topluluk oluştur" title="Yeni topluluk oluştur" onClick={() => setView("create")} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300 transition hover:rounded-xl hover:bg-emerald-500/20"><Plus className="h-5 w-5" /></button>
                </aside>
                {channelSidebarOpen && <button type="button" aria-label="Kanal menüsünü kapat" onClick={() => setChannelSidebarOpen(false)} className="absolute inset-0 z-20 bg-black/55 sm:hidden" />}
                <aside className={`absolute inset-y-0 left-0 z-30 flex w-[min(18rem,85vw)] flex-col overflow-y-auto border-r border-white/[0.06] bg-[#171925] p-3 shadow-2xl transition-transform duration-200 sm:relative sm:inset-auto sm:z-auto sm:h-auto sm:w-auto sm:shadow-none ${channelSidebarOpen ? "translate-x-0" : "-translate-x-full sm:hidden"}`}>
                  <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] p-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 text-xl">
                      {community.coverImageUrl ? <img src={community.coverImageUrl} alt={`${community.name} grup fotoğrafı`} className="h-full w-full object-cover" /> : community.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-white">{community.name}</p>
                      <p className="text-[10px] text-white/45">{community.memberCount} üye · topluluk</p>
                    </div>
                    <button type="button" aria-label="Kanal menüsünü kapat" title="Kanal menüsünü kapat" onClick={() => setChannelSidebarOpen(false)} className="hidden rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white sm:flex"><PanelLeftClose className="h-4 w-4" /></button>
                  </div>
                  <div className="mb-3 space-y-1 sm:hidden">
                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Toplulukların</p>
                    {orderedCommunities.filter((item) => item.membershipStatus === "active").map((item) => (
                      <button key={item.id} type="button" onClick={() => { setChannelSidebarOpen(false); if (item.id !== community.id) void openCommunity(item.id); }} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition ${item.id === community.id ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] text-lg">{item.coverImageUrl ? <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" /> : item.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.name}</span>
                      </button>
                    ))}
                    <button type="button" onClick={() => { setChannelSidebarOpen(false); setView("create"); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/10"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10"><Plus className="h-4 w-4" /></span>Yeni topluluk</button>
                  </div>
                  <div className="group/cover relative mb-4 h-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,#5b3e91,#342a52_48%,#1b3444)]">
                    {community.coverImageUrl && <img src={community.coverImageUrl} alt="Topluluk kapağı" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
                    <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-black text-white drop-shadow">{community.emoji} {community.name}</p><p className="text-[10px] text-white/65">{community.memberCount} üye · sunucu kapağı</p></div>
                      {community.permissions.manageCommunity && <button type="button" title="Kapak görseli yükle" aria-label="Topluluk kapak görseli yükle" disabled={busy} onClick={() => coverInputRef.current?.click()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/30 text-white/80 backdrop-blur transition hover:bg-black/55 hover:text-white disabled:opacity-50"><ImagePlus className="h-4 w-4" /></button>}
                    </div>
                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void uploadCover(event.target.files?.[0])} />
                  </div>
                  <div className="mb-2 flex items-center justify-between px-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Kanallar</p>
                    <div className="flex items-center gap-1">
                      {isMember && <><button type="button" aria-label="Davet bağlantısı oluştur" title="Davet bağlantısı" onClick={() => void loadInvite()} className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white"><UserPlus className="h-4 w-4" /></button>{canManage && <button type="button" aria-label="Sunucu ayarları" title="Sunucu ayarları" onClick={() => setSettingsOpen((open) => !open)} className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white"><Settings2 className="h-4 w-4" /></button>}</>}
                    </div>
                  </div>
                  <div className="mb-4 flex items-center justify-between px-2">
                    <button type="button" aria-expanded={!collapsedChannelGroups.text} onClick={() => setCollapsedChannelGroups((current) => ({ ...current, text: !current.text }))} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/40 hover:text-white/70"><ChevronDown className={`h-3 w-3 transition ${collapsedChannelGroups.text ? "-rotate-90" : ""}`} /> Metin kanalları</button>
                    {community.permissions.manageChannels && <button type="button" aria-label="Yazı kanalı oluştur" onClick={() => { setChannelType("text"); setSettingsOpen(true); }} className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white"><CirclePlus className="h-4 w-4" /></button>}
                  </div>
                  {!collapsedChannelGroups.text && <div className="space-y-1">{community.channels.filter((channel) => channel.type === "text").map(renderChannel)}</div>}
                  <div className="mb-2 mt-6 flex items-center justify-between px-2">
                    <button type="button" aria-expanded={!collapsedChannelGroups.voice} onClick={() => setCollapsedChannelGroups((current) => ({ ...current, voice: !current.voice }))} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/40 hover:text-white/70"><ChevronDown className={`h-3 w-3 transition ${collapsedChannelGroups.voice ? "-rotate-90" : ""}`} /> Sesli odalar</button>
                    {community.permissions.manageChannels && <button type="button" aria-label="Sesli oda oluştur" onClick={() => { setChannelType("voice"); setSettingsOpen(true); }} className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white"><CirclePlus className="h-4 w-4" /></button>}
                  </div>
                  {!collapsedChannelGroups.voice && <div className="space-y-1">{community.channels.filter((channel) => channel.type === "voice").map(renderChannel)}</div>}
                </aside>

                <div className="flex min-h-0 min-w-0 flex-col bg-[#1b1d29] text-white">
                  <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#171925] p-2 sm:px-3">
                    <button type="button" aria-label={channelSidebarOpen ? "Kanal menüsünü kapat" : "Kanal menüsünü aç"} aria-expanded={channelSidebarOpen} title={channelSidebarOpen ? "Kanal menüsünü kapat" : "Kanal menüsünü aç"} onClick={() => setChannelSidebarOpen((open) => !open)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white">
                      {channelSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                    </button>
                    <span className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-base" style={{ backgroundColor: `${community.accentColor || "#8b5cf6"}35` }}>
                        {community.coverImageUrl ? <img src={community.coverImageUrl} alt="" className="h-full w-full object-cover" /> : community.emoji}
                      </span>
                      <span className="truncate text-sm font-bold text-white">{community.name}</span>
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg" style={{ backgroundColor: `${community.accentColor || "#8b5cf6"}35` }}>
                        {community.coverImageUrl ? <img src={community.coverImageUrl} alt="" className="h-full w-full object-cover" /> : community.emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{community.name}</span>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 sm:flex">
                      {isMember && <><button type="button" aria-label="Davet bağlantısı oluştur" title="Davet bağlantısı" onClick={() => void loadInvite()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"><UserPlus className="h-4 w-4" /></button>{canManage && <button type="button" aria-label="Sunucu ayarları" title="Sunucu ayarları" onClick={() => setSettingsOpen((open) => !open)} className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition ${settingsOpen ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}><Settings2 className="h-4 w-4" /></button>}</>}
                    </div>
                  </div>
                  {settingsOpen && canManage ? (
                    <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                      <div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Sunucu yönetimi</h2><p className="mt-1 text-xs text-muted-foreground">Roller, kanallar, katılım ve izinler.</p></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Ayarları kapat" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
                      {community.permissions.manageChannels && <form onSubmit={(event) => void createChannel(event)} className="rounded-2xl border border-border p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><CirclePlus className="h-4 w-4 text-violet-500" /> Kanal oluştur</h3><div className="flex flex-wrap gap-2"><input value={channelName} onChange={(event) => setChannelName(event.target.value.slice(0, 32))} minLength={2} maxLength={32} placeholder="kanal-adı" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" /><select value={channelType} onChange={(event) => setChannelType(event.target.value as "text" | "voice")} className="h-10 rounded-lg border border-border bg-background px-2 text-sm"><option value="text">Yazı</option><option value="voice">Sesli</option></select><button type="submit" disabled={busy || channelName.trim().length < 2} className="rounded-lg bg-violet-600 px-3 text-sm font-bold text-white disabled:opacity-50">Ekle</button></div></form>}
                      {community.permissions.manageRoles && <form onSubmit={(event) => void createRole(event)} className="rounded-2xl border border-border p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Shield className="h-4 w-4 text-amber-500" /> Unvan ve rol oluştur</h3><div className="flex gap-2"><input value={roleName} onChange={(event) => setRoleName(event.target.value.slice(0, 24))} minLength={2} maxLength={24} placeholder="Örn. Moderatör" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" /><input aria-label="Rol rengi" type="color" value={roleColor} onChange={(event) => setRoleColor(event.target.value)} className="h-10 w-12 rounded-lg border border-border bg-background p-1" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissionOptions.map((permission) => <label key={permission.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(rolePermissions[permission.key])} onChange={(event) => setRolePermissions((current) => ({ ...current, [permission.key]: event.target.checked }))} className="accent-violet-600" />{permission.label}</label>)}</div><button type="submit" disabled={busy || roleName.trim().length < 2} className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Rolü oluştur</button></form>}
                      {community.permissions.manageRoles && <div className="rounded-2xl border border-border p-4"><h3 className="mb-3 text-sm font-extrabold">Roller ve unvanlar</h3><div className="space-y-2">{community.roles?.map((role) => <div key={role.id} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{role.name}</span><span className="text-[10px] text-muted-foreground">{role.isDefault ? "Varsayılan" : role.permissions.sendMessages ? "Sohbet açık" : "Yalnızca okuma"}</span>{!role.isDefault && <button type="button" aria-label={`${role.name} rolünü sil`} onClick={() => void deleteRole(role)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}</div></div>}
                      {community.permissions.manageMembers && community.pendingMembers && community.pendingMembers.length > 0 && <div className="rounded-2xl border border-amber-400/35 bg-amber-500/5 p-4"><h3 className="mb-3 text-sm font-extrabold">Bekleyen katılım istekleri ({community.pendingMembers.length})</h3><div className="space-y-2">{community.pendingMembers.map((member) => <div key={member.userId} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{member.displayName} · @{member.username}</span><button type="button" aria-label={`${member.username} isteğini onayla`} onClick={() => void handleRequest(member.userId, "approve")} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-700"><Check className="h-4 w-4" /></button><button type="button" aria-label={`${member.username} isteğini reddet`} onClick={() => void handleRequest(member.userId, "reject")} className="rounded-lg bg-rose-500/10 p-2 text-rose-600"><X className="h-4 w-4" /></button></div>)}</div></div>}
                      {community.permissions.manageMembers && <div className="rounded-2xl border border-border p-4"><h3 className="mb-3 text-sm font-extrabold">Üye rolleri</h3><div className="space-y-2">{community.members?.map((member) => <div key={member.userId} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{member.displayName}</span>{member.userId === community.createdBy ? <span className="text-[10px] font-bold text-amber-600">Kurucu</span> : <select aria-label={`${member.displayName} rolü`} value={member.roleId ?? ""} onChange={(event) => void changeMemberRole(member.userId, Number(event.target.value))} className="max-w-40 rounded-lg border border-border bg-background px-2 py-1.5 text-xs">{community.roles?.filter((role) => !role.permissions.manageCommunity).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</div>)}</div></div>}
                      {community.permissions.manageCommunity && <form onSubmit={(event) => void saveCommunityDetails(event)} className="rounded-2xl border border-border p-4"><h3 className="mb-3 text-sm font-extrabold">Sunucu görünümü ve bilgileri</h3><label className="mb-3 block text-xs font-semibold">Ad<input value={communityNameDraft} onChange={(event) => setCommunityNameDraft(event.target.value.slice(0, 32))} minLength={2} maxLength={32} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="mb-3 block text-xs font-semibold">Açıklama<textarea value={communityDescriptionDraft} onChange={(event) => setCommunityDescriptionDraft(event.target.value.slice(0, 240))} maxLength={240} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label><fieldset className="mb-3"><legend className="mb-2 text-xs font-semibold">Sunucu simgesi</legend><div className="flex flex-wrap gap-2">{communityEmojis.map((emoji) => <button key={emoji} type="button" aria-label={`${emoji} simgesini seç`} aria-pressed={communityEmojiDraft === emoji} onClick={() => setCommunityEmojiDraft(emoji)} className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg ${communityEmojiDraft === emoji ? "border-violet-400 bg-violet-500/10 ring-2 ring-violet-500/20" : "border-border"}`}>{emoji}</button>)}</div></fieldset><fieldset><legend className="mb-2 text-xs font-semibold">Vurgu rengi</legend><div className="flex flex-wrap gap-2">{communityAccentColors.map(({ color, label }) => <button key={color} type="button" aria-label={`${label} vurgu rengini seç`} aria-pressed={communityAccentDraft === color} onClick={() => setCommunityAccentDraft(color)} className={`h-8 w-8 rounded-full border-2 ${communityAccentDraft === color ? "border-foreground ring-2 ring-offset-2 ring-offset-card" : "border-transparent"}`} style={{ backgroundColor: color }} />)}</div></fieldset><button type="submit" className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-bold">Sunucu özelleştirmelerini kaydet</button></form>}
                      {community.permissions.manageCommunity && <div className="rounded-2xl border border-border p-4"><h3 className="mb-3 text-sm font-extrabold">Katılım ayarı</h3><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void changeAccess("public")} className={`rounded-lg border px-3 py-2 text-xs font-bold ${community.accessMode === "public" ? "border-violet-400 bg-violet-500/10 text-violet-700" : "border-border text-muted-foreground"}`}>Herkese açık</button><button type="button" onClick={() => void changeAccess("approval")} className={`rounded-lg border px-3 py-2 text-xs font-bold ${community.accessMode === "approval" ? "border-violet-400 bg-violet-500/10 text-violet-700" : "border-border text-muted-foreground"}`}>İstek onaylı</button><button type="button" onClick={() => void loadInvite()} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Davet bağlantısı</button></div></div>}
                    </div>
                  ) : selectedChannel?.type === "text" ? (
                    <>
                      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#171925] px-4 py-3"><Hash className="h-4 w-4 text-violet-300" /><h2 className="text-sm font-extrabold text-white">#{selectedChannel.name}</h2><span className="ml-auto text-[10px] text-white/40">{community.role?.name ?? "Üye"}</span></div>
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length === 0 ? <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><MessageCircle className="h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-bold">Sohbet burada başlıyor</p><p className="mt-1 text-xs text-muted-foreground">Topluluğa hoş geldin; ilk mesajı sen gönder.</p></div> : messages.map((message) => <article key={message.id} className="group/message flex gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-500/15 text-xs font-black text-violet-700">{message.avatarUrl ? <img src={message.avatarUrl} alt="" className="h-full w-full object-cover" /> : message.displayName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><span className="text-xs font-extrabold">{message.displayName || `@${message.username}`}</span><time className="text-[9px] text-muted-foreground">{new Date(message.createdAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-0.5 break-words text-sm leading-5">{message.content}</p></div>{community.permissions.manageMessages && <button type="button" aria-label="Mesajı sil" onClick={() => void deleteMessage(message)} className="self-center rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 group-hover/message:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}</article>)}</div>
                      {community.permissions.sendMessages ? <form onSubmit={(event) => void sendMessage(event)} className="border-t border-border p-3"><div className="flex gap-2"><input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value.slice(0, 2000))} maxLength={2000} placeholder={`#${selectedChannel.name} kanalına mesaj yaz`} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><button type="submit" disabled={!messageDraft.trim() || busy} aria-label="Mesajı gönder" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button></div></form> : <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">Bu kanalda yalnızca yetkili roller mesaj gönderebilir.</p>}
                    </>
                  ) : selectedChannel?.type === "voice" ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><AudioLines className="h-8 w-8" /></span><h2 className="mt-4 text-lg font-black">{selectedChannel.name}</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Bu, mikrofonla çalışan canlı sesli odadır. Katılınca ses izinlerini onayla.</p><button type="button" disabled={busy} onClick={() => void joinVoice(selectedChannel)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50"><Radio className="h-4 w-4" /> Sesli odaya katıl</button></div>
                  ) : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">Başlamak için soldan bir kanal seç.</div>}
                </div>
                <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-[#171925] p-4 lg:flex">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Topluluk üyeleri</p>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/55">{community.members?.length ?? community.memberCount}</span>
                  </div>
                  <div className="space-y-1">
                    {community.members?.map((member) => (
                      <div key={member.userId} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-white/[0.05]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-500/20 text-xs font-black text-violet-100">
                          {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" /> : member.displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">{member.displayName || `@${member.username}`}</span>
                        {member.userId === community.createdBy
                          ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                          : member.roleName && <span className="max-w-16 truncate text-[9px] font-bold" style={{ color: member.roleColor ?? undefined }}>{member.roleName}</span>}
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </section>
        )}

        {inviteLink && <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-lg rounded-2xl border border-violet-300/30 bg-card p-4 shadow-2xl"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-black">Davet bağlantısı</p><button type="button" aria-label="Davet penceresini kapat" onClick={() => setInviteLink("")}><X className="h-4 w-4" /></button></div><p className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{inviteLink}</p><button type="button" onClick={() => void copyInvite()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Kopyalandı" : "Bağlantıyı kopyala"}</button></div>}
      </div>
    </AppLayout>
  );
}
