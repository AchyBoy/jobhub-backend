import fs from "fs";
import path from "path";
import { Job, Note } from "../types";

const dataDir = path.join(process.cwd(), "data");
const jobsPath = path.join(dataDir, "jobs.json");
const notesPath = path.join(dataDir, "notes.json");

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function writeJson<T>(filePath: string, value: T) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function listJobs(): Job[] {
  return readJson<Job[]>(jobsPath);
}

export function getJob(jobId: string): Job | null {
  const jobs = listJobs();
  return jobs.find(j => j.id === jobId) || null;
}

export function listNotesForJob(jobId: string): Note[] {
  const notes = readJson<Note[]>(notesPath);
  return notes.filter(n => n.jobId === jobId);
}

export function upsertJob(job: Job) {
  const jobs = listJobs();
  const idx = jobs.findIndex(j => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  writeJson(jobsPath, jobs);
}

export function upsertNotesForJob(jobId: string, next: Note[]) {
  const all = readJson<Note[]>(notesPath);
  const kept = all.filter(n => n.jobId !== jobId);
  writeJson(notesPath, [...kept, ...next]);
}
