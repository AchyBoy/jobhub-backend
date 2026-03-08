//JobHub/jobhub-backend/src/routes/media.ts
import { Router } from "express";
import { pool } from "../db/postgres";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

router.use(requireAuthWithTenant);

/*
GET media for job
Cursor pagination
*/
router.get("/job/:jobId", async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user?.tenantId;
    const cursor = req.query.cursor;

    if (!tenantId) {
      return res.status(401).json({ error: "Missing tenant" });
    }

    const limit = 30;

    let query = `
      SELECT *
      FROM job_media
      WHERE tenant_id = $1
      AND job_id = $2
    `;

    const params: any[] = [tenantId, jobId];

    if (cursor) {
      query += ` AND created_at < $3`;
      params.push(cursor);
    }

    query += `
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const result = await pool.query(query, params);

// create signed URLs for media
// build direct storage URLs instead of signing (much faster)
console.log("🚨 MEDIA ROUTE BUILDING PUBLIC URLS", result.rows.length);

// create signed URLs for media (parallelized)
console.log("🚨 MEDIA ROUTE SIGNING START", result.rows.length);

const signedMedia = await Promise.all(
  result.rows.map(async (m: any) => {

    const { data } = await supabaseAdmin
      .storage
      .from("job-media")
      .createSignedUrl(m.storage_path, 3600);

    return {
      ...m,
      signed_url: data?.signedUrl ?? null,
    };

  })
);

res.json({
  media: signedMedia,
  nextCursor:
    result.rows.length === limit
      ? result.rows[result.rows.length - 1].created_at
      : null,
});

  } catch (err) {
    console.error("❌ media fetch error", err);
    res.status(500).json({ error: "Failed to load media" });
  }
});

/*
Create media record BEFORE upload
*/
router.post("/create", async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userEmail = req.user?.email;

    if (!tenantId) {
      return res.status(401).json({ error: "Missing tenant" });
    }

    const {
      jobId,
      fileName,
      mimeType,
      sizeBytes,
      latitude,
      longitude
    } = req.body;

    // check tenant storage usage
const tenantRes = await pool.query(
  `
  SELECT media_bytes_used, media_bytes_limit
  FROM tenants
  WHERE id = $1
  `,
  [tenantId]
);

const tenant = tenantRes.rows[0];

if (!tenant) {
  return res.status(404).json({ error: "Tenant not found" });
}

const newTotal = Number(tenant.media_bytes_used) + Number(sizeBytes);

if (newTotal > Number(tenant.media_bytes_limit)) {
  return res.status(400).json({
    error: "STORAGE_LIMIT_REACHED",
    limit: tenant.media_bytes_limit,
    used: tenant.media_bytes_used
  });
}

const id = randomUUID();

// extract extension from original filename
// derive extension from mimeType instead of filename
let ext = 'bin';

if (mimeType?.startsWith('video')) ext = 'mp4';
else if (mimeType?.includes('jpeg')) ext = 'jpg';
else if (mimeType?.includes('png')) ext = 'png';

const storagePath = `${tenantId}/${jobId}/${id}.${ext}`;

    await pool.query(
      `
      INSERT INTO job_media
      (
        id,
        tenant_id,
        job_id,
        file_name,
        storage_path,
        mime_type,
        size_bytes,
        uploaded_by,
        latitude,
        longitude,
        upload_status
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
      `,
      [
        id,
        tenantId,
        jobId,
        fileName,
        storagePath,
        mimeType,
        sizeBytes,
        userEmail,
        latitude || null,
        longitude || null
      ]
    );

    res.json({
      mediaId: id,
      storagePath
    });

  } catch (err) {
    console.error("❌ media create error", err);
    res.status(500).json({ error: "Failed to create media record" });
  }
});

/*
Mark upload complete
*/
router.post("/complete/:id", async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    // get file size so we can increment tenant usage
    const mediaRes = await pool.query(
      `
      SELECT size_bytes
      FROM job_media
      WHERE id = $1
      AND tenant_id = $2
      `,
      [id, tenantId]
    );

    const media = mediaRes.rows[0];

    // mark upload complete
    await pool.query(
      `
      UPDATE job_media
      SET upload_status = 'uploaded'
      WHERE id = $1
      AND tenant_id = $2
      `,
      [id, tenantId]
    );

    // increment tenant storage usage
    if (media) {
      await pool.query(
        `
        UPDATE tenants
        SET media_bytes_used = media_bytes_used + $1
        WHERE id = $2
        `,
        [media.size_bytes, tenantId]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("❌ media complete error", err);
    res.status(500).json({ error: "Failed to mark uploaded" });
  }
});

/*
Delete media
*/
router.delete("/:id", async (req: any, res) => {

  try {

    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    // get storage path first
    const mediaRes = await pool.query(
      `
      SELECT storage_path, size_bytes
      FROM job_media
      WHERE id = $1
      AND tenant_id = $2
      `,
      [id, tenantId]
    );

    const media = mediaRes.rows[0];

    // delete file from Supabase storage
    if (media?.storage_path) {

      const { error } = await supabaseAdmin
        .storage
        .from("job-media")
        .remove([media.storage_path]);

      if (error) {
        console.log("⚠️ storage delete error", error.message);
      }

    }

    // decrement tenant storage usage
if (media?.size_bytes) {
  await pool.query(
    `
    UPDATE tenants
    SET media_bytes_used = GREATEST(media_bytes_used - $1, 0)
    WHERE id = $2
    `,
    [media.size_bytes, tenantId]
  );
}

    // delete database row
    await pool.query(
      `
      DELETE FROM job_media
      WHERE id = $1
      AND tenant_id = $2
      `,
      [id, tenantId]
    );

    res.json({ success: true });

  } catch (err) {

    console.error("❌ media delete error", err);
    res.status(500).json({ error: "Delete failed" });

  }

});

export default router;