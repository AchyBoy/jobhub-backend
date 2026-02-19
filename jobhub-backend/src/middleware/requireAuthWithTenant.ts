// jobhub-backend/src/middleware/requireAuthWithTenant.ts
import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db/postgres";

console.log("AUTH MIDDLEWARE HIT");

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


// 🔎 Load user record (for session enforcement)
const userResult = await pool.query(
  `
SELECT tenant_id, active_session_id, must_change_password
FROM users
WHERE id = $1
LIMIT 1
  `,
  [userId]
);

if (userResult.rowCount === 0) {
  return res.status(403).json({ error: "User record not found" });
}

const { tenant_id, active_session_id, must_change_password } = userResult.rows[0];

// 🔐 Read device session header
const deviceSession = req.headers["x-device-session"] as string | undefined;

if (!deviceSession) {
  return res.status(401).json({
    error: "Missing device session",
    code: "SESSION_MISSING"
  });
}

// 🔒 Soft single-device enforcement
console.log("SESSION CHECK", {
  userId,
  active_session_id,
  deviceSession
});

if (!active_session_id) {
  // first login
  await pool.query(
    `
    UPDATE users
    SET active_session_id = $1
    WHERE id = $2
    `,
    [deviceSession, userId]
  );
} 

else if (active_session_id !== deviceSession) {
  return res.status(401).json({
    error: "Another device is already logged in",
    code: "SESSION_CONFLICT"
  });
}

// Now resolve role from tenant_users
const result = await pool.query(
  `
  SELECT role, is_active
  FROM tenant_users
  WHERE tenant_id = $1
  AND user_id = $2
  LIMIT 1
  `,
  [tenant_id, userId]
);

if (result.rowCount === 0) {
  return res.status(403).json({ error: "User not assigned to tenant" });
}

const { role, is_active } = result.rows[0];

if (!is_active) {
  return res.status(403).json({ error: "User is inactive" });
}

(req as any).user = {
  id: userId,
  tenantId: tenant_id,
  role,
  mustChangePassword: must_change_password === true,
};

  next();
}