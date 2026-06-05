import type { Request, Response, NextFunction } from "express";
import { getSessionUser } from "../lib/auth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
      if (user.isBanned) {
        res.status(403).json({ error: "banned", reason: user.banReason });
        return;
      }
      req.user = user;
      // Update lastSeenAt non-blocking
      db.update(usersTable)
        .set({ lastSeenAt: new Date() })
        .where(eq(usersTable.id, user.id))
        .catch(() => {});
    }
  }

  next();
}
