import { Router } from "express";
import { pool } from "../db/postgres";

const router = Router();

/**
 * ================================
 * TEMPLATES ROUTES
 * ================================
 *
 * Templates are jobs with:
 *   jobs.is_template = true
 *
 * They:
 *  - are NOT visible to crews
 *  - are NOT regular jobs
 *  - exist only to clone notes into new jobs
 *
 * ⚠️ DO NOT reuse job routes for templates
 * ⚠️ DO NOT delete templates casually
 * ⚠️ Templates are production data
 */

/**
 * GET /api/templates
 * Returns all job templates (no notes yet)
 */
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, created_at as "createdAt"
      FROM jobs
      WHERE is_template = true
      ORDER BY created_at ASC
      `
    );

    res.json({ templates: result.rows });
  } catch (err) {
    console.error("❌ Failed to list templates", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

/**
 * POST /api/templates/:templateId
 * Body: { name: string, notes: JobNote[] }
 *
 * Creates or updates a template and its notes.
 */
router.post("/:templateId", async (req, res) => {
  const templateId = String(req.params.templateId || "").trim();
  const { name, notes } = req.body || {};

  if (!templateId) {
    return res.status(400).json({ error: "Missing templateId" });
  }

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Missing template name" });
  }

  if (!Array.isArray(notes)) {
    return res.status(400).json({ error: "Missing notes array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure template job exists
    await client.query(
      `
      INSERT INTO jobs (id, name, is_template)
      VALUES ($1, $2, true)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        is_template = true
      `,
      [templateId, name.trim()]
    );

    // Remove existing template notes (templates are replaced atomically)
    await client.query(
      `DELETE FROM notes WHERE job_id = $1`,
      [templateId]
    );

    // Insert template notes
    for (const n of notes) {
      await client.query(
        `
        INSERT INTO notes (
          id,
          job_id,
          phase,
          note_a,
          note_b,
          text,
          status,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, COALESCE($8, now())
        )
        `,
        [
          n.id ?? `${templateId}-${Math.random().toString(36).slice(2)}`,
          templateId,
          n.phase ?? null,
          n.noteA ?? n.text ?? "",
          n.noteB ?? null,
          n.text ?? "",
          n.status ?? "incomplete",
          n.createdAt ?? null,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to save template", err);
    res.status(500).json({ error: "Failed to save template" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/job/from-template
 * Body: { templateId, jobId, jobName }
 *
 * Clones template notes into a NEW job.
 */
router.post("/create/job", async (req, res) => {
  const { templateId, jobId, jobName } = req.body || {};

  if (!templateId || !jobId || !jobName) {
    return res.status(400).json({ error: "Missing templateId, jobId, or jobName" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create job
    await client.query(
      `
      INSERT INTO jobs (id, name, is_template)
      VALUES ($1, $2, false)
      `,
      [jobId, jobName]
    );

    // Copy notes from template → job
    const { rows } = await client.query(
      `
      SELECT *
      FROM notes
      WHERE job_id = $1
      ORDER BY created_at ASC
      `,
      [templateId]
    );

    for (const n of rows) {
      await client.query(
        `
        INSERT INTO notes (
          id,
          job_id,
          phase,
          note_a,
          note_b,
          text,
          status,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, now()
        )
        `,
        [
          `${jobId}-${Math.random().toString(36).slice(2)}`,
          jobId,
          n.phase,
          n.note_a,
          n.note_b,
          n.text,
          n.status,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to create job from template", err);
    res.status(500).json({ error: "Failed to create job from template" });
  } finally {
    client.release();
  }
});

export default router;