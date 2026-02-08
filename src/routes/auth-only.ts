import { Router } from "express";
import { pool } from "../db/postgres";
import {
  requireAuthOnly,
  AuthOnlyRequest,
} from "../middleware/requireAuthOnly";

const router = Router();

/**
 * GET /api/me
 * Auth-only user state (Model 1)
 */
router.get("/me", requireAuthOnly, async (req: AuthOnlyRequest, res) => {
if (!req.user) {
  return res.json({ authenticated: false });
}

  const { id } = req.user;
const emailVerified = true; // TEMP — until we wire Supabase email_verified

  const result = await pool.query(
    `
    SELECT u.id, tu.tenant_id, tu.role
    FROM users u
    LEFT JOIN tenant_users tu ON tu.user_id = u.id
    WHERE u.id = $1
    LIMIT 1
    `,
    [id]
  );

  const userExists = result.rowCount > 0;
  const row = userExists ? result.rows[0] : null;

  return res.json({
    authenticated: true,
    emailVerified,
    userExists,
    hasTenant: !!row?.tenant_id,
    tenantId: row?.tenant_id ?? null,
    role: row?.role ?? null,
  });
});

export default router;