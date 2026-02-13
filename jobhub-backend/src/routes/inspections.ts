//JobHub/ jobhub-backend/src/routes/inspections.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/inspections
// ======================================
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  try {
    const result = await pool.query(
      `
SELECT
  i.id,
  i.name,
  i.active,
  i.created_at as "createdAt",
  COALESCE(
    json_agg(
      json_build_object(
        'id', ic.id,
        'type', ic.type,
        'label', ic.label,
        'value', ic.value
      )
    ) FILTER (WHERE ic.id IS NOT NULL),
    '[]'
  ) as contacts
FROM inspections i
LEFT JOIN inspection_contacts ic
  ON ic.inspection_id = i.id
  AND ic.tenant_id = i.tenant_id
WHERE i.tenant_id = $1
GROUP BY i.id
ORDER BY i.created_at DESC
      `,
      [tenantId]
    );

    res.json({ inspections: result.rows });
  } catch (err) {
    console.error("❌ Failed to load inspections", err);
    res.status(500).json({ error: "Failed to load inspections" });
  }
});

// ======================================
// POST /api/inspections
// ======================================
router.post("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  const { id, name, contacts = [] } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `
      INSERT INTO inspections (id, tenant_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name
      `,
      [id, tenantId, name]
    );

    for (const contact of contacts) {
      await pool.query(
        `
        INSERT INTO inspection_contacts
          (id, inspection_id, tenant_id, type, label, value)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id)
        DO UPDATE SET
          type  = EXCLUDED.type,
          label = EXCLUDED.label,
          value = EXCLUDED.value
        `,
        [
          contact.id,
          id,
          tenantId,
          contact.type,
          contact.label ?? null,
          contact.value,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to save inspection", err);
    res.status(500).json({ error: "Failed to save inspection" });
  }
});

export default router;