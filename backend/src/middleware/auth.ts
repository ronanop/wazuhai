import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";

type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.cookieName] as string | undefined;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
