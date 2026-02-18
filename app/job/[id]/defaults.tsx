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
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function JobDefaultsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
const jobId = typeof params.id === 'string' ? params.id : '';

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

useEffect(() => {
  if (!jobId) return;
  load();
}, [jobId]);

async function load() {
  try {
    // 1️⃣ LOAD LOCAL FIRST (instant UI)

    const [
      supLocal,
      conLocal,
      venLocal,
      permitLocal,
      inspectionLocal,
    ] = await Promise.all([
      AsyncStorage.getItem('supervisors_v1'),
      AsyncStorage.getItem('contractors_v1'),
      AsyncStorage.getItem('vendors_v1'),
      AsyncStorage.getItem('permit_companies_v1'),
      AsyncStorage.getItem('inspections_v1'),
    ]);

    if (supLocal) setSupervisors(JSON.parse(supLocal));
    if (conLocal) setContractors(JSON.parse(conLocal));
    if (venLocal) setVendors(JSON.parse(venLocal));
    if (permitLocal) setPermitCompanies(JSON.parse(permitLocal));
    if (inspectionLocal) setInspectionCompanies(JSON.parse(inspectionLocal));

    // 2️⃣ BACKGROUND REFRESH (parallel, not sequential)

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

    const sup = supRes.supervisors ?? [];
    const con = conRes.contractors ?? [];
    const ven = venRes.vendors ?? [];
    const permit = permitRes.permitCompanies ?? [];
    const inspection = inspectionRes.inspections ?? [];

    setSupervisors(sup);
    setContractors(con);
    setVendors(ven);
    setPermitCompanies(permit);
    setInspectionCompanies(inspection);

    await Promise.all([
      AsyncStorage.setItem('supervisors_v1', JSON.stringify(sup)),
      AsyncStorage.setItem('contractors_v1', JSON.stringify(con)),
      AsyncStorage.setItem('vendors_v1', JSON.stringify(ven)),
      AsyncStorage.setItem('permit_companies_v1', JSON.stringify(permit)),
      AsyncStorage.setItem('inspections_v1', JSON.stringify(inspection)),
    ]);

  } catch {
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
  let updated: string[];

  if (selectedSupervisors.includes(supervisorId)) {
    updated = selectedSupervisors.filter(
      s => s !== supervisorId
    );
  } else {
    updated = [...selectedSupervisors, supervisorId];
  }

  setSelectedSupervisors(updated);

  await persistLocalDefaults({
    supervisors: updated,
  });

  try {
    await apiFetch(`/api/jobs/${jobId}/supervisors`, {
      method: 'POST',
      body: JSON.stringify({
        supervisorIds: updated,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'job_supervisors_set',
      coalesceKey: `job_supervisors_set:${jobId}`,
      createdAt: nowIso(),
      payload: {
        jobId,
        supervisorIds: updated,
      },
    });
  }

  flushSyncQueue();
}

async function selectContractor(contractorId: string) {
  setSelectedContractor(contractorId);

  await persistLocalDefaults({
    contractor: { id: contractorId },
  });

  try {
    await apiFetch(`/api/jobs/${jobId}/contractor`, {
      method: 'POST',
      body: JSON.stringify({
        contractorId,
      }),
    });
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

  flushSyncQueue();
}

async function selectVendor(vendorId: string) {
  setSelectedVendor(vendorId);

  await persistLocalDefaults({
    vendor: { id: vendorId },
  });

  try {
    await apiFetch(`/api/jobs/${jobId}/vendor`, {
      method: 'POST',
      body: JSON.stringify({
        vendorId,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'job_vendor_set',
      coalesceKey: `job_vendor_set:${jobId}`,
      createdAt: nowIso(),
      payload: {
        jobId,
        vendorId,
      },
    });
  }

  flushSyncQueue();
}

async function selectPermitCompany(permitCompanyId: string) {
  setSelectedPermitCompany(permitCompanyId);

  await persistLocalDefaults({
    permitCompany: { id: permitCompanyId },
  });

  try {
    await apiFetch(`/api/jobs/${jobId}/permit-company`, {
      method: 'POST',
      body: JSON.stringify({
        permitCompanyId,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'job_permit_company_set',
      coalesceKey: `job_permit_company_set:${jobId}`,
      createdAt: nowIso(),
      payload: {
        jobId,
        permitCompanyId,
      },
    });
  }

  flushSyncQueue();
}

async function selectInspectionCompany(inspectionCompanyId: string) {
  setSelectedInspectionCompany(inspectionCompanyId);

  await persistLocalDefaults({
    inspection: { id: inspectionCompanyId },
  });

  try {
    await apiFetch(`/api/jobs/${jobId}/inspection`, {
      method: 'POST',
      body: JSON.stringify({
        inspectionId: inspectionCompanyId,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'job_inspection_set',
      coalesceKey: `job_inspection_set:${jobId}`,
      createdAt: nowIso(),
      payload: {
        jobId,
        inspectionId: inspectionCompanyId,
      },
    });
  }

  flushSyncQueue();
}

  return (
    <>
      <Stack.Screen options={{ title: 'Set Defaults' }} />

      <SafeAreaView style={styles.container}>
        <ScrollView>
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
                {selectedSupervisors.includes(s.id)
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