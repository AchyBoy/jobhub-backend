//JobHub/jobhub-backend/src/routes/job.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
// ⚠️ JSON store intentionally NOT imported here
// Notes are persisted ONLY in Postgres
import { pool } from "../db/postgres";

const router = Router();

// 🔐 ALL job routes require auth + tenant
router.use(requireAuthWithTenant);

// GET /api/job/:jobId
router.get("/job/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  try {
const result = await pool.query(
  `
  SELECT 
    id,
    name,
    is_template as "isTemplate"
  FROM jobs
  WHERE id = $1
    AND tenant_id = $2
  LIMIT 1
  `,
  [jobId, tenantId]
);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ job: result.rows[0] });
  } catch (err) {
    console.error("Fetch job error:", err);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

// 🔐 ALL job routes require auth + tenant

// POST /api/job/:jobId/notes
// Body: { notes: JobNote[] }
router.post("/job/:jobId/notes", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();

    // ✅ LOG #1 — confirm route + basic request shape
  console.log("🔥 NOTES POST HIT", {
    jobId,
    notesIsArray: Array.isArray(req.body?.notes),
    notesCount: Array.isArray(req.body?.notes) ? req.body.notes.length : null,
  });

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  const rawNotes = req.body?.notes;
  if (!Array.isArray(rawNotes)) {
    return res.status(400).json({ error: "Missing notes array" });
  }

    // ✅ LOG #2 — inspect first note payload exactly as backend sees it
  console.log("🧾 FIRST NOTE (raw)", rawNotes[0]);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔐 Resolve tenant from EXISTING job (source of truth)
    const jobResult = await client.query(
      `
      SELECT tenant_id
      FROM jobs
      WHERE id = $1
      LIMIT 1
      `,
      [jobId]
    );

if (jobResult.rowCount === 0) {
  await client.query("ROLLBACK");
  return res.status(403).json({
    error: "Job does not exist for this tenant",
  });
}

    const tenantId = jobResult.rows[0].tenant_id;

        // ✅ LOG #3 — confirm tenant resolved
    console.log("🏷️ TENANT RESOLVED", { jobId, tenantId });

for (const n of rawNotes) {
  
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
  marked_complete_by,
  crew_completed_at,
  office_completed_at,
  created_at
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now())
)
      ON CONFLICT (id) DO UPDATE SET
        phase = EXCLUDED.phase,
        note_a = EXCLUDED.note_a,
        note_b = EXCLUDED.note_b,
        text = EXCLUDED.text,
        status = EXCLUDED.status,
        marked_complete_by = EXCLUDED.marked_complete_by,
        crew_completed_at = EXCLUDED.crew_completed_at,
        office_completed_at = EXCLUDED.office_completed_at
      `,
[
  n.id,
  jobId,
  tenantId,
  n.phase ?? null,
  n.noteA ?? n.text ?? "",
  n.noteB ?? null,
  n.text ?? "",
  n.status ?? "incomplete",
  n.markedCompleteBy ?? null,
  n.crewCompletedAt ?? null,
  n.officeCompletedAt ?? null,
  n.createdAt ?? null,
]
    );
  }

  await client.query("COMMIT");
  res.json({ success: true });
} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ Failed to write notes to Postgres", err);
  res.status(500).json({ error: "Failed to save notes" });
} finally {
  client.release();
}
});

// GET /api/job/:jobId/notes
// ⚠️ IMPORTANT
// This endpoint READS FROM POSTGRES.
// This is the SOURCE OF TRUTH for notes.
// Do NOT switch this back to JSON.
// JSON storage was ephemeral and caused data loss on redeploy.
router.get("/job/:jobId/notes", async (req, res) => {
const jobId = String(req.params.jobId || "").trim();
const tenantId = (req as any).user?.tenantId;

if (!jobId) {
  return res.status(400).json({ error: "Missing jobId" });
}

if (!tenantId) {
  return res.status(403).json({ error: "Missing tenant context" });
}

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        job_id as "jobId",
        phase,
        note_a as "noteA",
        note_b as "noteB",
        text,
        status,
        marked_complete_by as "markedCompleteBy",
        crew_completed_at as "crewCompletedAt",
        office_completed_at as "officeCompletedAt",
        created_at as "createdAt"
FROM notes
WHERE job_id = $1
  AND tenant_id = $2
ORDER BY created_at ASC
      `,
      [jobId, tenantId]
    );

    res.json({
      jobId,
      notes: result.rows,
    });
  } catch (err) {
    console.error("❌ Failed to read notes from Postgres", err);
    res.status(500).json({ error: "Failed to load notes" });
  }
});

// POST /api/job/:jobId/meta
// ================================
// ⚠️ SOURCE OF TRUTH = POSTGRES
// Sets or updates the job name.
// Do NOT reintroduce JSON storage here.
// JSON caused data loss on redeploy.
router.post("/job/:jobId/meta", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }
  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  const name =
    typeof req.body?.name === "string"
      ? req.body.name.trim()
      : null;

  if (!name) {
    return res.status(400).json({ error: "Missing job name" });
  }

  try {
    await pool.query(
      `
INSERT INTO jobs (id, name, tenant_id)
VALUES ($1, $2, $3)
ON CONFLICT (id)
DO UPDATE SET name = EXCLUDED.name
      `,
      [jobId, name, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to save job name to Postgres", err);
    res.status(500).json({ error: "Failed to save job name" });
  }
});

// GET /api/job
// ================================
// Returns all jobs for the authenticated tenant
router.get("/job", async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
SELECT
  id,
  name,
  is_template as "isTemplate",
  created_at as "createdAt"
FROM jobs
WHERE tenant_id = $1
ORDER BY created_at DESC
      `,
      [tenantId]
    );

    res.json({ jobs: result.rows });
  } catch (err) {
    console.error("❌ Failed to load jobs", err);
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// PATCH /api/job/:jobId/template
router.patch("/job/:jobId/template", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const tenantId = (req as any).user?.tenantId;
  const { isTemplate } = req.body || {};

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  if (typeof isTemplate !== "boolean") {
    return res.status(400).json({ error: "Missing isTemplate boolean" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE jobs
      SET is_template = $1
      WHERE id = $2
        AND tenant_id = $3
      RETURNING id, is_template
      `,
      [isTemplate, jobId, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed updating template flag", err);
    return res.status(500).json({ error: "Failed to update template flag" });
  }
});

// DELETE /api/job/:jobId
router.delete("/job/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const user = (req as any).user;

  if (!user?.tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  // 🔐 ROLE CHECK
  if (user.role !== "owner" && user.role !== "admin") {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM jobs
      WHERE id = $1
        AND tenant_id = $2
      RETURNING id
      `,
      [jobId, user.tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to delete job", err);
    return res.status(500).json({ error: "Delete failed" });
  }
});

export default router;
