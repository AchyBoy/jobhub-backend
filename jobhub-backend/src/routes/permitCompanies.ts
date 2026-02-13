//JobHub/ jobhub-backend/src/routes/permitCompanies.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/permit-companies
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
  p.id,
  p.name,
  p.active,
  p.created_at as "createdAt",
  COALESCE(
    json_agg(
      json_build_object(
        'id', pc.id,
        'type', pc.type,
        'label', pc.label,
        'value', pc.value
      )
    ) FILTER (WHERE pc.id IS NOT NULL),
    '[]'
  ) as contacts
FROM permit_companies p
LEFT JOIN permit_company_contacts pc
  ON pc.permit_company_id = p.id
  AND pc.tenant_id = p.tenant_id
WHERE p.tenant_id = $1
GROUP BY p.id
ORDER BY p.created_at DESC
      `,
      [tenantId]
    );

    res.json({ permitCompanies: result.rows });
  } catch (err) {
    console.error("❌ Failed to load permit companies", err);
    res.status(500).json({ error: "Failed to load permit companies" });
  }
});

// ======================================
// POST /api/permit-companies
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
      INSERT INTO permit_companies (id, tenant_id, name)
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
        INSERT INTO permit_company_contacts
          (id, permit_company_id, tenant_id, type, label, value)
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
    console.error("❌ Failed to save permit company", err);
    res.status(500).json({ error: "Failed to save permit company" });
  }
});

export default router;