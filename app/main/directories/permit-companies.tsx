// JobHub/app/main/directories/permit-companies.tsx

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type PermitCompany = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function PermitCompaniesScreen() {
  const [companies, setCompanies] = useState<PermitCompany[]>([]);
  const prevRef = useRef<PermitCompany[]>([]);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, any>>({});
  const [saveState, setSaveState] =
    useState<Record<string, 'saving' | 'saved'>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const cached = await AsyncStorage.getItem('permit_companies_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        setCompanies(parsed);
        prevRef.current = parsed;
      }

      const res = await apiFetch('/api/permit-companies');
      const remote = res.permitCompanies ?? [];

      setCompanies(remote);
      prevRef.current = remote;

      await AsyncStorage.setItem(
        'permit_companies_v1',
        JSON.stringify(remote)
      );
    } catch {
      console.warn('Using cached permit companies');
    }
  }

async function addCompany() {
  if (!newName.trim()) return;

  const id = Date.now().toString();

  const newCompany: PermitCompany = {
    id,
    name: newName.trim(),
    contacts: [],
  };

  const updated = [newCompany, ...companies];

  // 1️⃣ Immediate UI update
  setCompanies(updated);
  prevRef.current = updated;
  setNewName('');

  // 2️⃣ Persist locally immediately
  AsyncStorage.setItem(
    'permit_companies_v1',
    JSON.stringify(updated)
  );

  // 3️⃣ Try backend (non-blocking)
  try {
    await apiFetch('/api/permit-companies', {
      method: 'POST',
      body: JSON.stringify(newCompany),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'permit_company_upsert',
      coalesceKey: `permit_company_upsert:${id}`,
      createdAt: nowIso(),
      payload: newCompany,
    });
  }

  flushSyncQueue();
}

async function addContact(id: string, type: 'phone' | 'email') {
  const company = companies.find(c => c.id === id);
  if (!company) return;

  const contactId = Date.now().toString();

  const updated = companies.map(c =>
    c.id === id
      ? {
          ...c,
          contacts: [
            ...c.contacts,
            { id: contactId, type, value: '' },
          ],
        }
      : c
  );

  // Immediate UI update
  setCompanies(updated);
  prevRef.current = updated;

  AsyncStorage.setItem(
    'permit_companies_v1',
    JSON.stringify(updated)
  );

  const companyToSync = updated.find(c => c.id === id);
if (!companyToSync) return;

  try {
    await apiFetch('/api/permit-companies', {
      method: 'POST',
      body: JSON.stringify(companyToSync),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'permit_company_upsert',
      coalesceKey: `permit_company_upsert:${id}`,
      createdAt: nowIso(),
      payload: companyToSync,
    });
  }

  flushSyncQueue();
}

  function updateContact(
    companyId: string,
    contactId: string,
    value: string
  ) {
    setCompanies(prev => {
      const updated = prev.map(c =>
        c.id === companyId
          ? {
              ...c,
              contacts: c.contacts.map(ct =>
                ct.id === contactId
                  ? { ...ct, value }
                  : ct
              ),
            }
          : c
      );

      prevRef.current = updated;
      return updated;
    });

    triggerAutosave(companyId);
  }

  function triggerAutosave(companyId: string) {
    if (saveTimers.current[companyId]) {
      clearTimeout(saveTimers.current[companyId]);
    }

    setSaveState(prev => ({
      ...prev,
      [companyId]: 'saving',
    }));

    saveTimers.current[companyId] = setTimeout(
      async () => {
        const company = prevRef.current.find(
          c => c.id === companyId
        );
        if (!company) return;

AsyncStorage.setItem(
  'permit_companies_v1',
  JSON.stringify(prevRef.current)
);

try {
  await apiFetch('/api/permit-companies', {
    method: 'POST',
    body: JSON.stringify(company),
  });
} catch {
  await enqueueSync({
    id: makeId(),
    type: 'permit_company_upsert',
    coalesceKey: `permit_company_upsert:${company.id}`,
    createdAt: nowIso(),
    payload: company,
  });
}

flushSyncQueue();

        setSaveState(prev => ({
          ...prev,
          [companyId]: 'saved',
        }));

        setTimeout(() => {
          setSaveState(prev => {
            const { [companyId]: _, ...rest } =
              prev;
            return rest;
          });
        }, 1500);
      },
      600
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Permit Companies</Text>

      <View style={styles.addRow}>
        <TextInput
          placeholder="Company name"
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addCompany}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView>
        {companies.map(company => (
          <View key={company.id} style={styles.card}>
            <Pressable
              onPress={() =>
                setExpanded(prev =>
                  prev === company.id
                    ? null
                    : company.id
                )
              }
            >
              <Text style={styles.name}>
                {company.name}
              </Text>
            </Pressable>

            {expanded === company.id && (
              <View style={{ marginTop: 10 }}>
                {company.contacts.map(contact => (
                  <TextInput
                    key={contact.id}
                    placeholder={
                      contact.type === 'phone'
                        ? 'Phone'
                        : 'Email'
                    }
                    value={contact.value}
                    onChangeText={text =>
                      updateContact(
                        company.id,
                        contact.id,
                        text
                      )
                    }
                    style={styles.input}
                  />
                ))}

                <View style={styles.contactBtns}>
                  <Pressable
                    onPress={() =>
                      addContact(company.id, 'phone')
                    }
                  >
                    <Text style={styles.link}>
                      + Phone
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      addContact(company.id, 'email')
                    }
                  >
                    <Text style={styles.link}>
                      + Email
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: 18 }}>
                  {saveState[company.id] && (
                    <Text style={{ fontSize: 12, opacity: 0.5 }}>
                      {saveState[company.id] ===
                      'saving'
                        ? 'saving…'
                        : 'saved'}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    marginBottom: 8,
  },
  addBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});