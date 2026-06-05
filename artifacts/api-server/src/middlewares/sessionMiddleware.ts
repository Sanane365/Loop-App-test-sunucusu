import type { Request, Response, NextFunction } from "express";
import { getSessionUser } from "../lib/auth";

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
        passwordHash: string;
        createdAt: Date;
      };
      sessionId?: string;
    }
  }
}

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
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
      req.user = user;
    }
  }

  next();
}
