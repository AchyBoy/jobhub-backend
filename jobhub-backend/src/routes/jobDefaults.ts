// jobhub-backend/src/routes/jobDefaults.ts

import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

/**
 * ======================================
 * GET /api/jobs/:id/supervisors
 * ======================================
 */
router.get("/:id/supervisors", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = req.params.id;

  if (!tenantId || !jobId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    const result = await pool.query(
      `
      SELECT s.id, s.name
      FROM job_supervisors js
      JOIN supervisors s
        ON s.id = js.supervisor_id
       AND s.tenant_id = js.tenant_id
      WHERE js.job_id = $1
        AND js.tenant_id = $2
      `,
      [jobId, tenantId]
    );

    res.json({ supervisors: result.rows });
  } catch (err) {
    console.error("Failed to load job supervisors", err);
    res.status(500).json({ error: "Failed to load job supervisors" });
  }
});

/**
 * ======================================
 * GET /api/jobs/:id/contractor
 * ======================================
 */
router.get("/:id/contractor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = req.params.id;

  if (!tenantId || !jobId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    const result = await pool.query(
      `
      SELECT c.id, c.name
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
    console.error("Failed to load job contractor", err);
    res.status(500).json({ error: "Failed to load job contractor" });
  }
});

/**
 * ======================================
 * POST /api/jobs/:id/supervisors
 * Multiple supervisors allowed
 * ======================================
 */
router.post("/:id/supervisors", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = req.params.id;
  const { supervisorIds = [] } = req.body;

  if (!tenantId || !jobId) {
    return res.status(400).json({ error: "Missing context" });
  }

  try {
    // Remove existing
    await pool.query(
      `DELETE FROM job_supervisors
       WHERE job_id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );

    // Insert new set
    for (const supervisorId of supervisorIds) {
      await pool.query(
        `
        INSERT INTO job_supervisors
        (id, job_id, supervisor_id, tenant_id)
        VALUES ($1, $2, $3, $4)
        `,
        [
          Date.now().toString() + supervisorId,
          jobId,
          supervisorId,
          tenantId,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to assign supervisors", err);
    res.status(500).json({ error: "Failed to assign supervisors" });
  }
});

/**
 * ======================================
 * POST /api/jobs/:id/contractor
 * Single contractor only
 * ======================================
 */
router.post("/:id/contractor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = req.params.id;
  const { contractorId } = req.body;

  if (!tenantId || !jobId || !contractorId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Remove existing contractor
    await pool.query(
      `DELETE FROM job_contractors
       WHERE job_id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );

    // Insert new
    await pool.query(
      `
      INSERT INTO job_contractors
      (id, job_id, contractor_id, tenant_id)
      VALUES ($1, $2, $3, $4)
      `,
      [
        Date.now().toString(),
        jobId,
        contractorId,
        tenantId,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to assign contractor", err);
    res.status(500).json({ error: "Failed to assign contractor" });
  }
});

export default router;