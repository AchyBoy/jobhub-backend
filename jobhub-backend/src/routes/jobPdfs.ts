//JobHub/jobhub-backend/src/routes/jobPdfs.ts
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * POST /api/job-pdfs/upload
 */
router.post(
  "/upload",
  requireAuthWithTenant,
  upload.single("pdf"),
  async (req, res) => {
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "No tenant" });
    }

    const { jobId } = req.body;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!jobId || !file?.buffer) {
      return res.status(400).json({ error: "Missing jobId or pdf file" });
    }

    const client = await pool.connect();
    const fileId = crypto.randomUUID();
    const objectKey = `tenant/${tenantId}/job/${jobId}/${fileId}.pdf`;

    try {
      await client.query("BEGIN");

      // 1️⃣ Get previous pdf_id (if exists)
      const existingRes = await client.query(
        `
        SELECT pdf_id
        FROM jobs
        WHERE id=$1 AND tenant_id=$2
        `,
        [jobId, tenantId]
      );

      const previousPdfId = existingRes.rows[0]?.pdf_id ?? null;

      // 2️⃣ Upload to Supabase
      const { error } = await supabaseAdmin.storage
        .from("job-pdfs")
        .upload(objectKey, file.buffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      // 3️⃣ Insert new job_pdfs row
      await client.query(
        `
        INSERT INTO job_pdfs
        (id, tenant_id, job_id, file_name, storage_path)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          fileId,
          tenantId,
          jobId,
          file.originalname,
          objectKey,
        ]
      );

      // 4️⃣ Update jobs.pdf_id pointer
      await client.query(
        `
        UPDATE jobs
        SET pdf_id=$1
        WHERE id=$2 AND tenant_id=$3
        `,
        [fileId, jobId, tenantId]
      );

      // 5️⃣ Now safe to delete previous PDF
if (previousPdfId) {

  const oldRes = await client.query(
    `
    SELECT storage_path
    FROM job_pdfs
    WHERE id=$1 AND tenant_id=$2
    `,
    [previousPdfId, tenantId]
  );

 const oldStoragePath = oldRes.rows[0]?.storage_path;

// 🔎 DEBUG: see what jobs still reference this PDF
const refCheck = await client.query(
  `
  SELECT id, tenant_id, pdf_id
  FROM jobs
  WHERE pdf_id=$1
  `,
  [previousPdfId]
);

console.log("🔎 Jobs still referencing old PDF before delete:", {
  previousPdfId,
  rows: refCheck.rows,
});

if (oldStoragePath) {
  const { error: removeError } = await supabaseAdmin.storage
    .from("job-pdfs")
    .remove([oldStoragePath]);

  if (removeError) {
    throw new Error(removeError.message);
  }
}

await client.query(
  `
  DELETE FROM job_pdfs
  WHERE id=$1 AND tenant_id=$2
  `,
  [previousPdfId, tenantId]
);

console.log("🔎 Jobs still referencing old PDF:", {
  previousPdfId,
  rows: refCheck.rows
});

// attempt delete
await client.query(
  `
  DELETE FROM job_pdfs
  WHERE id=$1 AND tenant_id=$2
  `,
  [previousPdfId, tenantId]
);
}

      await client.query("COMMIT");

      return res.json({
        file: {
          id: fileId,
          fileName: file.originalname,
        },
      });

    } catch (e: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        error: e?.message || "Upload failed",
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/job-pdfs?jobId=123
 */
router.get(
  "/",
  requireAuthWithTenant,
  async (req, res) => {
    const tenantId = (req as any).user?.tenantId;
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId" });
    }

    const r = await pool.query(
      `
      SELECT id, file_name, created_at
      FROM job_pdfs
      WHERE tenant_id=$1 AND job_id=$2
      ORDER BY created_at DESC
      `,
      [tenantId, jobId]
    );

    return res.json({ files: r.rows });
  }
);

/**
 * GET /api/job-pdfs/:id/url
 */
router.get(
  "/:id/url",
  requireAuthWithTenant,
  async (req, res) => {
    const tenantId = (req as any).user?.tenantId;
    const fileId = req.params.id;

    const r = await pool.query(
      `
      SELECT storage_path
      FROM job_pdfs
      WHERE id=$1 AND tenant_id=$2
      `,
      [fileId, tenantId]
    );

    const objectKey = r.rows[0]?.storage_path;

    if (!objectKey) {
      return res.status(404).json({ error: "Not found" });
    }

    const { data, error } =
      await supabaseAdmin.storage
        .from("job-pdfs")
        .createSignedUrl(objectKey, 60);

    if (error || !data?.signedUrl) {
      return res.status(500).json({ error: "Signed URL failed" });
    }

    return res.json({ url: data.signedUrl });
  }
);

export default router;