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
router.post("/add", async (req: any, res) => {
  const { tenantId, role: actingRole } = req.user;

  if (!["owner", "admin"].includes(actingRole)) {
    return res.status(403).json({ error: "Insufficient permission" });
  }

  const { newUserId, newRole } = req.body;

  if (!newUserId || !["admin", "member"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // 1️⃣ Enforce max 3 active total users
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

  // 2️⃣ Insert into users table if missing
  await pool.query(
    `
    INSERT INTO users (id, tenant_id)
    VALUES ($1, $2)
    ON CONFLICT (id) DO NOTHING
    `,
    [newUserId, tenantId]
  );

  // 3️⃣ Insert tenant_users row
  try {
    await pool.query(
      `
      INSERT INTO tenant_users (tenant_id, user_id, role)
      VALUES ($1, $2, $3)
      `,
      [tenantId, newUserId, newRole]
    );
  } catch (e) {
    return res.status(400).json({
      error: "User already assigned to this tenant"
    });
  }

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