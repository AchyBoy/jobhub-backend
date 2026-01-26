import { Router } from "express";
import { getJob, upsertNotesForJob, listNotesForJob } from "../lib/store";

const router = Router();

// POST /api/job/:jobId/notes
// Body: { notes: JobNote[] }
router.post("/job/:jobId/notes", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });

  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const rawNotes = req.body?.notes;
if (!Array.isArray(rawNotes)) {
  return res.status(400).json({ error: "Missing notes array" });
}

// 🔁 Normalize app notes → backend notes
const notes = rawNotes.map((n: any) => ({
  id: n.id,
  jobId,                     // 👈 CRITICAL
  phase: n.phase,
  title: n.text,             // 👈 app "text" → backend "title"
  status: n.status === "complete" ? "complete" : "pending",
}));

upsertNotesForJob(jobId, notes);

  res.json({ success: true });
});

// GET /api/job/:jobId/notes (office/app use)
router.get("/job/:jobId/notes", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });

  const notes = listNotesForJob(jobId);
  res.json({ jobId, notes });
});

export default router;