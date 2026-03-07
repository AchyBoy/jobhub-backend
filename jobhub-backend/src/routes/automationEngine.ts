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

    const existing = await pool.query(
  `
  SELECT 1
  FROM scheduled_tasks
  WHERE job_id = $1
    AND tenant_id = $2
    AND phase = $3
    AND status = 'scheduled'
  LIMIT 1
  `,
  [jobId, tenantId, rule.action_phase]
)

if (existing.rowCount > 0) continue

// try to base offset on the job's most recent scheduled phase
let baseDate = new Date()

const base = await pool.query(
  `
  SELECT scheduled_at
  FROM scheduled_tasks
  WHERE job_id = $1
    AND tenant_id = $2
  ORDER BY scheduled_at DESC
  LIMIT 1
  `,
  [jobId, tenantId]
)

if (base.rowCount > 0) {
  baseDate = new Date(base.rows[0].scheduled_at)
}

const scheduleDate = resolveOffset(
  baseDate,
  rule.schedule_offset
)

    const id = randomUUID()

    const jobRes = await pool.query(
  `
  SELECT name
  FROM jobs
  WHERE id = $1
  AND tenant_id = $2
  `,
  [jobId, tenantId]
)

const jobName = jobRes.rowCount
  ? jobRes.rows[0].name
  : "Job"

try {
  await pool.query(
    `
INSERT INTO scheduled_tasks (
  id,
  job_id,
  tenant_id,
  phase,
  scheduled_at,
  status,
  task_type,
  job_name
)
    VALUES ($1,$2,$3,$4,$5,'scheduled','job',$6)
    ON CONFLICT DO NOTHING
    `,
[
  id,
  jobId,
  tenantId,
  `${noteName} — ${rule.action_phase}`,
  scheduleDate.toISOString(),
  jobName,
]
  )
} catch (err:any) {

  // ignore duplicate schedule attempts
  if (err.code === "23505") return

  console.error("Automation scheduling failed:", err)
}
  }
}