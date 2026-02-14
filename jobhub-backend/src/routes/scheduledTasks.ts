//JobHub/jobhub-backend/src/routes/scheduledTasks.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";
import { randomUUID } from "crypto";

const router = Router();

router.use(requireAuthWithTenant);

/**
 * ======================================
 * GET /api/scheduled-tasks
 * ======================================
 */
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM scheduled_tasks
      WHERE tenant_id = $1
      ORDER BY scheduled_at ASC
      `,
      [tenantId]
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error("Fetch scheduled tasks failed:", err);
    res.status(500).json({ error: "Failed to fetch scheduled tasks" });
  }
});

/**
 * ======================================
 * POST /api/scheduled-tasks
 * ======================================
 */
router.post("/", async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { jobId, crewId, phase, scheduledAt } = req.body;

    if (!jobId || !crewId || !phase || !scheduledAt) {
      return res.status(400).json({
        error: "jobId, crewId, phase, scheduledAt required",
      });
    }

    // Fetch job name
    const jobResult = await pool.query(
      `
      SELECT name
      FROM jobs
      WHERE id = $1
        AND tenant_id = $2
      `,
      [jobId, tenantId]
    );

    if (jobResult.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const jobName = jobResult.rows[0].name;

    // Fetch crew name
    const crewResult = await pool.query(
      `
      SELECT name
      FROM crews
      WHERE id = $1
        AND tenant_id = $2
      `,
      [crewId, tenantId]
    );

    if (crewResult.rowCount === 0) {
      return res.status(404).json({ error: "Crew not found" });
    }

    const crewName = crewResult.rows[0].name;

    const id = randomUUID();

    const result = await pool.query(
      `
      INSERT INTO scheduled_tasks (
        id,
        job_id,
        tenant_id,
        crew_id,
        phase,
        scheduled_at,
        job_name,
        crew_name
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        id,
        jobId,
        tenantId,
        crewId,
        phase,
        scheduledAt,
        jobName,
        crewName,
      ]
    );

    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error("Create scheduled task failed:", err);
    res.status(500).json({ error: "Failed to create scheduled task" });
  }
});


/**
 * ======================================
 * DELETE /api/scheduled-tasks/:id
 * ======================================
 */
router.delete("/:id", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  try {
    await pool.query(
      `
      DELETE FROM scheduled_tasks
      WHERE id = $1
        AND tenant_id = $2
      `,
      [id, tenantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Delete scheduled task failed:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

/**
 * PATCH /api/scheduled-tasks/:id
 * Supports:
 * - reschedule (scheduled_at)
 * - status change
 */
router.patch("/:id", async (req, res) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { id } = req.params;

      const {
        scheduledAt,
        status,
      }: {
        scheduledAt?: string;
        status?: 'scheduled' | 'in_progress' | 'complete';
      } = req.body;

      // 1️⃣ Ensure task exists and belongs to tenant
      const existing = await pool.query(
        `
        SELECT *
        FROM scheduled_tasks
        WHERE id = $1
          AND tenant_id = $2
        `,
        [id, tenantId]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({ error: "Scheduled task not found" });
      }

      // 2️⃣ Build dynamic update
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (scheduledAt) {
        updates.push(`scheduled_at = $${idx++}`);
        values.push(scheduledAt);
      }

      if (status) {
        updates.push(`status = $${idx++}`);
        values.push(status);

        if (status === 'complete') {
          updates.push(`completed_at = now()`);
        }

        if (status !== 'complete') {
          updates.push(`completed_at = NULL`);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = now()`);

      const query = `
        UPDATE scheduled_tasks
        SET ${updates.join(", ")}
        WHERE id = $${idx}
          AND tenant_id = $${idx + 1}
        RETURNING *
      `;

      values.push(id, tenantId);

      const result = await pool.query(query, values);

      res.json({ task: result.rows[0] });
    } catch (err) {
      console.error("Update scheduled task failed:", err);
      res.status(500).json({ error: "Failed to update scheduled task" });
    }
  }
);

export default router;