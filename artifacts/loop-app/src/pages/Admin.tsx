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
    console.log("fetchAll tetiklendi!"); // Bunu ekle
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      setUsers(data.data ?? data);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMod) fetchAll();
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

  const handleChangeRole = async (userId: number, role: string) => {
    setUsers((prevUsers) => {
      const updated = prevUsers.map((u) =>
        u.id === userId ? { ...u, role: role } : u,
      );
      localStorage.setItem("loop_test_users", JSON.stringify(updated));
      return updated;
    });

    toast({
      title: "Rol güncellendi",
      description: `Kullanıcı rolü local hafızada '${role}' yapıldı ve kaydedildi.`,
    });
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
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
            <TabsTrigger value="bans">Yasaklar</TabsTrigger>
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
    </AppLayout>
  );
}
