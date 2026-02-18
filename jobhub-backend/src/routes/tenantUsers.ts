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
 * Add user (admin + owner only)
 */
router.post("/add", async (req: any, res) => {
  const { tenantId, role, id } = req.user;

  if (!["owner", "admin"].includes(role)) {
    return res.status(403).json({ error: "Insufficient permission" });
  }

  const { newUserId, newRole } = req.body;

  if (!["admin", "member"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const countResult = await pool.query(
    `
    SELECT count(*) 
    FROM tenant_users
    WHERE tenant_id = $1
    AND role != 'owner'
    AND is_active = true
    `,
    [tenantId]
  );

  const activeCount = Number(countResult.rows[0].count);

  if (activeCount >= 2) {
    return res.status(400).json({
      error: "Tenant user limit reached (max 2 non-owner users)"
    });
  }

  await pool.query(
    `
    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES ($1, $2, $3)
    `,
    [tenantId, newUserId, newRole]
  );

  res.json({ success: true });
});

/**
 * Deactivate user
 */
router.post("/deactivate", async (req: any, res) => {
  const { tenantId, role } = req.user;

  if (!["owner", "admin"].includes(role)) {
    return res.status(403).json({ error: "Insufficient permission" });
  }

  const { targetUserId } = req.body;

  await pool.query(
    `
    UPDATE tenant_users
    SET is_active = false
    WHERE tenant_id = $1
    AND user_id = $2
    AND role != 'owner'
    `,
    [tenantId, targetUserId]
  );

  res.json({ success: true });
});

export default router;