//JjobHub/jobhub-backend/src/cron.ts
import cron from "node-cron";
import { pool } from "../db/postgres";

export function startStorageReconcileCron() {

  // Every Sunday at 3:00 AM
  cron.schedule("0 3 * * 0", async () => {

    try {

      console.log("🔧 Weekly storage reconciliation starting...");

      await pool.query(`
        UPDATE tenants t
        SET media_bytes_used = (
          SELECT COALESCE(SUM(size_bytes),0)
          FROM job_media
          WHERE tenant_id = t.id
        )
      `);

      console.log("✅ Weekly storage reconciliation complete");

    } catch (err) {

      console.error("❌ Weekly storage reconciliation failed", err);

    }

  });

}