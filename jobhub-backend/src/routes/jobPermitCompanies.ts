//JobHub/ jobhub-backend/src/routes/jobPermitCompanies.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/permit-company
// ======================================
router.get("/:jobId/permit-company", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
SELECT
  jpc.id,
  p.id as "permitCompanyId",
  p.name
FROM job_permit_companies jpc
JOIN permit_companies p
  ON p.id = jpc.permit_company_id
  AND p.tenant_id = jpc.tenant_id
WHERE jpc.job_id = $1
  AND jpc.tenant_id = $2
LIMIT 1
      `,
      [jobId, tenantId]
    );

    res.json({ permitCompany: result.rows[0] ?? null });
  } catch (err) {
    console.error("❌ Failed to load job permit company", err);
    res.status(500).json({ error: "Failed to load job permit company" });
  }
});

// ======================================
// POST /api/jobs/:jobId/permit-company
// ======================================
router.post("/:jobId/permit-company", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;
  const { permitCompanyId } = req.body;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!permitCompanyId) {
    return res.status(400).json({ error: "Missing permitCompanyId" });
  }

  try {
    await pool.query(
      `
DELETE FROM job_permit_companies
WHERE job_id = $1
  AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    await pool.query(
      `
INSERT INTO job_permit_companies
  (id, job_id, permit_company_id, tenant_id)
VALUES ($1, $2, $3, $4)
      `,
      [Date.now().toString(), jobId, permitCompanyId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign permit company", err);
    res.status(500).json({ error: "Failed to assign permit company" });
  }
});

export default router;