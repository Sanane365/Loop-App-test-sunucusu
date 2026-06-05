import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/50 pb-16 md:pb-0">
      <Header />
      <main className="max-w-screen-md mx-auto min-h-[calc(100vh-3.5rem-4rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
