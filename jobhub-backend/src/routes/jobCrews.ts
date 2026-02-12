// JobHub/jobhub-backend/src/routes/jobCrews.ts

import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/crews
// ======================================
router.get("/:jobId/crews", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();

  if (!tenantId || !jobId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cja.id,
        cja.crew_id as "crewId",
        cja.phase,
        c.name as "crewName"
      FROM crew_job_assignments cja
      JOIN crews c
        ON c.id = cja.crew_id
        AND c.tenant_id = cja.tenant_id
      WHERE cja.job_id = $1
        AND cja.tenant_id = $2
      ORDER BY cja.created_at DESC
      `,
      [jobId, tenantId]
    );

    res.json({ assignments: result.rows });
  } catch (err) {
    console.error("❌ Failed to load job crews", err);
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

// ======================================
// POST /api/jobs/:jobId/crews
// ======================================
router.post("/:jobId/crews", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();
  const { crewId, phase } = req.body || {};

  if (!tenantId || !jobId || !crewId || !phase) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const id = Date.now().toString();

  try {
    await pool.query(
      `
      INSERT INTO crew_job_assignments
        (id, tenant_id, crew_id, job_id, phase)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (crew_id, job_id, phase, tenant_id)
      DO NOTHING
      `,
      [id, tenantId, crewId, jobId, phase]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to assign crew", err);
    res.status(500).json({ error: "Failed to assign crew" });
  }
});

// ======================================
// DELETE /api/jobs/:jobId/crews/:assignmentId
// ======================================
router.delete("/:jobId/crews/:assignmentId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId, assignmentId } = req.params;

  if (!tenantId || !jobId || !assignmentId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    await pool.query(
      `
      DELETE FROM crew_job_assignments
      WHERE id = $1
        AND job_id = $2
        AND tenant_id = $3
      `,
      [assignmentId, jobId, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to remove assignment", err);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

export default router;