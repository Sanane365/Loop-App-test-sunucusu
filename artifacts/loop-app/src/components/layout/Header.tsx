import { Bell, Menu } from "lucide-react";
import { Link } from "wouter";

export function Header() {
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
          <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground transition-colors" data-testid="header-notifications">
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0.5 w-2 h-2 bg-primary rounded-full"></span>
          </Link>
          <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="header-menu">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
