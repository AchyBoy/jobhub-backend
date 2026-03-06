//JobHub/ jobhub-backend/src/routes/automations.ts
import { Router } from "express"
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant"
import { pool } from "../db/postgres"
import { randomUUID } from "crypto"

const router = Router()

router.use(requireAuthWithTenant)

router.get("/", async (req: any, res) => {

  const tenantId = req.user?.tenantId

  const result = await pool.query(
    `
    SELECT *
    FROM automations
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    `,
    [tenantId]
  )

  res.json({ automations: result.rows })
})

router.post("/", async (req: any, res) => {

  const tenantId = req.user?.tenantId

  const {
    triggerType,
    triggerNote,
    actionPhase,
    scheduleOffset,
  } = req.body

  const id = randomUUID()

  const result = await pool.query(
    `
    INSERT INTO automations (
      id,
      tenant_id,
      trigger_type,
      trigger_note,
      action_type,
      action_phase,
      schedule_offset
    )
    VALUES ($1,$2,$3,$4,'schedule_task',$5,$6)
    RETURNING *
    `,
    [
      id,
      tenantId,
      triggerType,
      triggerNote,
      actionPhase,
      scheduleOffset,
    ]
  )

  res.json({ automation: result.rows[0] })
})

export default router