// jobhub-backend/src/middleware/requireAuthWithTenant.ts
import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db/postgres";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function requireAuthWithTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = auth.replace("Bearer ", "");

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = data.user.id;
    console.log("🧪 AUTH userId =", userId);

    const result = await pool.query(
      `
      SELECT tenant_id
      FROM tenant_users
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "User not assigned to a tenant" });
    }

    // 🔐 Attach canonical user context
    (req as any).user = {
      id: userId,
      tenantId: result.rows[0].tenant_id,
    };

    next();
  } catch (err) {
    console.error("❌ Auth middleware failed", err);
    res.status(500).json({ error: "Auth failure" });
  }
}