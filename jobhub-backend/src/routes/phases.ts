//JobHub/ jobhub-backend/src/routes/phases.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

// 🔒 All phase routes require auth
router.use(requireAuthWithTenant);

// GET /api/phases
router.get("/", async (req: any, res) => {
  const tenantId = req.user.tenantId;

  const result = await pool.query(
    `
    SELECT id, name, position, active
    FROM phases
    WHERE tenant_id = $1
    ORDER BY position ASC
    `,
    [tenantId]
  );

  res.json({ phases: result.rows });
});

// POST /api/phases
router.post("/", async (req: any, res) => {
  const tenantId = req.user.tenantId;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Phase name required" });
  }

  const id = Date.now().toString();

  await pool.query(
    `
    INSERT INTO phases (id, tenant_id, name, position)
    VALUES ($1, $2, $3, 0)
    `,
    [id, tenantId, name]
  );

  res.json({ success: true });
});

export default router;