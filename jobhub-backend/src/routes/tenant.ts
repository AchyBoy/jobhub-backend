//JobHub/ jobhub-backend/src/routes/tenant.ts
import { Router } from "express";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import crypto from "crypto";

const router = Router();

/**
 * This route must be protected by auth.
 * NOTE: requireAuthWithTenant currently FAILS if user has no tenant.
 * So for routes that create the first tenant, we should use a lighter auth middleware
 * that validates Supabase JWT but does NOT require tenant assignment.
 *
 * For now, we’ll implement that inline here via a small helper:
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAuthNoTenant(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = auth.replace("Bearer ", "");
  const { data: userData, error } = await supabase.auth.getUser(token);

  if (error || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = { id: userData.user.id };
  next();
}

/**
 * GET /api/me
 * Bootstraps user row if missing.
 * Determines whether tenant provisioning is required.
 */
router.get("/me", requireAuthNoTenant, async (req: any, res) => {
  const userId = req.user.id;

  // 1️⃣ Ensure user row exists (bootstrap)
  let userRecord = await pool.query(
    `
    SELECT tenant_id, must_change_password
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (userRecord.rowCount === 0) {
    await pool.query(
      `
      INSERT INTO users (id)
      VALUES ($1)
      `,
      [userId]
    );

    userRecord = await pool.query(
      `
      SELECT tenant_id, must_change_password
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );
  }

  const tenantId = userRecord.rows[0].tenant_id;

  // 2️⃣ No tenant assigned yet → needs company creation
  if (!tenantId) {
    return res.json({
      userId,
      needsCompany: true,
      tenantId: null,
      role: null,
      tenantName: null,
      mustChangePassword: false,
    });
  }

  // 3️⃣ Load role from tenant_users
  const roleResult = await pool.query(
    `
    SELECT role, is_active
    FROM tenant_users
    WHERE tenant_id = $1
    AND user_id = $2
    LIMIT 1
    `,
    [tenantId, userId]
  );

  if (roleResult.rowCount === 0) {
    return res.json({
      userId,
      needsCompany: true,
      tenantId: null,
      role: null,
      tenantName: null,
      mustChangePassword: false,
    });
  }

  return res.json({
    userId,
    needsCompany: false,
    tenantId,
    role: roleResult.rows[0].role,
    tenantName: null,
    mustChangePassword:
      userRecord.rows[0].must_change_password === true,
  });
});

/**
 * POST /api/tenant/create
 * Body: { name: string }
 * Creates tenant + assigns current user as owner.
 */
router.post("/create", requireAuthNoTenant, async (req: any, res) => {
  const userId = req.user.id;
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "Missing company name" });
  }

  // If already assigned, return existing tenant (idempotent)
  const existing = await pool.query(
    `
    SELECT tenant_id
    FROM tenant_users
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (existing.rowCount > 0) {
    return res.json({
      alreadyProvisioned: true,
      tenantId: existing.rows[0].tenant_id,
    });
  }

  const tenantId = `tenant_${crypto.randomUUID()}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2)`,
      [tenantId, name]
    );

    // users table is minimal in your schema (id, tenant_id, created_at)
    await client.query(
      `
      INSERT INTO users (id, tenant_id)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
      `,
      [userId, tenantId]
    );

    await client.query(
      `
      INSERT INTO tenant_users (tenant_id, user_id, role)
      VALUES ($1, $2, 'owner')
      `,
      [tenantId, userId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      tenantId,
      role: "owner",
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ tenant/create failed", e);
    return res.status(500).json({ error: "Failed to create tenant" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/tenant/takeover
 * Force this device to become the active session
 */
router.post("/takeover", requireAuthNoTenant, async (req: any, res) => {
  const userId = req.user.id;

  const deviceSession = req.headers["x-device-session"] as string | undefined;

  if (!deviceSession) {
    return res.status(400).json({
      error: "Missing device session",
      code: "SESSION_MISSING"
    });
  }

  await pool.query(
    `
    UPDATE users
    SET active_session_id = $1
    WHERE id = $2
    `,
    [deviceSession, userId]
  );

  return res.json({ success: true });
});

/**
 * GET /api/tenant/session
 * Session-enforced ping (uses requireAuthWithTenant)
 * Purpose: allow the app to detect takeover even when user is sitting on Home.
 */
router.get("/session", requireAuthWithTenant, async (req: any, res) => {
  return res.json({
    ok: true,
    userId: req.user.id,
    tenantId: req.user.tenantId,
    role: req.user.role,
  });
});

export default router;