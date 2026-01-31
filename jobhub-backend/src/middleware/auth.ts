import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/postgres";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_JWT_SECRET) {
  throw new Error("SUPABASE_JWT_SECRET is not set in environment variables");
}

interface SupabaseTokenPayload {
  sub: string;
  email?: string;
  tenant_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    tenantId: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(
      token,
      SUPABASE_JWT_SECRET
    ) as SupabaseTokenPayload;

    if (!payload.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenant_id ?? payload.sub,
    };

    // 🔒 Ensure user exists (1 user = 1 tenant)
await pool.query(
  `
  INSERT INTO users (id, tenant_id)
  VALUES ($1, $2)
  ON CONFLICT (id) DO NOTHING
  `,
  [req.user.id, req.user.tenantId]
);

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}
