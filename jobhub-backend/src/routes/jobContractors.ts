// jobhub-backend/src/routes/jobContractors.ts

import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/contractor
// ======================================
router.get("/:jobId/contractor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
SELECT
  jc.id,
  c.id as "contractorId",
  c.name
FROM job_contractors jc
JOIN contractors c
  ON c.id = jc.contractor_id
  AND c.tenant_id = jc.tenant_id
WHERE jc.job_id = $1
  AND jc.tenant_id = $2
LIMIT 1
      `,
      [jobId, tenantId]
    );

    res.json({ contractor: result.rows[0] ?? null });
  } catch (err) {
    console.error("❌ Failed to load job contractor", err);
    res.status(500).json({ error: "Failed to load job contractor" });
  }
});

// ======================================
// POST /api/jobs/:jobId/contractor
// ======================================
router.post("/:jobId/contractor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;
  const { contractorId } = req.body;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!contractorId) {
    return res.status(400).json({ error: "Missing contractorId" });
  }

  try {
    // Remove existing contractor for this job (enforces single)
    await pool.query(
      `
DELETE FROM job_contractors
WHERE job_id = $1
  AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    // Insert new assignment
    await pool.query(
      `
INSERT INTO job_contractors
  (id, job_id, contractor_id, tenant_id)
VALUES ($1, $2, $3, $4)
      `,
      [Date.now().toString(), jobId, contractorId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign contractor", err);
    res.status(500).json({ error: "Failed to assign contractor" });
  }
});

export default router;