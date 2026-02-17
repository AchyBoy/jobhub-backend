//JobHub/ jobhub-backend/src/routes/suppliers.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();
router.use(requireAuthWithTenant);

/* =========================================================
   GET /api/suppliers
   ========================================================= */
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
  s.is_internal as "isInternal",
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
FROM suppliers s
LEFT JOIN supplier_contacts sc
  ON sc.supplier_id = s.id
  AND sc.tenant_id = s.tenant_id
WHERE s.tenant_id = $1
GROUP BY s.id
ORDER BY s.created_at DESC
      `,
      [tenantId]
    );

    res.json({ suppliers: result.rows });
  } catch (err) {
    console.error("❌ Failed to load suppliers", err);
    res.status(500).json({ error: "Failed to load suppliers" });
  }
});

/* =========================================================
   GET /api/suppliers/internal
   Get tenant's internal (Storage) supplier
   ========================================================= */
router.get("/internal", async (req: any, res) => {
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
        s.is_internal as "isInternal",
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
      FROM suppliers s
      LEFT JOIN supplier_contacts sc
        ON sc.supplier_id = s.id
        AND sc.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1
      AND s.is_internal = true
      GROUP BY s.id
      LIMIT 1
      `,
      [tenantId]
    );

    res.json({
      supplier: result.rows[0] ?? null,
    });
  } catch (err) {
    console.error("❌ Failed to load internal supplier", err);
    res.status(500).json({ error: "Failed to load internal supplier" });
  }
});


/* =========================================================
   POST /api/suppliers
   Create or update supplier
   ========================================================= */
router.post("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  const { id, name, isInternal, contacts = [] } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `
      INSERT INTO suppliers (id, tenant_id, name, is_internal)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id)
      DO UPDATE SET
        name        = EXCLUDED.name,
        is_internal = EXCLUDED.is_internal
      `,
      [id, tenantId, name, isInternal ?? false]
    );

    for (const contact of contacts) {
      await pool.query(
        `
        INSERT INTO supplier_contacts
          (id, supplier_id, tenant_id, type, label, value)
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
          contact.value ?? null,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to save supplier", err);
    res.status(500).json({ error: "Failed to save supplier" });
  }
});

export default router;