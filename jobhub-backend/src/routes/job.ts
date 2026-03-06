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
is_template as "isTemplate",
latitude,
longitude,
  pdf_id as "pdfId",
  address
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

  console.log("🔥 META BODY RECEIVED:", req.body);

const name =
  typeof req.body?.name === "string"
    ? req.body.name.trim()
    : null;

const latitude =
  typeof req.body?.latitude === "number"
    ? req.body.latitude
    : null;

const longitude =
  typeof req.body?.longitude === "number"
    ? req.body.longitude
    : null;

    const pdfId =
  typeof req.body?.pdfId === "string"
    ? req.body.pdfId
    : null;

    const address =
  typeof req.body?.address === "string"
    ? req.body.address
    : null;

if (
  !name &&
  latitude === null &&
  longitude === null &&
  !pdfId &&
  address === null
) {
  return res.status(400).json({ error: "Nothing to update" });
}

if ((latitude === null) !== (longitude === null)) {
  return res.status(400).json({
    error: "Provide both latitude and longitude",
  });
}

  try {
await pool.query(
  `
INSERT INTO jobs (id, name, tenant_id, latitude, longitude, pdf_id, address)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id, tenant_id)
DO UPDATE SET
  name = COALESCE(EXCLUDED.name, jobs.name),
  latitude = COALESCE(EXCLUDED.latitude, jobs.latitude),
  longitude = COALESCE(EXCLUDED.longitude, jobs.longitude),
  pdf_id = COALESCE(EXCLUDED.pdf_id, jobs.pdf_id),
  address = COALESCE(EXCLUDED.address, jobs.address)
  `,
  [jobId, name, tenantId, latitude, longitude, pdfId, address]
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
  j.id,
  j.name,
  j.is_template as "isTemplate",
  j.latitude,
  j.longitude,
  j.created_at as "createdAt",

  -- 🟡 Incomplete Notes Count
  (
    SELECT COUNT(*)
    FROM notes n
    WHERE n.job_id = j.id
      AND n.tenant_id = j.tenant_id
      AND n.status = 'incomplete'
  )::int as "incompleteNoteCount",

-- 🔴 Supplier unordered items (only after ordering started)
(
  SELECT COUNT(*)
  FROM materials m
  WHERE m.job_id = j.id
    AND m.tenant_id = j.tenant_id
    AND m.supplier_id IS NOT NULL

    -- item still needs ordering
    AND COALESCE(m.qty_needed,0) >
        (COALESCE(m.qty_ordered,0) + COALESCE(m.qty_from_storage,0))

    -- ordering has started for that phase
AND EXISTS (
  SELECT 1
  FROM materials m2
  WHERE m2.job_id = m.job_id
    AND m2.tenant_id = m.tenant_id
    AND m2.phase = m.phase
    AND m2.supplier_id IS NOT NULL
    AND COALESCE(m2.qty_ordered,0) > 0
)
)::int as "supplierUnorderedCount",

-- 🟠 Vendor unordered items (always strict)
(
  SELECT COUNT(*)
  FROM materials m
  WHERE m.job_id = j.id
    AND m.tenant_id = j.tenant_id
    AND m.supplier_id IS NULL   -- vendor items

    AND COALESCE(m.qty_needed,0) >
        (COALESCE(m.qty_ordered,0) + COALESCE(m.qty_from_storage,0))
)::int as "vendorUnorderedCount"

FROM jobs j
WHERE j.tenant_id = $1
ORDER BY j.created_at DESC
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
