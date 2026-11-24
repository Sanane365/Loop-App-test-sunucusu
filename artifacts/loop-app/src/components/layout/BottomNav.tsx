import { Link, useLocation, useSearch } from "wouter";
import { Home, Search, Clapperboard, MessageCircle, Mic, User, BookOpen, Tag, Activity, BookMarked, CalendarDays, Pen, FileText, Feather, Rss, X, BriefcaseBusiness, UserRoundPen, Eye, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/use-language";

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
  { label: "Taslak",       Icon: FileText,        href: "/notebook/calismalari?tab=draft",  color: "#a78bfa" },
  { label: "Yaz",          Icon: Feather,          href: "/icerik-olustur",            color: "#f59e0b" },
  { label: "Akış Ekle",    Icon: Rss,              href: "/notebook/yeni?type=feed",   color: "#34d399" },
  { label: "Çalışmalarım", Icon: BriefcaseBusiness, href: "/notebook/calismalari",     color: "#f472b6" },
  { label: "Benimle İlgili", Icon: UserRoundPen,    href: "/benimle-ilgili",            color: "#60a5fa" },
];

const FLOW_PEN_ACTIONS = [
  { label: "Spoiler ekle / Kitabından alıntı", Icon: Eye, href: "/create?type=book", color: "#111827" },
  { label: "Fragman ekle", Icon: Play, href: "/create?type=trailer", color: "#111827" },
  { label: "Loop editoryal yazısı", Icon: Feather, href: "/create?type=column", color: "#111827" },
  { label: "Mikro öykü ekle", Icon: Feather, href: "/create?type=micro", color: "#111827" },
];

/* ── Fan menü bileşeni ───────────────────────────────────────────────── */
function PenFabMenu({ desktop = false, actions = PEN_ACTIONS, monochrome = false }: { desktop?: boolean; actions?: typeof PEN_ACTIONS; monochrome?: boolean }) {
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
      <div className={`absolute flex gap-2 ${desktop ? "right-0 bottom-[52px] flex-col-reverse items-end" : "bottom-[52px] left-0 flex-col-reverse items-start"}`}>
        {actions.map((action, i) => (
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
              style={{ background: monochrome ? "#ffffff" : "color-mix(in srgb, hsl(var(--primary)) 16%, hsl(var(--background)))", color: monochrome ? "#111827" : "hsl(var(--primary))", border: "1px solid color-mix(in srgb, hsl(var(--primary)) 30%, transparent)" }}
            >
              {action.label}
            </span>
            {/* Icon yuvası */}
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
              style={{ background: monochrome ? "#ffffff" : "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)", border: "1.5px solid color-mix(in srgb, hsl(var(--primary)) 45%, transparent)" }}
            >
              <action.Icon className="h-4 w-4" style={{ color: monochrome ? "#111827" : "hsl(var(--primary))" }} strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>

      {/* Ana kalem butonu */}
      <button
        type="button"
        title={open ? "Kapat" : "Yeni içerik"}
        onClick={() => setOpen(v => !v)}
        className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md shadow-[0_4px_18px_rgba(15,23,42,0.15)] active:scale-95 transition-all duration-200 ${monochrome ? "border-slate-900 bg-white text-slate-950" : "border-primary/30 bg-card/75 text-primary"}`}
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

function DesktopNav({ location, search }: { location: string; search: string }) {
  const { t } = useLanguage();
  const isNotebook = location.startsWith("/notebook");
  const currentTab = new URLSearchParams(search).get("tab");

  if (isNotebook) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-12 border-t border-border bg-background/95 pb-[max(0px,env(safe-area-inset-bottom))] shadow-sm backdrop-blur-md md:block" aria-label="Kitaplık navigasyonu">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-center gap-1 px-4">
          {NOTEBOOK_TABS.map(({ href, label, Icon, tabParam }) => {
            const active = tabParam === null ? currentTab === null : currentTab === tabParam;
            if (tabParam === "etkinlikler") {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => toast("🎉 Etkinlikler yakında sizlerle", { duration: 3000 })}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.8} />
                  <span>{label}</span>
                </button>
              );
            }
            return (
              <Link key={href} href={href} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <Icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  const items = [
    { href: "/", label: t("home"), Icon: Home, active: location === "/" },
    { href: "/explore", label: t("explore"), Icon: Search, active: location === "/explore" },
    { href: "/loops", label: t("loops"), Icon: Clapperboard, active: location === "/loops", accent: true },
    { href: "/notebook", label: t("library"), Icon: BookOpen, active: location.startsWith("/notebook") },
    { href: "/chat", label: t("chat"), Icon: MessageCircle, active: location === "/chat" },
    { href: "/voice", label: t("voice"), Icon: Mic, active: location === "/voice" },
    { href: "/profile/me", label: t("profile"), Icon: User, active: location.startsWith("/profile") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-12 border-t border-border bg-background/95 pb-[max(0px,env(safe-area-inset-bottom))] shadow-sm backdrop-blur-md md:block" aria-label="Ana navigasyon">
      <div className="mx-auto flex h-full max-w-screen-xl items-center justify-center gap-1 px-4">
        {items.map(({ href, label, Icon, active, accent }) => (
          <Link
            key={href}
            href={href}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all ${
              active
                ? accent
                  ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(168,85,247,0.35)]"
                  : "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const [storyOpen, setStoryOpen] = useState(false);
  const [loopsNavHidden, setLoopsNavHidden] = useState(false);

  useEffect(() => {
    const syncState = () => {
      const sheetOpen = document.body.classList.contains("story-viewer-open")
        || document.body.classList.contains("loops-nav-hidden")
        || document.body.classList.contains("mobile-sheet-open");
      setStoryOpen(document.body.classList.contains("story-viewer-open"));
      setLoopsNavHidden(document.body.classList.contains("loops-nav-hidden") || document.body.classList.contains("mobile-sheet-open"));
      return sheetOpen;
    };

    const observer = new MutationObserver(() => {
      syncState();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    syncState();
    return () => observer.disconnect();
  }, []);

  if (storyOpen || loopsNavHidden) return null;

  const desktopNav = <DesktopNav location={location} search={search} />;

  /* ── Kitaplık modu ───────────────────────────────────────────────── */
  const isNotebook = location.startsWith("/notebook");
  if (isNotebook) {
    const currentTab = new URLSearchParams(search).get("tab");
    const isFlow = currentTab === "akis";
    return (
      <>
        {desktopNav}
        <div className="fixed right-6 top-[4.5rem] z-50 hidden md:flex">
          <PenFabMenu desktop actions={isFlow ? FLOW_PEN_ACTIONS : PEN_ACTIONS} monochrome={isFlow} />
        </div>
        {/* Kalem fan menü + ana sayfa butonu — nav bar'ın hemen üstünde sabit */}
        <div className="fixed bottom-16 left-0 right-0 flex items-end justify-between px-5 pb-2 z-50 pointer-events-none md:hidden">
          <PenFabMenu actions={isFlow ? FLOW_PEN_ACTIONS : PEN_ACTIONS} monochrome={isFlow} />
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

        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around px-2 z-40 md:hidden">
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
    <>
      {desktopNav}
      <div className="fixed bottom-0 left-0 right-0 h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-background border-t border-border flex items-center justify-around px-2 z-40 md:hidden">
        <Link href="/" className={`p-3 flex flex-col items-center gap-1 ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-home">
          <Home className="w-6 h-6" />
        </Link>
        <Link href="/explore" className={`p-3 flex flex-col items-center gap-1 ${location === '/explore' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-explore">
          <Search className="w-6 h-6" />
        </Link>
        <Link
          href="/loops"
          className="group relative flex -mt-6 flex-col items-center gap-1 rounded-[1.35rem] border border-primary/40 bg-primary px-3 py-2 text-primary-foreground shadow-[0_14px_28px_rgba(168,85,247,0.38)] transition-all duration-200 hover:brightness-110 active:scale-95"
          data-testid="nav-loops"
        >
          <span className="absolute -inset-1.5 rounded-[1.5rem] bg-violet-500/20 blur-md opacity-60" />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/12 backdrop-blur-sm">
            <Clapperboard className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="relative text-[9px] font-black tracking-[0.16em] uppercase leading-none">Loops</span>
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
    </>
  );
}
