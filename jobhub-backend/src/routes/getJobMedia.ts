//JobHub/jobhub-backend/src/routes/getJobMedia.ts
import { Router } from "express";
import { pool } from "../../db/postgres";

const router = Router();

/**
 * GET /api/media/job/:jobId
 * cursor pagination
 */
router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
    const cursor = req.query.cursor as string | undefined;

    const values: any[] = [jobId, limit];

    let cursorSQL = "";

    if (cursor) {
      values.push(cursor);
      cursorSQL = `AND created_at < $3`;
    }

    const result = await pool.query(
      `
      SELECT
        id,
        job_id,
        mime_type,
        storage_path,
        upload_status,
        created_at
      FROM job_media
      WHERE job_id = $1
      ${cursorSQL}
      ORDER BY created_at DESC
      LIMIT $2
      `,
      values
    );

    const rows = result.rows;

    let nextCursor = null;

    if (rows.length === limit) {
      nextCursor = rows[rows.length - 1].created_at;
    }

    res.json({
      media: rows,
      nextCursor,
    });
  } catch (err) {
    console.error("MEDIA FETCH ERROR", err);
    res.status(500).json({ error: "Failed to fetch media" });
  }
});

export default router;