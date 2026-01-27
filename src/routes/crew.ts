import { Router } from "express";
import { getJob, listNotesForJob, upsertNotesForJob } from "../lib/store";

const router = Router();

// GET /api/crew/job/:jobId?phase=Final&view=Rough,Contractor%20Rough
router.get("/job/:jobId", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const activePhase = String(req.query.phase || "").trim();
  const viewParam = String(req.query.view || "").trim();

  if (!jobId) return res.status(400).json({ error: "Missing jobId" });
  if (!activePhase) return res.status(400).json({ error: "Missing ?phase=" });

  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const notes = listNotesForJob(jobId);

  // Build allowed phases from active + view list
  const viewPhases = viewParam
    ? viewParam.split(",").map(s => decodeURIComponent(s).trim()).filter(Boolean)
    : [];

  const allowed = new Set<string>([activePhase, ...viewPhases]);

  // Filter notes to only allowed phases
  const allowedNotes = notes.filter(n => allowed.has(n.phase));

  // Return active phase notes + grouped view-only notes (nice for UI)
  const activeNotes = allowedNotes.filter(n => n.phase === activePhase);

  const viewOnly: Record<string, typeof activeNotes> = {};
  for (const p of viewPhases) {
    viewOnly[p] = allowedNotes.filter(n => n.phase === p);
  }

  res.json({
    jobId,
    jobName: job.name,
    activePhase,
    notes: activeNotes,
    viewOnly,
    viewPhases
  });
});

// POST /api/crew/job/:jobId/notes/complete
// Body: { phase: string; text: string }
router.post("/job/:jobId/notes/complete", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const { phase, text } = req.body || {};

  if (!jobId) return res.status(400).json({ error: "Missing jobId" });
  if (!phase || !text)
    return res.status(400).json({ error: "Missing phase or text" });

  const job = getJob(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const notes = listNotesForJob(jobId);

  const idx = notes.findIndex(
    n => n.phase === phase && n.text === text
  );

  if (idx === -1) {
    return res.status(404).json({ error: "Note not found" });
  }

  const now = new Date().toISOString();

  const updated = notes.map((n, i) =>
    i !== idx
      ? n
      : {
          ...n,
          markedCompleteBy: "crew" as const,
          crewCompletedAt: now,
        }
  );

  upsertNotesForJob(jobId, updated);

  res.json({
    success: true,
    jobId,
    phase,
    text,
    crewCompletedAt: now,
  });
});

export default router;
