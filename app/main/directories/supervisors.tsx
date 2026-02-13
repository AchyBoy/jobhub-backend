//Jobhub/app/main/directories/supervisors.tsx
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { apiFetch } from '../../../src/lib/apiClient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';


type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type Supervisor = {
  id: string;
  name: string;
  contacts: Contact[];
  createdAt: string;
};

export default function SupervisorsDirectory() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    load();
  }, []);

async function load() {
  const stored = await AsyncStorage.getItem('supervisors_v1');
  if (!stored) return;

  const parsed = JSON.parse(stored);

  // 🔄 Migrate legacy supervisors (emails/phones → contacts)
  const normalized = parsed.map((s: any) => {
    if (Array.isArray(s.contacts)) return s;

    const contacts: Contact[] = [
      ...(s.emails || []).map((e: string) => ({
        id: `email-${e}-${Date.now()}`,
        type: 'email',
        value: e,
      })),
      ...(s.phones || []).map((p: string) => ({
        id: `phone-${p}-${Date.now()}`,
        type: 'phone',
        value: p,
      })),
    ];

    return {
      id: s.id,
      name: s.name,
      contacts,
      createdAt: s.createdAt ?? new Date().toISOString(),
    };
  });

  setSupervisors(normalized);

  // Save back in new structure
  await AsyncStorage.setItem(
    'supervisors_v1',
    JSON.stringify(normalized)
  );
}

async function syncSupervisorsToBackend(updated: Supervisor[]) {
  for (const supervisor of updated) {
    try {
      await apiFetch('/api/supervisors', {
        method: 'POST',
        body: JSON.stringify({
          id: supervisor.id,
          name: supervisor.name,
          contacts: supervisor.contacts ?? [],
        }),
      });
    } catch (err) {
      console.warn('Supervisor sync failed — queued', err);

      await enqueueSync({
        id: makeId(),
        type: 'supervisor_upsert',
        coalesceKey: `supervisor_upsert:${supervisor.id}`,
        createdAt: nowIso(),
        payload: {
          id: supervisor.id,
          name: supervisor.name,
          contacts: supervisor.contacts ?? [],
        },
      });
    }
  }

  await flushSyncQueue();
}

async function save(updated: Supervisor[]) {
  setSupervisors(updated);

  await AsyncStorage.setItem(
    'supervisors_v1',
    JSON.stringify(updated)
  );

  await syncSupervisorsToBackend(updated);
}

function updateContact(
  supervisorId: string,
  contactId: string,
  value: string
) {
  setSupervisors(prev => {
    const updated = prev.map(s => {
      if (s.id !== supervisorId) return s;

      return {
        ...s,
        contacts: s.contacts.map(c =>
          c.id === contactId ? { ...c, value } : c
        ),
      };
    });

    AsyncStorage.setItem(
      'supervisors_v1',
      JSON.stringify(updated)
    );

    syncSupervisorsToBackend(updated);

    return updated;
  });
}

function addContact(
  supervisorId: string,
  type: 'phone' | 'email'
) {
  const contactId = Date.now().toString();

  setSupervisors(prev => {
    const updated = prev.map(s => {
      if (s.id !== supervisorId) return s;

      return {
        ...s,
        contacts: [
          ...s.contacts,
          {
            id: contactId,
            type,
            label: '',
            value: '',
          },
        ],
      };
    });

    AsyncStorage.setItem(
      'supervisors_v1',
      JSON.stringify(updated)
    );

    syncSupervisorsToBackend(updated);

    return updated;
  });
}

  async function addSupervisor() {
    if (!name.trim()) return;

    const newSupervisor: Supervisor = {
      id: Date.now().toString(),
      name: name.trim(),
contacts: [],
      createdAt: new Date().toISOString(),
    };

    const updated = [newSupervisor, ...supervisors];
    await save(updated);

setName('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Supervisors</Text>

      <View style={styles.card}>
        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />


        <Pressable onPress={addSupervisor}>
          <Text style={styles.add}>+ Add Supervisor</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {supervisors.map(s => (
          <View key={s.id} style={styles.card}>
            <Text style={styles.name}>{s.name}</Text>

{s.contacts.map(contact => (
  <TextInput
    key={contact.id}
    placeholder={
      contact.type === 'phone'
        ? 'Phone number'
        : 'Email address'
    }
    value={contact.value}
    onChangeText={text =>
      updateContact(s.id, contact.id, text)
    }
    style={styles.input}
  />
))}

<View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
  <Pressable
    onPress={() => addContact(s.id, 'phone')}
  >
    <Text style={{ color: '#2563eb', fontWeight: '600' }}>
      + Phone
    </Text>
  </Pressable>

  <Pressable
    onPress={() => addContact(s.id, 'email')}
  >
    <Text style={{ color: '#2563eb', fontWeight: '600' }}>
      + Email
    </Text>
  </Pressable>
</View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  add: {
    color: '#2563eb',
    fontWeight: '600',
  },
  name: {
    fontWeight: '700',
    marginBottom: 6,
  },
});