import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NormalizedFrame } from "@/components/shared/NormalizedFrame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Ban,
  UserCheck,
  Users,
  Activity,
  Trash2,
  Search,
  ShieldAlert,
  Network,
  Crown,
  Gavel,
  PawPrint,
  Upload,
  Plus,
  Gamepad2,
  GitBranch,
  Vote,
  BookOpen,
  CheckCircle2,
  XCircle,
  Radio,
  Bot,
  Sparkles,
  Play,
  Image as ImageIcon,
  History,
  Maximize2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  bannedAt: string | null;
  lastSeenAt: string | null;
  lastIpAddress: string | null;
  avatarUrl: string | null;
  badge: string | null;
  badgeLabel: string | null;
  avatarFrame: string | null;
  badgeAssetId?: number | null;
  emblemAssetId?: number | null;
  avatarFrameAssetId?: number | null;
  createdAt: string;
}

interface BanRecord {
  id: number;
  user: { id: number; username: string; displayName: string } | null;
  ipAddress: string | null;
  banType?: string | null;
  reason: string | null;
  bannedBy: { id: number; username: string } | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  bannedUsers: number;
  admins: number;
  moderators: number;
  activeNow: number;
}

interface ModerationReport {
  id: number;
  targetType: string;
  targetId: number | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution: string | null;
  createdAt: string;
  reporterId: number | null;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  reportedUserId: number | null;
  reportedUsername: string | null;
  reportedDisplayName: string | null;
  assignedUsername: string | null;
}

interface ModerationWarning {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  reason: string;
  severity: "low" | "medium" | "high";
  source: string;
  issuedBy: string;
  createdAt: string;
  expiresAt: string | null;
}

interface ModiCommandRecord {
  id: number;
  userId: number | null;
  username: string | null;
  displayName: string | null;
  action: string;
  banType: string | null;
  reason: string;
  durationMinutes: number | null;
  issuedBy: string;
  createdAt: string;
}

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);

  const [bans, setBans] = useState<BanRecord[]>([]);
  const [moderationReports, setModerationReports] = useState<ModerationReport[]>([]);
  const [moderationWarnings, setModerationWarnings] = useState<ModerationWarning[]>([]);
  const [modiCommands, setModiCommands] = useState<ModiCommandRecord[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationReportFilter, setModerationReportFilter] = useState("open");
  const [warningHistoryOpen, setWarningHistoryOpen] = useState(false);
  const [warningHistoryPeriod, setWarningHistoryPeriod] = useState("7");
  const [warningHistorySearch, setWarningHistorySearch] = useState("");
  const [warningHistoryLoading, setWarningHistoryLoading] = useState(false);
  const [modiCommandUsername, setModiCommandUsername] = useState("");
  const [modiCommandAction, setModiCommandAction] = useState("warn");
  const [modiCommandBanType, setModiCommandBanType] = useState("user");
  const [modiCommandReason, setModiCommandReason] = useState("");
  const [modiCommandSeverity, setModiCommandSeverity] = useState("medium");
  const [modiCommandDuration, setModiCommandDuration] = useState("10");
  const [modiCommandPermanent, setModiCommandPermanent] = useState(false);
  const [modiCommandSaving, setModiCommandSaving] = useState(false);
  const [banSearch, setBanSearch] = useState("");
  const [search, setSearch] = useState("");
  // Kutucuklara tıklandığında role göre filtreleme yapmak için:
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(
    null,
  );
  const [decorationUserId, setDecorationUserId] = useState("");
  const [decorationBadge, setDecorationBadge] = useState("none");
  const [decorationBadgeLabel, setDecorationBadgeLabel] = useState("");
  const [decorationFrame, setDecorationFrame] = useState("none");
  const [decorationSaving, setDecorationSaving] = useState(false);
  const [decorationAssets, setDecorationAssets] = useState<{ badges: Array<{ id: number; name: string; imageUrl: string; published: boolean }>; frames: Array<{ id: number; name: string; imageUrl: string; published: boolean }>; emblems: Array<{ id: number; name: string; imageUrl: string; published: boolean }> }>({ badges: [], frames: [], emblems: [] });
  const [assetName, setAssetName] = useState("");
  const [assetKind, setAssetKind] = useState<"badge" | "frame" | "emblem">("badge");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [selectedBadgeAsset, setSelectedBadgeAsset] = useState("");
  const [selectedEmblemAsset, setSelectedEmblemAsset] = useState("");
  const [selectedFrameAsset, setSelectedFrameAsset] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const loadDecorationAssets = async () => { const response = await fetch("/api/admin/decoration-assets", { cache: "no-store" }); if (!response.ok) { toast({ title: "Rozet listesi yüklenemedi", variant: "destructive" }); return; } setDecorationAssets(await response.json()); };
  const uploadDecorationAsset = async () => { if (!assetFile || !assetName.trim()) return; const form = new FormData(); form.append("image", assetFile); form.append("name", assetName); form.append("kind", assetKind); const response = await fetch("/api/admin/decoration-assets", { method: "POST", body: form }); if (response.ok) { setAssetName(""); setAssetFile(null); await loadDecorationAssets(); toast({ title: "Asset taslak olarak yüklendi", duration: 1400 }); } else toast({ title: "Asset yüklenemedi", variant: "destructive" }); };
  const toggleDecorationAsset = async (kind: "badge" | "frame" | "emblem", id: number, action: "publish" | "delete") => { const response = await fetch(`/api/admin/decoration-assets/${kind}/${id}${action === "publish" ? "/publish" : ""}`, { method: action === "publish" ? "PATCH" : "DELETE" }); if (!response.ok) { toast({ title: action === "publish" ? "Yayınlama başarısız" : "Silme başarısız", variant: "destructive" }); return; } await loadDecorationAssets(); };
  const updateDecorations = async (userId: number, data: { badge?: string; badgeLabel?: string; avatarFrame?: string; badgeAssetId?: number | null; emblemAssetId?: number | null; avatarFrameAssetId?: number | null }) => {
    const response = await fetch(`/api/admin/users/${userId}/decorations`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (response.ok) { setUsers(current => current.map(item => item.id === userId ? { ...item, ...data, badge: data.badge === "none" ? null : (data.badge ?? item.badge), avatarFrame: data.avatarFrame === "none" ? null : (data.avatarFrame ?? item.avatarFrame) } : item)); toast({ title: "Profil süslemeleri kaydedildi", duration: 1200 }); return true; }
    const error = await response.json().catch(() => null) as { error?: string } | null;
    toast({ title: error?.error || "Profil süslemeleri kaydedilemedi", variant: "destructive" });
    return false;
  };
  const selectDecorationUser = (value: string) => {
    setDecorationUserId(value);
    const selected = users.find(item => String(item.id) === value);
    setDecorationBadge(selected?.badge ?? "none");
    setDecorationBadgeLabel(selected?.badgeLabel ?? "");
    setDecorationFrame(selected?.avatarFrame ?? "none");
    setSelectedBadgeAsset("");
    setSelectedEmblemAsset(selected?.emblemAssetId ? String(selected.emblemAssetId) : "");
    setSelectedFrameAsset("");
    setSelectedBadgeAsset(selected?.badgeAssetId ? String(selected.badgeAssetId) : "");
    setSelectedFrameAsset(selected?.avatarFrameAssetId ? String(selected.avatarFrameAssetId) : "");
  };
  const publishDecoration = async () => {
    if (!decorationUserId) return;
    setDecorationSaving(true);
    await updateDecorations(Number(decorationUserId), { badge: decorationBadge, badgeLabel: decorationBadgeLabel, avatarFrame: decorationFrame, badgeAssetId: selectedBadgeAsset ? Number(selectedBadgeAsset) : null, emblemAssetId: selectedEmblemAsset ? Number(selectedEmblemAsset) : null, avatarFrameAssetId: selectedFrameAsset ? Number(selectedFrameAsset) : null });
    setDecorationSaving(false);
  };
  const uploadUserAvatar = async () => {
    if (!decorationUserId || !avatarFile) return;
    setAvatarSaving(true);
    try {
      const form = new FormData();
      form.append("image", avatarFile);
      const response = await fetch(`/api/admin/users/${decorationUserId}/avatar`, { method: "POST", body: form });
      if (!response.ok) throw new Error();
      const updated = await response.json() as { avatarUrl: string };
      setUsers(current => current.map(item => item.id === Number(decorationUserId) ? { ...item, avatarUrl: updated.avatarUrl } : item));
      setAvatarFile(null);
      toast({ title: "Profil fotoğrafı kaydedildi", duration: 1400 });
    } catch {
      toast({ title: "Profil fotoğrafı kaydedilemedi", variant: "destructive" });
    } finally {
      setAvatarSaving(false);
    }
  };

  const [roleFilter, setRoleFilter] = useState("all");
  const [banFilter, setBanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [brandingLogo, setBrandingLogo] = useState({ logoUrl: "/loop-app-logo.png", originalName: "loop-app-logo.png", mimeType: "image/png", updatedAt: null as string | null });
  const [brandingFile, setBrandingFile] = useState<File | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [watermarkLogo, setWatermarkLogo] = useState({ watermarkUrl: "/loop-app-logo.png", originalName: "loop-app-logo.png", mimeType: "image/png", updatedAt: null as string | null, text: "", size: 1 });
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkSaving, setWatermarkSaving] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const watermarkSizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [banDialogUser, setBanDialogUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banIp, setBanIp] = useState("");
  const [banType, setBanType] = useState("user");
  const [banDurationDays, setBanDurationDays] = useState("0");

  const [ipBanOpen, setIpBanOpen] = useState(false);
  const [ipBanAddress, setIpBanAddress] = useState("");
  const [ipBanReason, setIpBanReason] = useState("");
  const [ipBanType, setIpBanType] = useState("ip");
  const [ipBanDurationDays, setIpBanDurationDays] = useState("0");

  // Wordle kelime yönetimi
  const [wordleWords,    setWordleWords]    = useState<string[]>([]);
  const [wordleInput,    setWordleInput]    = useState("");
  const [wordleAdding,   setWordleAdding]   = useState(false);
  const [wordleDeleting, setWordleDeleting] = useState<string | null>(null);
  const [xoxStatus, setXoxStatus] = useState("published");
  const [xoxSaving, setXoxSaving] = useState(false);
  const [bobi, setBobi] = useState<{ settings: { enabled: boolean; spamWindowSeconds: number; abilities: string }; words: Array<{ id: number; word: string }>; reports: Array<{ id: number; username: string; displayName: string; source: string; message: string; matchedWord?: string; confidence: string; status: string; createdAt: string }> } | null>(null);
  const [bobiWord, setBobiWord] = useState("");
  const [bobiAbilities, setBobiAbilities] = useState("");
  const [bobiReportUserId, setBobiReportUserId] = useState("");
  const [bobiReportMessage, setBobiReportMessage] = useState("");
  const [bobiReportSource, setBobiReportSource] = useState<"chat" | "dm">("chat");
  const [bobiCommand, setBobiCommand] = useState("");
  const [modi, setModi] = useState<{
    settings: { enabled: boolean; reportThreshold: number; pollMinVotes: number; pollDurationSeconds: number; muteMinutes: number; warningLimit: number; spamWindowSeconds: number };
    words: Array<{ id: number; word: string }>;
    polls: Array<{ id: number; targetUsername: string; endsAt: string; voteCount: number; yesCount: number; noCount: number; pollMinVotes: number; muteMinutes: number }>;
  } | null>(null);
  const [modiWord, setModiWord] = useState("");
  const [modiAsset, setModiAsset] = useState<{
    assetUrl: string | null;
    originalName: string | null;
    profileUrl: string | null;
    profileOriginalName: string | null;
  } | null>(null);
  const [modiAssetFile, setModiAssetFile] = useState<File | null>(null);
  const [modiAssetSaving, setModiAssetSaving] = useState(false);
  const modiAssetInputRef = useRef<HTMLInputElement>(null);
  const [modiProfileFile, setModiProfileFile] = useState<File | null>(null);
  const [modiProfileSaving, setModiProfileSaving] = useState(false);
  const modiProfileInputRef = useRef<HTMLInputElement>(null);

  const fetchBobi = async () => {
    const response = await fetch("/api/admin/bobi", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setBobi(data);
    setBobiAbilities(data.settings?.abilities ?? "");
  };
  const fetchModi = async () => {
    const response = await fetch("/api/admin/modi", { cache: "no-store" });
    if (!response.ok) return;
    setModi(await response.json());
  };
  const fetchModiAsset = async () => {
    const response = await fetch("/api/modi/asset", { cache: "no-store" });
    if (!response.ok) return;
    setModiAsset(await response.json());
  };
  const saveModiAsset = async () => {
    if (!modiAssetFile) return;
    setModiAssetSaving(true);
    try {
      const form = new FormData();
      form.append("asset", modiAssetFile);
      const response = await fetch("/api/admin/modi/asset", { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { assetUrl?: string | null; originalName?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Modi görseli yüklenemedi.");
      setModiAsset(current => ({
        assetUrl: data.assetUrl ?? null,
        originalName: data.originalName ?? null,
        profileUrl: current?.profileUrl ?? null,
        profileOriginalName: current?.profileOriginalName ?? null,
      }));
      setModiAssetFile(null);
      if (modiAssetInputRef.current) modiAssetInputRef.current.value = "";
      toast({ title: "Modi oylama görseli kaydedildi" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Modi görseli yüklenemedi", variant: "destructive" });
    } finally {
      setModiAssetSaving(false);
    }
  };
  const saveModiProfile = async () => {
    if (!modiProfileFile) return;
    setModiProfileSaving(true);
    try {
      const form = new FormData();
      form.append("asset", modiProfileFile);
      const response = await fetch("/api/admin/modi/profile", { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as {
        profileUrl?: string | null;
        profileOriginalName?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Modi profil fotoğrafı yüklenemedi.");
      setModiAsset(current => ({
        assetUrl: current?.assetUrl ?? null,
        originalName: current?.originalName ?? null,
        profileUrl: data.profileUrl ?? null,
        profileOriginalName: data.profileOriginalName ?? null,
      }));
      setModiProfileFile(null);
      if (modiProfileInputRef.current) modiProfileInputRef.current.value = "";
      toast({ title: "Modi profil fotoğrafı kaydedildi" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Modi profil fotoğrafı yüklenemedi", variant: "destructive" });
    } finally {
      setModiProfileSaving(false);
    }
  };
  const removeModiProfile = async () => {
    const response = await fetch("/api/admin/modi/profile", { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      toast({ title: data.error || "Modi profil fotoğrafı kaldırılamadı", variant: "destructive" });
      return;
    }
    setModiAsset(current => current
      ? { ...current, profileUrl: null, profileOriginalName: null }
      : { assetUrl: null, originalName: null, profileUrl: null, profileOriginalName: null });
    toast({ title: "Modi profil fotoğrafı kaldırıldı" });
  };
  const removeModiAsset = async () => {
    const response = await fetch("/api/admin/modi/asset", { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      toast({ title: data.error || "Modi görseli kaldırılamadı", variant: "destructive" });
      return;
    }
    setModiAsset(current => ({
      assetUrl: null,
      originalName: null,
      profileUrl: current?.profileUrl ?? null,
      profileOriginalName: current?.profileOriginalName ?? null,
    }));
    toast({ title: "Modi görseli kaldırıldı" });
  };
  const saveModiSettings = async (patch: Record<string, unknown>) => {
    const response = await fetch("/api/admin/modi/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      toast({ title: data.error || "Modi ayarları kaydedilemedi", variant: "destructive" });
      return;
    }
    await fetchModi();
    toast({ title: "Modi ayarları kaydedildi" });
  };
  const addModiWord = async () => {
    if (!modiWord.trim()) return;
    const response = await fetch("/api/admin/modi/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: modiWord }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      toast({ title: data.error || "Yasaklı kelime eklenemedi", variant: "destructive" });
      return;
    }
    setModiWord("");
    await fetchModi();
  };
  const removeModiWord = async (id: number) => {
    const response = await fetch(`/api/admin/modi/words/${id}`, { method: "DELETE" });
    if (response.ok) await fetchModi();
    else toast({ title: "Yasaklı kelime silinemedi", variant: "destructive" });
  };
  const saveBobiSettings = async (patch: Record<string, unknown>) => {
    const response = await fetch("/api/admin/bobi/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (response.ok) { await fetchBobi(); toast({ title: "Bobi ayarları kaydedildi" }); }
  };
  const addBobiWord = async () => {
    if (!bobiWord.trim()) return;
    const response = await fetch("/api/admin/bobi/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: bobiWord }) });
    if (response.ok) { setBobiWord(""); await fetchBobi(); }
  };
  const removeBobiWord = async (id: number) => { if ((await fetch(`/api/admin/bobi/words/${id}`, { method: "DELETE" })).ok) fetchBobi(); };
  const decideBobiReport = async (id: number, decision: "mute" | "dismiss") => { const response = await fetch(`/api/admin/bobi/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }); if (response.ok) fetchBobi(); };
  const submitBobiReport = async () => { const response = await fetch("/api/admin/bobi/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: Number(bobiReportUserId), source: bobiReportSource, message: bobiReportMessage }) }); if (response.ok) { setBobiReportUserId(""); setBobiReportMessage(""); await fetchBobi(); toast({ title: "Bobi raporu admin kararına gönderildi" }); } };
  const runBobiCommand = async () => { const response = await fetch("/api/admin/bobi/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: bobiCommand }) }); const data = await response.json().catch(() => ({})); if (response.ok) { setBobiCommand(""); toast({ title: `Bobi çalıştı: ${data.message}` }); } else toast({ title: data.error || "Bobi görevi çalıştırılamadı", variant: "destructive" }); };

  interface InteractiveStory {
    id: string; title: string; summary: string; eventTitle: string; eventText: string;
    options: Array<{ id: string; label: string; nextStepId?: string | null }>;
    steps?: Array<{ id: string; title: string; text: string; options: Array<{ id: string; label: string; nextStepId?: string | null }> }>;
    votes?: Record<string, number>;
    cover?: string; status: "ongoing" | "completed";
    published: boolean; updatedAt: string;
  }
  const [interactiveStories, setInteractiveStories] = useState<InteractiveStory[]>([]);
  const [interactiveTitle, setInteractiveTitle] = useState("");
  const [interactiveSummary, setInteractiveSummary] = useState("");
  const [interactiveEventTitle, setInteractiveEventTitle] = useState("");
  const [interactiveEventText, setInteractiveEventText] = useState("");
  const [interactiveOptions, setInteractiveOptions] = useState<Array<{ label: string; nextStepId: string | null }>>([{ label: "", nextStepId: null }, { label: "", nextStepId: null }]);
    const [interactiveExtraSteps, setInteractiveExtraSteps] = useState<Array<{ id: string; title: string; text: string; options: Array<{ label: string; nextStepId: string | null }> }>>([]);
    const [interactiveEditingId, setInteractiveEditingId] = useState<string | null>(null);
  const [interactiveCover, setInteractiveCover] = useState("");
  const [interactiveStatus, setInteractiveStatus] = useState<"ongoing" | "completed">("ongoing");
  const [interactiveSaving, setInteractiveSaving] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventTag, setEventTag] = useState("");
  const [eventCover, setEventCover] = useState("");
  const [eventTheme, setEventTheme] = useState<"night" | "ember" | "ocean" | "mint">("night");
  const [eventOptions, setEventOptions] = useState(["", ""]);
  const [eventSaving, setEventSaving] = useState(false);

  const fetchInteractiveStories = async () => {
    const r = await fetch("/api/admin/interactive-stories");
    if (r.ok) setInteractiveStories(await r.json());
  };

  const handleCreateEvent = async () => {
    const options = eventOptions.map(label => label.trim()).filter(Boolean);
    if (!eventTitle.trim()) {
      toast({ title: "Etkinlik başlığı gerekli", variant: "destructive" });
      return;
    }
    setEventSaving(true);
    try {
      const response = await fetch("/api/admin/interactive-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle,
          summary: eventDescription,
          eventTitle: `${eventTitle.trim()} etkinliğine katılır mısın?`,
          eventText: eventDescription || `${eventTitle.trim()} etkinliğine katılımını seç.`,
          eventTag,
          theme: eventTheme,
          cover: eventCover,
          options: options.map(label => ({ label })),
          status: "ongoing",
        }),
      });
      if (!response.ok) throw new Error();
      setEventTitle(""); setEventDescription(""); setEventTag(""); setEventCover(""); setEventTheme("night"); setEventOptions(["", ""]);
      toast({ title: "Etkinlik yayınlandı", duration: 2000 });
      fetchInteractiveStories();
    } catch {
      toast({ title: "Etkinlik yayınlanamadı", variant: "destructive" });
    } finally {
      setEventSaving(false);
    }
  };

  const handleCreateInteractive = async () => {
    if (interactiveOptions.filter(option => option.label.trim()).length < 2) {
      toast({ title: "En az iki seçenek gerekli", variant: "destructive" });
      return;
    }
    const incompleteStep = interactiveExtraSteps.find(step =>
      !step.title.trim() || !step.text.trim() || step.options.filter(option => option.label.trim()).length < 2,
    );
    if (incompleteStep) {
      toast({ title: "Alternatif bölümü tamamla", description: "Her bölümde başlık, metin ve en az iki karar seçeneği olmalı.", variant: "destructive" });
      return;
    }
    setInteractiveSaving(true);
    try {
      const r = await fetch(interactiveEditingId ? `/api/admin/interactive-stories/${interactiveEditingId}` : "/api/admin/interactive-stories", {
        method: interactiveEditingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: interactiveTitle,
          summary: interactiveSummary,
          eventTitle: interactiveEventTitle,
          eventText: interactiveEventText,
          options: interactiveOptions,
          steps: [
            { id: "step-1", title: interactiveEventTitle, text: interactiveEventText, options: interactiveOptions },
            ...interactiveExtraSteps,
          ],
          cover: interactiveCover,
          status: interactiveStatus,
        }),
      });
      if (!r.ok) {
        const error = await r.json().catch(() => ({}));
        toast({ title: "Yayınlanamadı", description: error.error ?? "Alanlar eksik", variant: "destructive" });
        return;
      }
      toast({ title: "✅ Etkileşimli hikâye yayınlandı", duration: 2000 });
      setInteractiveTitle(""); setInteractiveSummary(""); setInteractiveEventTitle(""); setInteractiveEventText("");
      setInteractiveOptions([{ label: "", nextStepId: null }, { label: "", nextStepId: null }]); setInteractiveExtraSteps([]); setInteractiveEditingId(null);
      setInteractiveCover(""); setInteractiveStatus("ongoing");
      fetchInteractiveStories();
    } finally { setInteractiveSaving(false); }
  };

  const handleToggleInteractive = async (id: string) => {
    const r = await fetch(`/api/admin/interactive-stories/${id}/publish`, { method: "PATCH" });
    if (r.ok) fetchInteractiveStories();
  };

  const handleDeleteInteractive = async (id: string) => {
    const r = await fetch(`/api/admin/interactive-stories/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "İçerik silindi", duration: 1500 }); fetchInteractiveStories(); }
  };

  const editInteractive = (story: InteractiveStory) => {
    const steps = story.steps ?? [{ id: "step-1", title: story.eventTitle, text: story.eventText, options: story.options }];
    const first = steps[0];
    setInteractiveEditingId(story.id); setInteractiveTitle(story.title); setInteractiveSummary(story.summary);
    setInteractiveCover(story.cover ?? ""); setInteractiveStatus(story.status ?? "ongoing");
    setInteractiveEventTitle(first?.title ?? story.eventTitle); setInteractiveEventText(first?.text ?? story.eventText);
    setInteractiveOptions((first?.options ?? story.options).map(option => ({ label: option.label, nextStepId: option.nextStepId ?? null })));
    setInteractiveExtraSteps(steps.slice(1).map(step => ({ ...step, options: step.options.map(option => ({ label: option.label, nextStepId: option.nextStepId ?? null })) })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fetchWordleWords = async () => {
    const r = await fetch("/api/admin/wordle-words");
    if (r.ok) setWordleWords(await r.json());
  };

  const fetchXoxStatus = async () => {
    const response = await fetch("/api/admin/games/xox", { cache: "no-store" });
    if (response.ok) setXoxStatus((await response.json()).status ?? "published");
  };

  const saveXoxStatus = async (status: string) => {
    setXoxSaving(true);
    try {
      const response = await fetch("/api/admin/games/xox", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (response.ok) { setXoxStatus(status); toast({ title: "XOX durumu kaydedildi", duration: 1500 }); }
      else toast({ title: "XOX durumu kaydedilemedi", variant: "destructive" });
    } finally { setXoxSaving(false); }
  };

  const handleAddWord = async () => {
    const w = wordleInput.trim().toUpperCase();
    if (w.length !== 5) { toast({ title: "Kelime tam 5 harf olmalı", variant: "destructive" }); return; }
    setWordleAdding(true);
    try {
      const r = await fetch("/api/admin/wordle-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w }),
      });
      if (r.ok) {
        toast({ title: `✅ "${w}" eklendi`, duration: 2000 });
        setWordleInput("");
        fetchWordleWords();
      } else {
        const e = await r.json();
        toast({ title: e.error, variant: "destructive" });
      }
    } finally { setWordleAdding(false); }
  };

  const handleDeleteWord = async (word: string) => {
    setWordleDeleting(word);
    try {
      const r = await fetch(`/api/admin/wordle-words/${encodeURIComponent(word)}`, { method: "DELETE" });
      if (r.ok) { toast({ title: `"${word}" silindi`, duration: 1500 }); fetchWordleWords(); }
    } finally { setWordleDeleting(null); }
  };

  // Yoldaş yönetimi
  interface CompanionRow { id: number; slug: string; name: string; description: string | null; imageUrl: string; published: boolean; }
  const [companions, setCompanions] = useState<CompanionRow[]>([]);
  const [compName, setCompName] = useState("");
  const [compDesc, setCompDesc] = useState("");
  const [compFile, setCompFile] = useState<File | null>(null);
  const [compUploading, setCompUploading] = useState(false);

  type LiveStatus = "enabled" | "coming_soon" | "disabled";
  type LiveTestUser = Pick<AdminUser, "id" | "username" | "displayName">;
  interface LiveAnimation { id: string; name: string; url: string; mimeType: string; coverUrl?: string | null; coinValue?: number; transparencyMode?: "auto" | "none" | "green" | "white"; edgeFade?: "none" | "top-bottom"; published: boolean; createdAt: string; }
  type BattleResultOutcome = "win" | "lose";
  interface BattleResultAnimation { id: string; name: string; outcome: BattleResultOutcome; url: string; mimeType: string; transparencyMode: "auto" | "none" | "green" | "white"; edgeFade: "none" | "top-bottom"; published: boolean; createdAt: string; }
  interface LiveEvent { id: string; title: string; description: string; images: Array<{ id: string; url: string; mimeType: string }>; published: boolean; createdAt: string; }
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("coming_soon");
  const [liveRestrictedMode, setLiveRestrictedMode] = useState(false);
  const [liveAllowedUserIds, setLiveAllowedUserIds] = useState<number[]>([]);
  const [membershipBadgeAssetIds, setMembershipBadgeAssetIds] = useState<Record<"premium_writer" | "blue_verified" | "gold", string>>({
    premium_writer: "",
    blue_verified: "",
    gold: "",
  });
  const [membershipBadgeSaving, setMembershipBadgeSaving] = useState(false);
  const [liveTestUsers, setLiveTestUsers] = useState<LiveTestUser[]>([]);
  const [liveTestUserSearch, setLiveTestUserSearch] = useState("");
  const [liveAccessSaving, setLiveAccessSaving] = useState(false);
  const [liveAnimations, setLiveAnimations] = useState<LiveAnimation[]>([]);
  const [liveCollectionGiftIds, setLiveCollectionGiftIds] = useState<string[]>([]);
  const [liveCollectionTotal, setLiveCollectionTotal] = useState(10);
  const [liveCollectionSaving, setLiveCollectionSaving] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [liveEventTitle, setLiveEventTitle] = useState("");
  const [liveEventDescription, setLiveEventDescription] = useState("");
  const [liveEventImages, setLiveEventImages] = useState<File[]>([]);
  const [liveEventUploading, setLiveEventUploading] = useState(false);
  const [liveAnimationName, setLiveAnimationName] = useState("");
  const [liveAnimationCoinValue, setLiveAnimationCoinValue] = useState("1");
  const [liveAnimationFile, setLiveAnimationFile] = useState<File | null>(null);
  const [liveAnimationTransparency, setLiveAnimationTransparency] = useState<"auto" | "none" | "green" | "white">("auto");
  const [liveAnimationEdgeFade, setLiveAnimationEdgeFade] = useState<"none" | "top-bottom">("top-bottom");
  const [liveAnimationUploading, setLiveAnimationUploading] = useState(false);
  const [liveGiftCoverUploadingId, setLiveGiftCoverUploadingId] = useState<string | null>(null);
  const [battleResultAnimations, setBattleResultAnimations] = useState<BattleResultAnimation[]>([]);
  const [battleResultName, setBattleResultName] = useState("");
  const [battleResultOutcome, setBattleResultOutcome] = useState<BattleResultOutcome>("win");
  const [battleResultFile, setBattleResultFile] = useState<File | null>(null);
  const [battleResultTransparency, setBattleResultTransparency] = useState<"auto" | "none" | "green" | "white">("auto");
  const [battleResultEdgeFade, setBattleResultEdgeFade] = useState<"none" | "top-bottom">("top-bottom");
  const [battleResultUploading, setBattleResultUploading] = useState(false);
  type ArenaAssetRole = "background" | "left-team" | "right-team" | "vs-emblem" | "score-bar" | "overlay";
  interface ArenaAsset { id: string; name: string; role: ArenaAssetRole; url: string; mimeType: string; published: boolean; createdAt: string; }
  const [arenaAssets, setArenaAssets] = useState<ArenaAsset[]>([]);
  const [arenaAssetName, setArenaAssetName] = useState("");
  const [arenaAssetRole, setArenaAssetRole] = useState<ArenaAssetRole>("background");
  const [arenaAssetFile, setArenaAssetFile] = useState<File | null>(null);
  const [arenaAssetUploading, setArenaAssetUploading] = useState(false);
  type ButtonAssetRole = "subscribe" | "guests" | "like" | "gift" | "share" | "comment" | "streak" | "ranking" | "collection" | "coin" | "general";
  interface ButtonAsset { id: string; name: string; role: ButtonAssetRole; url: string; mimeType: string; published: boolean; createdAt: string; }
  const [buttonAssets, setButtonAssets] = useState<ButtonAsset[]>([]);
  const [buttonAssetName, setButtonAssetName] = useState("");
  const [buttonAssetRole, setButtonAssetRole] = useState<ButtonAssetRole>("subscribe");
  const [buttonAssetFile, setButtonAssetFile] = useState<File | null>(null);
  const [buttonAssetUploading, setButtonAssetUploading] = useState(false);

  const fetchLiveAdmin = async () => {
    const [settingsResponse, animationsResponse, eventsResponse, arenaResponse, buttonResponse, battleResultResponse] = await Promise.all([fetch("/api/admin/live/settings"), fetch("/api/admin/live/animations"), fetch("/api/admin/live/events"), fetch("/api/admin/live/arena-assets"), fetch("/api/admin/live/button-assets"), fetch("/api/admin/live/battle-result-animations")]);
    const animations = animationsResponse.ok ? await animationsResponse.json() as LiveAnimation[] : null;
    if (animations) setLiveAnimations(animations);
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json() as {
        status: LiveStatus;
        collectionGiftIds?: string[];
        collectionTotal?: number;
        restrictedMode?: boolean;
        allowedUserIds?: number[];
        membershipBadgeAssetIds?: Partial<Record<"premium_writer" | "blue_verified" | "gold", number>>;
      };
      const configuredGiftIds = Array.isArray(settings.collectionGiftIds) ? settings.collectionGiftIds : [];
      const availableGiftIds = animations?.filter(animation => animation.published).map(animation => animation.id);
      const selectedGiftIds = availableGiftIds
        ? configuredGiftIds.length
          ? configuredGiftIds.filter(id => availableGiftIds.includes(id))
          : availableGiftIds.slice(0, settings.collectionTotal ?? 10)
        : configuredGiftIds;
      setLiveStatus(settings.status);
      setLiveRestrictedMode(settings.restrictedMode === true);
      setLiveAllowedUserIds(Array.isArray(settings.allowedUserIds) ? settings.allowedUserIds : []);
      setMembershipBadgeAssetIds({
        premium_writer: settings.membershipBadgeAssetIds?.premium_writer ? String(settings.membershipBadgeAssetIds.premium_writer) : "",
        blue_verified: settings.membershipBadgeAssetIds?.blue_verified ? String(settings.membershipBadgeAssetIds.blue_verified) : "",
        gold: settings.membershipBadgeAssetIds?.gold ? String(settings.membershipBadgeAssetIds.gold) : "",
      });
      setLiveCollectionGiftIds(selectedGiftIds);
      setLiveCollectionTotal(configuredGiftIds.length ? Math.max(1, selectedGiftIds.length) : selectedGiftIds.length || (Number.isInteger(settings.collectionTotal) ? settings.collectionTotal! : 10));
    }
    if (eventsResponse.ok) setLiveEvents(await eventsResponse.json());
    if (arenaResponse.ok) setArenaAssets(await arenaResponse.json());
    if (buttonResponse.ok) setButtonAssets(await buttonResponse.json());
    if (battleResultResponse.ok) setBattleResultAnimations(await battleResultResponse.json());
  };
  const uploadLiveEvent = async () => {
    if (!liveEventTitle.trim() || liveEventImages.length === 0) return;
    setLiveEventUploading(true);
    try {
      const form = new FormData();
      form.append("title", liveEventTitle.trim());
      form.append("description", liveEventDescription.trim());
      liveEventImages.forEach((image) => form.append("images", image));
      const response = await fetch("/api/admin/live/events", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setLiveEventTitle("");
      setLiveEventDescription("");
      setLiveEventImages([]);
      await fetchLiveAdmin();
      toast({ title: "Canlı yayın etkinliği taslak olarak eklendi" });
    } catch {
      toast({ title: "Etkinlik eklenemedi", variant: "destructive" });
    } finally {
      setLiveEventUploading(false);
    }
  };
  const toggleLiveEvent = async (id: string) => {
    if ((await fetch(`/api/admin/live/events/${id}/publish`, { method: "PATCH" })).ok) await fetchLiveAdmin();
  };
  const deleteLiveEvent = async (id: string) => {
    if (confirm("Bu canlı yayın etkinliği silinsin mi?") && (await fetch(`/api/admin/live/events/${id}`, { method: "DELETE" })).ok) await fetchLiveAdmin();
  };
  const updateLiveStatus = async (status: LiveStatus) => {
    const response = await fetch("/api/admin/live/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) { setLiveStatus(status); toast({ title: "Canlı yayın alanı güncellendi" }); }
    else {
      const data = await response.json().catch(() => ({})) as { error?: string };
      toast({ title: data.error || "Canlı yayın alanı güncellenemedi", variant: "destructive" });
    }
  };
  const saveLiveAccess = async () => {
    setLiveAccessSaving(true);
    try {
      const response = await fetch("/api/admin/live/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restrictedMode: liveRestrictedMode, allowedUserIds: liveAllowedUserIds }),
      });
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        restrictedMode?: boolean;
        allowedUserIds?: number[];
      };
      if (!response.ok) throw new Error(data.error || "Canlı yayın erişimi kaydedilemedi");
      setLiveRestrictedMode(data.restrictedMode === true);
      setLiveAllowedUserIds(Array.isArray(data.allowedUserIds) ? data.allowedUserIds : []);
      toast({ title: "Canlı yayın test erişimi kaydedildi" });
    } catch (error) {
      toast({
        title: "Canlı yayın erişimi kaydedilemedi",
        description: error instanceof Error ? error.message : "Tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLiveAccessSaving(false);
    }
  };
  const saveMembershipBadges = async () => {
    setMembershipBadgeSaving(true);
    try {
      const response = await fetch("/api/admin/live/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipBadgeAssetIds: Object.fromEntries(
            Object.entries(membershipBadgeAssetIds)
              .filter(([, id]) => id)
              .map(([key, id]) => [key, Number(id)]),
          ),
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Üyelik rozetleri kaydedilemedi");
      toast({ title: "Üyelik rozetleri kaydedildi" });
    } catch (error) {
      toast({
        title: "Üyelik rozetleri kaydedilemedi",
        description: error instanceof Error ? error.message : "Tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setMembershipBadgeSaving(false);
    }
  };
  const saveLiveCollection = async () => {
    setLiveCollectionSaving(true);
    try {
      const response = await fetch("/api/admin/live/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionGiftIds: liveCollectionGiftIds, collectionTotal: liveCollectionTotal }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; collectionGiftIds?: string[]; collectionTotal?: number };
      if (!response.ok) throw new Error(data.error || "Hediye vitrini kaydedilemedi");
      setLiveCollectionGiftIds(data.collectionGiftIds ?? []);
      setLiveCollectionTotal(data.collectionTotal ?? liveCollectionTotal);
      toast({ title: "Hediye koleksiyonu vitrini kaydedildi" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Hediye vitrini kaydedilemedi", variant: "destructive" });
    } finally {
      setLiveCollectionSaving(false);
    }
  };
  const uploadLiveAnimation = async () => {
    if (!liveAnimationFile) return;
    setLiveAnimationUploading(true);
    try {
      const form = new FormData(); form.append("file", liveAnimationFile); form.append("name", liveAnimationName.trim() || liveAnimationFile.name); form.append("coinValue", liveAnimationCoinValue); form.append("transparencyMode", liveAnimationTransparency); form.append("edgeFade", liveAnimationEdgeFade);
      const response = await fetch("/api/admin/live/animations", { method: "POST", body: form });
      if (response.ok) { setLiveAnimationFile(null); setLiveAnimationName(""); setLiveAnimationCoinValue("1"); setLiveAnimationTransparency("auto"); setLiveAnimationEdgeFade("top-bottom"); await fetchLiveAdmin(); toast({ title: "Animasyon yüklendi" }); }
      else toast({ title: "Animasyon yüklenemedi", variant: "destructive" });
    } finally { setLiveAnimationUploading(false); }
  };
  const uploadLiveGiftCover = async (animationId: string, file: File) => {
    setLiveGiftCoverUploadingId(animationId);
    try {
      const form = new FormData();
      form.append("cover", file);
      const response = await fetch(`/api/admin/live/animations/${animationId}/cover`, { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { coverUrl?: string; error?: string };
      if (!response.ok || !data.coverUrl) throw new Error(data.error || "Hediye kapağı yüklenemedi");
      setLiveAnimations(current => current.map(animation => animation.id === animationId ? { ...animation, coverUrl: data.coverUrl } : animation));
      toast({ title: "Hediye kapağı kaydedildi" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Hediye kapağı yüklenemedi", variant: "destructive" });
    } finally {
      setLiveGiftCoverUploadingId(null);
    }
  };
  const removeLiveGiftCover = async (animationId: string) => {
    const response = await fetch(`/api/admin/live/animations/${animationId}/cover`, { method: "DELETE" });
    if (!response.ok) {
      toast({ title: "Hediye kapağı kaldırılamadı", variant: "destructive" });
      return;
    }
    setLiveAnimations(current => current.map(animation => animation.id === animationId ? { ...animation, coverUrl: null } : animation));
  };
  const toggleLiveAnimation = async (id: string) => { if ((await fetch(`/api/admin/live/animations/${id}/publish`, { method: "PATCH" })).ok) fetchLiveAdmin(); };
  const updateLiveAnimationCoinValue = async (id: string, coinValue: number) => {
    const response = await fetch(`/api/admin/live/animations/${id}/coin-value`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coinValue }) });
    if (response.ok) await fetchLiveAdmin();
  };
  const updateLiveAnimationTransparency = async (id: string, transparencyMode: "auto" | "none" | "green" | "white") => {
    const response = await fetch(`/api/admin/live/animations/${id}/transparency`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transparencyMode }) });
    if (response.ok) await fetchLiveAdmin();
  };
  const updateLiveAnimationEdgeFade = async (id: string, edgeFade: "none" | "top-bottom") => {
    const response = await fetch(`/api/admin/live/animations/${id}/edge-fade`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edgeFade }) });
    if (response.ok) await fetchLiveAdmin();
  };
  const deleteLiveAnimation = async (id: string) => { if (confirm("Bu animasyon silinsin mi?") && (await fetch(`/api/admin/live/animations/${id}`, { method: "DELETE" })).ok) fetchLiveAdmin(); };
  const uploadBattleResultAnimation = async () => {
    if (!battleResultFile) return;
    setBattleResultUploading(true);
    try {
      const form = new FormData();
      form.append("file", battleResultFile);
      form.append("name", battleResultName.trim() || battleResultFile.name);
      form.append("outcome", battleResultOutcome);
      form.append("transparencyMode", battleResultTransparency);
      form.append("edgeFade", battleResultEdgeFade);
      const response = await fetch("/api/admin/live/battle-result-animations", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setBattleResultFile(null);
      setBattleResultName("");
      await fetchLiveAdmin();
      toast({ title: "Kapışma sonuç animasyonu taslak olarak yüklendi" });
    } catch {
      toast({ title: "Sonuç animasyonu yüklenemedi", variant: "destructive" });
    } finally {
      setBattleResultUploading(false);
    }
  };
  const toggleBattleResultAnimation = async (id: string) => {
    if ((await fetch(`/api/admin/live/battle-result-animations/${id}/publish`, { method: "PATCH" })).ok) await fetchLiveAdmin();
  };
  const deleteBattleResultAnimation = async (id: string) => {
    if (confirm("Bu Kapışma sonuç animasyonu silinsin mi?") && (await fetch(`/api/admin/live/battle-result-animations/${id}`, { method: "DELETE" })).ok) await fetchLiveAdmin();
  };
  const uploadArenaAsset = async () => {
    if (!arenaAssetFile) return;
    setArenaAssetUploading(true);
    try {
      const form = new FormData();
      form.append("file", arenaAssetFile);
      form.append("name", arenaAssetName.trim() || arenaAssetFile.name);
      form.append("role", arenaAssetRole);
      const response = await fetch("/api/admin/live/arena-assets", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setArenaAssetFile(null);
      setArenaAssetName("");
      await fetchLiveAdmin();
      toast({ title: "Arena asset'i taslak olarak yüklendi", duration: 1400 });
    } catch {
      toast({ title: "Arena asset'i yüklenemedi", variant: "destructive" });
    } finally { setArenaAssetUploading(false); }
  };
  const toggleArenaAsset = async (id: string) => { if ((await fetch(`/api/admin/live/arena-assets/${id}/publish`, { method: "PATCH" })).ok) fetchLiveAdmin(); };
  const updateArenaAssetRole = async (id: string, role: ArenaAssetRole) => { if ((await fetch(`/api/admin/live/arena-assets/${id}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })).ok) fetchLiveAdmin(); };
  const deleteArenaAsset = async (id: string) => { if (confirm("Bu arena asset'i silinsin mi?") && (await fetch(`/api/admin/live/arena-assets/${id}`, { method: "DELETE" })).ok) fetchLiveAdmin(); };
  const uploadButtonAsset = async () => {
    if (!buttonAssetFile) return;
    setButtonAssetUploading(true);
    try {
      const form = new FormData();
      form.append("file", buttonAssetFile);
      form.append("name", buttonAssetName.trim() || buttonAssetFile.name);
      form.append("role", buttonAssetRole);
      const response = await fetch("/api/admin/live/button-assets", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setButtonAssetFile(null);
      setButtonAssetName("");
      await fetchLiveAdmin();
      toast({ title: "Canlı yayın buton asset'i taslak olarak yüklendi", duration: 1400 });
    } catch {
      toast({ title: "Buton asset'i yüklenemedi", variant: "destructive" });
    } finally { setButtonAssetUploading(false); }
  };
  const toggleButtonAsset = async (id: string) => { if ((await fetch(`/api/admin/live/button-assets/${id}/publish`, { method: "PATCH" })).ok) fetchLiveAdmin(); };
  const updateButtonAssetRole = async (id: string, role: ButtonAssetRole) => { if ((await fetch(`/api/admin/live/button-assets/${id}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })).ok) fetchLiveAdmin(); };
  const deleteButtonAsset = async (id: string) => { if (confirm("Bu buton asset'i silinsin mi?") && (await fetch(`/api/admin/live/button-assets/${id}`, { method: "DELETE" })).ok) fetchLiveAdmin(); };

  const fetchCompanions = async () => {
    const r = await fetch("/api/companions");
    if (r.ok) setCompanions(await r.json());
  };

  const handleUploadCompanion = async () => {
    if (!compFile || !compName.trim()) return;
    setCompUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", compName.trim());
      fd.append("description", compDesc.trim());
      fd.append("image", compFile);
      const r = await fetch("/api/admin/companions", { method: "POST", body: fd });
      if (r.ok) {
        toast({ title: "✅ Yoldaş eklendi!", duration: 2000 });
        setCompName(""); setCompDesc(""); setCompFile(null);
        fetchCompanions();
      } else {
        const e = await r.json().catch(() => ({}));
        toast({ title: "Hata", description: e.error || "Yoldaş dosyası yüklenemedi", variant: "destructive" });
      }
    } finally { setCompUploading(false); }
  };

  const handleDeleteCompanion = async (id: number) => {
    if (!confirm("Bu yoldaşı silmek istediğine emin misin?")) return;
    const r = await fetch(`/api/admin/companions/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Silindi", duration: 1500 }); fetchCompanions(); }
  };

  const handleTogglePublish = async (id: number, currentlyPublished: boolean) => {
    const r = await fetch(`/api/admin/companions/${id}/publish`, { method: "PATCH" });
    if (r.ok) {
      toast({ title: currentlyPublished ? "⬇️ Taslağa alındı" : "✅ Yayınlandı", duration: 1800 });
      fetchCompanions();
    } else {
      const e = await r.json().catch(() => ({}));
      toast({ title: "Hata", description: e.error ?? "Bilinmeyen hata", variant: "destructive" });
    }
  };

  // Kurucu ve Admin Yetkisine Sahip E-postalar Listesi
  const adminEmails = [
    "copoglumihammetyasin@gmail.com",
    "copogluhakki@gmail.com",
    "tabiiisanane@gmail.com",
  ];
  const adminUsernames = ["mami", "mami denemee"];
  console.log("Giriş yapan kullanıcının verisi:", user);
  const userEmail = (user as (typeof user & { email?: string | null }) | null)?.email;

  // Kullanıcının e-postası listede varsa veya rolü zaten adminse yetkiyi veriyoruz
  const isAdmin = !!(
    user &&
    (user.role === "admin" ||
      adminEmails.includes(userEmail?.toLowerCase() ?? "") ||
      adminUsernames.includes(user.username?.toLowerCase() ?? ""))
  );

  const isMod =
    isAdmin ||
    !!(
      user?.role === "moderator"
    );

  useEffect(() => {
    if (!isMod) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ banned: "false" });
      if (liveTestUserSearch.trim()) params.set("q", liveTestUserSearch.trim());
      void fetch(`/api/admin/users?${params}`, { cache: "no-store" })
        .then(async response => {
          if (!response.ok) throw new Error("Kullanıcılar yüklenemedi");
          return await response.json() as AdminUser[];
        })
        .then(result => {
          if (!cancelled) {
            setLiveTestUsers(result.map(({ id, username, displayName }) => ({ id, username, displayName })));
          }
        })
        .catch(error => {
          if (!cancelled) {
            console.error("Canlı yayın test kullanıcıları yüklenemedi:", error);
            toast({ title: "Test kullanıcıları yüklenemedi", variant: "destructive" });
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMod, liveTestUserSearch]);

  useEffect(() => {
    void loadDecorationAssets();
  }, []);

  useEffect(() => {
    // Kullanıcı yüklendiğinde fetch işlemini tetikle
    if (user) {
      fetchAll();
    }
  }, [user]); // user değiştiğinde tetiklenir

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, bansRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/bans"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (bansRes.ok) setBans(await bansRes.json());
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModeration = async () => {
    setModerationLoading(true);
    try {
      const [reportsResponse, warningsResponse, commandsResponse] = await Promise.all([
        fetch("/api/admin/reports", { cache: "no-store" }),
        fetch("/api/admin/warnings?days=0", { cache: "no-store" }),
        fetch("/api/admin/modi/commands", { cache: "no-store" }),
      ]);
      if (!reportsResponse.ok || !warningsResponse.ok || !commandsResponse.ok) {
        throw new Error("Moderasyon kayıtları yüklenemedi.");
      }
      const [reports, warnings, commands] = await Promise.all([
        reportsResponse.json(),
        warningsResponse.json(),
        commandsResponse.json(),
      ]);
      setModerationReports(Array.isArray(reports) ? reports : []);
      setModerationWarnings(Array.isArray(warnings) ? warnings : []);
      setModiCommands(Array.isArray(commands) ? commands : []);
    } catch (error) {
      toast({
        title: "Moderasyon kayıtları yüklenemedi",
        description: error instanceof Error ? error.message : "Bağlantıyı kontrol edip tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setModerationLoading(false);
    }
  };

  useEffect(() => {
    if (!warningHistoryOpen) return;
    let cancelled = false;
    const loadWarningHistory = async () => {
      setWarningHistoryLoading(true);
      try {
        const response = await fetch(`/api/admin/warnings?days=${encodeURIComponent(warningHistoryPeriod)}`, { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Uyarı kayıtları yüklenemedi.");
        if (!cancelled) setModerationWarnings(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) toast({
          title: "Uyarı kayıtları yüklenemedi",
          description: error instanceof Error ? error.message : "Bağlantıyı kontrol edip tekrar deneyin.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setWarningHistoryLoading(false);
      }
    };
    void loadWarningHistory();
    return () => { cancelled = true; };
  }, [warningHistoryOpen, warningHistoryPeriod]);

  useEffect(() => {
    if (isMod) { fetchAll(); fetchModeration(); fetchCompanions(); fetchWordleWords(); fetchXoxStatus(); fetchInteractiveStories(); fetchLiveAdmin(); fetchBranding(); fetchBobi(); fetchModi(); fetchModiAsset(); }
  }, [isMod]);

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (banFilter !== "all")
      params.set("banned", banFilter === "banned" ? "true" : "false");
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) setUsers(await res.json());
  };

  const fetchBranding = async () => {
    const [logoResponse, watermarkResponse] = await Promise.all([
      fetch("/api/admin/branding/logo", { cache: "no-store" }),
      fetch("/api/admin/branding/watermark", { cache: "no-store" }),
    ]);
    if (logoResponse.ok) setBrandingLogo(await logoResponse.json());
    if (watermarkResponse.ok) {
      const data = await watermarkResponse.json();
      setWatermarkLogo(data);
      setWatermarkText(data.text ?? "");
    }
  };

  const uploadBrandingLogo = async () => {
    if (!brandingFile) return;
    setBrandingSaving(true);
    try {
      const form = new FormData();
      form.append("logo", brandingFile);
      const response = await fetch("/api/admin/branding/logo", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      setBrandingLogo(await response.json());
      setBrandingFile(null);
      toast({ title: "Logo güncellendi", description: "Yeni logo marka alanlarında kullanılacak." });
    } catch {
      toast({ title: "Logo güncellenemedi", description: "PNG, JPG, WEBP, GIF veya SVG görseli seçin.", variant: "destructive" });
    } finally {
      setBrandingSaving(false);
    }
  };

  const resetBrandingLogo = async () => {
    setBrandingSaving(true);
    try {
      const response = await fetch("/api/admin/branding/logo", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setBrandingLogo(await response.json());
      setBrandingFile(null);
      toast({ title: "Varsayılan logo geri yüklendi" });
    } catch {
      toast({ title: "Logo sıfırlanamadı", variant: "destructive" });
    } finally {
      setBrandingSaving(false);
    }
  };

  const uploadWatermarkLogo = async () => {
    if (!watermarkFile) return;
    setWatermarkSaving(true);
    try {
      const form = new FormData();
      form.append("watermark", watermarkFile);
      const response = await fetch("/api/admin/branding/watermark", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Watermark yüklenemedi");
      setWatermarkLogo(data);
      setWatermarkFile(null);
      toast({ title: "Loops watermark güncellendi", description: "Yeni filigran Loop videolarının hikaye paylaşımlarında kullanılacak." });
    } catch (error) {
      toast({ title: "Watermark güncellenemedi", description: error instanceof Error ? error.message : "PNG, JPG, WEBP, GIF veya SVG görseli seçin.", variant: "destructive" });
    } finally {
      setWatermarkSaving(false);
    }
  };

  const queueWatermarkSizeSave = (size: number) => {
    if (watermarkSizeTimer.current) clearTimeout(watermarkSizeTimer.current);
    watermarkSizeTimer.current = setTimeout(async () => {
      setWatermarkSaving(true);
      try {
        const response = await fetch("/api/admin/branding/watermark", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: watermarkText.trim(), size }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Watermark boyutu kaydedilemedi");
        setWatermarkLogo(data);
      } catch (error) {
        toast({ title: "Watermark boyutu kaydedilemedi", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      } finally {
        setWatermarkSaving(false);
      }
    }, 250);
  };

  const saveWatermarkText = async () => {
    setWatermarkSaving(true);
    try {
      const response = await fetch("/api/admin/branding/watermark", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: watermarkText.trim(), size: Number(watermarkLogo.size ?? 1) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Watermark yazısı kaydedilemedi");
      setWatermarkLogo(data);
      setWatermarkText(data.text ?? watermarkText.trim());
      toast({ title: "Watermark yazısı güncellendi" });
    } catch (error) {
      toast({ title: "Watermark yazısı kaydedilemedi", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setWatermarkSaving(false);
    }
  };

  const resetWatermarkLogo = async () => {
    setWatermarkSaving(true);
    try {
      const response = await fetch("/api/admin/branding/watermark", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setWatermarkLogo(await response.json());
      setWatermarkFile(null);
      setWatermarkText("");
      toast({ title: "Varsayılan Loops watermark geri yüklendi" });
    } catch {
      toast({ title: "Watermark sıfırlanamadı", variant: "destructive" });
    } finally {
      setWatermarkSaving(false);
    }
  };

  const handleBan = async () => {
    if (!banDialogUser) return;
    if (banDialogUser.role === "admin") {
      toast({
        title: "🛡️ Erişim Engellendi",
        description: "Bir moderatör, Admin üzerinde işlem yapamaz!",
        variant: "destructive",
      });
      return;
    }

    const res = await fetch(`/api/admin/users/${banDialogUser.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: banReason,
        ipAddress: banIp || undefined,
        banType,
        durationDays: Number(banDurationDays),
      }),
    });
    if (res.ok) {
      toast({ title: `${banDialogUser.username} yasaklandı` });
      setBanDialogUser(null);
      setBanReason("");
      setBanIp("");
      setBanType("user");
      setBanDurationDays("0");
      fetchAll();
    } else {
      const err = await res.json();
      toast({ title: "Hata", description: err.error, variant: "destructive" });
    }
  };

  const executeModiCommand = async () => {
    if (!modiCommandUsername.trim()) {
      toast({ title: "Kullanıcı adı gerekli", variant: "destructive" });
      return;
    }
    const removesRestriction = modiCommandAction.startsWith("un");
    const isWarning = modiCommandAction === "warn";
    if (!removesRestriction && !modiCommandReason.trim()) {
      toast({ title: "İşlem gerekçesi gerekli", variant: "destructive" });
      return;
    }
    const durationMinutes = Number(modiCommandDuration);
    const permanent = ["block_dm", "block_account"].includes(modiCommandAction) && modiCommandPermanent;
    if (permanent && !window.confirm(`@${modiCommandUsername.replace(/^@/, "")} için süresiz yaptırım uygulanacak. Devam edilsin mi?`)) return;
    setModiCommandSaving(true);
    try {
      const response = await fetch("/api/admin/modi/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: modiCommandUsername,
          action: modiCommandAction,
          reason: modiCommandReason,
          severity: modiCommandSeverity,
          durationMinutes: permanent || isWarning || removesRestriction ? 0 : durationMinutes,
          permanent,
          banType: modiCommandBanType,
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; username?: string; action?: string };
      if (!response.ok) throw new Error(data.error || "Modi komutu uygulanamadı.");
      const actionLabel: Record<string, string> = {
        warn: "uyarı gönderdi",
        mute_chat: "genel sohbetten susturdu",
        block_dm: "DM erişimini engelledi",
        block_account: `hesabı engelledi (${modiCommandBanType})`,
        unmute_chat: "sohbet susturmasını kaldırdı",
        unblock_dm: "DM engelini kaldırdı",
        unblock_account: "hesap engelini kaldırdı",
      };
      toast({ title: `Modi @${data.username} için işlem yaptı`, description: actionLabel[data.action ?? ""] ?? "İşlem kaydedildi" });
      setModiCommandReason("");
      setModiCommandPermanent(false);
      await Promise.all([fetchModeration(), fetchAll()]);
    } catch (error) {
      toast({
        title: "Modi komutu başarısız",
        description: error instanceof Error ? error.message : "İşlem kaydedilemedi.",
        variant: "destructive",
      });
    } finally {
      setModiCommandSaving(false);
    }
  };

  const updateModerationReport = async (reportId: number, status: ModerationReport["status"]) => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: status === "resolved" ? "Moderasyon merkezi üzerinden incelendi." : "" }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Rapor güncellenemedi.");
      await fetchModeration();
      toast({ title: status === "dismissed" ? "Rapor kapatıldı" : status === "resolved" ? "İnceleme tamamlandı" : "Rapor incelemeye alındı" });
    } catch (error) {
      toast({
        title: "Rapor güncellenemedi",
        description: error instanceof Error ? error.message : "Bağlantıyı kontrol edin.",
        variant: "destructive",
      });
    }
  };

  const useReportAsModerationTarget = (report: ModerationReport, action: string) => {
    if (!report.reportedUsername) {
      toast({ title: "Rapor kullanıcıya bağlı değil", description: "Bu rapordan doğrudan kullanıcı yaptırımı verilemiyor.", variant: "destructive" });
      return;
    }
    setModiCommandUsername(report.reportedUsername);
    setModiCommandAction(action);
    setModiCommandReason(`${report.reason}${report.details ? `: ${report.details}` : ""}`);
    setModiCommandSeverity("medium");
    document.getElementById("modi-command-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleUnban = async (userId: number, username: string) => {
    const res = await fetch(`/api/admin/users/${userId}/unban`, {
      method: "POST",
    });
    if (res.ok) {
      toast({ title: `${username} yasağı kaldırıldı` });
      fetchAll();
    }
  };

  const handleChangeRole = async (userId: number, role: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Hata", description: err.error ?? "Rol değiştirilemedi", variant: "destructive" });
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      toast({ title: "Rol güncellendi", description: `Kullanıcı rolü '${role}' yapıldı.` });
    } catch {
      toast({ title: "Bağlantı hatası", variant: "destructive" });
    }
  };

  const handleIpBan = async () => {
    const res = await fetch("/api/admin/ip-ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress: ipBanAddress, reason: ipBanReason, banType: ipBanType, durationDays: Number(ipBanDurationDays) }),
    });
    if (res.ok) {
      toast({ title: `${ipBanAddress} IP'si yasaklandı` });
      setIpBanOpen(false);
      setIpBanAddress("");
      setIpBanReason("");
      setIpBanType("ip");
      setIpBanDurationDays("0");
      fetchAll();
    }
  };

  const handleDeleteBan = async (banId: number) => {
    const res = await fetch(`/api/admin/bans/${banId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Yasak kaldırıldı" });
      fetchAll();
    }
  };

  const roleColor = (role: string) => {
    if (role === "admin")
      return "bg-destructive/10 text-destructive border-destructive/20";
    if (role === "moderator")
      return "bg-blue-500/10 text-blue-600 border-blue-300";
    if (role === "brand")
      return "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-300";
    return "bg-secondary text-secondary-foreground border-border";
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "moderator") return "Moderatör";
    if (role === "brand") return "Marka";
    return "Kullanıcı";
  };

  const banRemaining = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return "Süresiz";
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return "Süresi doldu";
    const minutes = Math.ceil(remaining / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return `Kalan: ${days > 0 ? `${days} gün ` : ""}${hours > 0 ? `${hours} saat ` : ""}${mins > 0 || (days === 0 && hours === 0) ? `${mins} dakika` : ""}`.trim();
  };
  const banLabel = (banType: string | null | undefined) => banType === "dm" ? "DM yasağını kaldır" : banType === "chat" ? "Sohbet yasağını kaldır" : banType === "ip" ? "IP yasağını kaldır" : banType === "user_ip" ? "Kullanıcı + IP yasağını kaldır" : banType === "app" ? "Uygulama yasağını kaldır" : "Yasağı kaldır";
  const isProtectedAccount = (item: AdminUser) => item.role === "admin" || item.role === "moderator" || ["copoglumihammetyasin@gmail.com", "copogluhakki@gmail.com", "tabiiisanane@gmail.com"].includes(item.email.toLowerCase()) || ["mami", "mami denemee"].includes(item.username.toLowerCase());

  const bannedUsers = users.filter(item => item.isBanned);
  const normalizedBanSearch = banSearch.trim().toLowerCase();
  const visibleBannedUsers = bannedUsers.filter(item =>
    !normalizedBanSearch || [item.displayName, item.username, item.lastIpAddress, item.banReason]
      .some(value => value?.toLowerCase().includes(normalizedBanSearch)),
  );
  const visibleBans = bans.filter(item =>
    !normalizedBanSearch || [item.user?.displayName, item.user?.username, item.ipAddress, item.reason, item.banType]
      .some(value => value?.toLowerCase().includes(normalizedBanSearch)),
  );

  // if (!isMod) return null;

  return (
    <AppLayout>
      <div className="min-w-0 max-w-3xl mx-auto space-y-6 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Admin Paneli</h1>
          {isAdmin && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 ml-auto">
              Admin
            </Badge>
          )}
          {!isAdmin && (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-300 ml-auto">
              Moderatör
            </Badge>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: "Toplam Üye",
                value: stats.totalUsers,
                icon: Users,
                color: "text-primary",
              },
              {
                label: "Aktif Şimdi",
                value: stats.activeNow,
                icon: Activity,
                color: "text-green-500",
              },
              {
                label: "Yasaklı",
                value: stats.bannedUsers,
                icon: Ban,
                color: "text-destructive",
              },
              {
                label: "Moderatör",
                value: stats.moderators,
                icon: ShieldAlert,
                color: "text-blue-500",
              },
              {
                label: "Admin",
                value: stats.admins,
                icon: Crown,
                color: "text-yellow-500",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1"
              >
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="users">
          <div className="w-full overflow-x-auto rounded-lg">
            <TabsList className="flex h-auto min-w-max justify-start gap-1 p-1">
              <TabsTrigger value="moderation" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Gavel className="h-3.5 w-3.5" />Moderasyon
                {moderationReports.filter(report => report.status === "open").length > 0 && (
                  <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground">
                    {moderationReports.filter(report => report.status === "open").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="shrink-0 whitespace-nowrap">Kullanıcılar</TabsTrigger>
              <TabsTrigger value="bans" className="shrink-0 whitespace-nowrap">Yasaklar</TabsTrigger>
              <TabsTrigger value="companions" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <PawPrint className="w-3.5 h-3.5" />Yoldaş
              </TabsTrigger>
              <TabsTrigger value="wordle" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Gamepad2 className="w-3.5 h-3.5" />Wordle
              </TabsTrigger>
              <TabsTrigger value="xox" className="flex shrink-0 items-center gap-1 whitespace-nowrap"><Gamepad2 className="w-3.5 h-3.5" />XOX</TabsTrigger>
              <TabsTrigger value="interactive" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <GitBranch className="w-3.5 h-3.5" />Akış
              </TabsTrigger>
              <TabsTrigger value="events" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Vote className="w-3.5 h-3.5" />Etkinlikler
              </TabsTrigger>
              <TabsTrigger value="decorations" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Badge className="h-3.5 px-1 text-[9px]">✓</Badge>Süslemeler
              </TabsTrigger>
              <TabsTrigger value="branding" className="flex shrink-0 items-center gap-1 whitespace-nowrap"><ImageIcon className="w-3.5 h-3.5" />Logo</TabsTrigger>
              <TabsTrigger value="live" className="flex shrink-0 items-center gap-1 whitespace-nowrap"><Radio className="w-3.5 h-3.5" />Canlı
              </TabsTrigger>
              <TabsTrigger value="bobi" className="flex shrink-0 items-center gap-1 whitespace-nowrap"><Bot className="w-3.5 h-3.5" />Bobi</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="moderation" className="mt-4 space-y-4">
            <section className="overflow-hidden rounded-2xl border border-amber-300/25 bg-[linear-gradient(135deg,rgba(180,130,45,0.1),rgba(124,58,237,0.06)_55%,rgba(15,23,42,0.02))] p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-600"><Gavel className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Güvenlik ve topluluk sağlığı</p>
                  <h2 className="mt-1 text-lg font-black">Moderasyon Merkezi</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Şikayetleri incele, uyarı ve erişim kısıtlamalarını yönet. Her Modi işlemi yetki kontrolünden geçer ve kayıt altına alınır.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={moderationLoading} onClick={() => void fetchModeration()}>{moderationLoading ? "Yenileniyor…" : "Yenile"}</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Açık rapor", value: moderationReports.filter(report => report.status === "open").length, tone: "text-amber-600" },
                  { label: "Uyarı kaydı", value: moderationWarnings.length, tone: "text-orange-500" },
                  { label: "Aktif kısıtlama", value: bans.filter(ban => !ban.expiresAt || new Date(ban.expiresAt).getTime() > Date.now()).length, tone: "text-destructive" },
                ].map(metric => <div key={metric.label} className="rounded-xl border border-border/70 bg-card/75 p-3"><p className={`text-xl font-black ${metric.tone}`}>{metric.value}</p><p className="text-[10px] text-muted-foreground">{metric.label}</p></div>)}
              </div>
            </section>

            <section id="modi-command-panel" className="space-y-3 rounded-2xl border border-violet-300/25 bg-violet-500/[0.035] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Bot className="h-4 w-4" /></div>
                <div><h3 className="text-sm font-bold">Modi’ye moderasyon komutu</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Kullanıcıyı ve işlemi açıkça seç. Modi yalnızca aşağıdaki sabit, denetlenebilir işlemleri uygular; gerekçe ve işlem geçmişi saklanır.</p></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={modiCommandUsername} onChange={event => setModiCommandUsername(event.target.value)} placeholder="Kullanıcı adı (örn. @kullanici)" aria-label="Moderasyon hedefi kullanıcı adı" />
                <Select value={modiCommandAction} onValueChange={value => { setModiCommandAction(value); setModiCommandPermanent(false); setModiCommandDuration("10"); }}>
                  <SelectTrigger><SelectValue placeholder="İşlem seç" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warn">Sistem uyarısı gönder</SelectItem>
                    <SelectItem value="mute_chat">Genel sohbetten sustur</SelectItem>
                    <SelectItem value="block_dm">DM erişimini engelle</SelectItem>
                    <SelectItem value="block_account">Hesabı engelle</SelectItem>
                    <SelectItem value="unmute_chat">Sohbet susturmasını kaldır</SelectItem>
                    <SelectItem value="unblock_dm">DM engelini kaldır</SelectItem>
                    <SelectItem value="unblock_account">Hesap engelini kaldır</SelectItem>
                  </SelectContent>
                </Select>
                {modiCommandAction === "warn" ? (
                  <Select value={modiCommandSeverity} onValueChange={setModiCommandSeverity}>
                    <SelectTrigger><SelectValue placeholder="Uyarı önem seviyesi" /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Düşük önem</SelectItem><SelectItem value="medium">Orta önem</SelectItem><SelectItem value="high">Yüksek önem</SelectItem></SelectContent>
                  </Select>
                ) : !modiCommandAction.startsWith("un") ? (
                  <Select value={modiCommandDuration} onValueChange={setModiCommandDuration}>
                    <SelectTrigger><SelectValue placeholder="Yaptırım süresi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 dakika</SelectItem>
                      <SelectItem value="60">1 saat</SelectItem>
                      <SelectItem value="1440">1 gün</SelectItem>
                      <SelectItem value="10080">7 gün</SelectItem>
                      {(modiCommandAction === "block_dm" || (modiCommandAction === "block_account" && !["dm", "chat"].includes(modiCommandBanType))) && <SelectItem value="0">Süresiz (onay gerektirir)</SelectItem>}
                    </SelectContent>
                  </Select>
                ) : <div className="flex items-center rounded-xl border border-border bg-background/60 px-3 text-xs text-muted-foreground">Seçili kısıtlama kaldırılacak</div>}
                {(modiCommandAction === "block_account" || modiCommandAction === "unblock_account") && (
                  <div className="space-y-1">
                    <Select value={modiCommandBanType} onValueChange={value => { setModiCommandBanType(value); setModiCommandPermanent(false); if (["dm", "chat"].includes(value)) setModiCommandDuration("10"); }}>
                      <SelectTrigger><SelectValue placeholder="Yaptırım türü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Hesap</SelectItem>
                        <SelectItem value="user_ip">Hesap + son bilinen IP</SelectItem>
                        <SelectItem value="app">Uygulama geneli</SelectItem>
                        <SelectItem value="spam">Spam</SelectItem>
                        <SelectItem value="abuse">Taciz / kötüye kullanım</SelectItem>
                        <SelectItem value="content">Uygunsuz içerik</SelectItem>
                      </SelectContent>
                    </Select>
                    {modiCommandBanType === "user_ip" && <p className="text-[10px] text-muted-foreground">IP türü kullanıcının son bilinen IP adresini kullanır; adres yoksa işlem reddedilir.</p>}
                  </div>
                )}
                <Textarea value={modiCommandReason} onChange={event => setModiCommandReason(event.target.value)} placeholder={modiCommandAction.startsWith("un") ? "Kaldırma notu (isteğe bağlı)" : "Gerekçe (kullanıcıya gönderilen uyarı metni)"} rows={2} maxLength={500} className="sm:col-span-2" />
              </div>
              {(modiCommandAction === "block_dm" || (modiCommandAction === "block_account" && !["dm", "chat"].includes(modiCommandBanType))) && modiCommandDuration === "0" && (
                <label className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs">
                  <input type="checkbox" checked={modiCommandPermanent} onChange={event => setModiCommandPermanent(event.target.checked)} className="mt-0.5 accent-destructive" />
                  <span><strong>Süresiz yaptırım onayı</strong><span className="mt-0.5 block text-muted-foreground">Bu işlem kullanıcı erişimini süre sınırı olmadan kısıtlar ve ayrıca onay ekranı gösterir.</span></span>
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">Süresiz yaptırım ayrı onay ister. Yönetici ve moderatörlere yaptırım uygulanamaz.</p>
                <Button type="button" disabled={modiCommandSaving || !modiCommandUsername.trim() || (!modiCommandAction.startsWith("un") && !modiCommandReason.trim()) || ((modiCommandAction === "block_dm" || modiCommandAction === "block_account") && modiCommandDuration === "0" && !modiCommandPermanent)} onClick={() => void executeModiCommand()} className="gap-1.5">
                  <Gavel className="h-4 w-4" />{modiCommandSaving ? "Uygulanıyor…" : "Komutu uygula"}
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-bold">Topluluk raporları</h3><p className="text-[11px] text-muted-foreground">Her raporu incelemeye alabilir, sonuçlandırabilir veya kapatabilirsin.</p></div>
                <Select value={moderationReportFilter} onValueChange={setModerationReportFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="reviewing">İnceleniyor</SelectItem><SelectItem value="resolved">Sonuçlandı</SelectItem><SelectItem value="dismissed">Kapatıldı</SelectItem><SelectItem value="all">Tüm raporlar</SelectItem></SelectContent>
                </Select>
              </div>
              {moderationLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Moderasyon kayıtları yükleniyor…</p> :
                moderationReports.filter(report => moderationReportFilter === "all" || report.status === moderationReportFilter).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center"><CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" /><p className="text-sm font-semibold">Bu görünümde rapor yok</p><p className="mt-1 text-xs text-muted-foreground">Yeni topluluk raporları burada görünür.</p></div>
                ) : (
                  <div className="space-y-2">
                    {moderationReports.filter(report => moderationReportFilter === "all" || report.status === moderationReportFilter).map(report => (
                      <article key={report.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={report.status === "open" ? "destructive" : "outline"}>{({ open: "Açık", reviewing: "İnceleniyor", resolved: "Sonuçlandı", dismissed: "Kapatıldı" } as const)[report.status]}</Badge>
                              <span className="text-xs font-bold">{report.reason}</span>
                              <span className="text-[10px] text-muted-foreground">#{report.id} · {report.targetType}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">Bildirilen: {report.reportedDisplayName ?? "Silinmiş kullanıcı"} {report.reportedUsername ? `(@${report.reportedUsername})` : ""} · Bildiren: {report.reporterDisplayName ?? "Bilinmiyor"} {report.reporterUsername ? `(@${report.reporterUsername})` : ""}</p>
                          </div>
                          <time className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(report.createdAt), { locale: tr, addSuffix: true })}</time>
                        </div>
                        {report.details && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/60 p-2 text-xs leading-5">{report.details}</p>}
                        {report.resolution && <p className="mt-2 text-[10px] text-muted-foreground">İşlem notu: {report.resolution}{report.assignedUsername ? ` · ${report.assignedUsername}` : ""}</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {report.status === "open" && <Button type="button" size="sm" variant="outline" onClick={() => void updateModerationReport(report.id, "reviewing")}>İncelemeye al</Button>}
                          {report.status !== "resolved" && report.status !== "dismissed" && <Button type="button" size="sm" onClick={() => void updateModerationReport(report.id, "resolved")}>Sonuçlandır</Button>}
                          {report.status !== "dismissed" && report.status !== "resolved" && <Button type="button" size="sm" variant="ghost" onClick={() => void updateModerationReport(report.id, "dismissed")}>Reddet / kapat</Button>}
                          {report.reportedUsername && <Button type="button" size="sm" variant="destructive" onClick={() => useReportAsModerationTarget(report, "mute_chat")}>Modi ile sustur</Button>}
                          {report.reportedUsername && <Button type="button" size="sm" variant="outline" onClick={() => useReportAsModerationTarget(report, "warn")}>Uyarı hazırla</Button>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">Son kullanıcı uyarıları</h3><p className="text-[11px] text-muted-foreground">Sistem ve moderatör uyarı kayıtları.</p></div><Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setWarningHistoryOpen(true)}><Maximize2 className="h-3.5 w-3.5" />Tüm kayıtları aç</Button></div>
                {moderationWarnings.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Henüz uyarı kaydı yok.</p> : <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                  {moderationWarnings.slice(0, 50).map(warning => <div key={warning.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{warning.displayName} <span className="font-normal text-muted-foreground">@{warning.username}</span></p><Badge variant="outline" className={warning.severity === "high" ? "border-destructive/40 text-destructive" : warning.severity === "medium" ? "border-amber-500/40 text-amber-600" : ""}>{warning.severity === "high" ? "Yüksek" : warning.severity === "medium" ? "Orta" : "Düşük"}</Badge></div>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5">{warning.reason}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{warning.source === "report_threshold" ? "Otomatik sistem" : warning.issuedBy} · {formatDistanceToNow(new Date(warning.createdAt), { locale: tr, addSuffix: true })}</p>
                  </div>)}
                </div>}
              </section>
              <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div><h3 className="font-bold">Modi işlem geçmişi</h3><p className="text-[11px] text-muted-foreground">Uyarı, susturma ve erişim işlemlerinin denetim kaydı.</p></div>
                {modiCommands.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Henüz Modi komutu uygulanmadı.</p> : <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                  {modiCommands.slice(0, 50).map(command => <div key={command.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{command.username ? `@${command.username}` : "Silinmiş kullanıcı"} · {({ warn: "Uyarı", mute_chat: "Sohbet susturma", block_dm: "DM engeli", block_account: "Hesap engeli", unmute_chat: "Susturma kaldırıldı", unblock_dm: "DM engeli kaldırıldı", unblock_account: "Hesap engeli kaldırıldı" } as Record<string, string>)[command.action] ?? command.action}</p><time className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(command.createdAt), { locale: tr, addSuffix: true })}</time></div>
                    <p className="mt-1 text-xs text-muted-foreground">{command.reason} · {command.issuedBy}{command.banType ? ` · ${({ user: "Hesap", user_ip: "Hesap + IP", app: "Uygulama geneli", dm: "DM", chat: "Genel sohbet", spam: "Spam", abuse: "Taciz / kötüye kullanım", content: "Uygunsuz içerik" } as Record<string, string>)[command.banType] ?? command.banType}` : ""}{command.durationMinutes ? ` · ${command.durationMinutes} dk` : ["block_dm", "block_account"].includes(command.action) ? " · Süresiz" : ""}</p>
                  </div>)}
                </div>}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="branding" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/5 p-5">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/15"><ImageIcon className="h-6 w-6 text-fuchsia-500" /></div>
                <div><h2 className="text-base font-bold">Uygulama logosu</h2><p className="mt-1 text-xs text-muted-foreground">Logo yalnızca marka alanında değişir. Loops alanının içeriği, düzeni ve çalışma mantığı etkilenmez.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border bg-card p-5">{brandingLogo.mimeType.startsWith("video/") ? <video src={brandingLogo.logoUrl} autoPlay muted loop playsInline controls aria-label="Aktif uygulama logosu" className="h-32 w-32 rounded-2xl object-cover shadow-lg" /> : <img src={brandingLogo.logoUrl} alt="Aktif uygulama logosu" className="h-32 w-32 rounded-2xl object-contain shadow-lg" />}</div>
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div><p className="text-sm font-semibold">Aktif logo</p><p className="mt-1 truncate text-xs text-muted-foreground">{brandingLogo.originalName}</p><p className="text-[11px] text-muted-foreground">{brandingLogo.updatedAt ? `Son güncelleme: ${new Date(brandingLogo.updatedAt).toLocaleString("tr-TR")}` : "Varsayılan asset kullanılıyor"}</p></div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-fuchsia-300/60 bg-fuchsia-500/5 px-3 py-3 text-sm font-medium hover:bg-fuchsia-500/10"><Upload className="h-4 w-4 text-fuchsia-500" />{brandingFile ? brandingFile.name : "Yeni logo veya video seç"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => setBrandingFile(event.target.files?.[0] ?? null)} /></label>
                  <div className="flex flex-wrap gap-2"><Button disabled={!brandingFile || brandingSaving} onClick={() => void uploadBrandingLogo()}><Upload className="mr-1 h-4 w-4" />{brandingSaving ? "Kaydediliyor..." : "Logoyu yayınla"}</Button><Button variant="outline" disabled={brandingSaving || brandingLogo.logoUrl === "/loop-app-logo.png"} onClick={() => void resetBrandingLogo()}>Varsayılana dön</Button></div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">PNG, WEBP, SVG veya MP4/WEBM video ekleyebilirsin. Video marka alanlarında sessiz, otomatik ve döngülü oynar. Tarayıcı sekmesi video desteklemediği için varsayılan görsel favicon kullanır.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-300/30 bg-violet-500/5 p-5">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15"><ImageIcon className="h-6 w-6 text-violet-500" /></div>
                <div><h2 className="text-base font-bold">Loops hikaye filigranı</h2><p className="mt-1 text-xs text-muted-foreground">Loops’tan hikayeye paylaşılan videoların sağ alt köşesinde görünecek logo veya watermark’ı buradan değiştir.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-border bg-black p-5">
                  {watermarkLogo.mimeType.startsWith("video/") ? (
                    <video
                      src={watermarkLogo.watermarkUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      aria-label="Aktif Loops watermark"
                      className="max-h-24 w-full object-contain"
                      style={{ width: `${Math.max(40, Math.round(110 * (watermarkLogo.size || 1)))}px`, height: `${Math.max(18, Math.round(30 * (watermarkLogo.size || 1)))}px` }}
                    />
                  ) : (
                    <img
                      src={watermarkLogo.watermarkUrl}
                      alt="Aktif Loops watermark"
                      className="max-h-24 w-full object-contain"
                      style={{ width: `${Math.max(40, Math.round(110 * (watermarkLogo.size || 1)))}px`, height: `${Math.max(18, Math.round(30 * (watermarkLogo.size || 1)))}px` }}
                    />
                  )}
                </div>
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <div><p className="text-sm font-semibold">Aktif hikaye filigranı</p><p className="mt-1 truncate text-xs text-muted-foreground">{watermarkLogo.originalName}</p><p className="text-[11px] text-muted-foreground">{watermarkLogo.updatedAt ? `Son güncelleme: ${new Date(watermarkLogo.updatedAt).toLocaleString("tr-TR")}` : "Varsayılan uygulama logosu kullanılıyor"}</p></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground"><label>Filigran boyutu</label><span>{Number(watermarkLogo.size || 1).toFixed(2)}x</span></div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      value={Number(watermarkLogo.size || 1)}
                      onChange={(event) => {
                        const size = Number(event.target.value);
                        setWatermarkLogo((previous) => ({ ...previous, size }));
                        queueWatermarkSizeSave(size);
                      }}
                      className="w-full accent-violet-500"
                    />
                  </div>
                  <div className="space-y-2"><label className="text-xs font-semibold text-muted-foreground">Filigran yazısı</label><div className="flex gap-2"><Input value={watermarkText} maxLength={40} onChange={event => setWatermarkText(event.target.value)} placeholder="İstersen yazı ekle" /><Button variant="outline" disabled={watermarkSaving} onClick={() => void saveWatermarkText()}>Yazıyı kaydet</Button></div></div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-violet-300/60 bg-violet-500/5 px-3 py-3 text-sm font-medium hover:bg-violet-500/10"><Upload className="h-4 w-4 text-violet-500" />{watermarkFile ? watermarkFile.name : "Yeni watermark seç"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => setWatermarkFile(event.target.files?.[0] ?? null)} /></label>
                  <div className="flex flex-wrap gap-2"><Button disabled={!watermarkFile || watermarkSaving} onClick={() => void uploadWatermarkLogo()}><Upload className="mr-1 h-4 w-4" />{watermarkSaving ? "Kaydediliyor..." : "Watermark yayınla"}</Button><Button variant="outline" disabled={watermarkSaving || watermarkLogo.watermarkUrl === "/loop-app-logo.png"} onClick={() => void resetWatermarkLogo()}>Varsayılana dön</Button></div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Yatay logo görseli, şeffaf PNG/SVG veya kısa MP4/WEBM kullanabilirsin. Filigran, hikaye videolarının sağ alt köşesinde görünür ve buradan boyutunu ayarlayabilirsin.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="decorations" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-violet-300/30 bg-violet-500/5 p-5">
              <div className="mb-4"><h2 className="text-base font-bold">Rozet, Tik & Çerçeve Stüdyosu</h2><p className="mt-1 text-xs text-muted-foreground">Hazır rozet yok. Görseli admin yükler, yayınlar ve kullanıcıya atar.</p></div>
              <div className="grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-4">
                <Input placeholder="Asset adı" value={assetName} onChange={event => setAssetName(event.target.value)} />
                <Select value={assetKind} onValueChange={value => setAssetKind(value as "badge" | "frame" | "emblem")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="badge">Rozet / Tik</SelectItem><SelectItem value="emblem">Amblem / Başarı rozeti</SelectItem><SelectItem value="frame">Tik çerçevesi</SelectItem></SelectContent></Select>
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => setAssetFile(event.target.files?.[0] ?? null)} />
                <Button disabled={!assetName.trim() || !assetFile} onClick={() => void uploadDecorationAsset()}><Upload className="mr-1 h-4 w-4" />Yükle (Taslak)</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(["badges", "emblems", "frames"] as const).map(kind => <div key={kind} className="space-y-2 rounded-xl border border-border bg-card p-3"><p className="text-xs font-bold">{kind === "badges" ? "Yüklenen rozetler" : kind === "emblems" ? "Yüklenen amblemler" : "Yüklenen tik çerçeveleri"}</p>{decorationAssets[kind].map(asset => <div key={asset.id} className="flex items-center gap-2"><img src={asset.imageUrl} alt={asset.name} className="h-8 w-8 object-contain" /><span className="min-w-0 flex-1 truncate text-xs">{asset.name}</span><Badge variant={asset.published ? "default" : "secondary"}>{asset.published ? "Yayında" : "Taslak"}</Badge><Button size="sm" variant="outline" onClick={() => void toggleDecorationAsset(kind === "badges" ? "badge" : kind === "emblems" ? "emblem" : "frame", asset.id, "publish")}>{asset.published ? "Taslağa al" : "Yayınla"}</Button><Button size="sm" variant="destructive" onClick={() => void toggleDecorationAsset(kind === "badges" ? "badge" : kind === "emblems" ? "emblem" : "frame", asset.id, "delete")}>Sil</Button></div>)}</div>)}
              </div>
              <Select value={decorationUserId} onValueChange={selectDecorationUser}><SelectTrigger><SelectValue placeholder="Profil fotoğrafı veya rozet verilecek kullanıcıyı seç" /></SelectTrigger><SelectContent>{users.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.displayName} @{item.username}</SelectItem>)}</SelectContent></Select>
              {decorationUserId && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3"><span className="text-xs font-bold text-primary">Profil fotoğrafı</span><Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => setAvatarFile(event.target.files?.[0] ?? null)} className="max-w-xs" /><Button size="sm" disabled={!avatarFile || avatarSaving} onClick={() => void uploadUserAvatar()}><Upload className="mr-1 h-3.5 w-3.5" />{avatarSaving ? "Yükleniyor..." : "Fotoğrafı ata"}</Button></div>}
              {decorationUserId && <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4"><p className="mb-3 text-xs font-bold text-violet-600">Rozet & Tik</p><Select value={selectedBadgeAsset || "none"} onValueChange={value => setSelectedBadgeAsset(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Yayınlanmış rozet seç" /></SelectTrigger><SelectContent><SelectItem value="none">Yok</SelectItem>{decorationAssets.badges.filter(asset => asset.published).map(asset => <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>)}</SelectContent></Select><Input className="mt-3" value={decorationBadgeLabel} onChange={event => setDecorationBadgeLabel(event.target.value)} placeholder="Görünen adın sonundaki yazı" /></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="mb-3 text-xs font-bold text-violet-600">Amblem / Başarı rozeti</p><Select value={selectedEmblemAsset || "none"} onValueChange={value => setSelectedEmblemAsset(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Yayınlanmış amblem seç" /></SelectTrigger><SelectContent><SelectItem value="none">Yok</SelectItem>{decorationAssets.emblems.filter(asset => asset.published).map(asset => <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="mb-3 text-xs font-bold text-violet-600">Tik Çerçevesi</p><Select value={selectedFrameAsset || "none"} onValueChange={value => setSelectedFrameAsset(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Yayınlanmış çerçeve seç" /></SelectTrigger><SelectContent><SelectItem value="none">Yok</SelectItem>{decorationAssets.frames.filter(asset => asset.published).map(asset => <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>)}</SelectContent></Select></div>
              </div>}
              {decorationUserId && <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-violet-300 bg-card p-4"><div className="flex items-center gap-3"><div className="relative h-14 w-14 shrink-0"><Avatar className={`h-14 w-14 rounded-full border-4 border-background ${decorationFrame === "violet" ? "ring-4 ring-violet-500" : decorationFrame === "gold" ? "ring-4 ring-amber-400" : decorationFrame === "cyan" ? "ring-4 ring-cyan-400" : decorationFrame === "rose" ? "ring-4 ring-rose-400" : ""}`}><AvatarImage src={users.find(item => String(item.id) === decorationUserId)?.avatarUrl || ""} /><AvatarFallback>{users.find(item => String(item.id) === decorationUserId)?.displayName?.charAt(0) || "?"}</AvatarFallback></Avatar>{selectedFrameAsset && <NormalizedFrame src={decorationAssets.frames.find(asset => String(asset.id) === selectedFrameAsset)?.imageUrl || ""} isReferenceFrame={selectedFrameAsset === "1"} />}</div><div><p className="font-bold">{users.find(item => String(item.id) === decorationUserId)?.displayName}</p><p className="text-xs text-muted-foreground">Test önizlemesi {decorationBadgeLabel && `· ${decorationBadgeLabel}`}</p></div></div><Button disabled={decorationSaving} onClick={() => void publishDecoration()}>{decorationSaving ? "Yayınlanıyor..." : "Yayınla"}</Button></div>}
            </div>
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-fuchsia-500/10 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15"><Vote className="h-6 w-6 text-cyan-500" /></div><div><h2 className="font-bold">Yeni kitap etkinliği</h2><p className="text-xs text-muted-foreground">Bu alan mevcut akıştan bağımsız etkinlik kartları içindir.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Etkinlik başlığı" value={eventTitle} onChange={e => setEventTitle(e.target.value)} />
                <Input placeholder="Yarışma etiketi" value={eventTag} onChange={e => setEventTag(e.target.value)} />
                <Select value={eventTheme} onValueChange={value => setEventTheme(value as typeof eventTheme)}><SelectTrigger><SelectValue placeholder="Tema" /></SelectTrigger><SelectContent><SelectItem value="night">Karanlık fantastik</SelectItem><SelectItem value="ember">Kor ateşi</SelectItem><SelectItem value="ocean">Gece mavisi</SelectItem><SelectItem value="mint">Nane neon</SelectItem></SelectContent></Select>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground"><Upload className="h-4 w-4 text-cyan-500" />{eventCover ? "Fotoğraf seçildi" : "Kart fotoğrafı ekle"}<input type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setEventCover(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></label>
              </div>
              <Textarea className="mt-3" rows={3} placeholder="Etkinlik açıklaması" value={eventDescription} onChange={e => setEventDescription(e.target.value)} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{eventOptions.map((option, index) => <Input key={index} placeholder={`Seçenek ${index + 1}`} value={option} onChange={e => setEventOptions(current => current.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} />)}</div>
              {eventOptions.length < 4 && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setEventOptions(current => [...current, ""])}><Plus className="mr-1 h-3.5 w-3.5" />Seçenek ekle</Button>}
              <Button type="button" className="mt-4 gap-2" disabled={eventSaving || !eventTitle.trim()} onClick={handleCreateEvent}><Vote className="h-4 w-4" />{eventSaving ? "Yayınlanıyor..." : "Etkinliği yayınla"}</Button>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3 mt-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                  placeholder="Kullanıcı ara..."
                  className="pl-8"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Roller</SelectItem>
                  <SelectItem value="user">Kullanıcı</SelectItem>
                  <SelectItem value="brand">Marka</SelectItem>
                  <SelectItem value="moderator">Moderatör</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={banFilter}
                onValueChange={(v) => {
                  setBanFilter(v);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="banned">Yasaklı</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                Filtrele
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-card rounded-xl animate-pulse"
                    />
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${u.isBanned ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={u.avatarUrl || ""} />
                      <AvatarFallback>{u.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {u.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{u.username}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleColor(u.role)}`}
                        >
                          {roleLabel(u.role)}
                        </span>
                        {u.isBanned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                            Yasaklı
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3">
                        <span>{u.email}</span>
                        {u.lastIpAddress && (
                          <span className="font-mono truncate" title="Son görülen IP adresi">
                            IP: {u.lastIpAddress}
                          </span>
                        )}
                        {u.lastSeenAt && (
                          <span>
                            Son:{" "}
                            {formatDistanceToNow(new Date(u.lastSeenAt), {
                              locale: tr,
                              addSuffix: true,
                            })}
                          </span>
                        )}
                        {u.isBanned && u.banReason && (
                          <span className="text-destructive">
                            Sebep: {u.banReason}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isAdmin && u.id !== user?.id && (
                        <Select
                          value={u.role}
                          onValueChange={(v) => handleChangeRole(u.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Kullanıcı</SelectItem>
                            <SelectItem value="brand">Marka</SelectItem>
                            <SelectItem value="moderator">Moderatör</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {u.id !== user?.id && !isProtectedAccount(u) &&
                        (u.isBanned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleUnban(u.id, u.username)}
                          >
                            <UserCheck className="w-3 h-3" /> Yasağı Kaldır
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => { setBanDialogUser(u); setBanIp(u.lastIpAddress ?? ""); }}
                          >
                            <Gavel className="w-3 h-3" /> Yasakla
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Kullanıcı bulunamadı
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="space-y-4 mt-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div><p className="text-sm font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-rose-500" />Canlı yayın alanı</p><p className="text-xs text-muted-foreground mt-1">Kullanıcıların canlı yayın alanında göreceği durumu seçin.</p></div>
              <Select value={liveStatus} onValueChange={(value) => void updateLiveStatus(value as LiveStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enabled">Kullanıma açık</SelectItem><SelectItem value="coming_soon">Yakında</SelectItem><SelectItem value="disabled">Kapalı</SelectItem></SelectContent></Select>
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.04] p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={liveRestrictedMode}
                    onChange={event => setLiveRestrictedMode(event.target.checked)}
                    className="mt-1 accent-rose-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Canlı yayını yalnızca seçtiğim kişiler kullanabilsin</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Etkinleştirildiğinde seçilmeyen kişiler canlı yayın alanında “Yakında” görür ve yayın başlatamaz.
                    </span>
                  </span>
                </label>
                {liveRestrictedMode && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={liveTestUserSearch}
                      onChange={event => setLiveTestUserSearch(event.target.value)}
                      placeholder="Kullanıcı adıyla ara"
                      aria-label="Canlı yayın test kullanıcısı ara"
                    />
                    <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                      {liveTestUsers.length === 0 ? (
                        <p className="p-2 text-center text-xs text-muted-foreground">Kullanıcı bulunamadı</p>
                      ) : liveTestUsers.map(testUser => (
                        <label key={testUser.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={liveAllowedUserIds.includes(testUser.id)}
                            onChange={event => setLiveAllowedUserIds(current => event.target.checked
                              ? [...new Set([...current, testUser.id])]
                              : current.filter(id => id !== testUser.id))}
                            className="accent-rose-500"
                          />
                          <span className="min-w-0 truncate">{testUser.displayName} <span className="text-muted-foreground">@{testUser.username}</span></span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Seçili kişi: {liveAllowedUserIds.length}</p>
                  </div>
                )}
                <Button type="button" size="sm" onClick={() => void saveLiveAccess()} disabled={liveAccessSaving}>
                  {liveAccessSaving ? "Kaydediliyor..." : "Test erişimini kaydet"}
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Üyelik rozet görselleri</p>
                <p className="mt-1 text-xs text-muted-foreground">Rozetler bölümünde yükleyip yayınladığınız görselleri üyeliklere bağlayın. Altın Tik görseli Basic ve Full üyelerde kullanılır.</p>
              </div>
              {([
                ["premium_writer", "Premium Yazar"],
                ["blue_verified", "Mavi Tik"],
                ["gold", "Altın Tik"],
              ] as const).map(([key, label]) => (
                <div key={key} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
                  <span className="text-sm font-medium">{label}</span>
                  <Select
                    value={membershipBadgeAssetIds[key] || "none"}
                    onValueChange={value => setMembershipBadgeAssetIds(current => ({
                      ...current,
                      [key]: value === "none" ? "" : value,
                    }))}
                  >
                    <SelectTrigger aria-label={`${label} üyelik rozeti`}>
                      <SelectValue placeholder="Rozet görseli seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçilmedi</SelectItem>
                      {decorationAssets.badges.filter(asset => asset.published).map(asset => (
                        <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button type="button" size="sm" onClick={() => void saveMembershipBadges()} disabled={membershipBadgeSaving}>
                {membershipBadgeSaving ? "Kaydediliyor..." : "Üyelik rozetlerini kaydet"}
              </Button>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div><p className="text-sm font-semibold flex items-center gap-2"><Upload className="w-4 h-4 text-violet-500" />Canlı yayın hediyeleri ve animasyonları</p><p className="text-xs text-muted-foreground mt-1">Video veya GIF yükleyin. Yayınlamadan önce önizleyebilirsiniz.</p></div>
              <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.04] p-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Hediye koleksiyonu vitrini</p>
                    <p className="mt-1 text-xs text-muted-foreground">Yayındaki hediyelerden vitrinde görünecek koleksiyonu belirleyin. Toplanan hediyeler canlı yayında ışıklı görünür.</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium">
                    Vitrin sayısı
                    <Input
                      className="h-9 w-20"
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      value={liveCollectionTotal}
                      onChange={event => {
                        const nextTotal = Math.max(1, Math.min(30, Number(event.target.value) || 1));
                        setLiveCollectionTotal(nextTotal);
                        setLiveCollectionGiftIds(current => current.slice(0, nextTotal));
                      }}
                      aria-label="Koleksiyondaki hediye sayısı"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Seçilen hediyeler: {liveCollectionGiftIds.length}/{liveCollectionTotal}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {liveAnimations.filter(animation => animation.published).map(animation => {
                    const checked = liveCollectionGiftIds.includes(animation.id);
                    return (
                      <label key={animation.id} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background/60 p-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && liveCollectionGiftIds.length >= liveCollectionTotal}
                          onChange={event => setLiveCollectionGiftIds(current => event.target.checked ? [...current, animation.id] : current.filter(id => id !== animation.id))}
                        />
                        <span className="truncate">{animation.name}</span>
                      </label>
                    );
                  })}
                  {liveAnimations.every(animation => !animation.published) && <p className="text-xs text-muted-foreground">Vitrine eklemek için önce en az bir hediyeyi yayınlayın.</p>}
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={liveCollectionSaving || liveCollectionGiftIds.length !== liveCollectionTotal}
                  onClick={() => void saveLiveCollection()}
                >
                  {liveCollectionSaving ? "Kaydediliyor…" : "Hediye vitrini ayarını kaydet"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_1fr]"><Input value={liveAnimationName} onChange={event => setLiveAnimationName(event.target.value)} placeholder="Animasyon adı" /><Input type="number" min="0" max="1000000" step="1" value={liveAnimationCoinValue} onChange={event => setLiveAnimationCoinValue(event.target.value)} aria-label="Hediye coin bedeli" placeholder="Coin" /><Input type="file" accept="video/*,image/gif" onChange={event => setLiveAnimationFile(event.target.files?.[0] ?? null)} /></div>
              <Select value={liveAnimationTransparency} onValueChange={value => setLiveAnimationTransparency(value as "auto" | "none" | "green" | "white")}><SelectTrigger><SelectValue placeholder="Arka plan türü" /></SelectTrigger><SelectContent><SelectItem value="auto">Otomatik green/white algıla</SelectItem><SelectItem value="none">Normal, şeffaflaştırma yok</SelectItem><SelectItem value="green">Green screen, yeşili şeffaflaştır</SelectItem><SelectItem value="white">White screen, beyazı şeffaflaştır</SelectItem></SelectContent></Select>
              <Select value={liveAnimationEdgeFade} onValueChange={value => setLiveAnimationEdgeFade(value as "none" | "top-bottom")}><SelectTrigger><SelectValue placeholder="Kenar görünümü" /></SelectTrigger><SelectContent><SelectItem value="top-bottom">Üst + alt yumuşak geçiş</SelectItem><SelectItem value="none">Kenar geçişi yok</SelectItem></SelectContent></Select>
              {liveAnimationFile && (liveAnimationFile.type === "image/gif" ? <img src={URL.createObjectURL(liveAnimationFile)} alt="Animasyon önizlemesi" className="max-h-52 w-full rounded-xl bg-black object-contain" /> : <video src={URL.createObjectURL(liveAnimationFile)} controls muted loop className="max-h-52 w-full rounded-xl bg-black object-contain" />)}
              <Button disabled={!liveAnimationFile || liveAnimationUploading} onClick={() => void uploadLiveAnimation()} className="gap-1.5"><Upload className="h-4 w-4" />{liveAnimationUploading ? "Yükleniyor…" : "Animasyonu yükle"}</Button>
              <div className="space-y-2">
                {liveAnimations.map(animation => (
                  <div key={animation.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-2">
                    {animation.mimeType === "image/gif" ? <img src={animation.url} alt={animation.name} className="h-16 w-24 rounded-lg bg-black object-contain" /> : <video src={animation.url} controls muted loop className="h-16 w-24 rounded-lg bg-black object-contain" />}
                    <div className="min-w-[180px] flex-1">
                      <p className="truncate text-sm font-semibold">{animation.name}</p>
                      <Badge variant={animation.published ? "default" : "secondary"}>{animation.published ? "Yayında" : "Taslak"}</Badge>
                      <Input className="mt-1 h-8 w-28" type="number" min="0" max="1000000" step="1" aria-label={`${animation.name} coin bedeli`} value={animation.coinValue ?? 1} onChange={event => { const coinValue = event.target.value === "" ? 0 : Number(event.target.value); setLiveAnimations(current => current.map(item => item.id === animation.id ? { ...item, coinValue } : item)); }} onBlur={event => void updateLiveAnimationCoinValue(animation.id, Number(event.target.value || "0"))} />
                      <Select value={animation.transparencyMode ?? "auto"} onValueChange={value => void updateLiveAnimationTransparency(animation.id, value as "auto" | "none" | "green" | "white")}><SelectTrigger className="mt-1 h-8 w-44 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Otomatik</SelectItem><SelectItem value="none">Normal</SelectItem><SelectItem value="green">Green screen</SelectItem><SelectItem value="white">White screen</SelectItem></SelectContent></Select>
                      <Select value={animation.edgeFade ?? "top-bottom"} onValueChange={value => void updateLiveAnimationEdgeFade(animation.id, value as "none" | "top-bottom")}><SelectTrigger className="mt-1 h-8 w-44 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top-bottom">Üst + alt geçiş</SelectItem><SelectItem value="none">Geçiş yok</SelectItem></SelectContent></Select>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-black/70">
                        {animation.coverUrl ? <img src={animation.coverUrl} alt={`${animation.name} hediye kapağı`} className="h-full w-full object-cover" /> : <span className="px-1 text-center text-[10px] text-muted-foreground">Kapak yok</span>}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Hediye kapağı</p>
                        <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`${animation.name} için kapak görseli`} className="h-8 max-w-52 text-xs" disabled={liveGiftCoverUploadingId === animation.id} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadLiveGiftCover(animation.id, file); event.currentTarget.value = ""; }} />
                        {liveGiftCoverUploadingId === animation.id && <p className="text-[10px] text-muted-foreground">Yükleniyor…</p>}
                        {animation.coverUrl && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void removeLiveGiftCover(animation.id)}>Kapağı kaldır</Button>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void toggleLiveAnimation(animation.id)}>{animation.published ? "Taslağa al" : "Yayınla"}</Button>
                    <Button size="icon" variant="ghost" onClick={() => void deleteLiveAnimation(animation.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-300/25 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/[0.06] to-cyan-500/[0.04] p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-rose-500" />Kapışma kazanma ve kaybetme animasyonları</p>
                <p className="mt-1 text-xs text-muted-foreground">Sonuç ekranları hediye animasyonlarından tamamen ayrıdır. Her sonuç türü için bir animasyonu yayınlayın.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px_1fr]">
                <Input value={battleResultName} onChange={event => setBattleResultName(event.target.value)} placeholder="Animasyon adı" />
                <Select value={battleResultOutcome} onValueChange={value => setBattleResultOutcome(value as BattleResultOutcome)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="win">Kazanma</SelectItem><SelectItem value="lose">Kaybetme</SelectItem></SelectContent></Select>
                <Input type="file" accept="video/*,image/gif" onChange={event => setBattleResultFile(event.target.files?.[0] ?? null)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={battleResultTransparency} onValueChange={value => setBattleResultTransparency(value as "auto" | "none" | "green" | "white")}><SelectTrigger><SelectValue placeholder="Arka plan türü" /></SelectTrigger><SelectContent><SelectItem value="auto">Otomatik green/white algıla</SelectItem><SelectItem value="none">Normal, şeffaflaştırma yok</SelectItem><SelectItem value="green">Green screen</SelectItem><SelectItem value="white">White screen</SelectItem></SelectContent></Select>
                <Select value={battleResultEdgeFade} onValueChange={value => setBattleResultEdgeFade(value as "none" | "top-bottom")}><SelectTrigger><SelectValue placeholder="Kenar görünümü" /></SelectTrigger><SelectContent><SelectItem value="top-bottom">Üst + alt yumuşak geçiş</SelectItem><SelectItem value="none">Kenar geçişi yok</SelectItem></SelectContent></Select>
              </div>
              {battleResultFile && (battleResultFile.type === "image/gif" ? <img src={URL.createObjectURL(battleResultFile)} alt="Kapışma sonucu önizlemesi" className="max-h-52 w-full rounded-xl bg-black object-contain" /> : <video src={URL.createObjectURL(battleResultFile)} controls muted loop className="max-h-52 w-full rounded-xl bg-black object-contain" />)}
              <Button disabled={!battleResultFile || battleResultUploading} onClick={() => void uploadBattleResultAnimation()} className="gap-1.5"><Upload className="h-4 w-4" />{battleResultUploading ? "Yükleniyor…" : "Sonuç animasyonunu taslak kaydet"}</Button>
              <div className="space-y-2">
                {battleResultAnimations.map(animation => <div key={animation.id} className="flex items-center gap-3 rounded-xl border bg-card p-2">
                  {animation.mimeType === "image/gif" ? <img src={animation.url} alt={animation.name} className="h-16 w-24 shrink-0 rounded-lg bg-black object-contain" /> : <video src={animation.url} controls muted loop className="h-16 w-24 shrink-0 rounded-lg bg-black object-contain" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{animation.name}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant={animation.outcome === "win" ? "default" : "secondary"}>{animation.outcome === "win" ? "Kazanma" : "Kaybetme"}</Badge><Badge variant={animation.published ? "default" : "outline"}>{animation.published ? "Yayında" : "Taslak"}</Badge></div></div>
                  <div className="flex shrink-0 flex-col gap-1"><Button size="sm" variant="outline" onClick={() => void toggleBattleResultAnimation(animation.id)}>{animation.published ? "Taslağa al" : "Yayınla"}</Button><Button size="icon" variant="ghost" aria-label="Sonuç animasyonunu sil" onClick={() => void deleteBattleResultAnimation(animation.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>)}
                {battleResultAnimations.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Henüz kazanma veya kaybetme animasyonu yüklenmedi.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/[0.06] to-cyan-500/[0.04] p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Canlı yayın etkinlik banner’ı</p>
                <p className="mt-1 text-xs text-muted-foreground">Başlık, açıklama ve yatay kaydırılabilir görseller yükleyin. Yayınlanan banner izleyici ve yayıncı ekranında kapatılabilir olarak görünür.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                <Input value={liveEventTitle} onChange={(event) => setLiveEventTitle(event.target.value)} maxLength={120} placeholder="Etkinlik başlığı" />
                <Input value={liveEventDescription} onChange={(event) => setLiveEventDescription(event.target.value)} maxLength={500} placeholder="Kısa açıklama" />
                <Input className="sm:col-span-2" type="file" accept="image/*" multiple onChange={(event) => setLiveEventImages(Array.from(event.target.files ?? []))} />
              </div>
              {liveEventImages.length > 0 && <p className="text-xs text-muted-foreground">{liveEventImages.length} görsel seçildi · banner içinde yatay kaydırılır</p>}
              <Button disabled={!liveEventTitle.trim() || liveEventImages.length === 0 || liveEventUploading} onClick={() => void uploadLiveEvent()} className="gap-1.5"><Upload className="h-4 w-4" />{liveEventUploading ? "Yükleniyor…" : "Etkinliği taslak kaydet"}</Button>
              <div className="space-y-2">
                {liveEvents.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl border bg-card p-2">
                  <div className="flex h-14 w-20 shrink-0 gap-1 overflow-hidden rounded-lg bg-black/80">{event.images.slice(0, 3).map((image) => <img key={image.id} src={image.url} alt="" className="h-full min-w-0 flex-1 object-cover" />)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="truncate text-xs text-muted-foreground">{event.description || `${event.images.length} görsel`}</p><Badge variant={event.published ? "default" : "secondary"}>{event.published ? "Yayında" : "Taslak"}</Badge></div>
                  <div className="flex shrink-0 flex-col gap-1"><Button size="sm" variant="outline" onClick={() => void toggleLiveEvent(event.id)}>{event.published ? "Kaldır" : "Yayınla"}</Button><Button size="icon" variant="ghost" aria-label="Etkinliği sil" onClick={() => void deleteLiveEvent(event.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>)}
                {liveEvents.length === 0 && <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Henüz etkinlik eklenmedi.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-cyan-500/10 p-4 space-y-3">
              <div><p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" />Canlı yayın assetleri</p><p className="text-xs text-muted-foreground mt-1">Abone ol ve diğer canlı yayın butonlarının görünümünde kullanacağınız görsel veya video assetlerini buradan tasarlayın ve yönetin.</p></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_1fr]">
                <Input value={buttonAssetName} onChange={event => setButtonAssetName(event.target.value)} placeholder="Asset adı" />
                <Select value={buttonAssetRole} onValueChange={value => setButtonAssetRole(value as ButtonAssetRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subscribe">Abone ol</SelectItem><SelectItem value="guests">Konuklar</SelectItem><SelectItem value="like">Beğeni</SelectItem><SelectItem value="gift">Gül / Hediye</SelectItem><SelectItem value="share">Paylaş</SelectItem><SelectItem value="comment">Yorum</SelectItem><SelectItem value="streak">🔥 Günlük / haftalık etiketi</SelectItem><SelectItem value="ranking">Sıralama aksiyonu</SelectItem><SelectItem value="collection">Koleksiyon galerisi</SelectItem><SelectItem value="coin">Coin simgesi</SelectItem><SelectItem value="general">Genel buton</SelectItem></SelectContent></Select>
                <Input type="file" accept="image/*,video/*" onChange={event => setButtonAssetFile(event.target.files?.[0] ?? null)} />
              </div>
              {buttonAssetFile && (buttonAssetFile.type.startsWith("video/") ? <video src={URL.createObjectURL(buttonAssetFile)} controls muted loop className="max-h-48 w-full rounded-xl bg-black object-contain" /> : <img src={URL.createObjectURL(buttonAssetFile)} alt="Buton asset önizlemesi" className="max-h-48 w-full rounded-xl bg-black object-contain" />)}
              <Button disabled={!buttonAssetFile || buttonAssetUploading} onClick={() => void uploadButtonAsset()} className="gap-1.5"><Upload className="h-4 w-4" />{buttonAssetUploading ? "Yükleniyor…" : "Buton asset'i yükle"}</Button>
              <div className="grid gap-2 md:grid-cols-2">
                {buttonAssets.map(asset => <div key={asset.id} className="flex gap-3 rounded-xl border bg-card p-2">
                  {asset.mimeType.startsWith("video/") ? <video src={asset.url} controls muted loop className="h-20 w-20 shrink-0 rounded-lg bg-black object-contain" /> : <img src={asset.url} alt={asset.name} className="h-20 w-20 shrink-0 rounded-lg bg-black object-contain" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset.name}</p><Badge variant={asset.published ? "default" : "secondary"}>{asset.published ? "Yayında" : "Taslak"}</Badge><Select value={asset.role} onValueChange={value => void updateButtonAssetRole(asset.id, value as ButtonAssetRole)}><SelectTrigger className="mt-1 h-8 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subscribe">Abone ol</SelectItem><SelectItem value="guests">Konuklar</SelectItem><SelectItem value="like">Beğeni</SelectItem><SelectItem value="gift">Gül / Hediye</SelectItem><SelectItem value="share">Paylaş</SelectItem><SelectItem value="comment">Yorum</SelectItem><SelectItem value="streak">🔥 Günlük / haftalık etiketi</SelectItem><SelectItem value="ranking">Sıralama aksiyonu</SelectItem><SelectItem value="collection">Koleksiyon galerisi</SelectItem><SelectItem value="coin">Coin simgesi</SelectItem><SelectItem value="general">Genel buton</SelectItem></SelectContent></Select></div>
                  <div className="flex shrink-0 flex-col gap-1"><Button size="sm" variant="outline" onClick={() => void toggleButtonAsset(asset.id)}>{asset.published ? "Taslağa al" : "Yayınla"}</Button><Button size="icon" variant="ghost" onClick={() => void deleteButtonAsset(asset.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>)}
              </div>
              {buttonAssets.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Henüz canlı yayın buton asset’i yüklenmedi.</p>}
            </div>
            <div className="rounded-2xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-cyan-500/10 p-4 space-y-3">
              <div><p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-500" />Canlı savaş arena asset stüdyosu</p><p className="text-xs text-muted-foreground mt-1">Referanstaki savaş ekranını oluşturan arka plan, takım görselleri, VS amblemi, skor barı ve overlay asset’lerini buradan yönetin.</p></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_1fr]">
                <Input value={arenaAssetName} onChange={event => setArenaAssetName(event.target.value)} placeholder="Asset adı" />
                <Select value={arenaAssetRole} onValueChange={value => setArenaAssetRole(value as ArenaAssetRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="background">Arena arka planı</SelectItem><SelectItem value="left-team">Sol takım görseli</SelectItem><SelectItem value="right-team">Sağ takım görseli</SelectItem><SelectItem value="vs-emblem">VS amblemi</SelectItem><SelectItem value="score-bar">Skor barı kaplaması</SelectItem><SelectItem value="overlay">Ön plan overlay</SelectItem></SelectContent></Select>
                <Input type="file" accept="image/*,video/*" onChange={event => setArenaAssetFile(event.target.files?.[0] ?? null)} />
              </div>
              {arenaAssetFile && (arenaAssetFile.type.startsWith("video/") ? <video src={URL.createObjectURL(arenaAssetFile)} controls muted loop className="max-h-56 w-full rounded-xl bg-black object-contain" /> : <img src={URL.createObjectURL(arenaAssetFile)} alt="Arena asset önizlemesi" className="max-h-56 w-full rounded-xl bg-black object-contain" />)}
              <Button disabled={!arenaAssetFile || arenaAssetUploading} onClick={() => void uploadArenaAsset()} className="gap-1.5"><Upload className="h-4 w-4" />{arenaAssetUploading ? "Yükleniyor…" : "Arena asset'i yükle"}</Button>
              <div className="grid gap-2 md:grid-cols-2">
                {arenaAssets.map(asset => <div key={asset.id} className="flex gap-3 rounded-xl border bg-card p-2">
                  {asset.mimeType.startsWith("video/") ? <video src={asset.url} controls muted loop className="h-20 w-28 shrink-0 rounded-lg bg-black object-contain" /> : <img src={asset.url} alt={asset.name} className="h-20 w-28 shrink-0 rounded-lg bg-black object-contain" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset.name}</p><Badge variant={asset.published ? "default" : "secondary"}>{asset.published ? "Yayında" : "Taslak"}</Badge><Select value={asset.role} onValueChange={value => void updateArenaAssetRole(asset.id, value as ArenaAssetRole)}><SelectTrigger className="mt-1 h-8 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="background">Arena arka planı</SelectItem><SelectItem value="left-team">Sol takım görseli</SelectItem><SelectItem value="right-team">Sağ takım görseli</SelectItem><SelectItem value="vs-emblem">VS amblemi</SelectItem><SelectItem value="score-bar">Skor barı kaplaması</SelectItem><SelectItem value="overlay">Ön plan overlay</SelectItem></SelectContent></Select></div>
                  <div className="flex shrink-0 flex-col gap-1"><Button size="sm" variant="outline" onClick={() => void toggleArenaAsset(asset.id)}>{asset.published ? "Taslağa al" : "Yayınla"}</Button><Button size="icon" variant="ghost" onClick={() => void deleteArenaAsset(asset.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>)}
              </div>
              {arenaAssets.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Henüz arena asset’i yüklenmedi.</p>}
            </div>
          </TabsContent>

          <TabsContent value="bobi" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15"><Bot className="h-6 w-6 text-primary" /></div><div><h2 className="font-bold">Bobi sohbet ve eğlence asistanı</h2><p className="text-xs text-muted-foreground">Bobi genel sohbette yardımcı olur; mevcut özel sohbet odası kuralları Bobi’de kalır. Genel sohbet moderasyonu Modi tarafından yürütülür.</p></div></div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <div><Textarea value={bobiAbilities} onChange={event => setBobiAbilities(event.target.value)} placeholder="Örnek: Sohbet odası spam yapanı 2 kez uyar, 10 dakika sustur; genel sohbette soruları yanıtla." rows={3} /><p className="mt-1 text-[11px] text-muted-foreground">Bobi özel sohbet odalarında “X kez uyar”, “X dakika sustur”, “spam denetimini kapat” talimatlarını; genel sohbette yardımcı/soru yanıtlama ayarlarını kullanır. Genel sohbet kuralları ve oylamalar Modi tarafından yönetilir.</p></div>
                <Input type="number" min={10} max={300} value={bobi?.settings.spamWindowSeconds ?? 30} onChange={event => setBobi(current => current ? { ...current, settings: { ...current.settings, spamWindowSeconds: Number(event.target.value) } } : current)} placeholder="Spam penceresi (sn)" />
                <div className="flex flex-col gap-2"><Button onClick={() => void saveBobiSettings({ enabled: bobi?.settings.enabled !== false, spamWindowSeconds: bobi?.settings.spamWindowSeconds ?? 30, abilities: bobiAbilities })}>Ayarları kaydet</Button><Button variant="outline" onClick={() => void saveBobiSettings({ enabled: bobi?.settings.enabled === false, spamWindowSeconds: bobi?.settings.spamWindowSeconds ?? 30, abilities: bobiAbilities })}>{bobi?.settings.enabled === false ? "Bobi'yi aç" : "Bobi'yi kapat"}</Button></div>
              </div>
              <div className="mt-4 flex gap-2"><Input value={bobiWord} onChange={event => setBobiWord(event.target.value)} placeholder="Bobi özel sohbet odaları için yasaklı kelime ekle" onKeyDown={event => event.key === "Enter" && void addBobiWord()} /><Button onClick={() => void addBobiWord()}><Plus className="mr-1 h-4 w-4" />Ekle</Button></div>
              <div className="mt-3 flex flex-wrap gap-2">{(bobi?.words ?? []).map(item => <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1 text-xs">{item.word}<button type="button" aria-label={`${item.word} kelimesini sil`} onClick={() => void removeBobiWord(item.id)}><XCircle className="h-3.5 w-3.5 text-destructive" /></button></span>)}</div>
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><p className="mb-2 text-xs font-bold">Bobi'ye görev ver</p><div className="flex gap-2"><Input value={bobiCommand} onChange={event => setBobiCommand(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runBobiCommand(); }} placeholder="Bobi selam ver" /><Button disabled={!bobiCommand.trim()} onClick={() => void runBobiCommand()}><Bot className="mr-1 h-4 w-4" />Çalıştır</Button></div><p className="mt-1 text-[11px] text-muted-foreground">Ücretsiz yerel komutlar: “Bobi selam ver”, “Bobi sohbete yaz Yayın 20:00'de başlayacak”, “Bobi duyuru yap Kurallar güncellendi”.</p></div>
              <div className="mt-5 rounded-xl border border-dashed border-primary/30 bg-card p-3"><p className="mb-2 text-xs font-bold">Emin olunmayan içeriği admin kararına gönder</p><div className="grid gap-2 md:grid-cols-[120px_120px_1fr_auto]"><Input value={bobiReportUserId} onChange={event => setBobiReportUserId(event.target.value)} placeholder="Kullanıcı ID" /><Select value={bobiReportSource} onValueChange={value => setBobiReportSource(value as "chat" | "dm")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="chat">Genel sohbet</SelectItem><SelectItem value="dm">DM</SelectItem></SelectContent></Select><Input value={bobiReportMessage} onChange={event => setBobiReportMessage(event.target.value)} placeholder="Mesaj içeriği" /><Button disabled={!bobiReportUserId || !bobiReportMessage.trim()} onClick={() => void submitBobiReport()}>Raporla</Button></div></div>
            </div>
            <div className="rounded-2xl border border-violet-300/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-cyan-500/5 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15"><Bot className="h-6 w-6 text-violet-500" /></div>
                <div><h2 className="font-bold">Modi · Genel sohbet moderatörü</h2><p className="text-xs text-muted-foreground">Bobi’den bağımsız çalışır. Bildirimleri ve oylamaları otomatik yönetir; kalıcı hesap engeli uygulamaz.</p></div>
              </div>
              {modi && (
                <>
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-cyan-300/20 bg-slate-950/[0.04] p-3">
                    <div className="flex h-28 w-24 shrink-0 items-end justify-center overflow-hidden rounded-xl border border-cyan-300/20 bg-gradient-to-b from-cyan-400/10 to-violet-500/10">
                      {modiAsset?.assetUrl
                        ? <img src={modiAsset.assetUrl} alt="Modi oylama görseli önizlemesi" className="h-full w-full object-contain object-bottom" />
                        : <Bot className="mb-3 h-12 w-12 text-cyan-300/70" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-semibold">Oylama paneli Modi görseli</p>
                        <p className="text-xs text-muted-foreground">Genel sohbetteki holografik oylama kartının solunda görünür. Şeffaf PNG önerilir; PNG, JPG, WEBP veya GIF, en fazla 15 MB.</p>
                      </div>
                      <input
                        ref={modiAssetInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-violet-700"
                        onChange={event => setModiAssetFile(event.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {modiAssetFile && <span className="max-w-56 truncate text-xs text-muted-foreground">{modiAssetFile.name}</span>}
                        <Button size="sm" disabled={!modiAssetFile || modiAssetSaving} onClick={() => void saveModiAsset()}>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />{modiAssetSaving ? "Yükleniyor..." : "Görseli kaydet"}
                        </Button>
                        {modiAsset?.assetUrl && <Button size="sm" variant="outline" onClick={() => void removeModiAsset()}>Görseli kaldır</Button>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-fuchsia-300/20 bg-slate-950/[0.04] p-3">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-fuchsia-300/50 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 shadow-[0_0_18px_rgba(217,70,239,0.22)]">
                      {modiAsset?.profileUrl
                        ? <img src={modiAsset.profileUrl} alt="Modi profil fotoğrafı önizlemesi" className="h-full w-full rounded-full object-cover" />
                        : <Bot className="h-9 w-9 text-fuchsia-300/80" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-semibold">Modi profil fotoğrafı</p>
                        <p className="text-xs text-muted-foreground">Mor robot simgesinin yerine ve oylama sonuçlandıktan sonra gelen Modi mesajlarının avatarında görünür. Bu fotoğraf, elini açmış asset’ten ayrıdır.</p>
                      </div>
                      <input
                        ref={modiProfileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-fuchsia-500/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-fuchsia-700"
                        onChange={event => setModiProfileFile(event.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {modiProfileFile && <span className="max-w-56 truncate text-xs text-muted-foreground">{modiProfileFile.name}</span>}
                        <Button size="sm" disabled={!modiProfileFile || modiProfileSaving} onClick={() => void saveModiProfile()}>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />{modiProfileSaving ? "Yükleniyor..." : "Profil fotoğrafını kaydet"}
                        </Button>
                        {modiAsset?.profileUrl && <Button size="sm" variant="outline" onClick={() => void removeModiProfile()}>Profil fotoğrafını kaldır</Button>}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="space-y-1 text-xs"><span>Oylama başlatmak için bildirim</span><Input type="number" min={5} max={20} value={modi.settings.reportThreshold} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, reportThreshold: Number(event.target.value) } } : current)} /></label>
                    <label className="space-y-1 text-xs"><span>Gerekli oy sayısı</span><Input type="number" min={5} max={100} value={modi.settings.pollMinVotes} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, pollMinVotes: Number(event.target.value) } } : current)} /></label>
                    <label className="space-y-1 text-xs"><span>Oylama süresi (sn)</span><Input type="number" min={30} max={600} value={modi.settings.pollDurationSeconds} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, pollDurationSeconds: Number(event.target.value) } } : current)} /></label>
                    <label className="space-y-1 text-xs"><span>Oylama evetinde susturma (dk)</span><Input type="number" min={1} max={60} value={modi.settings.muteMinutes} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, muteMinutes: Number(event.target.value) } } : current)} /></label>
                    <label className="space-y-1 text-xs"><span>24 saatte kural ihlal sınırı</span><Input type="number" min={1} max={10} value={modi.settings.warningLimit} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, warningLimit: Number(event.target.value) } } : current)} /></label>
                    <label className="space-y-1 text-xs"><span>Spam algılama aralığı (sn)</span><Input type="number" min={10} max={300} value={modi.settings.spamWindowSeconds} onChange={event => setModi(current => current ? { ...current, settings: { ...current.settings, spamWindowSeconds: Number(event.target.value) } } : current)} /></label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void saveModiSettings(modi.settings)}>Ayarları kaydet</Button>
                    <Button variant="outline" onClick={() => void saveModiSettings({ enabled: !modi.settings.enabled })}>{modi.settings.enabled ? "Modi’yi kapat" : "Modi’yi aç"}</Button>
                    <p className="self-center text-xs text-muted-foreground">Açık: {modi.settings.enabled ? "Etkin" : "Kapalı"} · Evet çoğunluğu ve en az {modi.settings.pollMinVotes} oy gerekir. Yeterli oy yoksa yaptırım uygulanmaz.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input value={modiWord} onChange={event => setModiWord(event.target.value)} placeholder="Modi yasaklı kelime listesine ekle" onKeyDown={event => event.key === "Enter" && void addModiWord()} />
                    <Button onClick={() => void addModiWord()}><Plus className="mr-1 h-4 w-4" />Kelime ekle</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modi.words.map(item => <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/5 px-3 py-1 text-xs">{item.word}<button type="button" aria-label={`${item.word} kelimesini sil`} onClick={() => void removeModiWord(item.id)}><XCircle className="h-3.5 w-3.5 text-destructive" /></button></span>)}
                    {modi.words.length === 0 && <p className="text-xs text-muted-foreground">Henüz yasaklı kelime eklenmedi.</p>}
                  </div>
                  <div className="rounded-xl border bg-card/70 p-3">
                    <p className="mb-2 text-xs font-bold">Devam eden oylamalar</p>
                    {modi.polls.length ? <div className="space-y-2">{modi.polls.map(poll => <div key={poll.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-2 text-xs"><span>@{poll.targetUsername} · {poll.yesCount} evet / {poll.noCount} hayır</span><span>{poll.voteCount}/{poll.pollMinVotes} oy · {poll.muteMinutes} dk susturma · Bitiş: {new Date(poll.endsAt).toLocaleTimeString("tr-TR")}</span></div>)}</div> : <p className="text-xs text-muted-foreground">Şu anda açık oylama yok.</p>}
                  </div>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Bobi raporları</h2><span className="text-xs text-muted-foreground">Belirsiz içerikler admin kararını bekler</span></div>{(bobi?.reports ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Bekleyen Bobi raporu yok.</p> : <div className="space-y-3">{(bobi?.reports ?? []).map(report => <div key={report.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{report.displayName} @{report.username} · {report.source === "dm" ? "DM" : "Genel sohbet"}</p><span className="text-[11px] text-muted-foreground">{new Date(report.createdAt).toLocaleString("tr-TR")}</span></div><p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-2 text-sm">{report.message}</p><p className="mt-2 text-xs text-muted-foreground">Eşleşen kelime: {report.matchedWord ?? "yok"} · Güven: {report.confidence}</p>{report.status === "open" && isAdmin && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void decideBobiReport(report.id, "mute")}>5 dk sustur</Button><Button size="sm" variant="outline" onClick={() => void decideBobiReport(report.id, "dismiss")}>Akla / kapat</Button></div>}</div>)}</div>}</div>
          </TabsContent>

          <TabsContent value="bans" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {bans.length + bannedUsers.filter(item => !bans.some(ban => ban.user?.id === item.id)).length} aktif yasak kaydı
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setIpBanOpen(true)}
              >
                <Network className="w-3.5 h-3.5" /> IP Yasakla
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={banSearch} onChange={event => setBanSearch(event.target.value)} placeholder="Kullanıcı adı veya IP ara..." className="pl-9" />
            </div>
            {visibleBannedUsers.length > 0 && (
              <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive">Yasaklı kullanıcılar</p>
                {visibleBannedUsers.map(bannedUser => (
                  <div key={bannedUser.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-destructive/10 bg-card p-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={bannedUser.avatarUrl || ""} />
                      <AvatarFallback>{bannedUser.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{bannedUser.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">@{bannedUser.username}{bannedUser.banReason ? ` · ${bannedUser.banReason}` : ""}</p>
                      <p className="text-[11px] font-semibold text-destructive">{banRemaining(bannedUser.banExpiresAt)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => handleUnban(bannedUser.id, bannedUser.username)}>
                      <UserCheck className="mr-1 h-3 w-3" /> Uygulama yasağını kaldır
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {visibleBans.map((b) => (
                <div
                  key={b.id}
                  className="bg-card border border-border rounded-xl p-3 flex items-start gap-3"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${b.ipAddress && !b.user ? "bg-orange-500/10" : "bg-destructive/10"}`}
                  >
                    {b.ipAddress && !b.user ? (
                      <Network className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Ban className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.user && (
                        <span className="font-semibold text-sm">
                          @{b.user.username}
                        </span>
                      )}
                      {b.ipAddress && (
                        <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                          {b.ipAddress}
                        </span>
                      )}
                      {b.banType && <Badge variant="outline" className="text-[10px]">{b.banType === "ip" ? "IP" : b.banType === "user_ip" ? "Kullanıcı + IP" : b.banType === "spam" ? "Spam" : b.banType === "abuse" ? "Taciz" : b.banType === "content" ? "Uygunsuz içerik" : b.banType === "dm" ? "DM yasağı" : b.banType === "chat" ? "Genel sohbet yasağı" : b.banType === "app" ? "Uygulama geneli" : "Kullanıcı"}</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(b.createdAt), {
                          locale: tr,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {b.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sebep: {b.reason}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Yasaklayan: @{b.bannedBy?.username}
                      {b.expiresAt &&
                        ` · Bitiş: ${new Date(b.expiresAt).toLocaleDateString("tr")}`}
                      {` · ${banRemaining(b.expiresAt)}`}
                    </p>
                  </div>
                    <Button
                      size="sm"
                    variant="ghost"
                      className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteBan(b.id)}
                      title={banLabel(b.banType)}
                      aria-label={banLabel(b.banType)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Kaldır</span>
                  </Button>
                </div>
              ))}
              {visibleBans.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {banSearch ? "Aramaya uygun yasak bulunamadı" : "Yasak kaydı yok"}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Etkileşimli Akış Tab ── */}
          <TabsContent value="interactive" className="space-y-4 mt-4">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-300/25 bg-[#090b16] p-4 shadow-[0_24px_80px_rgba(76,29,149,0.16)] sm:p-6">
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]"><BookOpen className="h-5 w-5" /></div>
                    <div><p className="text-base font-bold text-white">{interactiveEditingId ? "Eseri düzenle" : "Yeni seçimli kitap"}</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Kitabı normal bir eser gibi yaz; sahneler ve okur kararları hikâyenin dallanan akışını belirler.</p></div>
                  </div>
                  <Badge variant="outline" className="border-cyan-300/30 bg-cyan-300/[0.06] text-cyan-200"><Sparkles className="mr-1 h-3 w-3" />LOOP AI · SEÇİMLİ ESER</Badge>
              </div>

                <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10">01</span>Bilgiler ve kapak</div>
                      <Input placeholder="Kitabın adı" value={interactiveTitle} onChange={e => setInteractiveTitle(e.target.value)} className="h-11 border-white/10 bg-black/20 text-base font-semibold text-white placeholder:text-slate-500" />
                      <Textarea placeholder="Arka kapak yazısı / kısa tanıtım" value={interactiveSummary} onChange={e => setInteractiveSummary(e.target.value)} rows={3} maxLength={240} className="resize-y border-white/10 bg-black/20 text-sm leading-6 text-slate-200 placeholder:text-slate-500" />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-cyan-200/25 bg-cyan-200/[0.04] px-3 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/10">
                          <Upload className="h-4 w-4" />{interactiveCover ? "Kapağı değiştir" : "Kitap kapağı seç"}
                          <input type="file" accept="image/*" className="hidden" onChange={event => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setInteractiveCover(typeof reader.result === "string" ? reader.result : "");
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={interactiveStatus === "completed"} onChange={event => setInteractiveStatus(event.target.checked ? "completed" : "ongoing")} />Eser tamamlandı</label>
                        {interactiveCover && <img src={interactiveCover} alt="Kitap kapağı önizlemesi" className="h-14 w-10 rounded-md border border-white/15 object-cover" />}
                      </div>
                    </section>

                    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10">02</span>Birinci bölüm</div>
                      <Input placeholder="Bölüm başlığı" value={interactiveEventTitle} onChange={e => setInteractiveEventTitle(e.target.value)} className="border-white/10 bg-black/20 font-semibold text-white placeholder:text-slate-500" />
                      <div className="overflow-hidden rounded-2xl border border-amber-100/15 bg-[#f4eddf] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
                          <div className="flex items-center justify-between border-b border-[#4c3d2d]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#78664f]"><span>Manuscript · AI ile şekillenen anlatı</span><span>{interactiveEventText.trim().split(/\s+/).filter(Boolean).length} kelime</span></div>
                        <Textarea placeholder="Bölümünü bir kitap gibi yaz… Paragraflar, diyaloglar ve sahnenin atmosferi burada korunur." value={interactiveEventText} onChange={e => setInteractiveEventText(e.target.value)} rows={12} maxLength={20000} className="min-h-[280px] resize-y rounded-none border-0 bg-transparent px-5 py-5 font-serif text-[15px] leading-8 text-[#29251f] placeholder:text-[#8a7e6c]/70 focus-visible:ring-0 sm:px-8" />
                      </div>
                    </section>

                    <section className="space-y-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.035] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/85"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10">03</span>Okurun ilk kararı</div>
                        <p className="text-[10px] text-slate-400">Seçenekler sonraki sahnelere bağlanabilir.</p>
                      </div>
                      {interactiveOptions.map((option, index) => (
                        <div key={index} className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/15 p-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-200/10 text-xs font-black text-cyan-200">{String.fromCharCode(65 + index)}</span>
                          <Input placeholder={`Okur seçeneği ${index + 1}`} value={option.label} onChange={e => setInteractiveOptions(prev => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} className="min-w-40 flex-1 border-white/10 bg-black/20 text-white placeholder:text-slate-500" />
                          {interactiveExtraSteps.length > 0 && <Select value={option.nextStepId ?? "end"} onValueChange={value => setInteractiveOptions(prev => prev.map((item, i) => i === index ? { ...item, nextStepId: value === "end" ? null : value } : item))}><SelectTrigger className="w-40 border-white/10 bg-black/20 text-slate-200"><SelectValue placeholder="Sonraki bölüm" /></SelectTrigger><SelectContent><SelectItem value="end">Hikâyeyi bitir</SelectItem>{interactiveExtraSteps.map((step, stepIndex) => <SelectItem key={step.id} value={step.id}>{step.title || `Bölüm ${stepIndex + 2}`}</SelectItem>)}</SelectContent></Select>}
                          {interactiveOptions.length > 2 && <Button type="button" size="icon" variant="ghost" onClick={() => setInteractiveOptions(prev => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      ))}
                      {interactiveOptions.length < 6 && <Button type="button" size="sm" variant="outline" className="border-cyan-200/20 text-cyan-100 hover:bg-cyan-200/10" onClick={() => setInteractiveOptions(prev => [...prev, { label: "", nextStepId: null }])}><Plus className="mr-1 h-3.5 w-3.5" />Karar seçeneği ekle</Button>}
                    </section>

                    {interactiveExtraSteps.map((step, index) => (
                      <section key={step.id} className="space-y-3 rounded-2xl border border-violet-200/15 bg-violet-300/[0.035] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100/85"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-200/20 bg-violet-200/10">{String(index + 4).padStart(2, "0")}</span>Alternatif bölüm · seçim yolu</div>
                          <Button type="button" size="icon" variant="ghost" aria-label="Bölümü kaldır" onClick={() => setInteractiveExtraSteps(prev => prev.filter(item => item.id !== step.id))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <Input placeholder={`Bölüm ${index + 2} başlığı`} value={step.title} onChange={e => setInteractiveExtraSteps(prev => prev.map(item => item.id === step.id ? { ...item, title: e.target.value } : item))} className="border-white/10 bg-black/20 font-semibold text-white placeholder:text-slate-500" />
                        <div className="overflow-hidden rounded-2xl border border-amber-100/15 bg-[#f4eddf]">
                          <div className="flex items-center justify-between border-b border-[#4c3d2d]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#78664f]"><span>Manuscript · alternatif akış</span><span>{step.text.trim().split(/\s+/).filter(Boolean).length} kelime</span></div>
                          <Textarea placeholder="Bu karar yolunda okurun okuyacağı bölümü yaz…" value={step.text} onChange={e => setInteractiveExtraSteps(prev => prev.map(item => item.id === step.id ? { ...item, text: e.target.value } : item))} rows={9} maxLength={20000} className="min-h-[220px] resize-y rounded-none border-0 bg-transparent px-5 py-5 font-serif text-[15px] leading-8 text-[#29251f] placeholder:text-[#8a7e6c]/70 focus-visible:ring-0 sm:px-8" />
                        </div>
                        <div className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-3">
                          <p className="text-xs font-semibold text-violet-100">Bu bölümün kararları</p>
                          {step.options.map((option, optionIndex) => <div key={optionIndex} className="flex flex-wrap gap-2">
                            <Input placeholder={`Seçenek ${optionIndex + 1}`} value={option.label} onChange={e => setInteractiveExtraSteps(prev => prev.map(item => item.id === step.id ? { ...item, options: item.options.map((choice, j) => j === optionIndex ? { ...choice, label: e.target.value } : choice) } : item))} className="min-w-40 flex-1 border-white/10 bg-black/20 text-white placeholder:text-slate-500" />
                            <Select value={option.nextStepId ?? "end"} onValueChange={value => setInteractiveExtraSteps(prev => prev.map(item => item.id === step.id ? { ...item, options: item.options.map((choice, j) => j === optionIndex ? { ...choice, nextStepId: value === "end" ? null : value } : choice) } : item))}><SelectTrigger className="w-40 border-white/10 bg-black/20 text-slate-200"><SelectValue placeholder="Sonraki bölüm" /></SelectTrigger><SelectContent><SelectItem value="end">Hikâyeyi bitir</SelectItem>{interactiveExtraSteps.filter(nextStep => nextStep.id !== step.id).map((nextStep, stepIndex) => <SelectItem key={nextStep.id} value={nextStep.id}>{nextStep.title || `Alternatif bölüm ${stepIndex + 2}`}</SelectItem>)}</SelectContent></Select>
                          </div>)}
                        </div>
                      </section>
                    ))}
                    <Button type="button" disabled={interactiveExtraSteps.length >= 19} variant="outline" className="w-full border-dashed border-violet-300/30 text-violet-100 hover:bg-violet-300/10" onClick={() => setInteractiveExtraSteps(prev => [...prev, { id: `step-${Date.now()}`, title: "", text: "", options: [{ label: "", nextStepId: null }, { label: "", nextStepId: null }] }])}><Plus className="mr-1 h-4 w-4" />Alternatif bölüm ekle{interactiveExtraSteps.length >= 19 ? " · bölüm sınırına ulaşıldı" : ""}</Button>
                  </div>

                  <aside className="h-fit space-y-3 rounded-2xl border border-violet-200/15 bg-gradient-to-b from-violet-300/[0.08] to-cyan-300/[0.035] p-4 xl:sticky xl:top-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white"><Sparkles className="h-4 w-4 text-cyan-200" />Okur deneyimi</div>
                    <p className="text-xs leading-5 text-slate-400">Okur önce kitabı, bölüm metnini ve atmosferi görür. Karar anında verdiği seçim onu bağladığın yeni bölüme taşır.</p>
                    <div className="rounded-xl border border-cyan-200/15 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-cyan-100">Akış haritası</p>
                      <p className="mt-2 text-xs text-slate-300">1 başlangıç bölümü</p>
                      {interactiveExtraSteps.map((step, index) => <p key={step.id} className="mt-1 truncate text-xs text-violet-100/80">{String(index + 2).padStart(2, "0")} · {step.title || "İsimsiz alternatif bölüm"}</p>)}
                      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-slate-500">{interactiveExtraSteps.length + 1} bölüm · seçimlerle birbirine bağlanır</p>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-slate-300"><input type="checkbox" checked={interactiveStatus === "completed"} onChange={event => setInteractiveStatus(event.target.checked ? "completed" : "ongoing")} />Kitap tamamlandı</label>
                    <Button disabled={interactiveSaving || !interactiveTitle.trim() || !interactiveEventTitle.trim() || !interactiveEventText.trim()} onClick={handleCreateInteractive} className="w-full gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500"><BookOpen className="h-4 w-4" />{interactiveSaving ? "Kaydediliyor…" : interactiveEditingId ? "Kitap değişikliklerini kaydet" : "Kitabı yayınla"}</Button>
                  </aside>
                </div>
              </div>
            <div className="space-y-2">
              {interactiveStories.map(story => (
                <div key={story.id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3" onClick={() => editInteractive(story)}>
                  <GitBranch className="mt-1 h-4 w-4 shrink-0 text-violet-500" />
                  {story.cover && <img src={story.cover} alt="" className="h-12 w-9 rounded object-cover" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{story.title}</p><p className="text-xs text-muted-foreground">{story.eventTitle} · {story.options.length} seçenek · {story.status === "completed" ? "Tamamlandı" : "Devam ediyor"}</p><p className="mt-1 text-[10px] text-violet-500">Oylar: {Object.values(story.votes ?? {}).reduce((sum, count) => sum + count, 0)} · Düzenlemek için tıkla</p></div>
                  <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); void handleToggleInteractive(story.id); }}>{story.published ? "Yayından al" : "Yayınla"}</Button>
                  <Button size="icon" variant="ghost" onClick={event => { event.stopPropagation(); void handleDeleteInteractive(story.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {interactiveStories.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Henüz interaktif akış yayınlanmadı.</p>}
            </div>
          </TabsContent>

          {/* ── Yoldaşlar Tab ── */}
          <TabsContent value="companions" className="space-y-4 mt-4">
            {/* Upload formu */}
            <div className="rounded-2xl border border-border/60 p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Yeni Yoldaş Ekle
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="İsim (örn. Tilki)"
                  value={compName}
                  onChange={e => setCompName(e.target.value)}
                />
                <Input
                  placeholder="Açıklama (örn. Neşeli & Hızlı)"
                  value={compDesc}
                  onChange={e => setCompDesc(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/80 hover:border-primary/60 transition-colors text-sm text-muted-foreground">
                  <Upload className="w-4 h-4" />
                  {compFile ? compFile.name : "PNG veya video seç…"}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={e => setCompFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button
                size="sm"
                disabled={!compFile || !compName.trim() || compUploading}
                onClick={handleUploadCompanion}
                className="gap-1.5"
              >
                <PawPrint className="w-3.5 h-3.5" />
                {compUploading ? "Yükleniyor…" : "Yoldaş Ekle"}
              </Button>
            </div>

            {/* Mevcut yoldaşlar */}
            <div className="space-y-2">
              {companions.length === 0 && (
                <p className="text-center text-muted-foreground py-6 text-sm">Henüz yoldaş yok</p>
              )}
              {companions.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card transition-colors"
                  style={{ borderColor: c.published ? "hsl(var(--border) / 0.5)" : "rgba(234,179,8,0.35)" }}
                >
                  {/\.(mp4|webm|mov|m4v)(\?|$)/i.test(c.imageUrl) ? (
                    <video src={c.imageUrl} muted loop autoPlay playsInline className="w-12 h-12 object-contain rounded-xl bg-muted/30" />
                  ) : (
                    <img src={c.imageUrl} alt={c.name} className="w-12 h-12 object-contain rounded-xl bg-muted/30" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{c.name}</p>
                      {/* Yayın durumu rozeti */}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: c.published ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                          color:      c.published ? "#4ade80"              : "#fbbf24",
                        }}
                      >
                        {c.published ? "✓ Yayında" : "⬜ Taslak"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{c.description ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono">slug: {c.slug}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Yayınla / Taslağa al */}
                    {isAdmin && c.slug !== "bear" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] px-2.5 font-semibold"
                        onClick={() => handleTogglePublish(c.id, c.published)}
                      >
                        {c.published ? "Taslağa Al" : "Yayınla"}
                      </Button>
                    )}
                    {/* Sil */}
                    {isAdmin && c.slug !== "bear" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCompanion(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="xox" className="space-y-4 mt-4">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-500/5 p-5">
              <div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">⭕</div><div><h2 className="font-bold">XOX oyun yönetimi</h2><p className="text-xs text-muted-foreground">Oyunun kullanıcılar için hangi durumda görüneceğini belirle.</p></div></div>
              <Select value={xoxStatus} onValueChange={value => void saveXoxStatus(value)} disabled={xoxSaving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Yayında</SelectItem><SelectItem value="coming_soon">Yakında</SelectItem><SelectItem value="draft">Taslak / Test</SelectItem><SelectItem value="closed">Kapalı</SelectItem></SelectContent></Select>
              <div className="mt-3 rounded-xl border border-border bg-card p-3 text-sm"><strong>{xoxStatus === "published" ? "Oyuncular XOX oynayabilir." : xoxStatus === "coming_soon" ? "XOX kartı Yakında etiketiyle görünür." : xoxStatus === "draft" ? "XOX Taslak / Test etiketiyle görünür." : "XOX kullanıcılar için kapalıdır."}</strong><p className="mt-1 text-xs text-muted-foreground">Kapalı durumda yeni davet ve oyun başlatma işlemleri sunucu tarafından engellenir.</p></div>
            </div>
          </TabsContent>

          {/* ── Wordle Kelime Yönetimi ──────────────────────────────── */}
          <TabsContent value="wordle" className="space-y-4 mt-4">
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-green-500" />
                Admin Kelime Ekle
              </h3>
              <p className="text-xs text-muted-foreground">
                Eklediğin kelimeler günlük Wordle havuzuna girer. Tam 5 harf, Türkçe karakter kullanabilirsin.
              </p>
              <div className="flex gap-2">
                <Input
                  value={wordleInput}
                  onChange={e => setWordleInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleAddWord()}
                  placeholder="KELIM"
                  maxLength={5}
                  className="font-mono uppercase tracking-widest flex-1"
                />
                <Button
                  onClick={handleAddWord}
                  disabled={wordleAdding || wordleInput.trim().length !== 5}
                  className="gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {wordleAdding ? "Ekleniyor…" : "Ekle"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Admin Eklenen Kelimeler</h3>
                <Badge variant="secondary">{wordleWords.length} kelime</Badge>
              </div>
              {wordleWords.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Henüz admin kelimesi eklenmemiş.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {wordleWords.map(word => (
                    <div
                      key={word}
                      className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5"
                    >
                      <span className="font-mono text-sm font-bold tracking-widest text-green-600">{word}</span>
                      <button
                        onClick={() => handleDeleteWord(word)}
                        disabled={wordleDeleting === word}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Sil"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
                Eklenen kelimeler anında aktif olur — oyuncular doğrulamayla bu kelimeleri girebilir ve günlük çekiliş havuzuna katılır.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={warningHistoryOpen} onOpenChange={setWarningHistoryOpen}>
        <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-violet-500" />Uyarı kayıt arşivi</DialogTitle>
            <DialogDescription>Kalıcı olarak saklanan sistem ve moderatör uyarılarını zaman aralığına göre inceleyin.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <div className="min-w-44 flex-1">
              <Select value={warningHistoryPeriod} onValueChange={setWarningHistoryPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Son 24 saat</SelectItem>
                  <SelectItem value="3">Son 3 gün</SelectItem>
                  <SelectItem value="7">Son 1 hafta</SelectItem>
                  <SelectItem value="30">Son 30 gün</SelectItem>
                  <SelectItem value="90">Son 90 gün</SelectItem>
                  <SelectItem value="0">Tüm kayıtlar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={warningHistorySearch} onChange={event => setWarningHistorySearch(event.target.value)} placeholder="Kullanıcı, gerekçe veya kaynak ara" aria-label="Uyarı kayıtlarında ara" className="min-w-56 flex-1" />
            <Badge variant="outline">{moderationWarnings.filter(warning => `${warning.displayName} ${warning.username} ${warning.reason} ${warning.issuedBy}`.toLocaleLowerCase("tr-TR").includes(warningHistorySearch.trim().toLocaleLowerCase("tr-TR"))).length} kayıt</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {warningHistoryLoading ? <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">Uyarı arşivi yükleniyor…</div> :
              moderationWarnings.filter(warning => `${warning.displayName} ${warning.username} ${warning.reason} ${warning.issuedBy}`.toLocaleLowerCase("tr-TR").includes(warningHistorySearch.trim().toLocaleLowerCase("tr-TR"))).length === 0 ? (
                <div className="flex h-full min-h-40 flex-col items-center justify-center text-center"><History className="mb-2 h-7 w-7 text-muted-foreground/60" /><p className="text-sm font-semibold">Bu aralıkta uyarı kaydı bulunamadı</p><p className="mt-1 text-xs text-muted-foreground">Farklı bir tarih aralığı veya arama terimi deneyin.</p></div>
              ) : <div className="grid gap-3 md:grid-cols-2">
                {moderationWarnings.filter(warning => `${warning.displayName} ${warning.username} ${warning.reason} ${warning.issuedBy}`.toLocaleLowerCase("tr-TR").includes(warningHistorySearch.trim().toLocaleLowerCase("tr-TR"))).map(warning => (
                  <article key={warning.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-bold">{warning.displayName} <span className="font-normal text-muted-foreground">@{warning.username}</span></p><p className="mt-0.5 text-[10px] text-muted-foreground">Kayıt #{warning.id} · {new Date(warning.createdAt).toLocaleString("tr-TR")}</p></div>
                      <Badge variant="outline" className={warning.severity === "high" ? "border-destructive/40 text-destructive" : warning.severity === "medium" ? "border-amber-500/40 text-amber-600" : ""}>{warning.severity === "high" ? "Yüksek" : warning.severity === "medium" ? "Orta" : "Düşük"} önem</Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{warning.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
                      <span>{warning.source === "report_threshold" ? "Otomatik sistem" : warning.source === "admin_modi" ? "Modi / yönetici" : warning.issuedBy} · {warning.issuedBy}</span>
                      {warning.expiresAt ? <span>Bitiş: {new Date(warning.expiresAt).toLocaleString("tr-TR")}</span> : <span>Kalıcı kayıt</span>}
                    </div>
                  </article>
                ))}
              </div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!banDialogUser}
        onOpenChange={() => {
          setBanDialogUser(null);
          setBanReason("");
          setBanIp("");
        }}
      >
        <DialogContent className="rounded-2xl w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-destructive" />
              Kullanıcıyı Yasakla
            </DialogTitle>
            <DialogDescription>
              @{banDialogUser?.username} kullanıcısını yasakla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Yasak türü</label>
                <Select value={banType} onValueChange={setBanType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Hesap yasağı</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="abuse">Taciz / kötüye kullanım</SelectItem>
                    <SelectItem value="content">Uygunsuz içerik</SelectItem>
                    <SelectItem value="dm">DM yasağı</SelectItem>
                    <SelectItem value="chat">Genel sohbet yasağı</SelectItem>
                    <SelectItem value="app">Uygulama geneli yasağı</SelectItem>
                    <SelectItem value="user_ip">Hesap + IP yasağı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Süre</label>
                <Select value={banDurationDays} onValueChange={setBanDurationDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Süresiz</SelectItem>
                    <SelectItem value="1">1 gün</SelectItem>
                    <SelectItem value="7">7 gün</SelectItem>
                    <SelectItem value="30">30 gün</SelectItem>
                    <SelectItem value="365">1 yıl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Yasak Sebebi</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Kural ihlali, spam vb."
                className="resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                IP Adresi (opsiyonel)
              </label>
              <Input
                value={banIp}
                onChange={(e) => setBanIp(e.target.value)}
                placeholder="192.168.1.1"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setBanDialogUser(null)}
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-1"
                onClick={handleBan}
              >
                <Gavel className="w-4 h-4" /> Yasakla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ipBanOpen} onOpenChange={setIpBanOpen}>
        <DialogContent className="rounded-2xl w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-orange-500" />
              IP Adresi Yasakla
            </DialogTitle>
            <DialogDescription>
              Belirli bir IP adresini yasakla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">IP Adresi</label>
              <Input
                value={ipBanAddress}
                onChange={(e) => setIpBanAddress(e.target.value)}
                placeholder="192.168.1.1"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sebep</label>
              <Input
                value={ipBanReason}
                onChange={(e) => setIpBanReason(e.target.value)}
                placeholder="Spam, kötüye kullanım vb."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Yasak türü</label>
                <Select value={ipBanType} onValueChange={setIpBanType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ip">IP yasağı</SelectItem>
                    <SelectItem value="spam">Spam IP’si</SelectItem>
                    <SelectItem value="abuse">Kötüye kullanım IP’si</SelectItem>
                    <SelectItem value="dm">DM erişim IP’si</SelectItem>
                    <SelectItem value="chat">Genel sohbet IP’si</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Süre</label>
                <Select value={ipBanDurationDays} onValueChange={setIpBanDurationDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Süresiz</SelectItem>
                    <SelectItem value="1">1 gün</SelectItem>
                    <SelectItem value="7">7 gün</SelectItem>
                    <SelectItem value="30">30 gün</SelectItem>
                    <SelectItem value="365">1 yıl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIpBanOpen(false)}
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-1"
                onClick={handleIpBan}
                disabled={!ipBanAddress.trim()}
              >
                <Network className="w-4 h-4" /> IP Yasakla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
