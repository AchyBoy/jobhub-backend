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
import { Stack } from 'expo-router';
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
  const [expanded, setExpanded] = useState<string | null>(null);

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

async function save(updated: Supervisor[], changed: Supervisor) {
  setSupervisors(updated);

  AsyncStorage.setItem(
    'supervisors_v1',
    JSON.stringify(updated)
  );

  try {
    await apiFetch('/api/supervisors', {
      method: 'POST',
      body: JSON.stringify(changed),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'supervisor_upsert',
      coalesceKey: `supervisor_upsert:${changed.id}`,
      createdAt: nowIso(),
      payload: changed,
    });
  }

  flushSyncQueue();
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

    const changed = updated.find(s => s.id === supervisorId);
    if (!changed) return prev;

    AsyncStorage.setItem(
      'supervisors_v1',
      JSON.stringify(updated)
    );

    (async () => {
      try {
        await apiFetch('/api/supervisors', {
          method: 'POST',
          body: JSON.stringify(changed),
        });
      } catch {
        await enqueueSync({
          id: makeId(),
          type: 'supervisor_upsert',
          coalesceKey: `supervisor_upsert:${changed.id}`,
          createdAt: nowIso(),
          payload: changed,
        });
      }

      flushSyncQueue();
    })();

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

    const changed = updated.find(s => s.id === supervisorId);
    if (!changed) return prev;

    AsyncStorage.setItem(
      'supervisors_v1',
      JSON.stringify(updated)
    );

    (async () => {
      try {
        await apiFetch('/api/supervisors', {
          method: 'POST',
          body: JSON.stringify(changed),
        });
      } catch {
        await enqueueSync({
          id: makeId(),
          type: 'supervisor_upsert',
          coalesceKey: `supervisor_upsert:${changed.id}`,
          createdAt: nowIso(),
          payload: changed,
        });
      }

      flushSyncQueue();
    })();

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
await save(updated, newSupervisor);

setName('');
  }

  return (
  <>
    <Stack.Screen
      options={{
        title: 'Supervisors',
        headerShadowVisible: false,
      }}
    />

    <SafeAreaView
      style={styles.container}
      edges={['left','right','bottom']}
    >

<View style={styles.addRow}>
  <TextInput
    placeholder="Supervisor name"
    value={name}
    onChangeText={setName}
    style={styles.input}
  />

  <Pressable
    style={styles.addBtn}
    onPress={addSupervisor}
  >
    <Text style={styles.addBtnText}>Add</Text>
  </Pressable>
</View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
{supervisors.map(s => (
  <View key={s.id} style={styles.card}>
    <Pressable
      onPress={() =>
        setExpanded(prev =>
          prev === s.id ? null : s.id
        )
      }
    >
      <Text style={styles.name}>
        {s.name}
      </Text>

      {expanded !== s.id && (
        <Text
          style={{
            fontSize: 12,
            opacity: 0.5,
            marginTop: 4,
          }}
        >
          Tap to edit supervisor details
        </Text>
      )}
    </Pressable>

    {expanded === s.id && (
      <View style={{ marginTop: 12 }}>
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

        <View style={styles.contactBtns}>
          <Pressable
            style={styles.contactAdd}
            onPress={() =>
              addContact(s.id, 'phone')
            }
          >
            <Text style={styles.contactAddText}>
              + Phone
            </Text>
          </Pressable>

          <Pressable
            style={styles.contactAdd}
            onPress={() =>
              addContact(s.id, 'email')
            }
          >
            <Text style={styles.contactAddText}>
              + Email
            </Text>
          </Pressable>
        </View>
      </View>
    )}
  </View>
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

  contactAdd: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
  },

  contactAddText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});