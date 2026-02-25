//JobHub/jobhub-backend/src/routes/serviceCases.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";
import { randomUUID } from "crypto";

const router = Router();
router.use(requireAuthWithTenant);

/**
 * ======================================
 * GET /api/service-cases
 * Optional: ?unscheduled=true
 * ======================================
 */
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const unscheduledOnly = req.query.unscheduled === "true";
  const propertyName = req.query.propertyName as string | undefined;

  try {
if (unscheduledOnly) {
  const result = await pool.query(
    `
    SELECT sc.*
    FROM service_cases sc
    LEFT JOIN scheduled_tasks st
      ON st.service_case_id = sc.id
      AND st.tenant_id = sc.tenant_id
    WHERE sc.tenant_id = $1
      AND sc.status != 'closed'
    GROUP BY sc.id
    HAVING COUNT(st.id) = 0
    ORDER BY sc.created_at DESC
    `,
    [tenantId]
  );

  return res.json({ serviceCases: result.rows });
}

if (propertyName) {
  const result = await pool.query(
    `
    SELECT *
    FROM service_cases
    WHERE tenant_id = $1
      AND property_name ILIKE $2
      AND status != 'closed'
    ORDER BY created_at DESC
    `,
    [tenantId, `%${propertyName}%`]
  );

  return res.json({ serviceCases: result.rows });
}

const result = await pool.query(
      `
      SELECT *
      FROM service_cases
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenantId]
    );

    res.json({ serviceCases: result.rows });
  } catch (err) {
    console.error("Fetch service cases failed:", err);
    res.status(500).json({ error: "Failed to fetch service cases" });
  }
});

/**
 * ======================================
 * GET /api/service-cases/:id
 * ======================================
 */
router.get("/:id", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM service_cases
      WHERE id = $1
        AND tenant_id = $2
      `,
      [id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Service case not found" });
    }

    res.json({ serviceCase: result.rows[0] });
  } catch (err) {
    console.error("Fetch service case failed:", err);
    res.status(500).json({ error: "Failed to fetch service case" });
  }
});

/**
 * ======================================
 * POST /api/service-cases
 * ======================================
 */
router.post("/", async (req: any, res) => {

  console.log("🔥 SERVICE CASE POST HIT", req.body);
  const tenantId = req.user?.tenantId;

  const {
    propertyName,
    address,
    ownerName,
    description,
    contacts,
  } = req.body;

  if (!propertyName) {
    return res.status(400).json({ error: "propertyName required" });
  }

  try {
    const id = randomUUID();

    const result = await pool.query(
      `
      INSERT INTO service_cases (
        id,
        tenant_id,
        property_name,
        address,
        owner_name,
        description,
        contacts,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'open')
      RETURNING *
      `,
      [
        id,
        tenantId,
        propertyName,
        address ?? null,
        ownerName ?? null,
        description ?? null,
        contacts ?? [],
      ]
    );

    res.json({ serviceCase: result.rows[0] });
  } catch (err) {
    console.error("Create service case failed:", err);
    res.status(500).json({ error: "Failed to create service case" });
  }
});

/**
 * ======================================
 * PATCH /api/service-cases/:id
 * ======================================
 */
router.patch("/:id", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  const {
  propertyName,
  ownerName,
  description,
  contacts,
  status,
} = req.body;

  console.log("RAW CONTACTS TYPE:", typeof contacts);
console.log("RAW CONTACTS VALUE:", contacts);

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (propertyName !== undefined) {
  updates.push(`property_name = $${idx++}`);
  values.push(propertyName);
}

    if (ownerName !== undefined) {
      updates.push(`owner_name = $${idx++}`);
      values.push(ownerName);
    }

    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description);
    }
    
if (contacts !== undefined) {
  updates.push(`contacts = $${idx++}::jsonb`);
  values.push(JSON.stringify(contacts));
}

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === "closed") {
        updates.push(`closed_at = now()`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const query = `
      UPDATE service_cases
      SET ${updates.join(", ")}
      WHERE id = $${idx}
        AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    values.push(id, tenantId);

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Service case not found" });
    }

    res.json({ serviceCase: result.rows[0] });
  } catch (err) {
    console.error("Update service case failed:", err);
    res.status(500).json({ error: "Failed to update service case" });
  }
});

export default router;