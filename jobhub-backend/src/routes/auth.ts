import { Router } from "express";

const router = Router();

// 🔍 ROUTE SANITY CHECK
router.get("/ping", (_req, res) => {
  res.json({
    ok: true,
    route: "api/auth/ping",
  });
});

export default router;