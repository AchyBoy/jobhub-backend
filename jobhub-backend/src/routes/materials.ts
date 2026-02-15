//JobHub/jobhub-backend/src/routes/materials.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();
router.use(requireAuthWithTenant);

/* =========================================================
   GET /api/materials?jobId=xxx
   ========================================================= */
router.get("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { jobId } = req.query;

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM materials
      WHERE tenant_id = $1
      AND ($2::text IS NULL OR job_id = $2)
      ORDER BY created_at DESC
      `,
      [tenantId, jobId ?? null]
    );

    res.json({ materials: result.rows });
  } catch (err) {
    console.error("❌ Failed loading materials", err);
    res.status(500).json({ error: "Failed loading materials" });
  }
});

/* =========================================================
   POST /api/materials
   Create or update material
   ========================================================= */
router.post("/", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  const {
    id,
    jobId,
    itemName,
    itemCode,
    phase,
    supplierId,
    qtyNeeded,
  } = req.body;

  if (!id || !jobId || !itemName || !phase) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `
      INSERT INTO materials
        (id, tenant_id, job_id, item_name, item_code, phase, supplier_id, qty_needed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id)
      DO UPDATE SET
        item_name = EXCLUDED.item_name,
        item_code = EXCLUDED.item_code,
        phase = EXCLUDED.phase,
        supplier_id = EXCLUDED.supplier_id,
        qty_needed = EXCLUDED.qty_needed
      `,
      [
        id,
        tenantId,
        jobId,
        itemName,
        itemCode ?? null,
        phase,
        supplierId ?? null,
        qtyNeeded ?? 0,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed saving material", err);
    res.status(500).json({ error: "Failed saving material" });
  }
});

/* =========================================================
   PATCH /api/materials/:id
   Update material fields (qty, supplier, phase, etc)
   ========================================================= */
router.patch("/:id", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  const {
    qtyNeeded,
    supplierId,
    phase,
    itemName,
    itemCode,
    status,
    dateOrdered,
    dateDelivered,
  } = req.body;

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  try {
    await pool.query(
      `
      UPDATE materials
      SET
        qty_needed     = COALESCE($1, qty_needed),
        supplier_id    = COALESCE($2, supplier_id),
        phase          = COALESCE($3, phase),
        item_name      = COALESCE($4, item_name),
        item_code      = COALESCE($5, item_code),
        status         = COALESCE($6, status),
        date_ordered   = COALESCE($7, date_ordered),
        date_delivered = COALESCE($8, date_delivered)
      WHERE id = $9
      AND tenant_id = $10
      `,
      [
        qtyNeeded ?? null,
        supplierId ?? null,
        phase ?? null,
        itemName ?? null,
        itemCode ?? null,
        status ?? null,
        dateOrdered ?? null,
        dateDelivered ?? null,
        id,
        tenantId,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed updating material", err);
    res.status(500).json({ error: "Failed updating material" });
  }
});

/* =========================================================
   POST /api/materials/:id/reserve
   Reserve inventory for material
   ========================================================= */
router.post("/:id/reserve", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { qty } = req.body;

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const materialRes = await client.query(
      `SELECT * FROM materials WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (!materialRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Material not found" });
    }

    const material = materialRes.rows[0];

    const inventoryRes = await client.query(
      `
      SELECT *
      FROM inventory
      WHERE tenant_id = $1
      AND item_name = $2
      `,
      [tenantId, material.item_name]
    );

    if (!inventoryRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Inventory record missing" });
    }

    const inventory = inventoryRes.rows[0];
    const available = inventory.qty_on_hand - inventory.qty_reserved;

    if (available < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient inventory" });
    }

    await client.query(
      `UPDATE inventory
       SET qty_reserved = qty_reserved + $1
       WHERE id = $2`,
      [qty, inventory.id]
    );

    await client.query(
      `UPDATE materials
       SET qty_allocated = qty_allocated + $1
       WHERE id = $2`,
      [qty, id]
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Reserve failed", err);
    res.status(500).json({ error: "Reserve failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
   POST /api/materials/:id/consume
   Deduct reserved inventory on completion
   ========================================================= */
router.post("/:id/consume", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) return res.status(403).json({ error: "Missing tenant" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const materialRes = await client.query(
      `SELECT * FROM materials WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (!materialRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Material not found" });
    }

    const material = materialRes.rows[0];
    const qty = material.qty_allocated;

    if (qty <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nothing allocated" });
    }

    const inventoryRes = await client.query(
      `
      SELECT *
      FROM inventory
      WHERE tenant_id = $1
      AND item_name = $2
      `,
      [tenantId, material.item_name]
    );

    const inventory = inventoryRes.rows[0];

    await client.query(
      `
      UPDATE inventory
      SET
        qty_on_hand = qty_on_hand - $1,
        qty_reserved = qty_reserved - $1
      WHERE id = $2
      `,
      [qty, inventory.id]
    );

    await client.query(
      `
      UPDATE materials
      SET
        status = 'complete'
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Consume failed", err);
    res.status(500).json({ error: "Consume failed" });
  } finally {
    client.release();
  }
});

export default router;