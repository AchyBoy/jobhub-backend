//JobHub/jobhub-backend/src/routes/templates.ts
import { Router } from "express";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";

const router = Router();
router.use(requireAuthWithTenant);

/**
 * =========================================
 * GET /api/templates
 * =========================================
 */
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  try {
    const result = await pool.query(
      `
      SELECT id, name, created_at as "createdAt"
      FROM jobs
      WHERE is_template = true
      AND tenant_id = $1
      ORDER BY created_at ASC
      `,
      [tenantId]
    );

    res.json({ templates: result.rows });
  } catch (err) {
    console.error("❌ Failed to list templates", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

/**
 * =========================================
 * POST /api/templates/from-job/:jobId
 * =========================================
 */
router.post("/from-job/:jobId", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const sourceJobId = String(req.params.jobId || "").trim();

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });
  if (!sourceJobId) return res.status(400).json({ error: "Missing jobId" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jobRes = await client.query(
      `
      SELECT name
      FROM jobs
      WHERE id = $1
      AND tenant_id = $2
      AND is_template = false
      `,
      [sourceJobId, tenantId]
    );

    if (!jobRes.rowCount) {
      throw new Error("Source job not found");
    }

    const templateId = `template_${Date.now()}`;
    const templateName = `Template – ${jobRes.rows[0].name}`;

    await client.query(
      `
      INSERT INTO jobs (id, name, tenant_id, is_template)
      VALUES ($1, $2, $3, true)
      `,
      [templateId, templateName, tenantId]
    );

    await client.query(
      `
      INSERT INTO notes (
        id,
        job_id,
        phase,
        note_a,
        note_b,
        text,
        status,
        created_at,
        tenant_id
      )
      SELECT
        gen_random_uuid()::text,
        $2,
        phase,
        note_a,
        note_b,
        text,
        status,
        created_at,
        tenant_id
      FROM notes
      WHERE job_id = $1
      AND tenant_id = $3
      `,
      [sourceJobId, templateId, tenantId]
    );

    // =============================
// Clone Materials Into Template
// =============================
await client.query(
  `
  INSERT INTO materials (
    id,
    tenant_id,
    job_id,
    item_name,
    item_code,
    phase,
    supplier_id,
    qty_needed,
    qty_allocated,
    qty_ordered,
    qty_delivered,
    status,
    date_ready,
    date_ordered,
    date_delivered,
    automation_payload,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    tenant_id,
    $2,
    item_name,
    item_code,
    phase,
    supplier_id,
    qty_needed,
    qty_allocated,
    qty_ordered,
    qty_delivered,
    status,
    date_ready,
    date_ordered,
    date_delivered,
    automation_payload,
    now()
  FROM materials
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Job Contractors
// =============================
await client.query(
  `
  INSERT INTO job_contractors (
    id,
    job_id,
    contractor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $2,
    contractor_id,
    tenant_id,
    now()
  FROM job_contractors
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Job Supervisors
// =============================
await client.query(
  `
  INSERT INTO job_supervisors (
    id,
    job_id,
    supervisor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $2,
    supervisor_id,
    tenant_id,
    now()
  FROM job_supervisors
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Job Inspections
// =============================
await client.query(
  `
  INSERT INTO job_inspections (
    id,
    job_id,
    inspection_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $2,
    inspection_id,
    tenant_id,
    now()
  FROM job_inspections
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Job Permit Companies
// =============================
await client.query(
  `
  INSERT INTO job_permit_companies (
    id,
    job_id,
    permit_company_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $2,
    permit_company_id,
    tenant_id,
    now()
  FROM job_permit_companies
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Job Vendors
// =============================
await client.query(
  `
  INSERT INTO job_vendors (
    id,
    job_id,
    vendor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $2,
    vendor_id,
    tenant_id,
    now()
  FROM job_vendors
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

// =============================
// Clone Crew Job Assignments
// =============================
await client.query(
  `
  INSERT INTO crew_job_assignments (
    id,
    tenant_id,
    crew_id,
    job_id,
    phase,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    tenant_id,
    crew_id,
    $2,
    phase,
    now()
  FROM crew_job_assignments
  WHERE job_id = $1
  AND tenant_id = $3
  `,
  [sourceJobId, templateId, tenantId]
);

    await client.query("COMMIT");

    res.json({
      success: true,
      templateId,
      name: templateName,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed creating template", err);
    res.status(500).json({ error: "Failed to create template" });
  } finally {
    client.release();
  }
});

/**
 * =========================================
 * POST /api/templates/create/job
 * =========================================
 */
router.post("/create/job", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { templateId, jobId, jobName } = req.body || {};

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });
  if (!templateId || !jobId || !jobName) {
    return res.status(400).json({ error: "Missing templateId, jobId, or jobName" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO jobs (id, name, tenant_id, is_template)
      VALUES ($1, $2, $3, false)
      `,
      [jobId, jobName, tenantId]
    );

    // =============================
// Clone Materials From Template
// =============================
await client.query(
  `
  INSERT INTO materials (
    id,
    tenant_id,
    job_id,
    item_name,
    item_code,
    phase,
    supplier_id,
    qty_needed,
    qty_allocated,
    qty_ordered,
    qty_delivered,
    status,
    date_ready,
    date_ordered,
    date_delivered,
    automation_payload,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    tenant_id,
    $1,
    item_name,
    item_code,
    phase,
    supplier_id,
    qty_needed,
    0,
    0,
    0,
    status,
    NULL,
    NULL,
    NULL,
    NULL,
    now()
  FROM materials
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

    const { rows } = await client.query(
      `
      SELECT *
      FROM notes
      WHERE job_id = $1
      AND tenant_id = $2
      ORDER BY created_at ASC
      `,
      [templateId, tenantId]
    );

    for (const n of rows) {
      await client.query(
        `
        INSERT INTO notes (
          id,
          job_id,
          phase,
          note_a,
          note_b,
          text,
          status,
          created_at,
          tenant_id
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          now(),
          $7
        )
        `,
        [
          jobId,
          n.phase,
          n.note_a,
          n.note_b,
          n.text,
          n.status,
          tenantId,
        ]
      );
    }

    // =============================
// Clone Job Contractors
// =============================
await client.query(
  `
  INSERT INTO job_contractors (
    id,
    job_id,
    contractor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $1,
    contractor_id,
    tenant_id,
    now()
  FROM job_contractors
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

// =============================
// Clone Job Supervisors
// =============================
await client.query(
  `
  INSERT INTO job_supervisors (
    id,
    job_id,
    supervisor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $1,
    supervisor_id,
    tenant_id,
    now()
  FROM job_supervisors
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

// =============================
// Clone Job Inspections
// =============================
await client.query(
  `
  INSERT INTO job_inspections (
    id,
    job_id,
    inspection_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $1,
    inspection_id,
    tenant_id,
    now()
  FROM job_inspections
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

// =============================
// Clone Job Permit Companies
// =============================
await client.query(
  `
  INSERT INTO job_permit_companies (
    id,
    job_id,
    permit_company_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $1,
    permit_company_id,
    tenant_id,
    now()
  FROM job_permit_companies
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

// =============================
// Clone Job Vendors
// =============================
await client.query(
  `
  INSERT INTO job_vendors (
    id,
    job_id,
    vendor_id,
    tenant_id,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    $1,
    vendor_id,
    tenant_id,
    now()
  FROM job_vendors
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

// =============================
// Clone Crew Job Assignments
// =============================
await client.query(
  `
  INSERT INTO crew_job_assignments (
    id,
    tenant_id,
    crew_id,
    job_id,
    phase,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    tenant_id,
    crew_id,
    $1,
    phase,
    now()
  FROM crew_job_assignments
  WHERE job_id = $2
  AND tenant_id = $3
  `,
  [jobId, templateId, tenantId]
);

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to create job from template", err);
    res.status(500).json({ error: "Failed to create job from template" });
  } finally {
    client.release();
  }
});



export default router;