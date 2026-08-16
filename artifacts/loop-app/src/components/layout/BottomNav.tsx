import { Link, useLocation, useSearch } from "wouter";
import { Home, Search, Clapperboard, MessageCircle, Mic, User, BookOpen, Tag, Activity, BookMarked, CalendarDays, Pen, FileText, Feather, Rss, X, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ── Kitaplık sekmesi tanımları ─────────────────────────────────────── */
const NOTEBOOK_TABS = [
  { href: "/notebook",                    label: "Kitaplar",   Icon: BookOpen,     tabParam: null          },
  { href: "/notebook?tab=categories",     label: "Kategoriler", Icon: Tag,          tabParam: "categories"  },
  { href: "/notebook?tab=akis",           label: "Akış",        Icon: Activity,     tabParam: "akis"        },
  { href: "/notebook?tab=library",        label: "Kitaplık",    Icon: BookMarked,   tabParam: "library"     },
  { href: "/notebook?tab=etkinlikler",    label: "Etkinlikler", Icon: CalendarDays, tabParam: "etkinlikler" },
];

/* ── Kalem fan-menü seçenekleri ──────────────────────────────────────── */
const PEN_ACTIONS = [
  { label: "Taslak",       Icon: FileText,        href: "/notebook/yeni?type=draft",  color: "#a78bfa" },
  { label: "Yaz",          Icon: Feather,          href: "/icerik-olustur",            color: "#f59e0b" },
  { label: "Akış Ekle",    Icon: Rss,              href: "/notebook/yeni?type=feed",   color: "#34d399" },
  { label: "Çalışmalarım", Icon: BriefcaseBusiness, href: "/notebook/calismalari",     color: "#f472b6" },
];

/* ── Fan menü bileşeni ───────────────────────────────────────────────── */
function PenFabMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* dışarı tıklayınca kapat */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-end pointer-events-auto">
      {/* Fan seçenekleri */}
      <div className="absolute bottom-[52px] left-0 flex flex-col-reverse items-start gap-2">
        {PEN_ACTIONS.map((action, i) => (
          <Link
            key={action.label}
            href={action.href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
            style={{
              opacity:    open ? 1 : 0,
              transform:  open ? "translateY(0) scale(1)" : `translateY(${(i + 1) * 8}px) scale(0.85)`,
              transition: `opacity 180ms ${i * 45}ms ease, transform 200ms ${i * 45}ms cubic-bezier(0.34,1.56,0.64,1)`,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            {/* Label chip */}
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold shadow-lg whitespace-nowrap"
              style={{ background: "rgba(15,12,25,0.88)", color: action.color, border: `1px solid ${action.color}40` }}
            >
              {action.label}
            </span>
            {/* Icon yuvası */}
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
              style={{ background: `${action.color}18`, border: `1.5px solid ${action.color}55` }}
            >
              <action.Icon className="h-4 w-4" style={{ color: action.color }} strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>

      {/* Ana kalem butonu */}
      <button
        type="button"
        title={open ? "Kapat" : "Yeni içerik"}
        onClick={() => setOpen(v => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-200/80 bg-white/75 backdrop-blur-md text-violet-600 shadow-[0_4px_18px_rgba(109,40,217,0.15)] active:scale-95 transition-all duration-200"
        style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
      >
        {open
          ? <X   className="h-5 w-5" strokeWidth={2} />
          : <Pen className="h-5 w-5" strokeWidth={1.8} />
        }
      </button>
    </div>
  );
}

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
        {/* Kalem fan menü + ana sayfa butonu — nav bar'ın hemen üstünde sabit */}
        <div className="fixed bottom-16 left-0 right-0 flex items-end justify-between px-5 pb-2 z-50 pointer-events-none md:hidden">
          <PenFabMenu />
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
      <Link href="/loops" className="p-2 -mt-6 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:scale-105 transition-transform flex flex-col items-center gap-0.5" data-testid="nav-loops">
        <Clapperboard className="w-7 h-7" />
        <span className="text-[9px] font-black tracking-wide leading-none">Loops</span>
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
