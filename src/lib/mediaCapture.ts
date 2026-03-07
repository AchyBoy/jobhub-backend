// JobHub/src/lib/mediaCapture.ts
import { apiFetch } from "./apiClient";
import { enqueueSync, makeId, nowIso } from "./syncEngine";

type CaptureArgs = {
  jobId: string;
  localUri: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  latitude?: number | null;
  longitude?: number | null;
};

export async function enqueueMediaUpload(args: CaptureArgs) {
  const {
    jobId,
    localUri,
    mimeType,
    fileName,
    sizeBytes,
    latitude,
    longitude,
  } = args;

  // 1️⃣ Create DB record first
  const res = await apiFetch("/api/media/create", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      fileType: mimeType,
      fileSize: sizeBytes,
      latitude,
      longitude,
    }),
  });

  const { mediaId, storagePath } = res;

  // 2️⃣ Enqueue upload worker
  await enqueueSync({
    id: makeId(),
    type: "media_upload",
    coalesceKey: `media_${mediaId}`, // unique so it never coalesces
    createdAt: nowIso(),
    payload: {
      mediaId,
      jobId,
      storagePath,
      localUri,
      mimeType,
      fileName,
      sizeBytes,
    },
  });

  return {
    mediaId,
    storagePath,
  };
}