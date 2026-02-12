//JobHub/jobhub-backend/src/routes/crews.ts!!PLURAL!!
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

// 🔐 All crew directory routes require auth
router.use(requireAuthWithTenant);

// ======================================
// GET /api/crews
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
FROM crews c
LEFT JOIN crew_contacts cc
  ON cc.crew_id = c.id
  AND cc.tenant_id = c.tenant_id
WHERE c.tenant_id = $1
GROUP BY c.id
ORDER BY c.created_at DESC
      `,
      [tenantId]
    );

    res.json({ crews: result.rows });
  } catch (err) {
    console.error("❌ Failed to load crews", err);
    res.status(500).json({ error: "Failed to load crews" });
  }
});

// ======================================
// POST /api/crews
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
    // Upsert crew
    await pool.query(
      `
      INSERT INTO crews (id, tenant_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name
      `,
      [id, tenantId, name]
    );

// Upsert contacts (no blind delete)
for (const contact of contacts) {
  await pool.query(
    `
    INSERT INTO crew_contacts
      (id, crew_id, tenant_id, type, label, value)
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
    console.error("❌ Failed to save crew", err);
    res.status(500).json({ error: "Failed to save crew" });
  }
});

export default router;