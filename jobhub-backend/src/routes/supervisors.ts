//JobHub/jobhub-backend/src/routes/supervisors.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

// 🔐 All supervisor directory routes require auth
router.use(requireAuthWithTenant);

// ======================================
// GET /api/supervisors
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
  s.id,
  s.name,
  s.active,
  s.created_at as "createdAt",
  COALESCE(
    json_agg(
      json_build_object(
        'id', sc.id,
        'type', sc.type,
        'label', sc.label,
        'value', sc.value
      )
    ) FILTER (WHERE sc.id IS NOT NULL),
    '[]'
  ) as contacts
FROM supervisors s
LEFT JOIN supervisor_contacts sc
  ON sc.supervisor_id = s.id
  AND sc.tenant_id = s.tenant_id
WHERE s.tenant_id = $1
GROUP BY s.id
ORDER BY s.created_at DESC
      `,
      [tenantId]
    );

    res.json({ supervisors: result.rows });
  } catch (err) {
    console.error("❌ Failed to load supervisors", err);
    res.status(500).json({ error: "Failed to load supervisors" });
  }
});

// ======================================
// POST /api/supervisors
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
    // Upsert supervisor
    await pool.query(
      `
      INSERT INTO supervisors (id, tenant_id, name)
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
        INSERT INTO supervisor_contacts
          (id, supervisor_id, tenant_id, type, label, value)
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
    console.error("❌ Failed to save supervisor", err);
    res.status(500).json({ error: "Failed to save supervisor" });
  }
});

export default router;