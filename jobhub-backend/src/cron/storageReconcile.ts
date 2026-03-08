//JjobHub/jobhub-backend/src/cron.ts
import cron from "node-cron";
import { pool } from "../db/postgres";

export function startStorageReconcileCron() {

  async function runReconcile() {

    try {

      console.log("🔧 Storage reconciliation starting...");

      const result = await pool.query(`
        UPDATE tenants t
        SET media_bytes_used = (
          SELECT COALESCE(SUM(size_bytes),0)
          FROM job_media
          WHERE tenant_id = t.id
        )
        RETURNING id
      `);

      console.log("✅ Storage reconciliation complete", {
        tenantsUpdated: result.rowCount
      });

    } catch (err) {

      console.error("❌ Storage reconciliation failed", err);

    }

  }

  // run immediately on server start
  runReconcile();

  // then run every minute
  cron.schedule("0 3 * * 0", runReconcile);

}