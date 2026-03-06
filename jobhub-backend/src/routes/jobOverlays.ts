//JobHub/jobhub-backend/src/routes/jobOverlays.ts
import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/requireAuthWithTenant";
import { supabaseAdmin } from "../lib/supabaseAdmin";

console.log("📦 jobOverlays route loaded");

const router = Router();
router.use(requireAuthWithTenant);

router.put("/:jobId", async (req: any, res) => {
  console.log("📥 overlay upload request", req.params.jobId);
  try {
    const { jobId } = req.params;
    const overlay = req.body;

    const filePath = `job_${jobId}.overlay.json`;

    const { error } = await supabaseAdmin.storage
      .from("job-overlays")
      .upload(filePath, JSON.stringify(overlay), {
        upsert: true,
        contentType: "application/json",
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "overlay upload failed" });
  }
});

router.get("/:jobId/url", async (req: any, res) => {
  console.log("📄 job overlay url requested", req.params.jobId);
  try {
    const { jobId } = req.params;

    const { data, error } = await supabaseAdmin.storage
      .from("job-overlays")
      .createSignedUrl(`job_${jobId}.overlay.json`, 60 * 60);

    if (error) throw error;

    res.json({ url: data.signedUrl });
  } catch (e) {
    res.status(500).json({ error: "overlay url failed" });
  }
});

export default router;