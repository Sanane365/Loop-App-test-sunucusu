import { Link, useLocation, useSearch } from "wouter";
import { Home, Search, PlusCircle, MessageCircle, Mic, User, BookOpen, Tag, Activity, BookMarked, CalendarDays, Pen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/* ── Kitaplık sekmesi tanımları ─────────────────────────────────────── */
const NOTEBOOK_TABS = [
  { href: "/notebook",                    label: "Kitaplar",   Icon: BookOpen,     tabParam: null          },
  { href: "/notebook?tab=categories",     label: "Kategoriler", Icon: Tag,          tabParam: "categories"  },
  { href: "/notebook?tab=akis",           label: "Akış",        Icon: Activity,     tabParam: "akis"        },
  { href: "/notebook?tab=library",        label: "Kitaplık",    Icon: BookMarked,   tabParam: "library"     },
  { href: "/notebook?tab=etkinlikler",    label: "Etkinlikler", Icon: CalendarDays, tabParam: "etkinlikler" },
];

export function BottomNav() {
  const [location] = useLocation();
  const search = useSearch();
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
    const currentTab = new URLSearchParams(search).get("tab");
    return (
      <>
        {/* Şeffaf kalem + ana sayfa butonları — nav bar'ın hemen üstünde sabit */}
        <div className="fixed bottom-16 left-0 right-0 flex items-end justify-between px-5 pb-2 z-50 pointer-events-none md:hidden">
          <Link href="/notebook/yeni" className="pointer-events-auto">
            <button
              type="button"
              title="Yeni kitap yaz"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-200/80 bg-white/75 backdrop-blur-md text-violet-600 shadow-[0_4px_18px_rgba(109,40,217,0.15)] active:scale-95 transition-all duration-150"
            >
              <Pen className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </Link>
          <Link href="/" className="pointer-events-auto">
            <button
              type="button"
              title="Ana sayfaya dön"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/75 backdrop-blur-md text-violet-600 shadow-[0_4px_18px_rgba(15,23,42,0.10)] active:scale-95 transition-all duration-150"
            >
              <Home className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </Link>
        </div>

        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-50 md:hidden">
        {NOTEBOOK_TABS.map(({ href, label, Icon, tabParam }) => {
          const active = tabParam === null ? currentTab === null : currentTab === tabParam;
          if (tabParam === "etkinlikler") {
            return (
              <button
                key={href}
                type="button"
                onClick={() => toast("🎉 Etkinlikler yakında sizlerle", { duration: 3000 })}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.8} />
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </button>
            );
          }
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
      </>
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
