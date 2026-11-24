import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, LockKeyhole, MessageCircle, Newspaper, Shield, Users } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type PrivacySettingsState = {
  privateAccount: boolean;
  allowMessages: "everyone" | "followers" | "mutuals" | "requests" | "nobody";
  followerListVisibility: "everyone" | "followers" | "only_me";
  followingListVisibility: "everyone" | "followers" | "only_me";
  bulletinAudience: "everyone" | "followers";
  mentionReplyAudience: "everyone" | "followers" | "nobody";
};

const defaults: PrivacySettingsState = {
  privateAccount: false,
  allowMessages: "everyone",
  followerListVisibility: "everyone",
  followingListVisibility: "everyone",
  bulletinAudience: "everyone",
  mentionReplyAudience: "everyone",
};

const visibilityOptions = [
  { value: "everyone", label: "Herkes", detail: "Tüm kullanıcılar görebilir" },
  { value: "followers", label: "Takipçilerim", detail: "Yalnızca seni takip edenler görebilir" },
  { value: "only_me", label: "Yalnızca ben", detail: "Bu listeyi sadece sen görebilirsin" },
] as const;

export default function PrivacySettings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrivacySettingsState>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/me/privacy", { credentials: "include", cache: "no-store" })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Gizlilik ayarları yüklenemedi");
        if (!cancelled) setSettings({ ...defaults, ...result });
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Gizlilik ayarları yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = async <K extends keyof PrivacySettingsState>(key: K, value: PrivacySettingsState[K]) => {
    const previous = settings;
    const next = { ...previous, [key]: value };
    setSettings(next);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users/me/privacy", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gizlilik ayarı kaydedilemedi");
      setSettings({ ...defaults, ...result });
      toast.success("Gizlilik ayarların kaydedildi");
    } catch (reason) {
      setSettings(previous);
      const message = reason instanceof Error ? reason.message : "Gizlilik ayarı kaydedilemedi";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const choose = <K extends keyof PrivacySettingsState>(key: K, value: PrivacySettingsState[K]) => {
    void update(key, value);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <button type="button" onClick={() => setLocation("/settings")} aria-label="Ayarlara dön" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Hesap gizliliği</h1>
          <p className="text-xs text-muted-foreground">{user?.displayName || "Gizlilik tercihlerin"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 pb-10">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary"><Shield className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Gizli hesap</h2>
              <p className="mt-1 text-sm text-muted-foreground">Açık olduğunda seni takip etmeyen kişiler profil gönderilerini göremez.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Gizli hesap"
              aria-checked={settings.privateAccount}
              disabled={loading || saving}
              onClick={() => choose("privateAccount", !settings.privateAccount)}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${settings.privateAccount ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${settings.privateAccount ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <ChoiceCard
            icon={<MessageCircle className="h-5 w-5" />}
            title="Sana kimler mesaj gönderebilir?"
            description="Takip etmeyenlerin sana yeni DM göndermesini sınırla."
            value={settings.allowMessages}
            disabled={loading || saving}
            options={[
              { value: "everyone", label: "Herkes", detail: "Herkes doğrudan mesaj gönderebilir" },
              { value: "requests", label: "İstek onayı", detail: "Mesaj isteğini kabul ettiklerin sana yazabilir" },
              { value: "followers", label: "Takipçilerim", detail: "Seni takip edenler mesaj gönderebilir" },
              { value: "mutuals", label: "Yalnızca takip ettiklerim", detail: "Yalnızca senin takip ettiğin kişiler mesaj gönderebilir" },
              { value: "nobody", label: "Hiç kimse", detail: "Yeni mesaj kabul edilmez" },
            ]}
            onChange={value => choose("allowMessages", value as PrivacySettingsState["allowMessages"])}
          />
          <ChoiceCard
            icon={<Users className="h-5 w-5" />}
            title="Takipçi listeni kimler görebilir?"
            description="Takipçi listeni görüntüleyebilecek kişileri seç."
            value={settings.followerListVisibility}
            disabled={loading || saving}
            options={visibilityOptions}
            onChange={value => choose("followerListVisibility", value as PrivacySettingsState["followerListVisibility"])}
          />
          <ChoiceCard
            icon={<Users className="h-5 w-5" />}
            title="Takip ettiklerini kimler görebilir?"
            description="Takip ettiğin hesapların listesini görüntüleyebilecek kişileri seç."
            value={settings.followingListVisibility}
            disabled={loading || saving}
            options={visibilityOptions}
            onChange={value => choose("followingListVisibility", value as PrivacySettingsState["followingListVisibility"])}
          />
          <ChoiceCard
            icon={<Newspaper className="h-5 w-5" />}
            title="Bültenlerini kimler görebilir?"
            description="Bülten gönderilerinin hedef kitlesini belirle."
            value={settings.bulletinAudience}
            disabled={loading || saving}
            options={[
              { value: "everyone", label: "Herkes", detail: "Tüm kullanıcılar görebilir" },
              { value: "followers", label: "Takipçilerim", detail: "Yalnızca seni takip edenler görebilir" },
            ]}
            onChange={value => choose("bulletinAudience", value as PrivacySettingsState["bulletinAudience"])}
          />
        </section>

        {loading && <p className="text-center text-sm text-muted-foreground">Gizlilik tercihlerin yükleniyor...</p>}
        {!loading && error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {saving && <p role="status" className="text-center text-xs text-muted-foreground">Kaydediliyor...</p>}
      </main>
    </div>
  );
}

type ChoiceOption = { value: string; label: string; detail?: string };

function ChoiceCard({ icon, title, description, value, options, disabled, onChange }: {
  icon: ReactNode;
  title: string;
  description: string;
  value: string;
  options: readonly ChoiceOption[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 ${value === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-primary" : "border-muted-foreground/50"}`}>
              {value === option.value && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>}
            </span>
            <LockKeyhole className={`h-4 w-4 ${value === option.value ? "text-primary" : "text-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
