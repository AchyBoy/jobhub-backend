//JobHub/ jobhub-backend/src/routes/jobInspections.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/inspection
// ======================================
router.get("/:jobId/inspection", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
SELECT
  ji.id,
  i.id as "inspectionId",
  i.name
FROM job_inspections ji
JOIN inspections i
  ON i.id = ji.inspection_id
  AND i.tenant_id = ji.tenant_id
WHERE ji.job_id = $1
  AND ji.tenant_id = $2
LIMIT 1
      `,
      [jobId, tenantId]
    );

    res.json({ inspection: result.rows[0] ?? null });
  } catch (err) {
    console.error("❌ Failed to load job inspection", err);
    res.status(500).json({ error: "Failed to load job inspection" });
  }
});

// ======================================
// POST /api/jobs/:jobId/inspection
// ======================================
router.post("/:jobId/inspection", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;
  const { inspectionId } = req.body;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!inspectionId) {
    return res.status(400).json({ error: "Missing inspectionId" });
  }

  try {
    await pool.query(
      `
DELETE FROM job_inspections
WHERE job_id = $1
  AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    await pool.query(
      `
INSERT INTO job_inspections
  (id, job_id, inspection_id, tenant_id)
VALUES ($1, $2, $3, $4)
      `,
      [Date.now().toString(), jobId, inspectionId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign inspection", err);
    res.status(500).json({ error: "Failed to assign inspection" });
  }
});

export default router;