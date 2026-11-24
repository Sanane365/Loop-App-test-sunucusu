import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Archive, Bell, ChevronRight, Globe2, Lock, MessageCircle, Moon, Shield, Sun, UserX, BadgeCheck, Award, Frame, Palette, ImagePlus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLocation } from "wouter";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListStoriesQueryKey } from "@workspace/api-client-react";
import { SYSTEM_COLORS, useSystemColor, type SystemColorId } from "@/hooks/use-system-color";
import { LANGUAGES, useLanguage } from "@/hooks/use-language";

type SettingKey = "interactions" | "chatLock" | "doubleTap";
function readSetting(key: SettingKey, fallback: boolean) {
  return localStorage.getItem(`loop-setting-${key}`) === null ? fallback : localStorage.getItem(`loop-setting-${key}`) === "true";
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { color, setColor } = useSystemColor();
  const { language, setLanguage, t } = useLanguage();
  const [section, setSection] = useState<string | null>(null);
  const [timeline, setTimeline] = useState(() => localStorage.getItem("loop-timeline") || "recommended");
  const [settings, setSettings] = useState<Record<SettingKey, boolean>>({ interactions: readSetting("interactions", true), chatLock: readSetting("chatLock", false), doubleTap: readSetting("doubleTap", true) });
  const [doubleTapEmoji, setDoubleTapEmoji] = useState(() => localStorage.getItem("loop-setting-doubleTapEmoji") || "❤️");
  const [blockedCount, setBlockedCount] = useState(0);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [savingStoryPreview, setSavingStoryPreview] = useState(false);
  const [decorations, setDecorations] = useState({ badgeVisible: true, emblemVisible: true, avatarFrameVisible: true, badgeAssetUrl: null as string | null, emblemAssetUrl: null as string | null, avatarFrameAssetUrl: null as string | null });

  useEffect(() => {
    if (!user) return;
    fetch("/api/users/me/profile", { credentials: "include", cache: "no-store" }).then(response => response.ok ? response.json() : null).then(profile => {
      if (profile) {
        setDecorations(current => ({ ...current, ...profile }));
        setStoryPreviewUrl(profile.storyPreviewUrl ?? null);
      }
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/users/me/blocked", { credentials: "include", cache: "no-store" })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Engellenen kullanıcılar yüklenemedi");
        if (Array.isArray(result)) setBlockedCount(result.length);
      })
      .catch(reason => toast.error(reason instanceof Error ? reason.message : "Engellenen kullanıcı sayısı yüklenemedi"));
  }, [user]);

  const updateDecorationVisibility = async (key: "badgeVisible" | "emblemVisible" | "avatarFrameVisible", value: boolean) => {
    const next = { ...decorations, [key]: value };
    setDecorations(next);
    const response = await fetch("/api/users/me/decorations", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ badgeVisible: next.badgeVisible, emblemVisible: next.emblemVisible, avatarFrameVisible: next.avatarFrameVisible }) });
    if (!response.ok) { setDecorations(decorations); toast.error("Dekorasyon ayarı kaydedilemedi"); }
  };

  const updateSetting = (key: SettingKey, value: boolean) => {
    setSettings(current => ({ ...current, [key]: value }));
    localStorage.setItem(`loop-setting-${key}`, String(value));
  };
  const saveStoryPreview = async (file: File) => {
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!supportedTypes.includes(file.type)) {
      toast.error("JPG, PNG, WebP veya GIF görseli seçmelisin");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Hikaye kapağı en fazla 10 MB olabilir");
      return;
    }

    setSavingStoryPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/users/me/story-cover", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.storyPreviewUrl !== "string") {
        throw new Error(result.error || "Hikaye kapağı kaydedilemedi");
      }
      setStoryPreviewUrl(result.storyPreviewUrl);
      await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      toast.success("Hikaye ön izleme kapağın kaydedildi");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Hikaye kapağı kaydedilemedi");
    } finally {
      setSavingStoryPreview(false);
    }
  };
  const removeStoryPreview = async () => {
    setSavingStoryPreview(true);
    try {
      const response = await fetch("/api/users/me/story-cover", {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Hikaye kapağı kaldırılamadı");
      setStoryPreviewUrl(null);
      await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      toast.success("Özel hikaye kapağın kaldırıldı");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Hikaye kapağı kaldırılamadı");
    } finally {
      setSavingStoryPreview(false);
    }
  };
  const savePassword = async () => {
    if (newPassword.length < 6) { toast.error("Yeni şifre en az 6 karakter olmalı"); return; }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { toast.error(data.error || "Şifre değiştirilemedi"); return; }
      setCurrentPassword(""); setNewPassword(""); toast.success("Şifren değiştirildi");
    } finally { setSavingPassword(false); }
  };
  const setLanguageValue = (value: string) => {
    if (!LANGUAGES.some(languageOption => languageOption.value === value)) return;
    setLanguage(value);
    toast.success(`${LANGUAGES.find(languageOption => languageOption.value === value)?.label} dili kaydedildi`);
  };
  const setTimelineValue = (value: string) => { setTimeline(value); localStorage.setItem("loop-timeline", value); toast.success("Timeline sırası kaydedildi"); };
  const singleColors = SYSTEM_COLORS.filter(item => item.mode === "solid");
  const gradientColors = SYSTEM_COLORS.filter(item => item.mode === "gradient");

  const rows = [
    { id: "archive", label: "Arşiv", detail: "Hikayeler ve DM anlık paylaşımları", icon: Archive },
    { id: "story-cover", label: "Hikaye ön izleme kapağı", detail: storyPreviewUrl ? "Özel kapağın kullanılıyor" : "Galeriden kapak seç", icon: ImagePlus },
    { id: "notifications", label: "Bildirimler", detail: "Bildirim tercihleri", icon: Bell },
    { id: "privacy", label: "Hesap gizliliği", detail: "Profil, mesaj ve paylaşım izinleri", icon: Shield },
    { id: "blocked", label: "Engellenenler", detail: `${blockedCount} kullanıcı`, icon: UserX },
    { id: "decorations", label: "Rozet, çerçeve ve amblem", detail: "Profil süslemeleri", icon: BadgeCheck },
    { id: "memberships", label: "Üyelik paketleri", detail: "Premium Yazar, Mavi Tik ve Altın Tik", icon: Award },
    { id: "interactions", label: "Etkileşimler", detail: settings.interactions ? "Açık" : "Kapalı", icon: MessageCircle },
    { id: "mentions", label: "Bahsetmeler & yanıtlar", detail: "Kimler bahsedip yanıt verebilir?", icon: MessageCircle },
    { id: "password", label: "Şifre değiştir", detail: "Hesap güvenliği", icon: Lock },
    { id: "two-factor", label: "İki adımlı doğrulama", detail: "Yakında kullanıma açılacak", icon: Shield },
    { id: "chat-lock", label: "Sohbet kilidi", detail: settings.chatLock ? "Açık" : "Kapalı", icon: Lock },
    { id: "double-tap", label: "Çift tık tepkisi", detail: settings.doubleTap ? doubleTapEmoji : "Kapalı", icon: Bell },
    { id: "appearance", label: t("appearance"), detail: `${dark ? t("dark") : t("light")} tema · ${SYSTEM_COLORS.find(item => item.id === color)?.label}`, icon: dark ? Moon : Sun },
    { id: "language", label: t("language"), detail: LANGUAGES.find(languageOption => languageOption.value === language)?.label || "Türkçe", icon: Globe2 },
    { id: "timeline", label: "Timeline sırası", detail: timeline === "latest" ? "En yeni" : "Önerilen", icon: ChevronRight },
  ];

  const renderSection = (id: string) => {
    if (id === "notifications") return <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm">Bildirimler merkezi bildirim sayfasından yönetilir.</p><button type="button" onClick={() => setLocation("/notifications")} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Bildirimleri aç</button></div>;
    if (id === "story-cover") return <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Galeriden seçtiğin görsel, hikaye kartında son paylaştığın hikayenin yerine görünür. Bu kapağı diğer kullanıcılar da görür; hikayenin içeriği değişmez.</p>
      <div className="flex items-center gap-4">
        <div className="h-36 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
          {storyPreviewUrl
            ? <img src={storyPreviewUrl} alt="Hikaye kartı ön izleme kapağı" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">Son hikayen kullanılacak</div>}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label className={`cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground ${savingStoryPreview ? "pointer-events-none opacity-50" : ""}`}>
            {savingStoryPreview ? "Kaydediliyor..." : storyPreviewUrl ? "Kapağı değiştir" : "Galeriden kapak seç"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={savingStoryPreview}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void saveStoryPreview(file);
                event.target.value = "";
              }}
            />
          </label>
          {storyPreviewUrl && <button type="button" disabled={savingStoryPreview} onClick={() => void removeStoryPreview()} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Özel kapağı kaldır</button>}
          <span className="text-xs text-muted-foreground">JPG, PNG, WebP veya GIF · En fazla 10 MB</span>
        </div>
      </div>
    </div>;
    if (id === "decorations") return <div className="space-y-2 rounded-xl border border-border bg-card p-4"><p className="mb-3 text-sm text-muted-foreground">Sana verilen profil süslemelerinden hangilerinin görüneceğini seç.</p><DecorationOption icon={<BadgeCheck className="h-4 w-4" />} label="Rozet / Tik" imageUrl={decorations.badgeAssetUrl} assigned={Boolean(decorations.badgeAssetUrl)} value={decorations.badgeVisible} onChange={value => void updateDecorationVisibility("badgeVisible", value)} /><DecorationOption icon={<Award className="h-4 w-4" />} label="Amblem / Başarı rozeti" imageUrl={decorations.emblemAssetUrl} assigned={Boolean(decorations.emblemAssetUrl)} value={decorations.emblemVisible} onChange={value => void updateDecorationVisibility("emblemVisible", value)} /><DecorationOption icon={<Frame className="h-4 w-4" />} label="Tik çerçevesi" imageUrl={decorations.avatarFrameAssetUrl} assigned={Boolean(decorations.avatarFrameAssetUrl)} value={decorations.avatarFrameVisible} onChange={value => void updateDecorationVisibility("avatarFrameVisible", value)} /></div>;
    if (id === "interactions") return <Toggle label="Etkileşimlere izin ver" value={settings.interactions} onChange={value => updateSetting("interactions", value)} />;
    if (id === "double-tap") return <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <Toggle label="Çift tık tepkisini etkinleştir" value={settings.doubleTap} onChange={value => updateSetting("doubleTap", value)} />
      <div>
        <p className="mb-2 text-sm font-semibold">Çift tıkta kullanılacak emoji</p>
        <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
          <input
            type="text"
            inputMode="text"
            aria-label="Çift tık emojisi"
            value={doubleTapEmoji}
            onChange={event => {
              setDoubleTapEmoji(event.target.value);
              localStorage.setItem("loop-setting-doubleTapEmoji", event.target.value);
            }}
            className="min-w-0 flex-1 bg-transparent text-3xl focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">Klavyeden emoji seç</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Telefonunun emoji klavyesinden istediğin emojiyi seç. Genel sohbet ve DM’de çift tık bu emojiyi kullanır.</p>
      </div>
    </div>;
    if (id === "password") return <div className="space-y-3 rounded-xl border border-border bg-card p-4"><input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Mevcut şifre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Yeni şifre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /><button type="button" disabled={savingPassword || !currentPassword} onClick={() => void savePassword()} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{savingPassword ? "Kaydediliyor..." : "Şifreyi değiştir"}</button></div>;
    if (id === "two-factor") return <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">İki adımlı doğrulama altyapısı hazırlanıyor. Bu seçenek hazır olduğunda burada etkinleştirilecek.</div>;
    if (id === "chat-lock") return <Toggle label="Sohbet kilidini etkinleştir" value={settings.chatLock} onChange={value => updateSetting("chatLock", value)} />;
    if (id === "appearance") return <div className="space-y-4 rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{dark ? "Koyu tema" : "Açık tema"}</span><button type="button" onClick={toggleDark} className="rounded-lg border border-border px-3 py-2 text-sm">Değiştir</button></div><div className="space-y-4"><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4 text-primary" /> Tek renkler</div><div className="grid grid-cols-2 gap-2">{singleColors.map(option => <ColorOption key={option.id} option={option} selected={color === option.id} onSelect={next => { setColor(next); toast.success(`${option.label} rengi uygulandı`); }} />)}</div></div><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4 text-primary" /> Üçlü geçişli paletler</div><div className="grid grid-cols-2 gap-2">{gradientColors.map(option => <ColorOption key={option.id} option={option} selected={color === option.id} onSelect={next => { setColor(next); toast.success(`${option.label} paleti uygulandı`); }} />)}</div></div></div></div>;
    if (id === "language") return <select value={language} onChange={event => setLanguageValue(event.target.value)} aria-label="Uygulama dili" className="w-full rounded-xl border border-border bg-card p-4 text-sm">{LANGUAGES.map(languageOption => <option key={languageOption.value} value={languageOption.value}>{languageOption.label}</option>)}</select>;
    if (id === "timeline") return <select value={timeline} onChange={event => setTimelineValue(event.target.value)} className="w-full rounded-xl border border-border bg-card p-4 text-sm"><option value="recommended">Önerilen sıralama</option><option value="latest">En yeni önce</option></select>;
    return null;
  };

  return <AppLayout><div className="min-h-screen bg-background pb-24"><header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur"><button type="button" onClick={() => setLocation("/")} aria-label="Geri" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="text-lg font-bold">Ayarlar</h1><p className="text-xs text-muted-foreground">{user?.displayName || "Hesabın"}</p></div></header><main className="mx-auto max-w-2xl space-y-3 p-4">
    {rows.map(row => { const Icon = row.icon; const isFullPage = row.id === "archive" || row.id === "privacy" || row.id === "mentions" || row.id === "blocked" || row.id === "memberships"; return <div key={row.id} className="space-y-2"><button type="button" onClick={() => isFullPage ? setLocation(row.id === "archive" ? "/archive" : row.id === "privacy" ? "/privacy" : row.id === "mentions" ? "/mentions-replies" : row.id === "blocked" ? "/blocked-users" : "/memberships") : setSection(section === row.id ? null : row.id)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/50"><Icon className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1"><strong className="block text-sm">{row.label}</strong><small className="text-xs text-muted-foreground">{row.detail}</small></span><ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${section === row.id ? "rotate-90" : ""}`} /></button>{!isFullPage && section === row.id && renderSection(row.id)}</div>; })}
  </main></div></AppLayout>;
}

function ColorOption({ option, selected, onSelect }: { option: typeof SYSTEM_COLORS[number]; selected: boolean; onSelect: (value: SystemColorId) => void }) {
  return <button type="button" onClick={() => onSelect(option.id)} className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
    <span className="flex h-6 w-9 shrink-0 overflow-hidden rounded-full"><span className="flex-1" style={{ backgroundColor: option.swatches[0] }} /><span className="flex-1" style={{ backgroundColor: option.swatches[1] }} /><span className="flex-1" style={{ backgroundColor: option.swatches[2] }} /></span>
    <span className="min-w-0"><strong className="block text-xs">{option.label}</strong><small className="block truncate text-[10px] text-muted-foreground">{option.description}</small></span>
  </button>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4"><span className="text-sm font-semibold">{label}</span><button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} /></button></div>; }

function DecorationOption({ icon, label, imageUrl, assigned, value, onChange }: { icon: ReactNode; label: string; imageUrl: string | null; assigned: boolean; value: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="text-primary">{icon}</span>{imageUrl ? <img src={imageUrl} alt="" className="h-7 w-7 object-contain" /> : <span className="h-7 w-7 rounded-md bg-muted" /> }<span className="min-w-0 flex-1 text-sm font-semibold">{label}<small className="block text-xs font-normal text-muted-foreground">{assigned ? "Atandı" : "Henüz atanmadı"}</small></span><Toggle label="" value={assigned && value} onChange={onChange} /></div>; }
