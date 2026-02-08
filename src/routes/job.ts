// jobhub-backend/src/routes/job.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuthWithTenant";
// WARNING!!! import { requireAuth } from "../middleware/requireAuthWithTenant"; IS 100 PERCENT VERIFIED CORRECT!! DO NOT CHANGE
// ⚠️ JSON store intentionally NOT imported here
// Notes are persisted ONLY in Postgres
import { pool } from "../db/postgres";

const router = Router();

// 🔐 Protect ALL job + note routes
// BEFORE

// WARNING!! THIS router.use(requireAuth); IS VERIFIED 100 PERCENT CORRECT! DO NOT CHANGE
router.use(requireAuth);

// POST /api/job/:jobId/notes
// Body: { notes: JobNote[] }
router.post("/:jobId/notes", async (req, res) => {
console.log("🔥 NOTES ROUTE VERSION: PROVE-DEPLOY v3 (2026-02-08 03:40Z)");
console.log("🧪 NOTES HANDLER ENTERED");
console.log("🧪 FILE =", __filename);

// debug logs removed
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });

// ================================
// POST /api/job/:jobId/notes
// ================================
// ⚠️ SOURCE OF TRUTH = POSTGRES
// ⚠️ DO NOT WRITE NOTES TO JSON
// JSON storage caused DATA LOSS on redeploy.
// This endpoint is PRODUCTION SAFE.
//
// If this breaks, notes WILL be lost.
// Do not refactor casually.


let tenantId: string | null = null;

const rawNotes = req.body?.notes;
if (!Array.isArray(rawNotes)) {
  return res.status(400).json({ error: "Missing notes array" });
}

const client = await pool.connect();

try {
  await client.query("BEGIN");

  // Ensure job exists
// 🔐 Derive tenant from job AND enforce tenant isolation
const user = (req as any).user;
const authTenantId = user?.tenantId ?? user?.tenant_id;
console.log("🧪 AUTH TENANT FROM TOKEN =", authTenantId);

const jobResult = await client.query(
  `
  SELECT tenant_id
  FROM jobs
  WHERE id = $1
  `,
  [jobId]
);

if (jobResult.rowCount === 0) {
  throw new Error("Job does not exist");
}

const jobTenantId = jobResult.rows[0].tenant_id;

console.log("🧪 TENANT CHECK", {
  authTenantId,
  jobTenantId,
  jobId,
});

if (jobTenantId !== authTenantId) {
  throw new Error(
    `Tenant mismatch: auth=${authTenantId} job=${jobTenantId}`
  );
}

tenantId = jobTenantId as string;

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
  tenantId as string, // 🔐 tenant_id (REQUIRED)
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
} catch (err: unknown) {
  await client.query("ROLLBACK");

  console.error("❌ Failed to write notes to Postgres");
  console.error("JOB ID:", jobId);
  console.error("TENANT ID:", tenantId);
  console.error("RAW NOTES:", JSON.stringify(rawNotes, null, 2));
  console.error("PG ERROR:", err instanceof Error ? err.message : err);

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
router.get("/:jobId/notes", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

const user = (req as any).user;
const authTenantId = user?.tenantId ?? user?.tenant_id;

if (!authTenantId) {
  return res.status(401).json({ error: "Missing tenant context" });
}

  try {

    const result: any = await pool.query(
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
FROM notes n
JOIN jobs j
  ON j.id = n.job_id
 AND j.tenant_id = n.tenant_id
WHERE n.job_id = $1
  AND j.tenant_id = $2
  ORDER BY created_at ASC
  `,
  [jobId, authTenantId]
);

    res.json({
      jobId,
      notes: result.rows,
    });
  } catch (err: unknown) {
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
// POST /api/job/:jobId/meta
router.post("/:jobId/meta", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  const user = req.user as any;
const tenantId = user?.tenantId ?? user?.tenant_id;

if (!tenantId) {
  return res.status(409).json({
    error: "Job meta blocked: tenant context not established",
  });
}

  const name =
    typeof req.body?.name === "string" && req.body.name.trim()
      ? req.body.name.trim()
      : null;

  // 🔒 HARD STOP — DO NOT AUTO-CREATE OR AUTO-RENAME JOBS
  if (!name) {
    return res.status(400).json({
      error: "Job name is required. Job must already exist.",
    });
  }

  try {
    await pool.query(
      `
      UPDATE jobs
      SET name = $2
      WHERE id = $1
        AND tenant_id = $3
      `,
      [jobId, name, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to update job name", err);
    res.status(500).json({ error: "Failed to save job name" });
  }
});

export default router;
