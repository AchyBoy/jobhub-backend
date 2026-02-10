//JobHub/app/job/[id]/notes.tsx
import { apiFetch } from '../../../src/lib/apiClient';
import HomeButton from '../../../components/HomeButton';
import * as Linking from 'expo-linking';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import BackButton from '../../../components/BackButton';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AddNoteBar from '../../../components/notes/AddNoteBar';

type NoteStatus = 'blank' | 'incomplete' | 'complete';

type JobNote = {
  id: string;
  phase: string;

  // NOTE (future us):
  // noteA = primary instruction (what needs to be done)
  // noteB = clarification / explanation / context
  // `text` is legacy and will be removed after website + app fully migrate
  noteA: string;
  noteB?: string;
  text?: string;

  status: 'blank' | 'incomplete' | 'complete';

  // Scheduling
  scheduledFor?: string; // ISO date

  // Attempted completion (external)
  markedCompleteBy?: 'crew' | 'contractor';
  crewCompletedAt?: string;

  // Office authority
  officeCompletedAt?: string;

  createdAt: string;
};

async function fetchNotesFromBackend(
  jobId: string
): Promise<JobNote[] | null> {
  try {
    const res = await apiFetch(`/api/job/${jobId}/notes`);
    return res?.notes ?? null;
  } catch (err) {
    console.warn('⚠️ Failed to load notes from backend', err);
    return null;
  }
}

export default function JobNotes() {
  const { id } = useLocalSearchParams();

  const [notes, setNotes] = useState<JobNote[]>([]);

  // NOTE (future us):
  // Prevents accidental data loss on first load.
  // We NEVER sync until backend notes have been loaded at least once.
  const [backendHydrated, setBackendHydrated] = useState(false);

  async function syncNotesToBackend(jobId: string, notes: JobNote[]) {
    if (!backendHydrated) {
      // NOTE (future us):
      // Never write to backend before initial load completes.
      return;
    }

  try {
// NOTE (future us): backend is source of truth; always sync full note state.
// This prevents losing completion flags/timestamps when we add features like
// phase reassignment, A/B answers, editing, etc.
const payload = notes.map(n => ({
  id: n.id,
  jobId,
  phase: n.phase,

  // NOTE (future us):
  // Backend stores both noteA and noteB.
  // `text` is kept temporarily so website can migrate safely.
  noteA: n.noteA,
  noteB: n.noteB,
  text: n.text ?? n.noteA,

  status: n.status,
  scheduledFor: n.scheduledFor,
  markedCompleteBy: n.markedCompleteBy,
  crewCompletedAt: n.crewCompletedAt,
  officeCompletedAt: n.officeCompletedAt,
  createdAt: n.createdAt,
}));

await apiFetch(`/api/job/${jobId}/notes`, {
  method: 'POST',
  body: JSON.stringify({ notes: payload }),
});
  } catch (err) {
    console.warn('Failed to sync notes to backend', err);
  }
}

  // NOTE (future us):
// Global edit mode prevents accidental edits.
// When enabled, ALL notes become editable.
const [editMode, setEditMode] = useState(false);

// Tracks autosave status per-note
// idle | saving | saved
const [saveStateByNote, setSaveStateByNote] =
  useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [showCompletedByPhase, setShowCompletedByPhase] =
  useState<Record<string, boolean>>({});

const [currentPhase, setCurrentPhase] = useState('Rough');
const [expandedPhase, setExpandedPhase] = useState<string | null>('Rough');
const [crewViewPhases, setCrewViewPhases] = useState<string[]>([]);
const allPhases = Array.from(
  new Set(notes.map(n => n.phase))
).sort();


function buildCrewUrl(
  crewPhase: string,
  viewPhases: string[]
) {
  const base = Linking.createURL(`/crew/job/${id}`);
  const params = new URLSearchParams();

  params.set('phase', crewPhase);

  if (viewPhases.length) {
    params.set('view', viewPhases.join(','));
  }

  return `${base}?${params.toString()}`;
}

function sendCrewLink(
  crew: { name: string; email: string },
  crewPhase: string,
  viewPhases: string[]
) {
  const url = buildCrewUrl(crewPhase, viewPhases);

  const subject = `Job Notes – ${crewPhase}`;
  const body =
    `Hi ${crew.name},\n\n` +
    `Here is your job notes link:\n\n${url}\n\n` +
    `Please review and mark items complete as needed.\n`;

  Linking.openURL(
    `mailto:${crew.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  );
}

async function addNote(text: string) {
  const newNote: JobNote = {
    id: Date.now().toString(),
    phase: currentPhase,

    // NOTE: for now, new notes populate noteA only
    // noteB will be added later via edit mode
    noteA: text,
    noteB: '',

    // legacy compatibility
    text,

    status: 'incomplete',
    createdAt: new Date().toISOString(),
  };

  const updated = [newNote, ...notes];
  setNotes(updated);

  await AsyncStorage.setItem(
  `job:${id}:notes`,
  JSON.stringify(updated)
);

await syncNotesToBackend(id as string, updated);
}

// NOTE (future us):
// Autosave helper for editing noteA / noteB.
// No save button on purpose — typing triggers save.
async function updateNoteField(
  noteId: string,
  field: 'noteA' | 'noteB',
  value: string
) {
  // optimistic UI update
  const updated = notes.map(n =>
    n.id === noteId ? { ...n, [field]: value } : n
  );
  setNotes(updated);

  // show "saving…"
  setSaveStateByNote(prev => ({
    ...prev,
    [noteId]: 'saving',
  }));

  // persist locally + backend
  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );
  await syncNotesToBackend(id as string, updated);

  // show "saved"
  setSaveStateByNote(prev => ({
    ...prev,
    [noteId]: 'saved',
  }));

  // clear indicator after a short pause (no layout jump)
  setTimeout(() => {
    setSaveStateByNote(prev => {
      const { [noteId]: _, ...rest } = prev;
      return rest;
    });
  }, 1500);
}

useEffect(() => {
  if (!id) return;
  loadNotes();
}, [id]);

async function loadNotes() {
  if (!id) return;

  // 1️⃣ Load local cache
  const stored = await AsyncStorage.getItem(`job:${id}:notes`);
  let localNotes: JobNote[] = [];

  if (stored) {
    localNotes = JSON.parse(stored);
    setNotes(localNotes);
  }

  // 2️⃣ Fetch backend state (source of truth)
  const remoteNotes = await fetchNotesFromBackend(id as string);

// 3️⃣ Backend responded
if (Array.isArray(remoteNotes)) {
  // Only replace local state if backend actually has notes
  if (remoteNotes.length > 0) {
    setNotes(remoteNotes);

    await AsyncStorage.setItem(
      `job:${id}:notes`,
      JSON.stringify(remoteNotes)
    );
  }

  setBackendHydrated(true);
  return;
}

// 4️⃣ Backend unavailable → preserve local cache + UI
console.warn("⚠️ Backend unavailable — preserving local notes");
setBackendHydrated(true);
}

async function markAttemptedComplete(
  noteId: string,
  by: 'crew' | 'contractor'
) {
  const updated = notes.map(n =>
    n.id === noteId
      ? {
          ...n,
          markedCompleteBy: by,
          crewCompletedAt: new Date().toISOString(),
        }
      : n
  );

  setNotes(updated);

  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );
  await syncNotesToBackend(id as string, updated);
}

async function markOfficeComplete(noteId: string) {
  const updated = notes.map(n =>
    n.id === noteId
      ? {
          ...n,
          status: 'complete',
          officeCompletedAt: new Date().toISOString(),
        }
      : n
  );

  setNotes(updated);

  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );
  await syncNotesToBackend(id as string, updated);
}

async function markOfficeIncomplete(noteId: string) {
  const updated = notes.map(n =>
    n.id === noteId
      ? {
          ...n,
          status: 'incomplete',
          officeCompletedAt: undefined,
          markedCompleteBy: undefined,
          crewCompletedAt: undefined,
        }
      : n
  );

  setNotes(updated);

  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );
  await syncNotesToBackend(id as string, updated);
}

// NOTE: when a note is moved to another phase, it should not
// carry incomplete/complete state from the old phase.
function resetNoteForNewPhase(note: JobNote): JobNote {
  return {
    ...note,
    status: 'blank',
    markedCompleteBy: undefined,
    crewCompletedAt: undefined,
    officeCompletedAt: undefined,
  };
}

async function changeNotePhase(noteId: string, newPhase: string) {
  const updated = notes.map(n => {
    if (n.id !== noteId) return n;
    return resetNoteForNewPhase({
      ...n,
      phase: newPhase,
    });
  });

  setNotes(updated);

  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );
  await syncNotesToBackend(id as string, updated);
}

  return (

<SafeAreaView style={styles.container}>
  <BackButton />
  <HomeButton />

  <ScrollView
    contentContainerStyle={{ paddingBottom: 40 }}
    showsVerticalScrollIndicator={false}
  >
    <Text style={styles.title}>Job Notes</Text>
    <Text style={styles.sub}>Job ID: {id}</Text>

    <Pressable
  onPress={() => setEditMode(v => !v)}
  style={{ marginBottom: 16 }}
>
  <Text style={{ fontWeight: '700', color: '#2563eb' }}>
    {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
  </Text>
</Pressable>

<AddNoteBar
  phase={currentPhase}
  onPhaseChange={setCurrentPhase}
  onAdd={addNote}
/>


    {/* PHASE ACCORDION */}
{allPhases.map(phase => {
  const phaseNotes = notes.filter(n => n.phase === phase);

  // NOTE (future us):
// activeNotes includes BOTH 'blank' and 'incomplete' items.
// 'blank' means the phase has not started yet (e.g. moved from another phase).
// UI intentionally shows both together for now.
  const activeNotes = phaseNotes
    .filter(n => n.status !== 'complete')
    .sort((a, b) => {
      if (!!a.crewCompletedAt === !!b.crewCompletedAt) return 0;
      return a.crewCompletedAt ? 1 : -1;
    });

  const officeCompleted = phaseNotes.filter(
    n => n.status === 'complete'
  );

  return (
    <View key={phase} style={{ marginBottom: 24 }}>
      {/* Phase Header */}
      <Pressable
        onPress={() =>
  setExpandedPhase(p => (p === phase ? null : phase))
}
      >
<Text style={styles.sectionTitle}>
  {expandedPhase === phase ? '▼' : '▶'} {phase}
</Text>
      </Pressable>

      {expandedPhase === phase && (
        <View style={{ gap: 12 }}>
          {/* ACTIVE / CREW NOTES */}
          {activeNotes.map(note => (
            <View
              key={note.id}
              style={[
                styles.noteCard,
                note.crewCompletedAt && {
                  backgroundColor: '#dcfce7',
                },
              ]}
            >
{/* NOTE A — primary instruction */}
{editMode ? (
  <TextInput
    value={note.noteA ?? ''}
    onChangeText={text =>
      updateNoteField(note.id, 'noteA', text)
    }
    style={styles.noteText}
    multiline
  />
) : (
  <Text style={styles.noteText}>
    {note.noteA ?? note.text}
  </Text>
)}

{/* NOTE B — clarification / context */}
{editMode ? (
  <TextInput
    value={note.noteB ?? ''}
    onChangeText={text =>
      updateNoteField(note.id, 'noteB', text)
    }
    placeholder="Add clarification…"
    style={styles.noteSubText}
    multiline
  />
) : note.noteB ? (
  <Text style={styles.noteSubText}>
    {note.noteB}
  </Text>
) : null}

{/* NOTE (future us):
    Autosave indicator — ACTIVE / CREW NOTES
    Slot is always rendered to prevent layout jump while typing */}
<View style={styles.autosaveSlot}>
  {editMode && saveStateByNote[note.id] ? (
    <Text style={{ fontSize: 11, opacity: 0.5 }}>
      {saveStateByNote[note.id] === 'saving'
        ? 'saving…'
        : 'saved'}
    </Text>
  ) : null}
</View>

              {/* NOTE: office-only action to move an item to another phase */}
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
  {allPhases
    .filter(p => p !== note.phase)
    .map(p => (
      <Pressable
        key={p}
        onPress={() => changeNotePhase(note.id, p)}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: '#e5e7eb',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600' }}>
          Move to {p}
        </Text>
      </Pressable>
    ))}
</View>

              {note.crewCompletedAt && (
                <Text style={styles.meta}>
                  Crew completed:{' '}
                  {new Date(
                    note.crewCompletedAt
                  ).toLocaleDateString()}
                </Text>
              )}

              {!note.markedCompleteBy && (
                <Pressable
                  style={styles.action}
                  onPress={() =>
                    markAttemptedComplete(note.id, 'crew')
                  }
                >
                  <Text style={styles.actionText}>
                    Crew mark complete
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.action, { marginTop: 6 }]}
                onPress={() => markOfficeComplete(note.id)}
              >
                <Text style={styles.actionText}>
                  Office mark complete
                </Text>
              </Pressable>
            </View>
          ))}

          {/* OFFICE COMPLETED ACCORDION */}
          {officeCompleted.length > 0 && (
            <View style={{ marginTop: 10 }}>
<Pressable
  onPress={() =>
    setShowCompletedByPhase(prev => ({
      ...prev,
      [phase]: !prev[phase],
    }))
  }
>
  <Text style={styles.sectionTitle}>
    {showCompletedByPhase[phase] ? '▼' : '▶'} Completed
  </Text>
</Pressable>

{showCompletedByPhase[phase] &&
  officeCompleted.map(note => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteCard,
                      { opacity: 0.6 },
                    ]}
                  >
{/* NOTE A — primary instruction */}
{editMode ? (
  <TextInput
    value={note.noteA ?? ''}
    onChangeText={text =>
      updateNoteField(note.id, 'noteA', text)
    }
    style={styles.noteText}
    multiline
  />
) : (
  <Text style={styles.noteText}>
    {note.noteA ?? note.text}
  </Text>
)}

{/* NOTE B — clarification / context */}
{editMode ? (
  <TextInput
    value={note.noteB ?? ''}
    onChangeText={text =>
      updateNoteField(note.id, 'noteB', text)
    }
    placeholder="Add clarification…"
    style={styles.noteSubText}
    multiline
  />
) : note.noteB ? (
  <Text style={styles.noteSubText}>
    {note.noteB}
  </Text>
) : null}

{/* NOTE (future us):
    Autosave indicator — OFFICE COMPLETED NOTES
    Kept separate from ACTIVE section for clarity */}
<View style={styles.autosaveSlot}>
  {editMode && saveStateByNote[note.id] ? (
    <Text style={{ fontSize: 11, opacity: 0.5 }}>
      {saveStateByNote[note.id] === 'saving'
        ? 'saving…'
        : 'saved'}
    </Text>
  ) : null}
</View>

                    {note.officeCompletedAt && (
                      <Text style={styles.meta}>
                        Office completed:{' '}
                        {new Date(
                          note.officeCompletedAt
                        ).toLocaleDateString()}
                      </Text>
                    )}

                    <Pressable
                      style={styles.action}
                      onPress={() =>
                        markOfficeIncomplete(note.id)
                      }
                    >
                      <Text style={styles.actionText}>
                        Mark incomplete
                      </Text>
                    </Pressable>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
})}


</ScrollView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
meta: {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.6,
},

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 10,
  },

  sub: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
  },

  section: {
    gap: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },

  noteCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },

  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
header: {
  width: '100%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},

  phase: {
    fontSize: 14,
    fontWeight: '600',
  },

  status: {
    fontSize: 12,
    fontWeight: '700',
  },

  blank: {
    color: '#6b7280',
  },

  incomplete: {
    color: '#b45309',
  },

  complete: {
    color: '#15803d',
  },

  noteText: {
    fontSize: 16,
  },
  // NOTE B styling — secondary, explanatory text
noteSubText: {
  marginTop: 6,
  fontSize: 14,
  opacity: 0.7,
},
// NOTE (future us):
// Reserved space for autosave status ("saving…" / "saved").
// Always rendered to prevent layout jump while typing.
autosaveSlot: {
  height: 16,
  marginTop: 4,
},

  action: {
    marginTop: 10,
    alignItems: 'flex-end',
  },

  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
attempted: {
  marginTop: 8,
  fontSize: 13,
  fontWeight: '600',
  color: '#7c2d12', // amber/brown = attention needed
},
});