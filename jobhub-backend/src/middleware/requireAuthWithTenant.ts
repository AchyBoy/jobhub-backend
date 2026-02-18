// jobhub-backend/src/middleware/requireAuthWithTenant.ts
import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db/postgres";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const token = auth.replace("Bearer ", "");

  // 1️⃣ Verify Supabase JWT
  const { data: userData, error } = await supabase.auth.getUser(token);

  if (error || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userId = userData.user.id;

  // 2️⃣ Resolve tenant from tenant_users table
  const result = await pool.query(
    `
SELECT tenant_id, role, is_active
FROM tenant_users
WHERE user_id = $1
LIMIT 1
    `,
    [userId]
  );

if (result.rowCount === 0) {
  return res.status(403).json({ error: "User not assigned to a tenant" });
}

const { tenant_id, role, is_active } = result.rows[0];

if (!is_active) {
  return res.status(403).json({ error: "User is inactive" });
}

(req as any).user = {
  id: userId,
  tenantId: tenant_id,
  role,
};

  next();
}