import { Router } from "express";
import {
  getJob,
  upsertJob,
  upsertNotesForJob,
  listNotesForJob,
} from "../lib/store";

const router = Router();

// POST /api/job/:jobId/notes
// Body: { notes: JobNote[] }
router.post("/job/:jobId/notes", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });

let job = getJob(jobId);

if (!job) {
  upsertJob({
    id: jobId,
    name: "Untitled Job",
  });
}

const rawNotes = req.body?.notes;
if (!Array.isArray(rawNotes)) {
  return res.status(400).json({ error: "Missing notes array" });
}

// 🔁 Normalize app notes → backend Note schema
// NOTE (future us):
// - noteA / noteB are now first-class fields
// - `text` is legacy and kept for backward compatibility
// - Backend stores ALL fields so app + website stay in sync
const notes = rawNotes.map((n: any, i: number) => ({
  id: n.id ?? `${jobId}-${i}`, // required
  jobId,
  phase: n.phase,

  // Primary + secondary note content
  noteA: n.noteA ?? n.text ?? "",
  noteB: n.noteB ?? "",

  // Legacy fallback (do NOT remove yet)
  text: n.text ?? n.noteA ?? "",

  status: n.status ?? "incomplete",
  markedCompleteBy: n.markedCompleteBy,
  crewCompletedAt: n.crewCompletedAt,
  officeCompletedAt: n.officeCompletedAt,

  createdAt: n.createdAt ?? new Date().toISOString(),
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