//JobHub/jobhub-backend/src/routes/scheduledTasks.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";
import { randomUUID } from "crypto";

const router = Router();

/**
 * Create scheduled task
 * POST /api/jobs/:jobId/schedule
 */
router.post(
  "/jobs/:jobId/schedule",
  requireAuthWithTenant,
  async (req, res) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { jobId } = req.params;

      const { crewId, phase, scheduledAt } = req.body;

      if (!crewId || !phase || !scheduledAt) {
        return res.status(400).json({
          error: "crewId, phase, and scheduledAt are required",
        });
      }

      const id = randomUUID();

      const result = await pool.query(
        `
        INSERT INTO scheduled_tasks (
          id,
          job_id,
          tenant_id,
          crew_id,
          phase,
          scheduled_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [id, jobId, tenantId, crewId, phase, scheduledAt]
      );

      res.json({ task: result.rows[0] });
    } catch (err) {
      console.error("Create scheduled task failed:", err);
      res.status(500).json({ error: "Failed to create scheduled task" });
    }
  }
);

export default router;