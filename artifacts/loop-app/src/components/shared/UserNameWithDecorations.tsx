import type { ReactNode } from "react";
import { BadgeCheck } from "lucide-react";

type DecoratedUser = {
  displayName?: string | null;
  username?: string | null;
  badge?: string | null;
  badgeAssetUrl?: string | null;
  emblemAssetUrl?: string | null;
  badgeLabel?: string | null;
};

type Props = {
  user?: DecoratedUser | null;
  fallback?: string;
  className?: string;
  showLabel?: boolean;
  children?: ReactNode;
};

export function UserNameWithDecorations({ user, fallback = "Kullanıcı", className, showLabel = true, children }: Props) {
  const name = user?.displayName || user?.username || fallback;
  const badgeColor = user?.badgeLabel?.startsWith("Altın Tik") ? "text-amber-400" : "text-sky-500";
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className ?? ""}`}>
      {children ?? <span className="min-w-0 truncate">{name}</span>}
      {user?.badgeAssetUrl && <img src={user.badgeAssetUrl} alt="" className="inline-block h-5 w-5 shrink-0 object-contain" />}
      {!user?.badgeAssetUrl && user?.badge && user.badge !== "none" && (
        <BadgeCheck aria-label={user.badgeLabel || user.badge} className={`h-4 w-4 shrink-0 ${badgeColor}`} />
      )}
      {user?.emblemAssetUrl && <img src={user.emblemAssetUrl} alt="" className="inline-block h-5 w-5 shrink-0 object-contain" />}
      {showLabel && user?.badgeLabel && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{user.badgeLabel}</span>}
    </span>
  );
}
