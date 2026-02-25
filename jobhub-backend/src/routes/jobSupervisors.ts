//JobHub/jobhub-backend/src/routes/jobSupervisors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/jobs/:jobId/supervisors
// ======================================
router.get("/:jobId/supervisors", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();

  console.log("🔎 GET /api/jobs/:jobId/supervisors called", {
    jobId,
    tenantId,
    user: req.user,
  });

  if (!tenantId || !jobId) {
    console.log("❌ Missing context in GET supervisors");
    return res.status(400).json({ error: "Missing context" });
  }

  try {
const result = await pool.query(
  `
  SELECT
    js.id,
    js.supervisor_id as "supervisorId",
    s.name as "supervisorName",

    MAX(CASE WHEN sc.type = 'phone' THEN sc.value END) as phone,
    MAX(CASE WHEN sc.type = 'email' THEN sc.value END) as email

  FROM job_supervisors js
  JOIN supervisors s
    ON s.id = js.supervisor_id
    AND s.tenant_id = js.tenant_id

  LEFT JOIN supervisor_contacts sc
    ON sc.supervisor_id = s.id
    AND sc.tenant_id = s.tenant_id

  WHERE js.job_id = $1
    AND js.tenant_id = $2

  GROUP BY js.id, js.supervisor_id, s.name
  ORDER BY js.created_at DESC
  `,
  [jobId, tenantId]
);

    console.log("📦 Supervisors returned:", result.rows);

    res.json({ assignments: result.rows });
  } catch (err) {
    console.error("❌ Failed to load job supervisors", err);
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

router.post("/:jobId/supervisor", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const jobId = String(req.params.jobId || "").trim();
  const { supervisorId } = req.body || {};

  if (!tenantId || !jobId || !supervisorId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Insert assignment (no delete — multiple supervisors allowed)
    await client.query(
      `
      INSERT INTO job_supervisors
        (id, tenant_id, supervisor_id, job_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (supervisor_id, job_id, tenant_id)
      DO NOTHING
      `,
      [Date.now().toString(), tenantId, supervisorId, jobId]
    );

    // 2️⃣ Fetch supervisor template notes
    const templateResult = await client.query(
      `
      SELECT phase, note_a, note_b
      FROM supervisor_phase_notes
      WHERE supervisor_id = $1
        AND tenant_id = $2
      `,
      [supervisorId, tenantId]
    );

    // 3️⃣ Fetch active phases
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

    // 4️⃣ Inject notes (duplicate-safe)
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
          AND source_type = 'supervisor'
          AND source_id = $3
          AND phase = $4
          AND note_a = $5
        LIMIT 1
        `,
        [jobId, tenantId, supervisorId, phase, noteA]
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
          'supervisor',
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
          supervisorId
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to assign supervisor with injection", err);
    res.status(500).json({ error: "Failed to assign supervisor" });
  } finally {
    client.release();
  }
  
});

// ======================================
// DELETE /api/jobs/:jobId/supervisors/:assignmentId
// ======================================
router.delete("/:jobId/supervisors/:assignmentId", async (req: any, res) => {
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