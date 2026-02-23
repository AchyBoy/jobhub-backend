// JobHub/app/job/[id]/defaults.tsx

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function JobDefaultsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
const jobId = typeof params.id === 'string' ? params.id : '';
const [loadingState, setLoadingState] = useState({
  supervisors: true,
  contractors: true,
  vendors: true,
  permit: true,
  inspections: true,
});

  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
const [vendors, setVendors] = useState<any[]>([]);
const [permitCompanies, setPermitCompanies] = useState<any[]>([]);

  const [selectedSupervisors, setSelectedSupervisors] =
    useState<string[]>([]);
const [selectedContractor, setSelectedContractor] =
  useState<string | null>(null);

const [selectedVendor, setSelectedVendor] =
  useState<string | null>(null);

const [selectedPermitCompany, setSelectedPermitCompany] =
  useState<string | null>(null);

const [inspectionCompanies, setInspectionCompanies] =
  useState<any[]>([]);

const [selectedInspectionCompany, setSelectedInspectionCompany] =
  useState<string | null>(null);

useFocusEffect(
  useCallback(() => {
    if (!jobId) return;

    load();

    return () => {
      // optional cleanup
    };
  }, [jobId])
);

async function load() {
  const T0 = performance.now();
  console.log(`\n========================`);
  console.log(`🟢 defaults.load() jobId=${jobId}`);
  setLoadingState({
  supervisors: true,
  contractors: true,
  vendors: true,
  permit: true,
  inspections: true,
});

  try {
    // 1️⃣ LOAD LOCAL FIRST (instrumented)

    const [
      supLocal,
      conLocal,
      venLocal,
      permitLocal,
      inspectionLocal,
    ] = await timed('AsyncStorage multi-get (lists)', () =>
      Promise.all([
        timed('AsyncStorage.getItem supervisors_v1', () => AsyncStorage.getItem('supervisors_v1')),
        timed('AsyncStorage.getItem contractors_v1', () => AsyncStorage.getItem('contractors_v1')),
        timed('AsyncStorage.getItem vendors_v1', () => AsyncStorage.getItem('vendors_v1')),
        timed('AsyncStorage.getItem permit_companies_v1', () => AsyncStorage.getItem('permit_companies_v1')),
        timed('AsyncStorage.getItem inspections_v1', () => AsyncStorage.getItem('inspections_v1')),
      ])
    );

    // 🔎 DEBUG: local list lengths
console.log("LOCAL vendors length:", venLocal ? JSON.parse(venLocal).length : 0);
console.log("LOCAL permit length:", permitLocal ? JSON.parse(permitLocal).length : 0);
console.log("LOCAL inspections length:", inspectionLocal ? JSON.parse(inspectionLocal).length : 0);

if (supLocal) {
  setSupervisors(timedParse('supervisors_v1', supLocal));
  
}

if (conLocal) {
  setContractors(timedParse('contractors_v1', conLocal));
  
}

if (venLocal) {
  const parsedVendors = timedParse('vendors_v1', venLocal);
  setVendors(parsedVendors);
  
}

if (permitLocal) {
  setPermitCompanies(timedParse('permit_companies_v1', permitLocal));
  
}

if (inspectionLocal) {
  setInspectionCompanies(timedParse('inspections_v1', inspectionLocal));
  
}

    console.log(`🟡 After LOCAL setState (${msSince(T0)}ms)`);

// 🔥 allow React to paint before continuing
await new Promise(resolve => setTimeout(resolve, 0));

    // 1.1️⃣ LOAD SELECTED DEFAULTS FROM LOCAL (instant selection state)
    try {
      const defaultsRaw = await timed(
        `AsyncStorage.getItem job:${jobId}:defaults`,
        () => AsyncStorage.getItem(`job:${jobId}:defaults`)
      );
if (defaultsRaw) {
  const parsed = JSON.parse(defaultsRaw);
  console.log("🔎 LOCAL PARSED DEFAULTS:", parsed);

  const defaults = timedParse(`job:${jobId}:defaults`, defaultsRaw);

  if (defaults.supervisors) setSelectedSupervisors(defaults.supervisors);

  if (defaults.contractor?.id) setSelectedContractor(defaults.contractor.id);

  if (defaults.vendor?.id) setSelectedVendor(defaults.vendor.id);

  if (defaults.permitCompany?.id) setSelectedPermitCompany(defaults.permitCompany.id);

  if (defaults.inspection?.id) setSelectedInspectionCompany(defaults.inspection.id);
}

      console.log(`🟡 After LOCAL selection setState (${msSince(T0)}ms)`);
    } catch (e) {
      console.log('⚠️ LOCAL defaults load failed', e);
    }

    // 1.5️⃣ Hydrate selected values from backend (background override; do NOT block UI)
    timed('JOB hydration Promise.all (background)', () =>
      Promise.all([
        timed(`apiFetch /api/jobs/${jobId}/supervisors`, () => apiFetch(`/api/jobs/${jobId}/supervisors`)),
        timed(`apiFetch /api/jobs/${jobId}/contractor`, () => apiFetch(`/api/jobs/${jobId}/contractor`)),
        timed(`apiFetch /api/jobs/${jobId}/vendor`, () => apiFetch(`/api/jobs/${jobId}/vendor`)),
        timed(`apiFetch /api/jobs/${jobId}/permit-company`, () => apiFetch(`/api/jobs/${jobId}/permit-company`)),
        timed(`apiFetch /api/jobs/${jobId}/inspection`, () => apiFetch(`/api/jobs/${jobId}/inspection`)),
      ])
    )
      .then(async ([
        supAssign,
        contractorAssign,
        vendorAssign,
        permitAssign,
        inspectionAssign,
      ]) => {
        // Merge: do NOT overwrite local defaults with nulls from backend
        let existing: any = {};
        try {
          const existingRaw = await AsyncStorage.getItem(`job:${jobId}:defaults`);
          existing = existingRaw ? JSON.parse(existingRaw) : {};
        } catch {}

        const nextDefaults = {
          supervisors:
            (supAssign.assignments?.map((a: any) => String(a.supervisorId)) ?? existing.supervisors) ?? [],

          contractor: contractorAssign.contractor?.contractorId
            ? { id: contractorAssign.contractor.contractorId }
            : (existing.contractor ?? null),

          vendor: vendorAssign.vendor?.vendorId
            ? { id: vendorAssign.vendor.vendorId }
            : (existing.vendor ?? null),

          permitCompany: permitAssign.permitCompany?.permitCompanyId
            ? { id: permitAssign.permitCompany.permitCompanyId }
            : (existing.permitCompany ?? null),

          inspection: inspectionAssign.inspection?.inspectionId
            ? { id: inspectionAssign.inspection.inspectionId }
            : (existing.inspection ?? null),
        };

        setSelectedSupervisors(nextDefaults.supervisors);
        setSelectedContractor(nextDefaults.contractor?.id ?? null);
        const nextVendor = nextDefaults.vendor?.id ?? null;
if (nextVendor !== selectedVendor) {
  setSelectedVendor(nextVendor);
}

const nextPermit = nextDefaults.permitCompany?.id ?? null;
if (nextPermit !== selectedPermitCompany) {
  setSelectedPermitCompany(nextPermit);
}

const nextInspection = nextDefaults.inspection?.id ?? null;
if (nextInspection !== selectedInspectionCompany) {
  setSelectedInspectionCompany(nextInspection);
}

        AsyncStorage.setItem(
          `job:${jobId}:defaults`,
          JSON.stringify(nextDefaults)
        ).catch(() => {});

        console.log(`🟡 After JOB selection setState (${msSince(T0)}ms)`);
      })
      .catch((e) => {
        console.log('⚠️ JOB hydration failed (offline?)', e);
      });

    // 2️⃣ BACKGROUND REFRESH (instrumented)

setTimeout(() => {
  backgroundRefresh();
}, 0);

    console.log(`✅ defaults.load() DONE total=${msSince(T0)}ms`);
  } catch (e) {
    console.log(`❌ defaults.load() FAILED total=${msSince(T0)}ms`, e);
    // silent offline mode
  }
}

async function persistLocalDefaults(update: any) {
  const storageKey = `job:${jobId}:defaults`;

  const existingRaw = await AsyncStorage.getItem(storageKey);
  const existing = existingRaw ? JSON.parse(existingRaw) : {};

  const merged = { ...existing, ...update };

  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify(merged)
  );
}

async function toggleSupervisor(supervisorId: string) {
  const id = String(supervisorId);

  const isSelected = selectedSupervisors.includes(id);

  let updated: string[];

  if (isSelected) {
    // ✅ Remove locally first
    updated = selectedSupervisors.filter(
      s => s !== id
    );

    setSelectedSupervisors(updated);

    await persistLocalDefaults({
      supervisors: updated,
    });

    try {
      // Fetch assignment id
      const res = await apiFetch(
        `/api/jobs/${jobId}/supervisors`
      );

      const assignment = res.assignments?.find(
        (a: any) => String(a.supervisorId) === id
      );

      if (assignment?.id) {
await apiFetch(
  `/api/jobs/${jobId}/supervisors/${assignment.id}`,
  { method: 'DELETE' }
);
      }

    } catch (err) {
      console.log("Supervisor remove failed", err);
    }

  } else {
    // ✅ Add locally first
    updated = [...selectedSupervisors, id];

    setSelectedSupervisors(updated);

    await persistLocalDefaults({
      supervisors: updated,
    });

    try {
      await apiFetch(
        `/api/jobs/${jobId}/supervisor`,
        {
          method: 'POST',
          body: JSON.stringify({ supervisorId: id }),
        }
      );
    } catch (err) {
      console.log("Supervisor add failed", err);
    }
  }

  flushSyncQueue();
}

async function backgroundRefresh() {
  const [
    supRes,
    conRes,
    venRes,
    permitRes,
    inspectionRes,
  ] = await Promise.all([
    apiFetch('/api/supervisors'),
    apiFetch('/api/contractors'),
    apiFetch('/api/vendors'),
    apiFetch('/api/permit-companies'),
    apiFetch('/api/inspections'),
  ]);

  setSupervisors(supRes.supervisors ?? []);
  setLoadingState(prev => ({ ...prev, supervisors: false }));

  setContractors(conRes.contractors ?? []);
  setLoadingState(prev => ({ ...prev, contractors: false }));

  setVendors(venRes.vendors ?? []);
  setLoadingState(prev => ({ ...prev, vendors: false }));

  setPermitCompanies(permitRes.permitCompanies ?? []);
  setLoadingState(prev => ({ ...prev, permit: false }));

  setInspectionCompanies(inspectionRes.inspections ?? []);
  setLoadingState(prev => ({ ...prev, inspections: false }));

  await AsyncStorage.multiSet([
    ['supervisors_v1', JSON.stringify(supRes.supervisors ?? [])],
    ['contractors_v1', JSON.stringify(conRes.contractors ?? [])],
    ['vendors_v1', JSON.stringify(venRes.vendors ?? [])],
    ['permit_companies_v1', JSON.stringify(permitRes.permitCompanies ?? [])],
    ['inspections_v1', JSON.stringify(inspectionRes.inspections ?? [])],
  ]);
}

async function selectContractor(contractorId: string) {
  console.log("SELECT CONTRACTOR CALLED", {
  selectedContractor,
  contractorId,
  equal: selectedContractor === contractorId,
  typeA: typeof selectedContractor,
  typeB: typeof contractorId,
});
  const isSelected = selectedContractor === contractorId;

  if (isSelected) {
    // Unselect
    setSelectedContractor(null);

    await persistLocalDefaults({
      contractor: null,
    });

    try {
      await apiFetch(
        `/api/jobs/${jobId}/contractor`,
        { method: 'DELETE' }
      );
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_contractor_remove',
        coalesceKey: `job_contractor_remove:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId },
      });
    }

  } else {
    // Select new
    setSelectedContractor(contractorId);

    await persistLocalDefaults({
      contractor: { id: contractorId },
    });

    try {
      await apiFetch(
        `/api/jobs/${jobId}/contractor`,
        {
          method: 'POST',
          body: JSON.stringify({ contractorId }),
        }
      );
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_contractor_set',
        coalesceKey: `job_contractor_set:${jobId}`,
        createdAt: nowIso(),
        payload: {
          jobId,
          contractorId,
        },
      });
    }
  }

  flushSyncQueue();
}

async function selectVendor(vendorId: string) {
  const isSelected = selectedVendor === vendorId;

  if (isSelected) {
    // Unselect
    setSelectedVendor(null);

    await persistLocalDefaults({
      vendor: null,
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/vendor`, {
        method: 'DELETE',
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_vendor_remove',
        coalesceKey: `job_vendor_remove:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId },
      });
    }

  } else {
    // Select new
    setSelectedVendor(vendorId);

    await persistLocalDefaults({
      vendor: { id: vendorId },
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/vendor`, {
        method: 'POST',
        body: JSON.stringify({ vendorId }),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_vendor_set',
        coalesceKey: `job_vendor_set:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId, vendorId },
      });
    }
  }

  flushSyncQueue();
}

// put near top of file (outside component) or inside component (either works)
function msSince(t0: number) {
  return Math.round(performance.now() - t0);
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  console.log(`⏱️ START ${label}`);
  try {
    const out = await fn();
    console.log(`✅ DONE  ${label} (${msSince(t0)}ms)`);
    return out;
  } catch (e) {
    console.log(`❌ FAIL  ${label} (${msSince(t0)}ms)`, e);
    throw e;
  }
}

function timedParse(label: string, raw: string) {
  const t0 = performance.now();
  try {
    const parsed = JSON.parse(raw);
    console.log(`✅ PARSE ${label} (${msSince(t0)}ms)`);
    return parsed;
  } catch (e) {
    console.log(`❌ PARSE FAIL ${label} (${msSince(t0)}ms)`, e);
    throw e;
  }
}

async function selectPermitCompany(permitCompanyId: string) {
  const isSelected = selectedPermitCompany === permitCompanyId;

  if (isSelected) {
    // Unselect
    setSelectedPermitCompany(null);

    await persistLocalDefaults({
      permitCompany: null,
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/permit-company`, {
        method: 'DELETE',
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_permit_company_remove',
        coalesceKey: `job_permit_company_remove:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId },
      });
    }

  } else {
    // Select new
    setSelectedPermitCompany(permitCompanyId);

    await persistLocalDefaults({
      permitCompany: { id: permitCompanyId },
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/permit-company`, {
        method: 'POST',
        body: JSON.stringify({ permitCompanyId }),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_permit_company_set',
        coalesceKey: `job_permit_company_set:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId, permitCompanyId },
      });
    }
  }

  flushSyncQueue();
}

async function selectInspectionCompany(inspectionCompanyId: string) {
  const isSelected = selectedInspectionCompany === inspectionCompanyId;

  if (isSelected) {
    // Unselect
    setSelectedInspectionCompany(null);

    await persistLocalDefaults({
      inspection: null,
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/inspection`, {
        method: 'DELETE',
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_inspection_remove',
        coalesceKey: `job_inspection_remove:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId },
      });
    }

  } else {
    // Select new
    setSelectedInspectionCompany(inspectionCompanyId);

    await persistLocalDefaults({
      inspection: { id: inspectionCompanyId },
    });

    try {
      await apiFetch(`/api/jobs/${jobId}/inspection`, {
        method: 'POST',
        body: JSON.stringify({ inspectionId: inspectionCompanyId }),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'job_inspection_set',
        coalesceKey: `job_inspection_set:${jobId}`,
        createdAt: nowIso(),
        payload: { jobId, inspectionId: inspectionCompanyId },
      });
    }
  }

  flushSyncQueue();
}

const allLoaded =
  !loadingState.supervisors &&
  !loadingState.contractors &&
  !loadingState.vendors &&
  !loadingState.permit &&
  !loadingState.inspections;

  return (
    <>
      <Stack.Screen options={{ title: 'Set Defaults' }} />

      <SafeAreaView style={styles.container}>
        <ScrollView>

  {!allLoaded && (
    <View style={styles.loadingBox}>
      {loadingState.supervisors && <Text>Loading supervisors...</Text>}
      {loadingState.contractors && <Text>Loading contractors...</Text>}
      {loadingState.vendors && <Text>Loading vendors...</Text>}
      {loadingState.permit && <Text>Loading permit companies...</Text>}
      {loadingState.inspections && <Text>Loading inspections...</Text>}
    </View>
  )}
          <Text style={styles.section}>
            Supervisors (Multiple Allowed)
          </Text>

          {supervisors.map(s => (
            <Pressable
              key={s.id}
              onPress={() => toggleSupervisor(s.id)}
              style={styles.row}
            >
              <Text>
                {selectedSupervisors.includes(String(s.id))
                  ? '✓ '
                  : '○ '}
                {s.name}
              </Text>
            </Pressable>
          ))}

          <Text style={styles.section}>
            Primary Contractor (Single)
          </Text>

{contractors.map(c => (
  <Pressable
    key={c.id}
    onPress={() => selectContractor(c.id)}
    style={styles.row}
  >
    <Text>
      {selectedContractor === c.id
        ? '✓ '
        : '○ '}
      {c.name}
    </Text>
  </Pressable>
))}

<Text style={styles.section}>
  Vendor (Single)
</Text>

{vendors.map(v => (
  <Pressable
    key={v.id}
    onPress={() => selectVendor(v.id)}
    style={styles.row}
  >
    <Text>
      {selectedVendor === v.id
        ? '✓ '
        : '○ '}
      {v.name}
    </Text>
  </Pressable>
))}

<Text style={styles.section}>
  Permit Company (Single)
</Text>

{permitCompanies.map(p => (
  <Pressable
    key={p.id}
    onPress={() => selectPermitCompany(p.id)}
    style={styles.row}
  >
    <Text>
      {selectedPermitCompany === p.id
        ? '✓ '
        : '○ '}
      {p.name}
    </Text>
  </Pressable>
))}

<Text style={styles.section}>
  Inspection Company (Single)
</Text>

{inspectionCompanies.map(i => (
  <Pressable
    key={i.id}
    onPress={() => selectInspectionCompany(i.id)}
    style={styles.row}
  >
    <Text>
      {selectedInspectionCompany === i.id
        ? '✓ '
        : '○ '}
      {i.name}
    </Text>
  </Pressable>
))}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },

  loadingBox: {
  padding: 12,
  marginBottom: 12,
  backgroundColor: '#f2f2f2',
  borderRadius: 6,
},
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    paddingVertical: 8,
  },
});