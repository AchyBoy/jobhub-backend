// JobHub/src/lib/syncEngine.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './apiClient';

type SyncItem =
  | {
      id: string;
      type: 'crew_assignment';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; crewId: string; phase: string };
    }
    | {
    id: string;
    type: 'vendor_upsert';
    coalesceKey: string;
    createdAt: string;
    payload: { id: string; name: string; contacts: any[] };
  }
  | {
    id: string;
    type: 'supplier_upsert';
    coalesceKey: string;
    createdAt: string;
    payload: {
      id: string;
      name: string;
      isInternal?: boolean;
      contacts: {
        id: string;
        type: string;
        label?: string | null;
        value?: string | null;
      }[];
    };
  }
  | {
    id: string;
    type: 'inspection_upsert';
    coalesceKey: string;
    createdAt: string;
    payload: { id: string; name: string; contacts: any[] };
  }
    | {
    id: string;
    type: 'contractor_upsert';
    coalesceKey: string;
    createdAt: string;
    payload: { id: string; name: string; contacts: any[] };
  }
  | {
      id: string;
      type: 'job_notes_sync';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; notes: any[] };
    }
  | {
      id: string;
      type: 'job_supervisors_set';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; supervisorIds: string[] };
    }
  | {
      id: string;
      type: 'job_contractor_set';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; contractorId: string };
    }
  | {
      id: string;
      type: 'job_vendor_set';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; vendorId: string };
    }
  | {
      id: string;
      type: 'job_permit_company_set';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; permitCompanyId: string };
    }
  | {
      id: string;
      type: 'job_inspection_set';
      coalesceKey: string;
      createdAt: string;
      payload: { jobId: string; inspectionId: string };
    }
  | {
      id: string;
      type: 'permit_company_upsert';
      coalesceKey: string;
      createdAt: string;
      payload: { id: string; name: string; contacts: any[] };
    }
  | {
      id: string;
      type: 'supervisor_upsert';
      coalesceKey: string;
      createdAt: string;
      payload: { id: string; name: string; contacts: any[] };
    }
| {
    id: string;
    type: 'crew_upsert';
    coalesceKey: string;
    createdAt: string;
    payload: { id: string; name: string; contacts: any[] };
  }
| {
    id: string;
    type: 'scheduled_task_create';
    coalesceKey: string;
    createdAt: string;
    payload: {
      jobId: string;
      crewId: string;
      phase: string;
      scheduledAt: string;
    };
  }
| {
    id: string;
    type: 'scheduled_task_update';
    coalesceKey: string;
    createdAt: string;
    payload: {
      taskId: string;
      scheduledAt?: string | null;
      status?: string;
      crewId?: string;
    };
  }
| {
    id: string;
    type: 'scheduled_task_delete';
    coalesceKey: string;
    createdAt: string;
    payload: { taskId: string };
  }
| {
    id: string;
    type: 'material_create';
    coalesceKey: string;
    createdAt: string;
    payload: {
      id: string;
      job_id: string;
      item_name: string;
      phase: string;
      supplier_id?: string | null;
      qty_needed: number;
      status: string;
    };
  }
| {
    id: string;
    type: 'material_update';
    coalesceKey: string;
    createdAt: string;
    payload: {
      materialId: string;
      updates: any;
    };
  }
| {
    id: string;
    type: 'order_create';
    coalesceKey: string;
    createdAt: string;
    payload: {
      orderId: string;
      jobId: string;
      phase: string;
      supplierId: string;
      items: { materialId: string; qtyOrdered: number }[];
      pdfUri: string;
    };
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

      if (item.type === 'vendor_upsert') {
  await apiFetch('/api/vendors', {
    method: 'POST',
    body: JSON.stringify(item.payload),
  });
}

      if (item.type === 'job_notes_sync') {
        const { jobId, notes } = item.payload;
        await apiFetch(`/api/job/${jobId}/notes`, {
          method: 'POST',
          body: JSON.stringify({ notes }),
        });
      }

            if (item.type === 'permit_company_upsert') {
        await apiFetch('/api/permit-companies', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      }

      if (item.type === 'supplier_upsert') {
  await apiFetch('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(item.payload),
  });
}

            if (item.type === 'job_supervisors_set') {
        const { jobId, supervisorIds } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/supervisors`, {
          method: 'POST',
          body: JSON.stringify({ supervisorIds }),
        });
      }

      if (item.type === 'inspection_upsert') {
  await apiFetch('/api/inspections', {
    method: 'POST',
    body: JSON.stringify(item.payload),
  });
}

      if (item.type === 'job_contractor_set') {
        const { jobId, contractorId } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/contractor`, {
          method: 'POST',
          body: JSON.stringify({ contractorId }),
        });
      }

      if (item.type === 'contractor_upsert') {
  await apiFetch('/api/contractors', {
    method: 'POST',
    body: JSON.stringify(item.payload),
  });
}

      if (item.type === 'job_vendor_set') {
        const { jobId, vendorId } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/vendor`, {
          method: 'POST',
          body: JSON.stringify({ vendorId }),
        });
      }

      if (item.type === 'job_permit_company_set') {
        const { jobId, permitCompanyId } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/permit-company`, {
          method: 'POST',
          body: JSON.stringify({ permitCompanyId }),
        });
      }

      if (item.type === 'job_inspection_set') {
        const { jobId, inspectionId } = item.payload;
        await apiFetch(`/api/jobs/${jobId}/inspection`, {
          method: 'POST',
          body: JSON.stringify({ inspectionId }),
        });
      }

      if (item.type === 'supervisor_upsert') {
        await apiFetch('/api/supervisors', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      }

      if (item.type === 'crew_upsert') {
        await apiFetch('/api/crews', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      }
      if (item.type === 'scheduled_task_create') {
  const { jobId, crewId, phase, scheduledAt } = item.payload;

  await apiFetch('/api/scheduled-tasks', {
    method: 'POST',
    body: JSON.stringify({
      jobId,
      crewId,
      phase,
      scheduledAt,
    }),
  });
}

if (item.type === 'scheduled_task_update') {
  const { taskId, ...updates } = item.payload;

  await apiFetch(`/api/scheduled-tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

if (item.type === 'scheduled_task_delete') {
  const { taskId } = item.payload;

  await apiFetch(`/api/scheduled-tasks/${taskId}`, {
    method: 'DELETE',
  });
}

if (item.type === 'material_create') {
  const {
    id,
    job_id,
    item_name,
    phase,
    supplier_id,
    qty_needed,
  } = item.payload;

  await apiFetch('/api/materials', {
    method: 'POST',
    body: JSON.stringify({
      id,
      jobId: job_id,
      itemName: item_name,
      phase,
      supplierId: supplier_id,
      qtyNeeded: qty_needed,
    }),
  });
}

if (item.type === 'material_update') {
  const { materialId, updates } = item.payload;

  await apiFetch(`/api/materials/${materialId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

if (item.type === 'order_create') {
  const {
    orderId,
    jobId,
    phase,
    supplierId,
    items,
    pdfUri,
  } = item.payload;

  const form = new FormData();

  form.append('orderId', orderId);
  form.append('jobId', jobId);
  form.append('phase', phase);
  form.append('supplierId', supplierId);
  form.append('itemsJson', JSON.stringify(items));
  form.append('bccTenant', 'true');

  form.append('pdf', {
    uri: pdfUri,
    name: 'order.pdf',
    type: 'application/pdf',
  } as any);

  await apiFetch('/api/orders/create', {
    method: 'POST',
    body: form,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
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