// JobHub/app/main/directories/contractors.tsx

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
import { Stack } from 'expo-router';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type Contractor = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function ContractorsScreen() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const prevRef = useRef<Contractor[]>([]);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, any>>({});
  const [saveState, setSaveState] =
    useState<Record<string, 'saving' | 'saved'>>({});

useEffect(() => {
  load();
  loadPhases();
}, []);

  async function load() {
    try {
      const cached = await AsyncStorage.getItem('contractors_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        setContractors(parsed);
        prevRef.current = parsed;
      }

      const res = await apiFetch('/api/contractors');
      const remote = res.contractors ?? [];

      setContractors(remote);
      prevRef.current = remote;

      await AsyncStorage.setItem(
        'contractors_v1',
        JSON.stringify(remote)
      );
    } catch {
      console.warn('Using cached contractors');
    }
  }

  // ==============================
// Contractor Phase Template Notes
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
  useState<string>('Rough');

  const [phases, setPhases] = useState<string[]>([]);
const [showPhasePicker, setShowPhasePicker] =
  useState<string | null>(null);

const [newTemplateNoteA, setNewTemplateNoteA] =
  useState<string>('');

const [newTemplateNoteB, setNewTemplateNoteB] =
  useState<string>('');

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

async function addContractor() {
  if (!newName.trim()) return;

  const id = Date.now().toString();

  const newContractor: Contractor = {
    id,
    name: newName.trim(),
    contacts: [],
  };

  const updated = [newContractor, ...contractors];

  // 1️⃣ Immediate UI
  setContractors(updated);
  prevRef.current = updated;
  setNewName('');

  // 2️⃣ Persist locally
  await AsyncStorage.setItem(
    'contractors_v1',
    JSON.stringify(updated)
  );

  // 3️⃣ Attempt backend
  try {
    await apiFetch('/api/contractors', {
      method: 'POST',
      body: JSON.stringify(newContractor),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'contractor_upsert',
      coalesceKey: `contractor_upsert:${id}`,
      createdAt: nowIso(),
      payload: newContractor,
    });
  }

  flushSyncQueue();
}

async function addContact(id: string, type: 'phone' | 'email') {
  const contractor = contractors.find(c => c.id === id);
  if (!contractor) return;

  const contactId = Date.now().toString();

  const updated = contractors.map(c =>
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

  setContractors(updated);
  prevRef.current = updated;

  await AsyncStorage.setItem(
    'contractors_v1',
    JSON.stringify(updated)
  );

  const contractorToSync = updated.find(c => c.id === id);
  if (!contractorToSync) return;

  try {
try {
  await apiFetch('/api/contractors', {
    method: 'POST',
    body: JSON.stringify(contractor),
  });
} catch {
  await enqueueSync({
    id: makeId(),
    type: 'contractor_upsert',
    coalesceKey: `contractor_upsert:${contractor.id}`,
    createdAt: nowIso(),
    payload: contractor,
  });
}

flushSyncQueue();
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'contractor_upsert',
      coalesceKey: `contractor_upsert:${id}`,
      createdAt: nowIso(),
      payload: contractorToSync,
    });
  }

  flushSyncQueue();
}

  function updateContact(
    contractorId: string,
    contactId: string,
    value: string
  ) {
    setContractors(prev => {
      const updated = prev.map(c =>
        c.id === contractorId
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

    triggerAutosave(contractorId);
  }

  function triggerAutosave(contractorId: string) {
    if (saveTimers.current[contractorId]) {
      clearTimeout(saveTimers.current[contractorId]);
    }

    setSaveState(prev => ({
      ...prev,
      [contractorId]: 'saving',
    }));

    saveTimers.current[contractorId] = setTimeout(
      async () => {
        const contractor = prevRef.current.find(
          c => c.id === contractorId
        );
        if (!contractor) return;

        await apiFetch('/api/contractors', {
          method: 'POST',
          body: JSON.stringify(contractor),
        });

        await AsyncStorage.setItem(
          'contractors_v1',
          JSON.stringify(prevRef.current)
        );

        setSaveState(prev => ({
          ...prev,
          [contractorId]: 'saved',
        }));

        setTimeout(() => {
          setSaveState(prev => {
            const { [contractorId]: _, ...rest } =
              prev;
            return rest;
          });
        }, 1500);
      },
      600
    );
  }

  // ======================================
// Template Notes (for later injection)
// ======================================

function getTemplateKey(contractorId: string) {
  return `contractor:${contractorId}:phase_templates_v1`;
}

async function loadTemplateNotes(contractorId: string) {
  const cached = await AsyncStorage.getItem(
    getTemplateKey(contractorId)
  );

  if (cached) {
    setTemplateNotes(prev => ({
      ...prev,
      [contractorId]: JSON.parse(cached),
    }));
  }

  try {
    const res = await apiFetch(
      `/api/contractor-phase-notes/${contractorId}`
    );

    const remote = res?.notes ?? [];

    setTemplateNotes(prev => ({
      ...prev,
      [contractorId]: remote,
    }));

    await AsyncStorage.setItem(
      getTemplateKey(contractorId),
      JSON.stringify(remote)
    );
  } catch {
    // offline-safe
  }
}

async function saveTemplateNotes(
  contractorId: string,
  notes: TemplateNote[]
) {
  // local first
  setTemplateNotes(prev => ({
    ...prev,
    [contractorId]: notes,
  }));

  await AsyncStorage.setItem(
    getTemplateKey(contractorId),
    JSON.stringify(notes)
  );

  // attempt backend
  try {
    await apiFetch(
      `/api/contractor-phase-notes/${contractorId}`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    );
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'contractor_phase_notes_sync',
      coalesceKey: `contractor_phase_notes_sync:${contractorId}`,
      createdAt: nowIso(),
      payload: { contractorId, notes },
    });
  }

  flushSyncQueue();
}

async function addTemplateNote(contractorId: string) {
  if (!newTemplateNoteA.trim()) return;

  const existing = templateNotes[contractorId] ?? [];

  const newItem: TemplateNote = {
    id: Date.now().toString(),
    phase: newTemplatePhase,
    noteA: newTemplateNoteA.trim(),
    noteB: newTemplateNoteB.trim(),
    createdAt: new Date().toISOString(),
  };

  const updated = [newItem, ...existing];

  await saveTemplateNotes(contractorId, updated);

  setNewTemplateNoteA('');
  setNewTemplateNoteB('');
  setShowAddTemplateFor(null);
}

async function deleteTemplateNote(
  contractorId: string,
  noteId: string
) {
  const existing = templateNotes[contractorId] ?? [];

  const updated = existing.filter(n => n.id !== noteId);

  await saveTemplateNotes(contractorId, updated);
}

  return (
  <>
    <Stack.Screen
      options={{
        title: 'Contractors',
        headerShadowVisible: false,
      }}
    />

    <SafeAreaView
      style={styles.container}
      edges={['left','right','bottom']}
    >

      <View style={styles.addRow}>
        <TextInput
          placeholder="Contractor name"
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addContractor}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView>
        {contractors.map(contractor => (
          <View key={contractor.id} style={styles.card}>
            
<Pressable
  onPress={async () => {
    const next =
      expanded === contractor.id
        ? null
        : contractor.id;

    setExpanded(next);

    if (next === contractor.id) {
      await loadTemplateNotes(contractor.id);
    }
  }}
>

  <Text style={styles.name}>
    {contractor.name}
  </Text>

  {expanded !== contractor.id && (
    <Text
      style={{
        fontSize: 12,
        opacity: 0.5,
        marginTop: 4,
      }}
    >
      Tap to edit contractor details
    </Text>
  )}
</Pressable>

            {expanded === contractor.id && (
              <View style={{ marginTop: 10 }}>
                {contractor.contacts.map(contact => (
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
                        contractor.id,
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
                      addContact(contractor.id, 'phone')
                    }
                  >
                    <Text style={styles.link}>
                      + Phone
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      addContact(contractor.id, 'email')
                    }
                  >
                    <Text style={styles.link}>
                      + Email
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: 18 }}>
                  {saveState[contractor.id] && (
                    <Text style={{ fontSize: 12, opacity: 0.5 }}>
                      {saveState[contractor.id] ===
                      'saving'
                        ? 'saving…'
                        : 'saved'}
                    </Text>
                  )}
                </View>

                                            {/* ============================== */}
{/* Template Notes For Injection */}
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
  when this contractor is assigned as default.
</Text>

  <Pressable
    onPress={() =>
      setShowAddTemplateFor(prev =>
        prev === contractor.id
          ? null
          : contractor.id
      )
    }
  >
    <Text style={styles.link}>
      {showAddTemplateFor === contractor.id
        ? 'Cancel'
        : '+ Add Template Note'}
    </Text>
  </Pressable>

  {showAddTemplateFor === contractor.id && (
    <View style={{ marginTop: 10 }}>

{/* Phase Dropdown */}
<Pressable
  style={styles.input}
  onPress={() =>
    setShowPhasePicker(prev =>
      prev === contractor.id ? null : contractor.id
    )
  }
>
  <Text>
    {newTemplatePhase || 'Select Phase'}
  </Text>
</Pressable>

{showPhasePicker === contractor.id && (
  <View
    style={{
      backgroundColor: '#fff',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      marginBottom: 8,
    }}
  >
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
        onPress={() =>
          addTemplateNote(contractor.id)
        }
      >
        <Text style={styles.addBtnText}>
          Save Template Note
        </Text>
      </Pressable>
    </View>
  )}

{(templateNotes[contractor.id] ?? []).map(n => (
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
          deleteTemplateNote(contractor.id, n.id)
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