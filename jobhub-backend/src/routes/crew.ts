//JobHub/jobhub-backend/src/routes/crew.ts
import { Router } from "express";
import { pool } from "../db/postgres";

const router = Router();

// =======================================================
// GET /api/crew/job/:jobId?phase=Rough&view=Final,Trim
// =======================================================
// ⚠️ SOURCE OF TRUTH = POSTGRES
// ⚠️ JSON STORAGE IS PERMANENTLY REMOVED
//
// This endpoint exists for WEB CREW LINKS.
// It MUST remain backward-compatible with the web UI.
// Do NOT change response shape without updating the web.
//
// JSON storage caused DATA LOSS on redeploy.
// Do not reintroduce it.
router.get("/job/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const activePhase = String(req.query.phase || "").trim();
  const viewParam = String(req.query.view || "").trim();

  if (!jobId) return res.status(400).json({ error: "Missing jobId" });
  if (!activePhase)
    return res.status(400).json({ error: "Missing ?phase=" });

  try {
    // Load job
    const jobRes = await pool.query(
      `SELECT id, name FROM jobs WHERE id = $1`,
      [jobId]
    );

    if (jobRes.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = jobRes.rows[0];

    // Load notes
    const notesRes = await pool.query(
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
      ORDER BY created_at ASC
      `,
      [jobId]
    );

    const rawNotes = notesRes.rows;

    // Build allowed phases
    const viewPhases = viewParam
      ? viewParam
          .split(",")
          .map(s => decodeURIComponent(s).trim())
          .filter(Boolean)
      : [];

    const allowed = new Set<string>([activePhase, ...viewPhases]);

    const allowedNotes = rawNotes.filter(n =>
      allowed.has(n.phase)
    );

    const activeNotes = allowedNotes.filter(
      n => n.phase === activePhase
    );

    const viewOnly: Record<string, typeof activeNotes> = {};
    for (const p of viewPhases) {
      viewOnly[p] = allowedNotes.filter(n => n.phase === p);
    }

    res.json({
      jobId,
      jobName: job.name,
      activePhase,
      notes: activeNotes,
      viewOnly,
      viewPhases,
    });
  } catch (err) {
    console.error("❌ Crew job load failed", err);
    res.status(500).json({ error: "Failed to load job data" });
  }
});

// =======================================================
// POST /api/crew/job/:jobId/notes/complete
// =======================================================
// ⚠️ SOURCE OF TRUTH = POSTGRES
// Marks a note complete by the crew.
// Legacy text matching is intentionally REMOVED.
router.post("/job/:jobId/notes/complete", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const { noteId } = req.body || {};

  if (!jobId) return res.status(400).json({ error: "Missing jobId" });
  if (!noteId)
    return res.status(400).json({ error: "Missing noteId" });

  const now = new Date().toISOString();

  try {
const result = await pool.query(
  `
  UPDATE notes
  SET
    marked_complete_by = 'crew',
    crew_completed_at = $3
  WHERE id = $1
    AND job_id = $2
  RETURNING id
  `,
  [noteId, jobId, now]
);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json({
      success: true,
      jobId,
      noteId,
      crewCompletedAt: now,
    });
  } catch (err) {
    console.error("❌ Crew note completion failed", err);
    res.status(500).json({ error: "Failed to complete note" });
  }
});

// =======================================================
// POST /api/crew/job/:jobId/notes/update-noteB
// =======================================================
// ⚠️ PUBLIC CREW ENDPOINT
// Updates note_b only.
// Tenant is resolved implicitly via job_id.
router.post("/job/:jobId/notes/update-noteB", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const { noteId, noteB } = req.body || {};

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  if (!noteId) {
    return res.status(400).json({ error: "Missing noteId" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE notes
      SET note_b = $3
      WHERE id = $1
        AND job_id = $2
      RETURNING id
      `,
      [noteId, jobId, noteB ?? null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    return res.json({
      success: true,
      jobId,
      noteId,
      noteB: noteB ?? null,
    });
  } catch (err) {
    console.error("❌ Crew note update failed", err);
    return res.status(500).json({ error: "Failed to update note" });
  }
});

export default router;