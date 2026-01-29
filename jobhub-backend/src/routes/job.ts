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
    name: "Untitled Job", // app can rename later
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

const existing = listNotesForJob(jobId);

// 🚨 SAFETY: never allow overwrite with empty notes
if (existing.length && notes.length === 0) {
  return res.status(409).json({
    error: "Refusing to overwrite existing notes with empty payload",
  });
}

// 🚨 SAFETY: never allow accidental shrinking
if (existing.length && notes.length < existing.length) {
  return res.status(409).json({
    error: "Refusing to overwrite notes with smaller set",
  });
}

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

// POST /api/job/:jobId/meta
// Body: { name?: string }
router.post("/job/:jobId/meta", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });

  const name =
    typeof req.body?.name === "string"
      ? req.body.name.trim()
      : null;

  if (!name) {
    return res.status(400).json({ error: "Missing job name" });
  }

  upsertJob({
    id: jobId,
    name,
  });

  res.json({ success: true });
});

export default router;
