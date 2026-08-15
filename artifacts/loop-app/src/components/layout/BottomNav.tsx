import { Link, useLocation } from "wouter";
import { Home, Search, PlusCircle, MessageCircle, Mic, User, BookOpen, Tag, Activity, BookMarked, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

/* ── Kitaplık sekmesi tanımları ─────────────────────────────────────── */
const NOTEBOOK_TABS = [
  { href: "/notebook",            label: "Kitaplar",   Icon: BookOpen,     exact: true  },
  { href: "/notebook/kategoriler",label: "Kategoriler", Icon: Tag,          exact: false },
  { href: "/notebook/akis",       label: "Akış",        Icon: Activity,     exact: false },
  { href: "/notebook/kitaplik",   label: "Kitaplık",    Icon: BookMarked,   exact: false },
  { href: "/notebook/etkinlikler",label: "Etkinlikler", Icon: CalendarDays, exact: false },
];

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setStoryOpen(document.body.classList.contains("story-viewer-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (storyOpen) return null;

  /* ── Kitaplık modu ───────────────────────────────────────────────── */
  const isNotebook = location.startsWith("/notebook");
  if (isNotebook) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-50 md:hidden">
        {NOTEBOOK_TABS.map(({ href, label, Icon, exact }) => {
          const active = exact ? location === href : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-semibold leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  /* ── Standart mod ────────────────────────────────────────────────── */
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-50 md:hidden">
      <Link href="/" className={`p-3 flex flex-col items-center gap-1 ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-home">
        <Home className="w-6 h-6" />
      </Link>
      <Link href="/explore" className={`p-3 flex flex-col items-center gap-1 ${location === '/explore' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-explore">
        <Search className="w-6 h-6" />
      </Link>
      <Link href="/create" className="p-2 -mt-6 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:scale-105 transition-transform" data-testid="nav-create">
        <PlusCircle className="w-10 h-10" />
      </Link>
      <Link href="/chat" className={`p-3 flex flex-col items-center gap-1 ${location === '/chat' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-chat">
        <MessageCircle className="w-6 h-6" />
      </Link>
      <Link href="/voice" className={`p-3 flex flex-col items-center gap-1 ${location === '/voice' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-voice">
        <Mic className="w-6 h-6" />
      </Link>
      <Link href="/profile/me" className={`p-3 flex flex-col items-center gap-1 ${location.startsWith('/profile') ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-profile">
        <User className="w-6 h-6" />
      </Link>
    </div>
  );
}
