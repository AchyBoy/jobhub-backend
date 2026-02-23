//JobHub/ jobhub-backend/src/routes/push.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();
router.use(requireAuthWithTenant);

// ======================================
// GET /api/contractor-phase-notes/:contractorId
// ======================================
router.get("/:contractorId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const contractorId = String(req.params.contractorId || "").trim();

  if (!tenantId) return res.status(403).json({ error: "Missing tenant context" });
  if (!contractorId) return res.status(400).json({ error: "Missing contractorId" });

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        contractor_id as "contractorId",
        phase,
        note_a as "noteA",
        note_b as "noteB",
        created_at as "createdAt"
      FROM contractor_phase_notes
      WHERE tenant_id = $1
        AND contractor_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, contractorId]
    );

    res.json({ notes: result.rows });
  } catch (err) {
    console.error("❌ Failed to load contractor phase notes", err);
    res.status(500).json({ error: "Failed to load contractor phase notes" });
  }
});

// ======================================
// POST /api/contractor-phase-notes/:contractorId
// Body: { notes: TemplateNote[] }
// Upserts only (NO deletions).
// ======================================
router.post("/:contractorId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const contractorId = String(req.params.contractorId || "").trim();

  if (!tenantId) return res.status(403).json({ error: "Missing tenant context" });
  if (!contractorId) return res.status(400).json({ error: "Missing contractorId" });

  const rawNotes = req.body?.notes;
  if (!Array.isArray(rawNotes)) {
    return res.status(400).json({ error: "Missing notes array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 1. Delete all existing notes for this contractor
    await client.query(
      `
      DELETE FROM contractor_phase_notes
      WHERE tenant_id = $1
        AND contractor_id = $2
      `,
      [tenantId, contractorId]
    );

    // 🔥 2. Insert provided notes fresh
    for (const n of rawNotes) {
      if (!n?.id || !n?.phase || !n?.noteA) continue;

      await client.query(
        `
        INSERT INTO contractor_phase_notes (
          id,
          contractor_id,
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
          contractorId,
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
    console.error("❌ Failed to save contractor phase notes", err);
    res.status(500).json({ error: "Failed to save contractor phase notes" });
  } finally {
    client.release();
  }
});

export default router;