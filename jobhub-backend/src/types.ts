export type NoteStatus = "blank" | "incomplete" | "complete";

export type Job = {
  id: string;
  name: string;
};

export type Note = {
  id: string;
  jobId: string;
  phase: string;
  text: string;
  status: NoteStatus;
  createdAt: string;
  // optional metadata later
  scheduledFor?: string;
  markedCompleteBy?: "crew" | "contractor";
  crewCompletedAt?: string;
  officeCompletedAt?: string;
};
