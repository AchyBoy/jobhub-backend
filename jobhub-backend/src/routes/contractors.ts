//JobHub/jobhub-backend/src/routes/contractors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

router.use(requireAuthWithTenant);

// ======================================
// GET /api/contractors
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
  c.id,
  c.name,
  c.active,
  c.created_at as "createdAt",
  COALESCE(
    json_agg(
      json_build_object(
        'id', cc.id,
        'type', cc.type,
        'label', cc.label,
        'value', cc.value
      )
    ) FILTER (WHERE cc.id IS NOT NULL),
    '[]'
  ) as contacts
FROM contractors c
LEFT JOIN contractor_contacts cc
  ON cc.contractor_id = c.id
  AND cc.tenant_id = c.tenant_id
WHERE c.tenant_id = $1
GROUP BY c.id
ORDER BY c.created_at DESC
      `,
      [tenantId]
    );

    res.json({ contractors: result.rows });
  } catch (err) {
    console.error("❌ Failed to load contractors", err);
    res.status(500).json({ error: "Failed to load contractors" });
  }
});

// ======================================
// POST /api/contractors
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
      INSERT INTO contractors (id, tenant_id, name)
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
        INSERT INTO contractor_contacts
          (id, contractor_id, tenant_id, type, label, value)
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
    console.error("❌ Failed to save contractor", err);
    res.status(500).json({ error: "Failed to save contractor" });
  }
});

export default router;