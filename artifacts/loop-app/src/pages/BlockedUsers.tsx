import { useEffect, useState } from "react";
import { ArrowLeft, Ban, UserRoundX } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface BlockedUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function BlockedUsers() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unblockingUserId, setUnblockingUserId] = useState<number | null>(null);

  const fetchBlockedUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users/me/blocked", { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Engellenen kullanıcılar yüklenemedi");
      setBlockedUsers(Array.isArray(result) ? result as BlockedUser[] : []);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Engellenen kullanıcılar yüklenemedi";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBlockedUsers();
  }, []);

  const unblockUser = async (blockedUser: BlockedUser) => {
    setUnblockingUserId(blockedUser.id);
    try {
      const response = await fetch(`/api/users/${blockedUser.id}/controls`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control: "blocked", enabled: false }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Engel kaldırılamadı");
      setBlockedUsers(current => current.filter(item => item.id !== blockedUser.id));
      toast.success(`@${blockedUser.username} engeli kaldırıldı`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Engel kaldırılamadı");
    } finally {
      setUnblockingUserId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <button type="button" onClick={() => setLocation("/settings")} aria-label="Ayarlara dön" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">Engellenenler</h1>
          <p className="text-xs text-muted-foreground">{user?.displayName || "Engellediğin hesaplar"}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{blockedUsers.length}</span>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-4 pb-10">
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">Engellenen kullanıcılar yükleniyor...</p>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchBlockedUsers()}>Yeniden dene</Button>
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <UserRoundX className="h-8 w-8" />
            </div>
            <p className="text-sm font-semibold">Engellenen kullanıcı yok</p>
            <p className="text-xs">Engellediğin hesaplar burada görünecek.</p>
          </div>
        ) : (
          blockedUsers.map(blockedUser => (
            <article key={blockedUser.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => setLocation(`/profile/${blockedUser.id}`)}
                aria-label={`${blockedUser.displayName} profilini görüntüle`}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={blockedUser.avatarUrl || ""} />
                  <AvatarFallback>{blockedUser.displayName?.charAt(0) || blockedUser.username.charAt(0)}</AvatarFallback>
                </Avatar>
              </button>
              <button
                type="button"
                onClick={() => setLocation(`/profile/${blockedUser.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold">{blockedUser.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">@{blockedUser.username}</span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unblockingUserId !== null}
                onClick={() => void unblockUser(blockedUser)}
                className="shrink-0"
              >
                <Ban className="h-4 w-4" />
                {unblockingUserId === blockedUser.id ? "Kaldırılıyor..." : "Engeli kaldır"}
              </Button>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
