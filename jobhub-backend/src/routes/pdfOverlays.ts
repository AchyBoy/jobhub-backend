//JobHub/jobhub-backend/src/routes/pdfOverlays.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();

// 🔐 All overlay routes require auth + tenant
router.use(requireAuthWithTenant);

/**
 * GET /api/pdf-overlays/:jobId
 */
router.get("/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        job_id as "jobId",
        page,
        type,
        x,
        y,
        width,
        height,
        text_content as "textContent",
        color,
        layer,
        visible,
        created_at as "createdAt"
      FROM pdf_overlays
      WHERE job_id = $1
        AND tenant_id = $2
      ORDER BY created_at ASC
      `,
      [jobId, tenantId]
    );

    return res.json({ overlays: result.rows });

  } catch (err) {
    console.error("❌ Failed to load overlays", err);
    return res.status(500).json({ error: "Failed to load overlays" });
  }
});

/**
 * POST /api/pdf-overlays/:jobId
 * Body: { page, type, x, y, width, height, textContent, color, layer }
 */
router.post("/:jobId", async (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Missing tenant context" });
  }

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  const {
    page,
    type,
    x,
    y,
    width,
    height,
    textContent,
    color,
    layer,
  } = req.body || {};

  if (
    typeof page !== "number" ||
    typeof type !== "string" ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof layer !== "string"
  ) {
    return res.status(400).json({ error: "Invalid overlay payload" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO pdf_overlays
      (job_id, tenant_id, page, type, x, y, width, height, text_content, color, layer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
      `,
      [
        jobId,
        tenantId,
        page,
        type,
        x,
        y,
        width ?? null,
        height ?? null,
        textContent ?? null,
        color ?? null,
        layer,
      ]
    );

    return res.json({ id: result.rows[0].id });

  } catch (err) {
    console.error("❌ Failed to create overlay", err);
    return res.status(500).json({ error: "Overlay creation failed" });
  }
});

export default router;