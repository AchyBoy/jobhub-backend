//JobHub/jobhub-backend/src/routes/jobSupervisors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/supervisors
// ======================================
router.get("/:jobId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();

  if (!tenantId || !jobId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        js.id,
        js.supervisor_id as "supervisorId",
        s.name as "supervisorName"
      FROM job_supervisors js
      JOIN supervisors s
        ON s.id = js.supervisor_id
        AND s.tenant_id = js.tenant_id
      WHERE js.job_id = $1
        AND js.tenant_id = $2
      ORDER BY js.created_at DESC
      `,
      [jobId, tenantId]
    );

    res.json({ assignments: result.rows });
  } catch (err) {
    console.error("❌ Failed to load job supervisors", err);
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

// ======================================
// POST /api/jobs/:jobId/supervisors
// ======================================
router.post("/:jobId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();
  const { supervisorId } = req.body || {};

  if (!tenantId || !jobId || !supervisorId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const id = Date.now().toString();

  try {
    await pool.query(
      `
      INSERT INTO job_supervisors
        (id, tenant_id, supervisor_id, job_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (supervisor_id, job_id, tenant_id)
      DO NOTHING
      `,
      [id, tenantId, supervisorId, jobId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign supervisor", err);
    res.status(500).json({ error: "Failed to assign supervisor" });
  }
});

// ======================================
// DELETE /api/jobs/:jobId/supervisors/:assignmentId
// ======================================
router.delete("/:jobId/:assignmentId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId, assignmentId } = req.params;

  if (!tenantId || !jobId || !assignmentId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    await pool.query(
      `
      DELETE FROM job_supervisors
      WHERE id = $1
        AND job_id = $2
        AND tenant_id = $3
      `,
      [assignmentId, jobId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to remove supervisor assignment", err);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

export default router;