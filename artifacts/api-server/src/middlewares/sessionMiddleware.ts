import type { Request, Response, NextFunction } from "express";
import { getSessionUser, isPrivilegedUser } from "../lib/auth";
import { db } from "@workspace/db";
import { usersTable, bansTable } from "@workspace/db";
import { and, eq, or, isNull, gt } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        displayName: string;
        bio: string | null;
        avatarUrl: string | null;
        bannerUrl: string | null;
        role: string;
        isBanned: boolean;
        banReason: string | null;
        passwordHash: string;
        createdAt: Date;
      };
      sessionId?: string;
      ipAddress?: string;
    }
  }
}

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  req.ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  const authHeader = req.headers["authorization"];
  const cookieHeader = req.headers["cookie"];

  let sessionId: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    sessionId = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) sessionId = match[1];
  }

  if (sessionId) {
    req.sessionId = sessionId;
    const user = await getSessionUser(sessionId);
    if (user) {
      if (!isPrivilegedUser(user)) {
        const requestPath = req.originalUrl.split("?", 1)[0];
        const isDmRequest = requestPath.startsWith("/api/dm");
        const isChatRequest = requestPath.startsWith("/api/chat");
        const activeBans = await db.select({ banType: bansTable.banType, reason: bansTable.reason, expiresAt: bansTable.expiresAt })
          .from(bansTable)
          .where(and(
            or(eq(bansTable.userId, user.id), eq(bansTable.ipAddress, req.ipAddress)),
            or(isNull(bansTable.expiresAt), gt(bansTable.expiresAt, new Date())),
          ));
        const scopedBan = activeBans.find(ban =>
          (String(ban.banType).toLowerCase() === "dm" && isDmRequest) ||
          (String(ban.banType).toLowerCase() === "chat" && isChatRequest),
        );
        const globalBan = activeBans.find(ban => !["dm", "chat"].includes(String(ban.banType).toLowerCase()));
        const legacyGlobalBan = user.isBanned && activeBans.length === 0;
        if (legacyGlobalBan || globalBan || scopedBan) {
          const ban = scopedBan ?? globalBan;
          res.status(403).json({ error: ban?.banType === "dm" ? "dm_banned" : ban?.banType === "chat" ? "chat_banned" : "banned", reason: ban?.reason ?? user.banReason, expiresAt: ban?.expiresAt?.toISOString() ?? null });
          return;
        }
      }
      req.user = user;
      // Update lastSeenAt non-blocking
      db.update(usersTable)
        .set({ lastSeenAt: new Date(), lastIpAddress: req.ipAddress })
        .where(eq(usersTable.id, user.id))
        .catch(() => {});
    }
  }

  next();
}
