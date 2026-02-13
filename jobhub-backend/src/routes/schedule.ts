//JobHub/jobhub-backend/src/routes/schedule.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

/**
 * GET /api/schedule
 * Returns all scheduled tasks for tenant
 */
router.get("/", async (req, res) => {
  const tenantId = (req as any).user.tenantId;

  try {
    const result = await pool.query(
      `
      SELECT 
        st.id,
        st.job_id,
        j.name as job_name,
        st.crew_id,
        c.name as crew_name,
        st.phase,
        st.scheduled_at,
        st.status
      FROM scheduled_tasks st
      JOIN jobs j 
        ON j.id = st.job_id 
        AND j.tenant_id = st.tenant_id
      JOIN crews c
        ON c.id = st.crew_id
        AND c.tenant_id = st.tenant_id
      WHERE st.tenant_id = $1
      ORDER BY st.scheduled_at ASC
      `,
      [tenantId]
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error("Schedule fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

export default router;