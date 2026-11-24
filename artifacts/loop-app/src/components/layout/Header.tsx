import { Bell, BookOpen, Search, User, LogOut, Home, MessageCircle, Mic, Mail, Shield, Bookmark, Moon, Sun, Menu, Settings as SettingsIcon, ScrollText, Globe2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { LANGUAGES, useLanguage } from "@/hooks/use-language";

interface HeaderProps {
  feedType?: "akis" | "takipte";
  onFeedChange?: (type: "akis" | "takipte") => void;
}

export function Header({ feedType, onFeedChange }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { language, setLanguage, t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const userEmail = (user as (typeof user & { email?: string | null }) | null)?.email;

  const adminEmails = new Set([
    "copoglumihammetyasin@gmail.com",
    "copogluhakki@gmail.com",
    "tabiiisanane@gmail.com",
  ]);
  const adminUsernames = new Set(["mami", "mami denemee"]);
  const isPrivilegedEmail = !!userEmail && adminEmails.has(userEmail.toLowerCase());
  const isPrivilegedUsername = !!user?.username && adminUsernames.has(user.username.toLowerCase());
  const isMod = !!(user && (user.role === "admin" || user.role === "moderator" || isPrivilegedEmail || isPrivilegedUsername));
  const canSeeModerationCenter = user?.role === "admin" || user?.role === "moderator";
  const isAdmin = user?.role === "admin" || isPrivilegedEmail || isPrivilegedUsername;

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      fetch("/api/notifications/unread-count")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.count ?? 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setOpen(false);
        setLocation("/login");
      },
    });
  }

  const navItems = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/explore", label: t("explore"), icon: Search },
    { href: "/chat", label: t("chat"), icon: MessageCircle },
    { href: "/voice", label: t("voice"), icon: Mic },
    { href: "/notifications", label: t("notifications"), icon: Bell },
    { href: "/dm", label: t("messages"), icon: Mail },
    { href: "/bookmarks", label: t("bookmarks"), icon: Bookmark },
    { href: "/settings", label: t("settings"), icon: SettingsIcon },
  ];

  if (isMod) {
    navItems.push({ href: "/admin", label: t("admin"), icon: Shield });
  }

  const isHome = location === "/";

  return (
    <header
      className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border"
      style={{
        paddingTop: "var(--safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-4 max-w-screen-md mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0" data-testid="header-logo">
          <img src="/loop-app-logo.png" alt="Loop App" className="h-8 w-8 rounded-2xl border border-primary/30 object-cover shadow-sm" />
          <span className="text-xl font-bold tracking-tight text-foreground">loop</span>
        </Link>

        {/* Center: spacer */}
        {isHome ? (
          <div />
        ) : (
          <div />
        )}

        {/* Right icons */}
        <div className="flex items-center gap-4">
          {canSeeModerationCenter && (
            <Link
              href="/account-center"
              className="text-muted-foreground transition-colors hover:text-foreground"
              data-testid="header-account-center"
              aria-label="Moderasyon merkezi"
              title="Moderasyon merkezi"
            >
              <ScrollText className="h-5 w-5" />
            </Link>
          )}
          <Link
            href="/notebook"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="header-notebook"
          >
            <BookOpen className="w-5 h-5" />
          </Link>

          <Link
            href="/notifications"
            className="relative text-muted-foreground hover:text-foreground transition-colors"
            data-testid="header-notifications"
            onClick={() => setUnreadCount(0)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </Link>

          <Link
            href="/dm"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="header-dm"
          >
            <Mail className="w-5 h-5" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="header-menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 p-0 flex flex-col">
              <SheetHeader className="p-5 border-b border-border">
                <SheetDescription className="sr-only">Gezinme menüsü</SheetDescription>
                <SheetTitle className="text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        user?.displayName?.charAt(0).toUpperCase() ?? "?"
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate">{user?.displayName ?? "Misafir"}</span>
                      {user?.username && (
                        <span className="text-sm text-muted-foreground">@{user.username}</span>
                      )}
                      {isMod && (
                        <span className={`text-[10px] font-semibold ${isAdmin ? "text-destructive" : "text-blue-500"}`}>
                          {isAdmin ? "Admin" : "Moderatör"}
                        </span>
                      )}
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 py-3 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{label}</span>
                  </Link>
                ))}

                {user && (
                  <Link
                    href="/profile/me"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-medium">Profilim</span>
                  </Link>
                )}

                <button
                  onClick={toggleDark}
                  className="w-full flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted/60 transition-colors"
                >
                  {dark ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
                  <span className="font-medium">{dark ? "Açık Tema" : "Koyu Tema"}</span>
                </button>

                <label className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted/60 transition-colors">
                  <Globe2 className="w-5 h-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 font-medium">{t("language")}</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    aria-label={t("language")}
                    className="max-w-28 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {LANGUAGES.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </nav>

              <div className="border-t border-border p-3">
                {user ? (
                  <button
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors font-medium"
                    data-testid="menu-logout"
                  >
                    <LogOut className="w-5 h-5" />
                    {logout.isPending ? "Çıkış yapılıyor..." : "Çıkış Yap"}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium justify-center"
                  >
                    Giriş Yap
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
