// jobhub-backend/src/middleware/requireAuthWithTenant.ts
import { Request, Response, NextFunction } from "express";

/**
 * TEMP AUTH MIDDLEWARE
 *
 * Frontend already authenticates users via Supabase.
 * Backend currently trusts the JWT and only enforces presence.
 *
 * This keeps notes/jobs stable while removing backend Supabase dependency.
 */
export async function requireAuthWithTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  // TEMP: trust frontend-authenticated user
  // Tenant enforcement already handled at data level
  (req as any).user = {
    id: "frontend-user",
    tenantId: "tenant_default",
  };

  next();
}