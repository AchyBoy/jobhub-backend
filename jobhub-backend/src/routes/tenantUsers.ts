//JobHub/ jobhub-backend/src/routes/tenantUsers.ts
import { Router } from "express";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";

const router = Router();
router.use(requireAuthWithTenant);

/**
 * GET current tenant users
 */
router.get("/", async (req: any, res) => {
  const { tenantId } = req.user;

  const result = await pool.query(
    `
    SELECT tu.user_id, tu.role, tu.is_active, u.created_at
    FROM tenant_users tu
    JOIN users u ON u.id = tu.user_id
    WHERE tu.tenant_id = $1
    ORDER BY u.created_at ASC
    `,
    [tenantId]
  );

  res.json({ users: result.rows });
});

/**
 * ADD USER
 * owner + admin only
 * Max 3 active total (including owner)
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * ADD USER BY EMAIL
 * owner + admin only
 * Max 3 active total (including owner)
 */
router.post("/add", async (req: any, res) => {
  const { tenantId, role: actingRole } = req.user;

  if (!["owner", "admin"].includes(actingRole)) {
    return res.status(403).json({ error: "Insufficient permission" });
  }

  const { email, newRole } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing email" });
  }

  if (!["admin", "member"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // 🔒 Enforce max 3 active users total
  const countResult = await pool.query(
    `
    SELECT COUNT(*)
    FROM tenant_users
    WHERE tenant_id = $1
    AND is_active = true
    `,
    [tenantId]
  );

  const activeCount = Number(countResult.rows[0].count);

  if (activeCount >= 3) {
    return res.status(400).json({
      error: "Tenant user limit reached (max 3 active users)"
    });
  }

// 🔎 Resolve Supabase user by email (admin API does NOT have getUserByEmail)
const { data, error } = await supabase.auth.admin.listUsers();

if (error || !data?.users) {
  return res.status(500).json({ error: "Failed to query Supabase users" });
}

const foundUser = data.users.find(
  (u: any) => u.email?.toLowerCase() === email.toLowerCase()
);

if (!foundUser) {
  return res.status(400).json({ error: "User not found in Supabase" });
}

const newUserId = foundUser.id;

  // Ensure user exists in users table
  await pool.query(
    `
    INSERT INTO users (id, tenant_id)
    VALUES ($1, $2)
    ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
    `,
    [newUserId, tenantId]
  );

  // Insert or reactivate tenant_users row
  await pool.query(
    `
    INSERT INTO tenant_users (tenant_id, user_id, role, is_active)
    VALUES ($1, $2, $3, true)
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, is_active = true
    `,
    [tenantId, newUserId, newRole]
  );

  res.json({ success: true });
});

/**
 * DEACTIVATE USER (soft delete)
 */
router.post("/deactivate", async (req: any, res) => {
  const { tenantId, role: actingRole, id: actingUserId } = req.user;

  if (!["owner", "admin"].includes(actingRole)) {
    return res.status(403).json({ error: "Insufficient permission" });
  }

  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: "Missing targetUserId" });
  }

  // 1️⃣ Prevent self-deactivation
  if (targetUserId === actingUserId) {
    return res.status(400).json({
      error: "Cannot deactivate yourself"
    });
  }

  // 2️⃣ Prevent deactivating owner
  const roleCheck = await pool.query(
    `
    SELECT role
    FROM tenant_users
    WHERE tenant_id = $1
    AND user_id = $2
    `,
    [tenantId, targetUserId]
  );

  if (roleCheck.rowCount === 0) {
    return res.status(404).json({ error: "User not found in tenant" });
  }

  if (roleCheck.rows[0].role === "owner") {
    return res.status(400).json({
      error: "Cannot deactivate owner"
    });
  }

  await pool.query(
    `
    UPDATE tenant_users
    SET is_active = false
    WHERE tenant_id = $1
    AND user_id = $2
    `,
    [tenantId, targetUserId]
  );

  res.json({ success: true });
});

export default router;