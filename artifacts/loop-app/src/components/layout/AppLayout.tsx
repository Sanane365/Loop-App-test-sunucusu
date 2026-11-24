import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children, hideHeader = false, hideBottomNav = false, fullHeight = false, wide = false, className = "" }: { children: ReactNode; hideHeader?: boolean; hideBottomNav?: boolean; fullHeight?: boolean; wide?: boolean; className?: string }) {
  return (
    <div className={`${className} ${fullHeight ? "h-[100dvh] min-h-0 overflow-hidden" : "min-h-screen overflow-x-hidden"} ${hideHeader ? "bg-[#050611]" : "bg-secondary/50"} ${hideBottomNav || fullHeight ? "" : "pb-16 md:pb-16"}`}>
      {!hideHeader && <Header />}
      <main className={`${wide ? "w-full" : "max-w-screen-md mx-auto"} ${fullHeight ? "h-full min-h-0" : `min-h-[calc(100vh-3.5rem-4rem)]`} ${hideHeader && !fullHeight ? "min-h-screen" : ""}`}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
