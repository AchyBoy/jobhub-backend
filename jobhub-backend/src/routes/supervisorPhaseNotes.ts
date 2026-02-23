// jobhub-backend/src/routes/supervisorPhaseNotes.ts

import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();
router.use(requireAuthWithTenant);

// ======================================
// GET /api/supervisor-phase-notes/:supervisorId
// ======================================
router.get("/:supervisorId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const supervisorId = String(req.params.supervisorId || "").trim();

  if (!tenantId)
    return res.status(403).json({ error: "Missing tenant context" });

  if (!supervisorId)
    return res.status(400).json({ error: "Missing supervisorId" });

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        supervisor_id as "supervisorId",
        phase,
        note_a as "noteA",
        note_b as "noteB",
        created_at as "createdAt"
      FROM supervisor_phase_notes
      WHERE tenant_id = $1
        AND supervisor_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, supervisorId]
    );

    res.json({ notes: result.rows });
  } catch (err) {
    console.error("❌ Failed to load supervisor phase notes", err);
    res
      .status(500)
      .json({ error: "Failed to load supervisor phase notes" });
  }
});

// ======================================
// POST /api/supervisor-phase-notes/:supervisorId
// Body: { notes: TemplateNote[] }
// Upserts only (NO deletions).
// ======================================
router.post("/:supervisorId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const supervisorId = String(req.params.supervisorId || "").trim();

  if (!tenantId)
    return res.status(403).json({ error: "Missing tenant context" });

  if (!supervisorId)
    return res.status(400).json({ error: "Missing supervisorId" });

  const rawNotes = req.body?.notes;

  if (!Array.isArray(rawNotes)) {
    return res.status(400).json({ error: "Missing notes array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 1. Delete all existing notes for this supervisor
    await client.query(
      `
      DELETE FROM supervisor_phase_notes
      WHERE tenant_id = $1
        AND supervisor_id = $2
      `,
      [tenantId, supervisorId]
    );

    // 🔥 2. Insert provided notes fresh
    for (const n of rawNotes) {
      if (!n?.id || !n?.phase || !n?.noteA) continue;

      await client.query(
        `
        INSERT INTO supervisor_phase_notes (
          id,
          supervisor_id,
          tenant_id,
          phase,
          note_a,
          note_b,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
        `,
        [
          String(n.id),
          supervisorId,
          tenantId,
          String(n.phase),
          String(n.noteA),
          n.noteB ?? null,
          n.createdAt ?? null,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to save supervisor phase notes", err);
    res
      .status(500)
      .json({ error: "Failed to save supervisor phase notes" });
  } finally {
    client.release();
  }
});

export default router;