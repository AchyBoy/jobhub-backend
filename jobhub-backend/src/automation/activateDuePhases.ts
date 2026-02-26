//JobHub/jobhub-backend/src/automation/activateDuePhases.ts
import { pool } from "../db/postgres";

export async function activateDuePhases() {
  try {
await pool.query(`
  UPDATE notes n
  SET status = 'incomplete'
  FROM scheduled_tasks st
LEFT JOIN phase_groups pg
  ON pg.tenant_id = st.tenant_id
 AND pg.base_phase =
     CASE
       WHEN st.phase LIKE 'Grouped Phase:%'
       THEN TRIM(REPLACE(st.phase, 'Grouped Phase:', ''))
       ELSE st.phase
     END
  LEFT JOIN phase_group_members pgm
    ON pgm.group_id = pg.id
   AND pgm.tenant_id = st.tenant_id
  WHERE st.status = 'scheduled'
    AND st.scheduled_at <= NOW()
    AND st.job_id = n.job_id
    AND st.tenant_id = n.tenant_id
AND (
  n.phase =
    CASE
      WHEN st.phase LIKE 'Grouped Phase:%'
      THEN TRIM(REPLACE(st.phase, 'Grouped Phase:', ''))
      ELSE st.phase
    END
  OR n.phase = pgm.phase_name
)
    AND n.status = 'blank'
`);

    console.log("🔄 Due phases activated");
  } catch (err) {
    console.error("Phase activation automation failed:", err);
  }
}