import { Bell, Menu, User, LogOut, Settings, Home, Search, MessageCircle, Mic, Mail, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();

  const isAdmin = user?.role === "admin";
  const isMod = user?.role === "moderator" || isAdmin;

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
    { href: "/", label: "Ana Sayfa", icon: Home },
    { href: "/explore", label: "Keşfet", icon: Search },
    { href: "/chat", label: "Genel Sohbet", icon: MessageCircle },
    { href: "/voice", label: "Sesli Odalar", icon: Mic },
    { href: "/notifications", label: "Bildirimler", icon: Bell },
    { href: "/dm", label: "Mesajlarım", icon: Mail },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex h-14 items-center justify-between px-4 max-w-screen-md mx-auto">
        <Link href="/" className="flex items-center gap-2" data-testid="header-logo">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            ∞
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">loop</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/notifications"
            className="relative text-muted-foreground hover:text-foreground transition-colors"
            data-testid="header-notifications"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0.5 w-2 h-2 bg-primary rounded-full" />
          </Link>

          <Link
            href="/dm"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="header-dm"
          >
            <Mail className="w-6 h-6" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="header-menu"
              >
                <Menu className="w-6 h-6" />
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
                    data-testid={`menu-link-${label}`}
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
                    data-testid="menu-link-profile"
                  >
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-medium">Profilim</span>
                  </Link>
                )}

                {isMod && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-foreground hover:bg-muted/60 transition-colors"
                    data-testid="menu-link-admin"
                  >
                    <Shield className={`w-5 h-5 ${isAdmin ? "text-destructive" : "text-blue-500"}`} />
                    <span className="font-medium">Admin Paneli</span>
                  </Link>
                )}
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
                    data-testid="menu-login"
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
