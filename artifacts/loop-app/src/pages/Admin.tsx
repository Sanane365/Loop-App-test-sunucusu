import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  KeyRound,
  PawPrint,
  Upload,
  Plus,
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
  bannedAt: string | null;
  lastSeenAt: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface BanRecord {
  id: number;
  user: { id: number; username: string; displayName: string } | null;
  ipAddress: string | null;
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

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);

  const [bans, setBans] = useState<BanRecord[]>([]);
  const [search, setSearch] = useState("");
  // Kutucuklara tıklandığında role göre filtreleme yapmak için:
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(
    null,
  );

  const [roleFilter, setRoleFilter] = useState("all");
  const [banFilter, setBanFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [banDialogUser, setBanDialogUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banIp, setBanIp] = useState("");

  const [ipBanOpen, setIpBanOpen] = useState(false);
  const [ipBanAddress, setIpBanAddress] = useState("");
  const [ipBanReason, setIpBanReason] = useState("");

  const [resetPassUser, setResetPassUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Yoldaş yönetimi
  interface CompanionRow { id: number; slug: string; name: string; description: string | null; imageUrl: string; }
  const [companions, setCompanions] = useState<CompanionRow[]>([]);
  const [compName, setCompName] = useState("");
  const [compDesc, setCompDesc] = useState("");
  const [compFile, setCompFile] = useState<File | null>(null);
  const [compUploading, setCompUploading] = useState(false);

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
        const e = await r.json();
        toast({ title: "Hata", description: e.error, variant: "destructive" });
      }
    } finally { setCompUploading(false); }
  };

  const handleDeleteCompanion = async (id: number) => {
    if (!confirm("Bu yoldaşı silmek istediğine emin misin?")) return;
    const r = await fetch(`/api/admin/companions/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "Silindi", duration: 1500 }); fetchCompanions(); }
  };

  // Kurucu ve Admin Yetkisine Sahip E-postalar Listesi
  const adminEmails = [
    "copoglumihammetyasin@gmail.com",
    "copogluhakki@gmail.com",
    "tabiiisanane@gmail.com",
  ];
  console.log("Giriş yapan kullanıcının verisi:", user);

  // Kullanıcının e-postası listede varsa veya rolü zaten adminse yetkiyi veriyoruz
  const isAdmin = !!(user && (user.role === "admin"));

  const isMod =
    isAdmin ||
    !!(
      user?.role === "moderator"
    );

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

  useEffect(() => {
    if (isMod) { fetchAll(); fetchCompanions(); }
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
      }),
    });
    if (res.ok) {
      toast({ title: `${banDialogUser.username} yasaklandı` });
      setBanDialogUser(null);
      setBanReason("");
      setBanIp("");
      fetchAll();
    } else {
      const err = await res.json();
      toast({ title: "Hata", description: err.error, variant: "destructive" });
    }
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

  const handleResetPassword = async () => {
    if (!resetPassUser || newPassword.length < 4) return;
    try {
      const res = await fetch(`/api/admin/users/${resetPassUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        toast({ title: `✅ @${resetPassUser.username} şifresi sıfırlandı` });
        setResetPassUser(null);
        setNewPassword("");
      } else {
        toast({ title: "Hata", description: "Şifre sıfırlanamadı", variant: "destructive" });
      }
    } catch {
      toast({ title: "Hata", variant: "destructive" });
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
      body: JSON.stringify({ ipAddress: ipBanAddress, reason: ipBanReason }),
    });
    if (res.ok) {
      toast({ title: `${ipBanAddress} IP'si yasaklandı` });
      setIpBanOpen(false);
      setIpBanAddress("");
      setIpBanReason("");
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
    return "bg-secondary text-secondary-foreground border-border";
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "moderator") return "Moderatör";
    return "Kullanıcı";
  };

  // if (!isMod) return null;

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-6 max-w-3xl mx-auto">
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
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
            <TabsTrigger value="bans">Yasaklar</TabsTrigger>
            <TabsTrigger value="companions" className="flex items-center gap-1">
              <PawPrint className="w-3.5 h-3.5" />Yoldaşlar
            </TabsTrigger>
          </TabsList>

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
                            <SelectItem value="moderator">Moderatör</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {u.id !== user?.id &&
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
                            onClick={() => setBanDialogUser(u)}
                          >
                            <Gavel className="w-3 h-3" /> Yasakla
                          </Button>
                        ))}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-muted-foreground"
                          title="Şifre Sıfırla"
                          onClick={() => { setResetPassUser(u); setNewPassword(""); }}
                        >
                          <KeyRound className="w-3 h-3" />
                        </Button>
                      )}
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

          <TabsContent value="bans" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {bans.length} aktif yasak kaydı
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
            <div className="space-y-2">
              {bans.map((b) => (
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
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteBan(b.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {bans.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Yasak kaydı yok
                </p>
              )}
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
                  {compFile ? compFile.name : "PNG seç…"}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
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
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="w-12 h-12 object-contain rounded-xl bg-muted/30"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.description ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono">slug: {c.slug}</p>
                  </div>
                  {isAdmin && c.slug !== "bear" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDeleteCompanion(c.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
      {/* Şifre Sıfırlama Dialog */}
      <Dialog open={!!resetPassUser} onOpenChange={(o) => { if (!o) { setResetPassUser(null); setNewPassword(""); } }}>
        <DialogContent className="rounded-2xl w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Şifre Sıfırla
            </DialogTitle>
            <DialogDescription>
              @{resetPassUser?.username} için yeni şifre belirle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Yeni Şifre</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 4 karakter"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setResetPassUser(null); setNewPassword(""); }}>
                İptal
              </Button>
              <Button className="flex-1 gap-1" onClick={handleResetPassword} disabled={newPassword.length < 4}>
                <KeyRound className="w-4 h-4" /> Sıfırla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
