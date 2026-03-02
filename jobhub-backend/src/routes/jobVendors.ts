//JobHub/ jobhub-backend/src/routes/jobVendors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/vendor
// ======================================
router.get("/:jobId/vendor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
const result = await pool.query(
  `
SELECT
  jv.id,
  v.id as "vendorId",
  v.name,
  COALESCE(
    json_agg(
      json_build_object(
        'id', vc.id,
        'type', vc.type,
        'label', vc.label,
        'value', vc.value
      )
    ) FILTER (WHERE vc.id IS NOT NULL),
    '[]'
  ) as contacts
FROM job_vendors jv
JOIN vendors v
  ON v.id = jv.vendor_id
  AND v.tenant_id = jv.tenant_id
LEFT JOIN vendor_contacts vc
  ON vc.vendor_id = v.id
  AND vc.tenant_id = v.tenant_id
WHERE jv.job_id = $1
  AND jv.tenant_id = $2
GROUP BY jv.id, v.id
LIMIT 1
  `,
  [jobId, tenantId]
);

    res.json({ vendor: result.rows[0] ?? null });
  } catch (err) {
    console.error("❌ Failed to load job vendor", err);
    res.status(500).json({ error: "Failed to load job vendor" });
  }
});

// ======================================
// POST /api/jobs/:jobId/vendor
// ======================================
router.post("/:jobId/vendor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;
  const { vendorId } = req.body;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!vendorId) {
    return res.status(400).json({ error: "Missing vendorId" });
  }

  try {
    await pool.query(
      `
DELETE FROM job_vendors
WHERE job_id = $1
  AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    await pool.query(
      `
INSERT INTO job_vendors
  (id, job_id, vendor_id, tenant_id)
VALUES ($1, $2, $3, $4)
      `,
      [Date.now().toString(), jobId, vendorId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign vendor", err);
    res.status(500).json({ error: "Failed to assign vendor" });
  }
});

// ======================================
// DELETE /api/jobs/:jobId/vendor
// ======================================
router.delete("/:jobId/vendor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    await pool.query(
      `
DELETE FROM job_vendors
WHERE job_id = $1
  AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to remove job vendor", err);
    res.status(500).json({ error: "Failed to remove job vendor" });
  }
});

export default router;