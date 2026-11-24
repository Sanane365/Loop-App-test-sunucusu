import { useEffect, useState } from "react";
import { ArrowLeft, AtSign, Check, Users, UserRoundX } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type Audience = "everyone" | "followers" | "nobody";

const options: { value: Audience; label: string; detail: string; icon: typeof Users }[] = [
  { value: "everyone", label: "Herkes", detail: "Tüm kullanıcılar senden bahsedebilir ve içeriklerine yanıt verebilir.", icon: Users },
  { value: "followers", label: "Takipçilerim", detail: "Yalnızca seni takip eden kişiler senden bahsedebilir ve içeriklerine yanıt verebilir.", icon: AtSign },
  { value: "nobody", label: "Hiç kimse", detail: "Diğer kullanıcılar senden bahsedemez veya içeriklerine yanıt veremez.", icon: UserRoundX },
];

export default function MentionsRepliesSettings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [audience, setAudience] = useState<Audience>("everyone");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/me/privacy", { credentials: "include", cache: "no-store" })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Bahsetme ve yanıt ayarı yüklenemedi");
        if (!cancelled) setAudience(result.mentionReplyAudience ?? "everyone");
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Bahsetme ve yanıt ayarı yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const chooseAudience = async (nextAudience: Audience) => {
    if (saving || nextAudience === audience) return;
    const previous = audience;
    setAudience(nextAudience);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users/me/privacy", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentionReplyAudience: nextAudience }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Bahsetme ve yanıt ayarı kaydedilemedi");
      setAudience(result.mentionReplyAudience ?? nextAudience);
      toast.success("Bahsetme ve yanıt tercihin kaydedildi");
    } catch (reason) {
      setAudience(previous);
      const message = reason instanceof Error ? reason.message : "Bahsetme ve yanıt ayarı kaydedilemedi";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <button type="button" onClick={() => setLocation("/settings")} aria-label="Ayarlara dön" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Bahsetmeler ve yanıtlar</h1>
          <p className="text-xs text-muted-foreground">{user?.displayName || "İzin tercihlerin"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Kimler senden bahsedebilir ve yanıt verebilir?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu tercih; hikayelerde senden bahsedilmesini, hikaye yanıtlarını, gönderi yorumlarını ve Loop yanıtlarını belirler.
          </p>
        </section>

        <section className="space-y-2" aria-label="Bahsetme ve yanıt izinleri">
          {options.map(option => {
            const Icon = option.icon;
            const selected = audience === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={loading || saving}
                onClick={() => void chooseAudience(option.value)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-60 ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}
              >
                <span className={`mt-0.5 rounded-xl p-2 ${selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.detail}</span>
                </span>
                <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </section>

        {loading && <p role="status" className="text-center text-sm text-muted-foreground">Tercihin yükleniyor...</p>}
        {saving && <p role="status" className="text-center text-xs text-muted-foreground">Kaydediliyor...</p>}
        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
