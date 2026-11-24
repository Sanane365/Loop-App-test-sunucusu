import { useEffect, useState } from "react";
import { ArrowLeft, Ban, BellRing, ChevronRight, Flag, History, ScrollText, Search, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";

type ModerationUser = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  bannedAt: string | null;
  lastSeenAt: string | null;
};

type BanRecord = {
  id: number;
  user: { id: number; username: string; displayName: string } | null;
  banType: string | null;
  reason: string | null;
  bannedBy: { id: number; username: string } | null;
  expiresAt: string | null;
  createdAt: string;
};

type ReportRecord = {
  id: number;
  targetType: string;
  reportedUserId: number | null;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporterUsername: string | null;
  reportedUsername: string | null;
  reportedDisplayName: string | null;
  assignedUsername: string | null;
};

type WarningRecord = {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  reason: string;
  severity: string;
  source: string;
  issuedBy: string;
  createdAt: string;
};

type WarnedAccount = {
  userId: number;
  username: string;
  displayName: string;
  warningCount: number;
  lastWarningAt: string;
  latestReason: string;
  latestSeverity: string;
  latestSource: string;
};

function EmptyRecord({ icon: Icon, title, detail }: { icon: typeof Flag; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export default function AccountCenter() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isModerator = user?.role === "admin" || user?.role === "moderator";
  const [users, setUsers] = useState<ModerationUser[]>([]);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [warnedAccounts, setWarnedAccounts] = useState<WarnedAccount[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isModerator) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/users?banned=true", { credentials: "include" }),
      fetch("/api/admin/bans", { credentials: "include" }),
      fetch("/api/admin/reports", { credentials: "include" }),
      fetch("/api/admin/warnings", { credentials: "include" }),
      fetch("/api/admin/warned-users", { credentials: "include" }),
    ]).then(async ([usersResponse, bansResponse, reportsResponse, warningsResponse, warnedUsersResponse]) => {
      if (!usersResponse.ok || !bansResponse.ok || !reportsResponse.ok || !warningsResponse.ok || !warnedUsersResponse.ok) throw new Error("moderation data unavailable");
      setUsers(await usersResponse.json());
      setBans(await bansResponse.json());
      setReports(await reportsResponse.json());
      setWarnings(await warningsResponse.json());
      setWarnedAccounts(await warnedUsersResponse.json());
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [isModerator]);

  if (!isModerator) {
    return <AppLayout><div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-9 w-9 text-destructive" /><h1 className="font-bold">Yetkin yok</h1><p className="mt-2 text-sm text-muted-foreground">Bu merkez yalnızca admin ve moderatör hesaplarına açıktır.</p><Link href="/" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Ana sayfaya dön</Link></div></div></AppLayout>;
  }

  const visibleUsers = users.filter((item) => `${item.displayName} ${item.username}`.toLowerCase().includes(query.toLowerCase().trim()));
  const visibleWarnedAccounts = warnedAccounts.filter((item) => `${item.displayName} ${item.username}`.toLowerCase().includes(query.toLowerCase().trim()));
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "Süresiz";

  return (
    <AppLayout>
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
          <button type="button" onClick={() => setLocation("/")} aria-label="Geri" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Moderasyon Merkezi</h1>
            <p className="text-xs text-muted-foreground">Rol: {user?.role}</p>
          </div>
        </header>

        <main className="mx-auto max-w-2xl space-y-6 p-4">
          {loadError && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Moderasyon kayıtları yüklenemedi.</div>}

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Ban className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold">Yaptırım alan kullanıcılar</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kullanıcı ara" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
            {loading ? <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Kayıtlar yükleniyor...</div> : visibleUsers.length ? <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3">Kullanıcı</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Neden</th><th className="px-4 py-3">Bitiş</th></tr></thead><tbody>{visibleUsers.map((item) => <tr key={item.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><strong>{item.displayName}</strong><span className="ml-1 text-muted-foreground">@{item.username}</span></td><td className="px-4 py-3">{item.role}</td><td className="px-4 py-3">{item.banReason || "Belirtilmedi"}</td><td className="px-4 py-3">{formatDate(item.banExpiresAt)}</td></tr>)}</tbody></table></div> : <EmptyRecord icon={Flag} title="Aktif yaptırım yok" detail="Arama ölçütüne uyan uyarı veya yaptırım alan kullanıcı bulunamadı." />}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1"><Flag className="h-4 w-4 text-orange-500" /><h2 className="text-sm font-bold">Şikayet kuyruğu</h2><span className="ml-auto rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-600">{reports.filter((item) => item.status === "open").length} açık</span></div>
            {reports.length ? <div className="space-y-2">{reports.map((item) => <div key={item.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">#{item.id} · {item.targetType}</p>{item.reportedUserId ? <Link href={`/profile/${item.reportedUserId}`} className="mt-1 inline-flex max-w-full items-center gap-1 text-sm font-bold text-primary hover:underline"><span className="truncate">{item.reportedDisplayName || "Kullanıcı"}</span><span className="truncate font-normal">@{item.reportedUsername || "silinmiş"}</span></Link> : <p className="mt-1 text-sm font-semibold">Silinmiş kullanıcı</p>}</div><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{item.status}</span></div><div className="mt-3 rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold text-foreground">Neden: {item.reason}</p>{item.details && <p className="mt-1 text-xs leading-5 text-muted-foreground">Detay: {item.details}</p>}</div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>Bildiren: @{item.reporterUsername || "bilinmiyor"}</span><span>{formatDate(item.createdAt)}</span>{item.assignedUsername && <span>Atanan: @{item.assignedUsername}</span>}</div></div>)}</div> : <EmptyRecord icon={Flag} title="Açık şikayet yok" detail="Kullanıcılar tarafından gönderilen raporlar burada görünecek." />}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1"><BellRing className="h-4 w-4 text-violet-500" /><h2 className="text-sm font-bold">Uyarı almış hesaplar</h2><span className="ml-auto text-xs text-muted-foreground">{warnedAccounts.length} hesap</span></div>
            <p className="px-1 text-xs text-muted-foreground">Spam uyarısı, son 7 günde 30 farklı hesaptan bildirim alan kullanıcıya otomatik gönderilir. Bu uyarı tek başına yasaklama değildir.</p>
            {visibleWarnedAccounts.length ? <div className="space-y-2">{visibleWarnedAccounts.map((item) => <div key={item.userId} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/profile/${item.userId}`} className="text-sm font-semibold text-primary hover:underline">{item.displayName} <span className="font-normal text-muted-foreground">@{item.username}</span></Link><span className="rounded-full bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-700">{item.warningCount} uyarı</span></div><p className="mt-2 text-xs leading-5">{item.latestReason}</p><p className="mt-2 text-[11px] text-muted-foreground">{item.latestSource === "report_threshold" ? "Otomatik spam uyarısı" : item.latestSource === "test_preview" ? "Sistem uyarısı önizlemesi (test)" : "Moderatör uyarısı"} · Son uyarı: {formatDate(item.lastWarningAt)}</p></div>)}</div> : <EmptyRecord icon={BellRing} title="Uyarı almış hesap yok" detail="Otomatik veya moderatör kaynaklı uyarı alan hesaplar burada listelenir." />}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1"><BellRing className="h-4 w-4 text-violet-500" /><h2 className="text-sm font-bold">Uyarı kayıtları</h2><span className="ml-auto text-xs text-muted-foreground">{warnings.length} kayıt</span></div>
            {warnings.length ? <div className="space-y-2">{warnings.map((item) => <div key={item.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><Link href={`/profile/${item.userId}`} className="text-sm font-semibold text-primary hover:underline">{item.displayName} <span className="font-normal text-muted-foreground">@{item.username}</span></Link><span className="text-xs font-semibold text-violet-600">{item.severity}</span></div><p className="mt-2 text-xs">{item.reason}</p><p className="mt-2 text-[11px] text-muted-foreground">Uyarıyı veren: {item.issuedBy === "Loop sistemi" ? item.issuedBy : `@${item.issuedBy}`} · {formatDate(item.createdAt)}</p></div>)}</div> : <EmptyRecord icon={BellRing} title="Uyarı kaydı yok" detail="Verilen uyarılar kullanıcı ve moderatör bilgisiyle burada listelenecek." />}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <History className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-bold">İşlem geçmişi</h2>
            </div>
            {bans.length ? <div className="space-y-2">{bans.map((item) => <div key={item.id} className="rounded-xl border border-border bg-card p-4 text-sm"><div className="flex items-center justify-between gap-3"><strong>{item.user?.displayName || "Silinmiş kullanıcı"}</strong><span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.banType || "işlem"} · {item.reason || "Neden belirtilmedi"}</p><p className="mt-2 text-xs text-muted-foreground">İşlemi yapan: <span className="font-semibold text-foreground">@{item.bannedBy?.username || "bilinmiyor"}</span> · Bitiş: {formatDate(item.expiresAt)}</p></div>)}</div> : <EmptyRecord icon={BellRing} title="İşlem kaydı yok" detail="Henüz kaydedilmiş bir yaptırım işlemi bulunmuyor." />}
          </section>
        </main>
      </div>
    </AppLayout>
  );
}
