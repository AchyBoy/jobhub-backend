import { Router } from "express";
import { requireAuth } from "../middleware/auth";

console.log("🧪 LOADING auth-test ROUTER FILE");

const router = Router();

// 🔓 TEMP: unprotected route to verify routing works
router.get("/ping", (_req, res) => {
  res.json({ ok: true, route: "ping" });
});

// 🔐 Protected route
router.get("/auth-test", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;