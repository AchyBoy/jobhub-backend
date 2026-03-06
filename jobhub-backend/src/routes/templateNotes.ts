//JobHub/ jobhub-backend/src/routes/templateNotes.ts
import { Router } from "express"
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant"
import { pool } from "../db/postgres"

const router = Router()

router.use(requireAuthWithTenant)

/*
GET /api/templates/notes
Returns all notes from template jobs
*/

router.get("/", async (req: any, res) => {

  const tenantId = req.user?.tenantId

  try {

    const result = await pool.query(
      `
      SELECT
        n.id,
        n.phase,
        n.note_a AS "noteA",
        n.note_b AS "noteB"
      FROM notes n
      JOIN jobs j
        ON j.id = n.job_id
      WHERE j.tenant_id = $1
        AND j.is_template = true
      ORDER BY n.phase, n.note_a
      `,
      [tenantId]
    )

    res.json({
      notes: result.rows
    })

  } catch (err) {

    console.error("Template notes fetch failed:", err)

    res.status(500).json({
      error: "Failed to load template notes"
    })
  }

})

export default router