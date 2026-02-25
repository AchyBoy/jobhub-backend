//JobHub/jobhub-backend/src/automation/activateDuePhases.ts
import { pool } from "../db/postgres";

export async function activateDuePhases() {
  try {
    await pool.query(`
      UPDATE notes n
      SET status = 'incomplete'
      FROM scheduled_tasks st
      WHERE st.status = 'scheduled'
        AND st.scheduled_at <= NOW()
        AND st.job_id = n.job_id
        AND st.phase = n.phase
        AND st.tenant_id = n.tenant_id
        AND n.status = 'blank'
    `);

    console.log("🔄 Due phases activated");
  } catch (err) {
    console.error("Phase activation automation failed:", err);
  }
}