//JobHub/jobhub-backend/src/routes/scheduledTasks.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";
import { randomUUID } from "crypto";
const DEV_BYPASS_TENANT = "tenant_a2688515-022c-4981-ace6-416b16e86abd";

const router = Router();

router.use(requireAuthWithTenant);

/**
 * ======================================
 * GET /api/scheduled-tasks
 * Supports optional ?jobId=
 * ======================================
 */
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;

  const jobId = typeof req.query.jobId === "string"
    ? req.query.jobId.trim()
    : null;

  try {

  // 🔄 Auto-activate notes when task time arrives
  await pool.query(
    `
    UPDATE notes n
    SET status = 'incomplete'
    FROM scheduled_tasks st
    WHERE st.tenant_id = $1
      AND st.status = 'scheduled'
      AND st.scheduled_at <= NOW()
      AND st.job_id = n.job_id
      AND st.phase = n.phase
      AND n.tenant_id = $1
      AND n.status != 'complete'
    `,
    [tenantId]
  );

  let result;

    if (jobId) {
      // 🔒 Scoped to specific job
      result = await pool.query(
        `
        SELECT *
        FROM scheduled_tasks
        WHERE tenant_id = $1
          AND job_id = $2
        ORDER BY scheduled_at ASC
        `,
        [tenantId, jobId]
      );
    } else {
      // 🌎 Return all tasks for tenant (main scheduler)
      result = await pool.query(
        `
        SELECT *
        FROM scheduled_tasks
        WHERE tenant_id = $1
        ORDER BY scheduled_at ASC
        `,
        [tenantId]
      );
    }

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

    // ======================================
// 🔄 Phase Reset Automation (Paywalled)
// ======================================

const isBypassTenant = tenantId === DEV_BYPASS_TENANT;

// TODO: Replace with real billing check later
const isPaidTenant = false;

// Only run automation if:
// - bypass tenant (you)
// - OR paid tenant in future
if (isBypassTenant || isPaidTenant) {
  try {
    await pool.query(
      `
      UPDATE notes
      SET
        marked_complete_by = NULL,
        crew_completed_at = NULL
      WHERE job_id = $1
        AND tenant_id = $2
        AND phase = $3
        AND (
          marked_complete_by IS NULL
          OR marked_complete_by != 'office'
        )
      `,
      [jobId, tenantId, phase]
    );

    console.log("🔄 Phase reset executed");
  } catch (err) {
    console.error("Phase reset failed:", err);
  }
}

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

        // 1️⃣ Get task info before deleting
    const existing = await pool.query(
      `
      SELECT job_id, phase
      FROM scheduled_tasks
      WHERE id = $1
        AND tenant_id = $2
      `,
      [id, tenantId]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const { job_id, phase } = existing.rows[0];

    // 2️⃣ Delete the task
    await pool.query(
      `
      DELETE FROM scheduled_tasks
      WHERE id = $1
        AND tenant_id = $2
      `,
      [id, tenantId]
    );

        // 3️⃣ Reset notes for that job/phase (NOT completed notes)
    await pool.query(
      `
      UPDATE notes
      SET status = 'blank'
      WHERE tenant_id = $1
        AND job_id = $2
        AND phase = $3
        AND status != 'complete'
      `,
      [tenantId, job_id, phase]
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
  crewId,
  emailConfirmedSentAt,
}: {
  scheduledAt?: string;
  status?: 'scheduled' | 'in_progress' | 'complete';
  crewId?: string;
  emailConfirmedSentAt?: string;
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

if (scheduledAt !== undefined) {
  updates.push(`scheduled_at = $${idx++}`);
  values.push(scheduledAt);
}

if (crewId) {
  // Fetch crew name (tenant safe)
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

  updates.push(`crew_id = $${idx++}`);
  values.push(crewId);

  updates.push(`crew_name = $${idx++}`);
  values.push(crewName);
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

      if (emailConfirmedSentAt) {
  updates.push(`email_confirmed_sent_at = $${idx++}`);
  values.push(emailConfirmedSentAt);
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