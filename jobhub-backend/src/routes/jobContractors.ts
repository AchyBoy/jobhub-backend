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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Remove existing contractor assignment
    await client.query(
      `
      DELETE FROM job_contractors
      WHERE job_id = $1
        AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    // 2️⃣ Insert new contractor assignment
    await client.query(
      `
      INSERT INTO job_contractors
        (id, job_id, contractor_id, tenant_id)
      VALUES ($1, $2, $3, $4)
      `,
      [Date.now().toString(), jobId, contractorId, tenantId]
    );

    // 3️⃣ Fetch contractor template notes
    const templateResult = await client.query(
      `
      SELECT phase, note_a, note_b
      FROM contractor_phase_notes
      WHERE contractor_id = $1
        AND tenant_id = $2
      `,
      [contractorId, tenantId]
    );

    // 4️⃣ Fetch active phases
    const phasesResult = await client.query(
      `
      SELECT name
      FROM phases
      WHERE tenant_id = $1
        AND active = true
      `,
      [tenantId]
    );

    const activePhases = new Set(
      phasesResult.rows.map((p: any) => p.name)
    );

    // 5️⃣ Inject notes (duplicate-safe)
    for (const t of templateResult.rows) {
      const phase = t.phase;
      const noteA = t.note_a;
      const noteB = t.note_b ?? null;

      // Duplicate guard
      const exists = await client.query(
        `
        SELECT 1
        FROM notes
        WHERE job_id = $1
          AND tenant_id = $2
          AND source_type = 'contractor'
          AND source_id = $3
          AND phase = $4
          AND note_a = $5
        LIMIT 1
        `,
        [jobId, tenantId, contractorId, phase, noteA]
      );

      if (exists.rowCount > 0) continue;

      const status = activePhases.has(phase)
        ? "incomplete"
        : "blank";

      await client.query(
        `
        INSERT INTO notes (
          id,
          job_id,
          tenant_id,
          phase,
          note_a,
          note_b,
          text,
          status,
          created_at,
          source_type,
          source_id
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          $4,
          $6,
          now(),
          'contractor',
          $7
        )
        `,
        [
          jobId,
          tenantId,
          phase,
          noteA,
          noteB,
          status,
          contractorId
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to assign contractor with injection", err);
    res.status(500).json({ error: "Failed to assign contractor" });
  } finally {
    client.release();
  }
});

// ======================================
// DELETE /api/jobs/:jobId/contractor
// ======================================
router.delete("/:jobId/contractor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.params;

  console.log("🧨 DELETE contractor called", {
    jobId,
    tenantId,
    user: req.user,
  });

  if (!tenantId) {
    console.log("❌ Missing tenant in DELETE");
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM job_contractors
      WHERE job_id = $1
        AND tenant_id = $2
      RETURNING *
      `,
      [jobId, tenantId]
    );

    console.log("🗑 Rows deleted:", result.rows);

    res.json({ success: true, deleted: result.rows });
  } catch (err) {
    console.error("❌ Failed to remove contractor", err);
    res.status(500).json({ error: "Failed to remove contractor" });
  }
});

export default router;