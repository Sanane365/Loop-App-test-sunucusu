import { Link, useLocation } from "wouter";
import { Home, Search, PlusCircle, MessageCircle, Mic, User, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isMod = user?.role === "admin" || user?.role === "moderator";
  const isAdmin = user?.role === "admin";

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
      
      <Link href="/chat" className={`relative p-3 flex flex-col items-center gap-1 ${location === '/chat' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-chat">
        <MessageCircle className="w-6 h-6" />
        {/* Unread indicator mockup */}
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></span>
      </Link>
      
      <Link href="/voice" className={`p-3 flex flex-col items-center gap-1 ${location === '/voice' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-voice">
        <Mic className="w-6 h-6" />
      </Link>

      {isMod ? (
        <Link href="/admin" className={`p-3 flex flex-col items-center gap-1 ${location === '/admin' ? 'text-primary' : isAdmin ? 'text-destructive/70' : 'text-blue-500/70'}`} data-testid="nav-admin">
          <Shield className="w-6 h-6" />
        </Link>
      ) : (
        <Link href="/profile/me" className={`p-3 flex flex-col items-center gap-1 ${location.startsWith('/profile') ? 'text-primary' : 'text-muted-foreground'}`} data-testid="nav-profile">
          <User className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}
