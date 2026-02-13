//JobHub/ jobhub-backend/src/routes/vendors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/vendors
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
  v.id,
  v.name,
  v.active,
  v.created_at as "createdAt",
  COALESCE(
    json_agg(
      json_build_object(
        'id', vc.id,
        'type', vc.type,
        'label', vc.label,
        'value', vc.value
      )
    ) FILTER (WHERE vc.id IS NOT NULL),
    '[]'
  ) as contacts
FROM vendors v
LEFT JOIN vendor_contacts vc
  ON vc.vendor_id = v.id
  AND vc.tenant_id = v.tenant_id
WHERE v.tenant_id = $1
GROUP BY v.id
ORDER BY v.created_at DESC
      `,
      [tenantId]
    );

    res.json({ vendors: result.rows });
  } catch (err) {
    console.error("❌ Failed to load vendors", err);
    res.status(500).json({ error: "Failed to load vendors" });
  }
});

// ======================================
// POST /api/vendors
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
      INSERT INTO vendors (id, tenant_id, name)
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
        INSERT INTO vendor_contacts
          (id, vendor_id, tenant_id, type, label, value)
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
    console.error("❌ Failed to save vendor", err);
    res.status(500).json({ error: "Failed to save vendor" });
  }
});

export default router;