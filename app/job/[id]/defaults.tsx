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

export default function JobDefaultsScreen() {
  const { id } = useLocalSearchParams();

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

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

async function load() {
  try {
    const supRes = await apiFetch('/api/supervisors');
    setSupervisors(supRes.supervisors ?? []);

    const conRes = await apiFetch('/api/contractors');
    setContractors(conRes.contractors ?? []);

const venRes = await apiFetch('/api/vendors');
setVendors(venRes.vendors ?? []);

const permitRes = await apiFetch('/api/permit-companies');
setPermitCompanies(permitRes.permitCompanies ?? []);

  } catch {
    console.warn('Failed to load defaults');
  }
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

    await apiFetch(`/api/jobs/${id}/supervisors`, {
      method: 'POST',
      body: JSON.stringify({
        supervisorIds: updated,
      }),
    });
  }

async function selectContractor(contractorId: string) {
  setSelectedContractor(contractorId);

  await apiFetch(`/api/jobs/${id}/contractor`, {
    method: 'POST',
    body: JSON.stringify({
      contractorId,
    }),
  });
}

async function selectVendor(vendorId: string) {
  setSelectedVendor(vendorId);

  await apiFetch(`/api/jobs/${id}/vendor`, {
    method: 'POST',
    body: JSON.stringify({
      vendorId,
    }),
  });
}

async function selectPermitCompany(permitCompanyId: string) {
  setSelectedPermitCompany(permitCompanyId);

  await apiFetch(`/api/jobs/${id}/permit-company`, {
    method: 'POST',
    body: JSON.stringify({
      permitCompanyId,
    }),
  });
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