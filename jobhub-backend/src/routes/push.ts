//JobHub/ jobhub-backend/src/routes/push.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { pool } from "../db/postgres";

const router = Router();
router.use(requireAuthWithTenant);

/**
 * POST /api/push/register
 * Registers an Expo push token for the authenticated user
 */
router.post("/register", async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;

  if (!tenantId || !userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { expoPushToken } = req.body;

  if (!expoPushToken || typeof expoPushToken !== "string") {
    return res.status(400).json({ error: "Missing expoPushToken" });
  }

  const deviceSession =
    (req.headers["x-device-session"] as string | undefined) || null;

  try {
    // Avoid duplicate rows for same user + same token
    const existing = await pool.query(
      `
      SELECT id
      FROM push_tokens
      WHERE user_id = $1
      AND expo_push_token = $2
      LIMIT 1
      `,
      [userId, expoPushToken]
    );

    if (existing.rowCount === 0) {
      await pool.query(
        `
        INSERT INTO push_tokens
          (user_id, tenant_id, expo_push_token, device_session_id)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, tenantId, expoPushToken, deviceSession]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed registering push token", err);
    res.status(500).json({ error: "Push registration failed" });
  }
});

export default router;