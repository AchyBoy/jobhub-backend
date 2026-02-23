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

  // ==============================
// Supervisor Phase Template Notes
// ==============================

type TemplateNote = {
  id: string;
  phase: string;
  noteA: string;
  noteB?: string;
  createdAt: string;
};

const [templateNotes, setTemplateNotes] =
  useState<Record<string, TemplateNote[]>>({});

const [showAddTemplateFor, setShowAddTemplateFor] =
  useState<string | null>(null);

const [newTemplatePhase, setNewTemplatePhase] =
  useState<string>('');

const [newTemplateNoteA, setNewTemplateNoteA] =
  useState<string>('');

const [newTemplateNoteB, setNewTemplateNoteB] =
  useState<string>('');

const [phases, setPhases] = useState<string[]>([]);
const [showPhasePicker, setShowPhasePicker] =
  useState<string | null>(null);

useEffect(() => {
  load();
  loadPhases();
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

function getTemplateKey(supervisorId: string) {
  return `supervisor:${supervisorId}:phase_templates_v1`;
}

async function loadTemplateNotes(supervisorId: string) {
  const cached = await AsyncStorage.getItem(
    getTemplateKey(supervisorId)
  );

  if (cached) {
    setTemplateNotes(prev => ({
      ...prev,
      [supervisorId]: JSON.parse(cached),
    }));
  }

  try {
    const res = await apiFetch(
      `/api/supervisor-phase-notes/${supervisorId}`
    );

    const remote = res?.notes ?? [];

    setTemplateNotes(prev => ({
      ...prev,
      [supervisorId]: remote,
    }));

    await AsyncStorage.setItem(
      getTemplateKey(supervisorId),
      JSON.stringify(remote)
    );
  } catch {}
}

async function saveTemplateNotes(
  supervisorId: string,
  notes: TemplateNote[]
) {
  setTemplateNotes(prev => ({
    ...prev,
    [supervisorId]: notes,
  }));

  await AsyncStorage.setItem(
    getTemplateKey(supervisorId),
    JSON.stringify(notes)
  );

  try {
    await apiFetch(
      `/api/supervisor-phase-notes/${supervisorId}`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    );
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'supervisor_phase_notes_sync',
      coalesceKey: `supervisor_phase_notes_sync:${supervisorId}`,
      createdAt: nowIso(),
      payload: { supervisorId, notes },
    });
  }

  flushSyncQueue();
}

async function addTemplateNote(supervisorId: string) {
  if (!newTemplateNoteA.trim()) return;

  const existing = templateNotes[supervisorId] ?? [];

  const newItem: TemplateNote = {
    id: Date.now().toString(),
    phase: newTemplatePhase,
    noteA: newTemplateNoteA.trim(),
    noteB: newTemplateNoteB.trim(),
    createdAt: new Date().toISOString(),
  };

  const updated = [newItem, ...existing];

  await saveTemplateNotes(supervisorId, updated);

  setNewTemplateNoteA('');
  setNewTemplateNoteB('');
  setShowAddTemplateFor(null);
}

async function deleteTemplateNote(
  supervisorId: string,
  noteId: string
) {
  const existing = templateNotes[supervisorId] ?? [];
  const updated = existing.filter(n => n.id !== noteId);
  await saveTemplateNotes(supervisorId, updated);
}

async function loadPhases() {
  try {
    const cached = await AsyncStorage.getItem('phases');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        setPhases(parsed);
        if (!newTemplatePhase && parsed.length) {
          setNewTemplatePhase(parsed[0]);
        }
      }
    }

    const res = await apiFetch('/api/phases');
    const remote =
      res?.phases?.map((p: any) => p.name) ?? [];

    if (remote.length) {
      setPhases(remote);
      await AsyncStorage.setItem(
        'phases',
        JSON.stringify(remote)
      );

      if (!newTemplatePhase) {
        setNewTemplatePhase(remote[0]);
      }
    }
  } catch {
    // offline safe
  }
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
onPress={async () => {
  const next =
    expanded === s.id ? null : s.id;

  setExpanded(next);

  if (next === s.id) {
    await loadTemplateNotes(s.id);
  }
}}
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
                  {/* ============================== */}
{/* Phase Template Notes */}
{/* ============================== */}

<View style={{ marginTop: 20 }}>
  <Text style={{
    fontWeight: '700',
    marginBottom: 4,
  }}>
    Phase Template Notes
  </Text>

  <Text style={{
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 10,
  }}>
    Notes added here will automatically be injected into a job
    when this supervisor is assigned as default.
  </Text>

  <Pressable
    onPress={() =>
      setShowAddTemplateFor(prev =>
        prev === s.id ? null : s.id
      )
    }
  >
    <Text style={styles.contactAddText}>
      {showAddTemplateFor === s.id
        ? 'Cancel'
        : '+ Add Template Note'}
    </Text>
  </Pressable>

  {showAddTemplateFor === s.id && (
    <View style={{ marginTop: 10 }}>
      
      {/* Phase Dropdown */}
      <Pressable
        style={styles.input}
        onPress={() =>
          setShowPhasePicker(prev =>
            prev === s.id ? null : s.id
          )
        }
      >
        <Text>
          {newTemplatePhase || 'Select Phase'}
        </Text>
      </Pressable>

      {showPhasePicker === s.id && (
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          marginBottom: 8,
        }}>
          {phases.map(p => (
            <Pressable
              key={p}
              onPress={() => {
                setNewTemplatePhase(p);
                setShowPhasePicker(null);
              }}
              style={{
                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text>{p}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        placeholder="Instruction (Note A)"
        value={newTemplateNoteA}
        onChangeText={setNewTemplateNoteA}
        style={styles.input}
      />

      <TextInput
        placeholder="Clarification (Note B)"
        value={newTemplateNoteB}
        onChangeText={setNewTemplateNoteB}
        style={styles.input}
      />

      <Pressable
        style={styles.addBtn}
        onPress={() => addTemplateNote(s.id)}
      >
        <Text style={styles.addBtnText}>
          Save Template Note
        </Text>
      </Pressable>
    </View>
  )}

{(templateNotes[s.id] ?? []).map(n => (
  <View
    key={n.id}
    style={{
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: '#f3f4f6',
    }}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontWeight: '600' }}>
        {n.phase}
      </Text>

      <Pressable
        onPress={() =>
          deleteTemplateNote(s.id, n.id)
        }
      >
        <Text style={{ fontSize: 12, color: '#b91c1c' }}>
          Delete
        </Text>
      </Pressable>
    </View>

    <Text>{n.noteA}</Text>

    {n.noteB ? (
      <Text style={{ opacity: 0.7 }}>
        {n.noteB}
      </Text>
    ) : null}
  </View>
))}
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