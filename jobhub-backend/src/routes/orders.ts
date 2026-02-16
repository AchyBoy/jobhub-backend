//JobHub/jobhub-backend/src/routes/orders.ts
import { Router } from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();



const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function requireEnv(name: string) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
  return process.env[name]!;
}

async function sendOrderEmail(args: {
  to: string[];
  bcc?: string[];
  subject: string;
  text: string;
  pdfBuffer: Buffer;
  filename: string;
}) {
  // SMTP config (Railway Variables)
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = requireEnv("SMTP_FROM");

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // typical
    auth: { user, pass },
  });

  await transport.sendMail({
    from,
    to: args.to,
    bcc: args.bcc,
    subject: args.subject,
    text: args.text,
    attachments: [
      {
        filename: args.filename,
        content: args.pdfBuffer,
      },
    ],
  });
}

/**
 * POST /api/orders/create
 * SAFE ORDER FLOW:
 * 1) BEGIN
 * 2) Insert DB rows
 * 3) COMMIT
 * 4) Upload PDF
 * 5) Send Email
 *
 * This guarantees DB integrity even if upload/email fails.
 */
router.post(
  "/create",
  requireAuthWithTenant,
  upload.single("pdf"),
  async (req, res) => {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const tenantEmail = user?.email;

    if (!tenantId) {
      return res.status(401).json({ error: "No tenant" });
    }

    const {
      orderId,
      jobId,
      phase,
      supplierId,
      supervisor,
      deliveryAddress,
      itemsJson,
      bccTenant,
    } = req.body as Record<string, string>;

    if (!orderId || !jobId || !phase || !supplierId || !itemsJson) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      return res.status(400).json({ error: "Missing pdf file" });
    }

    let items: Array<{ materialId: string; qtyOrdered: number }> = [];
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return res.status(400).json({ error: "itemsJson must be valid JSON" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "itemsJson empty" });
    }

    const client = await pool.connect();
    let poNumber = 0;

        // Supabase storage key (declare ONCE)
    const objectKey =
      `tenant/${tenantId}/job/${jobId}/orders/${orderId}.pdf`;

    try {
      await client.query("BEGIN");

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [tenantId]
      );

      const poRes = await client.query(
        "SELECT COALESCE(MAX(po_number),0)+1 AS next_po FROM orders WHERE tenant_id=$1",
        [tenantId]
      );

      poNumber = Number(poRes.rows[0].next_po);

      // Insert single order row
      await client.query(
        `
        INSERT INTO orders
        (id, tenant_id, job_id, phase, supplier_id, po_number, supervisor, delivery_address, pdf_path)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          orderId,
          tenantId,
          jobId,
          phase,
          supplierId,
          poNumber,
          supervisor || null,
          deliveryAddress || null,
          objectKey,
        ]
      );

      // Insert order_items and update materials
      for (const it of items) {
        const uuidRes = await client.query(
          "SELECT gen_random_uuid() AS id"
        );
        const itemId = uuidRes.rows[0].id;

        await client.query(
          `
          INSERT INTO order_items
          (id, order_id, material_id, qty_ordered)
          VALUES ($1,$2,$3,$4)
          `,
          [itemId, orderId, it.materialId, it.qtyOrdered]
        );

        await client.query(
          `
          UPDATE materials
          SET qty_ordered = qty_ordered + $1
          WHERE id=$2 AND tenant_id=$3
          `,
          [it.qtyOrdered, it.materialId, tenantId]
        );
      }

      await client.query("COMMIT");

      // ---- AFTER DB SUCCESS ----


      await supabaseAdmin.storage
        .from("orders")
        .upload(objectKey, file.buffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      const emailsRes = await pool.query(
        `
        SELECT value
        FROM supplier_contacts
        WHERE tenant_id=$1
        AND supplier_id=$2
        AND type='email'
        `,
        [tenantId, supplierId]
      );

      const to = emailsRes.rows.map((r: any) => r.value).filter(Boolean);

      const shouldBccTenant = (bccTenant ?? "true") !== "false";
      const bcc = shouldBccTenant && tenantEmail ? [tenantEmail] : [];

// Email sending disabled — mobile app handles email draft

      return res.json({
        ok: true,
        order: {
          id: orderId,
          poNumber,
        },
      });

    } catch (e: any) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: e?.message || "Order create failed",
      });
    } finally {
      client.release();
    }
  }
);

router.get("/:orderId/pdf", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const orderId = req.params.orderId;

  const r = await pool.query(
    "SELECT pdf_path FROM orders WHERE id = $1 AND tenant_id = $2",
    [orderId, tenantId]
  );

  const objectKey = r.rows[0]?.pdf_path;
  if (!objectKey) {
    return res.status(404).json({ error: "Not found" });
  }

  // Generate permanent public URL (bucket must be public)
  const { data } = supabaseAdmin
    .storage
    .from("orders")
    .getPublicUrl(objectKey);

  const publicUrl = data.publicUrl;

  if (!publicUrl) {
    return res.status(500).json({ error: "Failed to generate public URL" });
  }

  return res.json({
    url: publicUrl,
  });
});

export default router;