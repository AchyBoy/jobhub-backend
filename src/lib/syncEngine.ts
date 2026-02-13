// JobHub/src/lib/syncEngine.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './apiClient';

type SyncItem =
  | {
      id: string;
      type: 'crew_assignment';
      coalesceKey: string; // used to dedupe
      createdAt: string;
      payload: { jobId: string; crewId: string; phase: string };
    }
  | {
      id: string;
      type: 'job_notes_sync';
      coalesceKey: string; // one pending sync per job
      createdAt: string;
      payload: { jobId: string; notes: any[] };
    };

const QUEUE_KEY = 'sync_queue_v1';

let started = false;
let timer: any = null;

async function readQueue(): Promise<SyncItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: SyncItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/**
 * Enqueue with COALESCE:
 * If an item with the same coalesceKey exists, we replace it (keep latest).
 */
export async function enqueueSync(item: SyncItem) {
  const q = await readQueue();

  const idx = q.findIndex(x => x.coalesceKey === item.coalesceKey);
  if (idx >= 0) {
    q[idx] = item; // replace with newest payload
  } else {
    q.push(item);
  }

  await writeQueue(q);

  // Start retry loop automatically (no NetInfo required)
  startSyncLoop();
}

/**
 * Attempts to flush queue once.
 * Leaves failed items in queue for retry.
 */
export async function flushSyncQueue() {
  const q = await readQueue();
  if (q.length === 0) return;

  const remaining: SyncItem[] = [];

  for (const item of q) {
    try {
      if (item.type === 'crew_assignment') {
        const { jobId, crewId, phase } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/crews`, {
          method: 'POST',
          body: JSON.stringify({ crewId, phase }),
        });
      }

      if (item.type === 'job_notes_sync') {
        const { jobId, notes } = item.payload;
        await apiFetch(`/api/job/${jobId}/notes`, {
          method: 'POST',
          body: JSON.stringify({ notes }),
        });
      }
    } catch (err) {
      // keep it for later
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
}

export function startSyncLoop(intervalMs: number = 8000) {
  if (started) return;
  started = true;

  timer = setInterval(() => {
    flushSyncQueue().catch(() => {});
  }, intervalMs);

  // also attempt one immediately
  flushSyncQueue().catch(() => {});
}

export function stopSyncLoop() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

// tiny helpers (optional, but nice)
export function makeId() {
  return Date.now().toString();
}

export function nowIso() {
  return new Date().toISOString();
}