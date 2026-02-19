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
SELECT 
  tu.user_id,
  tu.role,
  tu.is_active,
  u.created_at,
  u.email
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
 * CREATE USER WITH PASSWORD (NO EMAIL FLOW)
 * owner only
 */
router.post("/add", async (req: any, res) => {
  const { tenantId, role: actingRole } = req.user;

  if (actingRole !== "owner") {
    return res.status(403).json({
      error: "Only the owner can add users"
    });
  }

  const { email, newRole, password } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Missing email" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Missing password" });
  }

  if (!["admin", "member"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // Enforce max 3 active users
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

  // Create Supabase user directly
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user) {
    return res.status(400).json({
      error: error?.message || "Failed to create user"
    });
  }

  const newUserId = data.user.id;

  // Insert into users table
await pool.query(
  `
  INSERT INTO users (id, tenant_id, email, must_change_password)
  VALUES ($1, $2, $3, true)
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    must_change_password = true
  `,
  [newUserId, tenantId, email]
);

  // Insert tenant relationship
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

// 🔒 Only owner can deactivate users
if (actingRole !== "owner") {
  return res.status(403).json({
    error: "Only the owner can deactivate users"
  });
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

/**
 * UPDATE USER ROLE
 * owner only
 */
router.post("/role", async (req: any, res) => {
  const { tenantId, role: actingRole } = req.user;

  if (actingRole !== "owner") {
    return res.status(403).json({
      error: "Only owner can change roles"
    });
  }

  const { targetUserId, newRole } = req.body;

  if (!targetUserId || !["admin", "member"].includes(newRole)) {
    return res.status(400).json({
      error: "Invalid request"
    });
  }

  // Prevent changing owner role
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
    return res.status(404).json({ error: "User not found" });
  }

  if (roleCheck.rows[0].role === "owner") {
    return res.status(400).json({
      error: "Cannot change owner role"
    });
  }

  await pool.query(
    `
    UPDATE tenant_users
    SET role = $1
    WHERE tenant_id = $2
    AND user_id = $3
    `,
    [newRole, tenantId, targetUserId]
  );

  return res.json({ success: true });
});

/**
 * OWNER resets a user's password
 */
router.post("/reset-password", async (req: any, res) => {
  const { tenantId, role: actingRole } = req.user;

  if (actingRole !== "owner") {
    return res.status(403).json({
      error: "Only the owner can reset passwords"
    });
  }

  const { targetUserId, newPassword } = req.body;

  if (!targetUserId || !newPassword) {
    return res.status(400).json({
      error: "Missing targetUserId or newPassword"
    });
  }

  // Ensure target belongs to this tenant
  const check = await pool.query(
    `
    SELECT role
    FROM tenant_users
    WHERE tenant_id = $1
    AND user_id = $2
    `,
    [tenantId, targetUserId]
  );

  if (check.rowCount === 0) {
    return res.status(404).json({
      error: "User not found in this tenant"
    });
  }

  if (check.rows[0].role === "owner") {
    return res.status(400).json({
      error: "Cannot reset owner password"
    });
  }

const { error } = await supabase.auth.admin.updateUserById(
  targetUserId,
  { password: newPassword }
);

if (error) {
  return res.status(400).json({
    error: error.message
  });
}

// 🔐 Force user to change password on next login
await pool.query(
  `
  UPDATE users
  SET must_change_password = true
  WHERE id = $1
  `,
  [targetUserId]
);

return res.json({ success: true });
});

/**
 * Clear must_change_password flag (self)
 */
router.post("/clear-password-flag", async (req: any, res) => {
  const userId = req.user.id;

  await pool.query(
    `
    UPDATE users
    SET must_change_password = false
    WHERE id = $1
    `,
    [userId]
  );

  return res.json({ success: true });
});

export default router;