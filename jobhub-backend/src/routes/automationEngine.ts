//JobHub/ jobhub-backend/src/routes/automationEngine.ts
import { pool } from "../db/postgres"
import { randomUUID } from "crypto"
import { resolveOffset } from "./automationOffsets"

export async function runNoteIncompleteAutomations({
  tenantId,
  jobId,
  noteName,
}: {
  tenantId: string
  jobId: string
  noteName: string
}) {

  const rules = await pool.query(
    `
    SELECT *
    FROM automations
    WHERE tenant_id = $1
      AND trigger_type = 'note_incomplete'
      AND trigger_note = $2
      AND enabled = true
    `,
    [tenantId, noteName]
  )

  if (rules.rowCount === 0) return

  for (const rule of rules.rows) {

    const scheduleDate = resolveOffset(
      new Date(),
      rule.schedule_offset
    )

    const id = randomUUID()

    await pool.query(
      `
      INSERT INTO scheduled_tasks (
        id,
        job_id,
        tenant_id,
        phase,
        scheduled_at,
        status,
        task_type
      )
      VALUES ($1,$2,$3,$4,$5,'scheduled','job')
      ON CONFLICT DO NOTHING
      `,
      [
        id,
        jobId,
        tenantId,
        rule.action_phase,
        scheduleDate.toISOString(),
      ]
    )
  }
}