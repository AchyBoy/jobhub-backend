//JobHub/app/job/[id]/notes.tsx
import { apiFetch } from '../../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';
import * as Linking from 'expo-linking';
import { Keyboard } from 'react-native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';

import { useEffect, useState, useRef } from 'react';
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

async function fetchPhasesFromBackend(): Promise<string[] | null> {
  try {
    const res = await apiFetch('/api/phases');
    return res?.phases?.map((p: any) => p.name) ?? null;
  } catch (err) {
    console.warn('⚠️ Failed to load phases from backend', err);
    return null;
  }
}

export default function JobNotes() {
  const params = useLocalSearchParams();
const idParam = typeof params.id === 'string' ? params.id : undefined;

if (!idParam) {
  throw new Error('JobNotes requires a valid job id');
}

const id = idParam;
  const [notes, setNotes] = useState<JobNote[]>([]);
  const latestNotesRef = useRef<JobNote[]>([]);
  const noteSaveTimers = useRef<Record<string, any>>({});
  const noteRefs = useRef<Record<string, any>>({});
const [phasePickerForNote, setPhasePickerForNote] =
  useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
const [highlightedNote, setHighlightedNote] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const scrollRef = useRef<ScrollView>(null);
  const [pendingCompletion, setPendingCompletion] =
  useState<Record<string, any>>({});
const notePositions = useRef<Record<string, number>>({});
const lastTapRef = useRef<Record<string, number>>({});
const [searchQuery, setSearchQuery] = useState('');
const [showSearch, setShowSearch] = useState(false);
const [showAddItem, setShowAddItem] = useState(false);
const [role, setRole] = useState<string | null>(null);

  // NOTE (future us):
  // Prevents accidental data loss on first load.
  // We NEVER sync until backend notes have been loaded at least once.
  const [backendHydrated, setBackendHydrated] = useState(false);

  useEffect(() => {
  latestNotesRef.current = notes;
}, [notes]);

async function deleteNote(noteId: string) {
  if (!id) return;

  const updated = notes.filter(n => n.id !== noteId);

  setNotes(updated);

  await AsyncStorage.setItem(
    `job:${id}:notes`,
    JSON.stringify(updated)
  );

  await syncNotesToBackend(id, updated);
}

async function syncNotesToBackend(jobId: string, notes: JobNote[]) {
  if (!backendHydrated) {
    // NOTE (future us):
    // Never write to backend before initial load completes.
    return;
  }

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

  try {
    await apiFetch(`/api/job/${jobId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ notes: payload }),
    });
  } catch (err) {
    console.warn('Failed to sync notes to backend — queued for retry', err);

    // Queue latest full note payload (coalesced per job)
    await enqueueSync({
      id: makeId(),
      type: 'job_notes_sync',
      coalesceKey: `job_notes_sync:${jobId}`,
      createdAt: nowIso(),
      payload: {
        jobId,
        notes: payload,
      },
    });

    // Try immediately (if offline it stays queued)
    await flushSyncQueue();
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

const [phases, setPhases] = useState<string[]>([]);
const [currentPhase, setCurrentPhase] = useState<string>('');
const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
const [crewViewPhases, setCrewViewPhases] = useState<string[]>([]);

const allPhases = [...phases].sort((a, b) =>
  a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
);


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

async function fetchJobFromBackend(jobId: string): Promise<string | null> {
  try {
    const res = await apiFetch(`/api/job/${jobId}`);
    return res?.job?.name ?? null;
  } catch (err) {
    console.warn('⚠️ Failed to load job name', err);
    return null;
  }
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

    // Phase is "active" if it already has any non-blank note
  // (i.e. someone started work / phase is underway)
  const phaseIsActive = notes.some(
    n => n.phase === currentPhase && n.status !== 'blank'
  );
  const newNote: JobNote = {
    id: Date.now().toString(),
    phase: currentPhase,

    // NOTE: for now, new notes populate noteA only
    // noteB will be added later via edit mode
    noteA: text,
    noteB: '',

    // legacy compatibility
    text,

        status: phaseIsActive ? 'incomplete' : 'blank',

    createdAt: new Date().toISOString(),
  };

const updated: JobNote[] = [newNote, ...notes];  setNotes(updated);

  await AsyncStorage.setItem(
  `job:${id}:notes`,
  JSON.stringify(updated)
);

if (!id) return;
await syncNotesToBackend(id, updated);
}

// NOTE (future us):
// Autosave helper for editing noteA / noteB.
// No save button on purpose — typing triggers save.
function updateNoteField(
  noteId: string,
  field: 'noteA' | 'noteB',
  value: string
) {
  if (!id) return;

  // 1) Immediate UI update (fast typing)
  const updated: JobNote[] = notes.map(n =>
    n.id === noteId ? { ...n, [field]: value } : n
  );
  setNotes(updated);
  latestNotesRef.current = updated;

  // 2) Show "saving…" immediately
  setSaveStateByNote(prev => ({
    ...prev,
    [noteId]: 'saving',
  }));

  // 3) Debounce disk + network
  if (noteSaveTimers.current[noteId]) {
    clearTimeout(noteSaveTimers.current[noteId]);
  }

  noteSaveTimers.current[noteId] = setTimeout(async () => {
    try {
      const latest = latestNotesRef.current;

      // persist locally (still offline-first, just not per-keystroke)
      await AsyncStorage.setItem(
        `job:${id}:notes`,
        JSON.stringify(latest)
      );

      // attempt backend sync (and queue if offline)
if (!id) return;
await syncNotesToBackend(id, latest);
      // show "saved"
      setSaveStateByNote(prev => ({
        ...prev,
        [noteId]: 'saved',
      }));

      // clear indicator after a short pause
      setTimeout(() => {
        setSaveStateByNote(prev => {
          const { [noteId]: _, ...rest } = prev;
          return rest;
        });
      }, 1500);
    } catch {
      // If something truly unexpected happens here, keep "saving…"
      // (syncNotesToBackend already queues on network failure)
    }
  }, 700);
}

useEffect(() => {
  if (!id) return;

  loadNotes();
  loadPhases();
  loadJob();
  loadRole();
}, [id]);

async function loadRole() {
  try {
    const res = await apiFetch('/api/tenant/me');
    setRole(res?.role ?? null);
  } catch {
    setRole(null);
  }
}

async function loadJob() {

if (!id) return;
const name = await fetchJobFromBackend(id);  if (name) {
    setJobName(name);
  }
}

async function loadPhases() {
  // 1️⃣ Load local cache first
  const stored = await AsyncStorage.getItem('phases');

  if (stored) {
    const parsed = JSON.parse(stored);
    setPhases(parsed);

    if (parsed.length && !currentPhase) {
      setCurrentPhase(parsed[0]);
    }
  }

  try {
    // 2️⃣ Fetch both base phases + groups
    const [phaseRes, groupRes] = await Promise.all([
      apiFetch('/api/phases'),
      apiFetch('/api/phase-groups'),
    ]);

    const basePhases: string[] =
      phaseRes?.phases?.map((p: any) => p.name) ?? [];

    const groupArray: any[] =
      groupRes?.phaseGroups ?? [];

    // Deduplicate grouped bucket names
    const groupedPhases: string[] = Array.from(
      new Set(
        groupArray.map(
          (g: any) => `Grouped Phase: ${g.basePhase}`
        )
      )
    );

    const merged: string[] = [...basePhases];

    groupedPhases.forEach(gp => {
      if (!merged.includes(gp)) {
        merged.push(gp);
      }
    });

    setPhases(merged);
    await AsyncStorage.setItem('phases', JSON.stringify(merged));

    if (merged.length && !currentPhase) {
      setCurrentPhase(merged[0]);
    }

  } catch (err) {
    console.warn('⚠️ Failed to load grouped phases', err);
  }
}

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
if (!id) return;
const remoteNotes = await fetchNotesFromBackend(id);
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
const updated: JobNote[] = notes.map(n =>    n.id === noteId
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
  if (!id) return;
await syncNotesToBackend(id, updated);
}

function triggerCompleteWithUndo(noteId: string) {
  if (!id) return;
  const jobId = id;

  const original = latestNotesRef.current.find(
    (n: JobNote) => n.id === noteId
  );
  if (!original) return;

  // 1️⃣ Optimistic update
  setNotes((prev: JobNote[]) => {
    const updated: JobNote[] = prev.map((n: JobNote) =>
      n.id === noteId
        ? {
            ...n,
            officeCompletedAt: new Date().toISOString(),
          }
        : n
    );

    latestNotesRef.current = updated;
    return updated;
  });

  // 2️⃣ Start undo timer
  const timer = setTimeout(() => {
    setNotes((prev: JobNote[]) => {
      const finalized: JobNote[] = prev.map((n: JobNote) =>
        n.id === noteId
          ? {
              ...n,
              status: 'complete',
            }
          : n
      );

      latestNotesRef.current = finalized;

      // persist + sync OUTSIDE async context safely
      AsyncStorage.setItem(
        `job:${jobId}:notes`,
        JSON.stringify(finalized)
      );

      syncNotesToBackend(jobId, finalized);

      return finalized;
    });

    setPendingCompletion((prev: Record<string, any>) => {
      const { [noteId]: _, ...rest } = prev;
      return rest;
    });
  }, 3000);

  // 3️⃣ Store undo state
  setPendingCompletion((prev: Record<string, any>) => ({
    ...prev,
    [noteId]: {
      original,
      timer,
    },
  }));
}

function undoCompletion(noteId: string) {
  const pending = pendingCompletion[noteId];
  if (!pending) return;

  clearTimeout(pending.timer);

  const restored = notes.map(n =>
    n.id === noteId ? pending.original : n
  );

  setNotes(restored);

  setPendingCompletion(prev => {
    const { [noteId]: _, ...rest } = prev;
    return rest;
  });
}

async function markOfficeIncomplete(noteId: string) {
const updated: JobNote[] = notes.map(n =>    n.id === noteId
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
  if (!id) return;
await syncNotesToBackend(id, updated);
}

async function markOfficeBlank(noteId: string) {
  const updated: JobNote[] = notes.map(n =>
    n.id === noteId
      ? {
          ...n,
          status: 'blank',
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

  if (!id) return;
  await syncNotesToBackend(id, updated);
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

function handleNoteTap(noteId: string, phase: string) {
  const now = Date.now();
  const lastTap = lastTapRef.current[phase] ?? 0;

  if (now - lastTap < 300) {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: false,
    }));
  }

  lastTapRef.current[phase] = now;
}

function handleCompletedTap(phase: string) {
  const now = Date.now();
  const key = `completed-${phase}`;
  const lastTap = lastTapRef.current[key] ?? 0;

  if (now - lastTap < 300) {
    setShowCompletedByPhase(prev => ({
      ...prev,
      [phase]: false,
    }));
  }

  lastTapRef.current[key] = now;
}

async function changeNotePhase(noteId: string, newPhase: string) {
const updated: JobNote[] = notes.map(n => {
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
  if (!id) return;
await syncNotesToBackend(id, updated);
}

  return (
    <>
  <Stack.Screen
  options={{
    title: jobName ? jobName : 'Job',
  }}
/>

<SafeAreaView
  style={styles.container}
  edges={['left', 'right', 'bottom']}
>

<Text style={styles.sub}>Job ID: {id}</Text>

<View
  style={{
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  }}
>
  {/* LEFT — Edit Mode */}
  <Pressable onPress={() => setEditMode(v => !v)}>
    <Text style={{ fontWeight: '700', color: '#2563eb' }}>
      {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
    </Text>
  </Pressable>

  {/* RIGHT — Add Item */}
  <Pressable onPress={() => setShowAddItem(v => !v)}>
    <Text style={{ fontWeight: '700', color: '#2563eb' }}>
      {showAddItem ? 'Cancel Add' : 'Add Note'}
    </Text>
  </Pressable>
</View>

{/* SEARCH */}
<View style={{ marginBottom: 12, zIndex: 1000 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TextInput
      placeholder="Search notes..."
      value={searchQuery}
      onChangeText={setSearchQuery}
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        padding: 10,
        backgroundColor: '#fff',
      }}
    />

<Pressable
  onPress={() => {
    setSearchQuery('');
    Keyboard.dismiss();
  }}
  style={{ marginLeft: 8 }}
>
  <Text style={{ fontWeight: '600', color: '#2563eb' }}>
    Clear
  </Text>
</Pressable>
  </View>

  {searchQuery.length > 0 && (
    <View
      style={{
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        maxHeight: 250,
        elevation: 10,
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
{notes
  .filter(n => {
    const query = searchQuery.toLowerCase().trim();

    // If query matches a phase name → filter by phase
    const phaseMatch = allPhases.find(p =>
      p.toLowerCase() === query
    );

    if (phaseMatch) {
      return n.phase === phaseMatch;
    }

    // Otherwise search note text
    return (
      (n.noteA + ' ' + (n.noteB ?? ''))
        .toLowerCase()
        .includes(query)
    );
  })
          .slice(0, 20)
          .map(n => (
            <Pressable
              key={n.id}
              onPress={() => {
                setExpandedPhases(prev => ({
  ...prev,
  [n.phase]: true,
}));
                setSearchQuery('');
                Keyboard.dismiss();
                setHighlightedNote(n.id);

setTimeout(() => {
  const node = noteRefs.current[n.id];
  if (node && scrollRef.current) {
node.measureLayout(
  // @ts-ignore
  scrollRef.current,
  (_x: number, y: number) => {
    scrollRef.current?.scrollTo({
      y: y - 20,
      animated: true,
    });
  },
  () => {}
);
  }

  setHighlightedNote(null);
}, 150);
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ fontWeight: '700' }}>
                {n.noteA}
              </Text>

              {n.noteB ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13, opacity: 0.7 }}
                >
                  {n.noteB}
                </Text>
              ) : null}
            </Pressable>
          ))}
      </ScrollView>
    </View>
  )}
</View>

{/* CONDITIONAL ADD NOTE BAR */}
{showAddItem && (
  <AddNoteBar
  phases={allPhases}
  phase={currentPhase}
  onPhaseChange={setCurrentPhase}
  onAdd={(text) => {
    addNote(text);
    // DO NOT close
  }}
/>
)}

 <ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  contentContainerStyle={{ paddingBottom: 80 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="always"
>

    {/* PHASE ACCORDION */}
{allPhases.map(phase => {
  const isGroupedBucket = phase.startsWith('Grouped Phase: ');
  let phaseNotes: JobNote[];

if (phase.startsWith('Grouped Phase: ')) {
  const base = phase.replace('Grouped Phase: ', '');

  // Find all child phases of this grouped base
  const groupedChildren = phases
    .filter(p => p !== phase && p.includes(base))
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

  phaseNotes = notes.filter(
    n =>
      n.phase === base ||
      groupedChildren.includes(n.phase)
  );
} else {
  phaseNotes = notes.filter(n => n.phase === phase);
}

  // NOTE (future us):
// activeNotes includes BOTH 'blank' and 'incomplete' items.
// 'blank' means the phase has not started yet (e.g. moved from another phase).
// UI intentionally shows both together for now.
const activeNotes = phaseNotes
  .filter(n => n.status !== 'complete')
.sort((a, b) => {
  // 1️⃣ First sort by phase name
  const phaseCompare = a.phase.localeCompare(b.phase, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  if (phaseCompare !== 0) return phaseCompare;

  // 2️⃣ Then sort by numeric id
  const aId = Number(a.id);
  const bId = Number(b.id);

  if (!isNaN(aId) && !isNaN(bId)) {
    return aId - bId;
  }

  return a.id.localeCompare(b.id);
});

const officeCompleted = phaseNotes
  .filter(n => n.status === 'complete')
  .sort((a, b) => {
    // 1️⃣ First sort by phase name
    const phaseCompare = a.phase.localeCompare(b.phase, undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    if (phaseCompare !== 0) return phaseCompare;

    // 2️⃣ Then sort by numeric id
    const aId = Number(a.id);
    const bId = Number(b.id);

    if (!isNaN(aId) && !isNaN(bId)) {
      return aId - bId;
    }

    return a.id.localeCompare(b.id);
  });

  return (
    <View key={phase} style={{ marginBottom: 24 }}>
{/* Phase Header */}
<Pressable
  onPress={() => {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase],
    }));
  }}
>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Text style={styles.sectionTitle}>
      {expandedPhases[phase] ? '▼' : '▶'} {phase}
    </Text>

{/* Incomplete Badge */}
{(() => {
  const incompleteCount = phaseNotes.filter(
    n => n.status === 'incomplete'
  ).length;

  if (incompleteCount === 0) return null;

  return (
    <View
      style={{
        marginLeft: 8,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        minWidth: 20,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: '#b45309',
        }}
      >
        {incompleteCount}
      </Text>
    </View>
  );
})()}
  </View>
</Pressable>

      {!searchQuery && expandedPhases[phase] && (
        <View style={{ gap: 12 }}>
          {/* ACTIVE / CREW NOTES */}
          {activeNotes.map(note => (
<Pressable
  key={note.id}
delayLongPress={600}
onLongPress={() => {
  if (role !== 'owner' && role !== 'admin') return;

  Alert.alert(
    'Delete Note?',
    'This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNote(note.id),
      },
    ]
  );
}}
  onPress={() => handleNoteTap(note.id, phase)}
ref={r => {
  if (r) noteRefs.current[note.id] = r;
}}
style={[
  styles.noteCard,
  note.status === 'incomplete' && {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  (note.crewCompletedAt || note.status === 'complete') && {
  backgroundColor: '#dcfce7',
},
  highlightedNote === note.id && {
    borderWidth: 2,
    borderColor: '#2563eb',
  },
]}
            >
{/* NOTE A — primary instruction */}
<View style={styles.inputPillPrimary}>
  {editMode ? (
    <TextInput
      value={note.noteA ?? ''}
      onChangeText={text =>
        updateNoteField(note.id, 'noteA', text)
      }
      style={styles.inputPillTextPrimary}
      multiline
      blurOnSubmit={true}
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
    />
  ) : (
    <Text style={styles.inputPillTextPrimary}>
      {note.noteA ?? note.text}
    </Text>
  )}
</View>

{/* NOTE B — clarification / context */}
{note.noteB || editMode ? (
  <View style={styles.inputPillSecondary}>
    {editMode ? (
      <TextInput
        value={note.noteB ?? ''}
        onChangeText={text =>
          updateNoteField(note.id, 'noteB', text)
        }
        placeholder="Add clarification…"
        style={styles.inputPillTextSecondary}
        multiline
        blurOnSubmit={true}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
    ) : (
      <Text style={styles.inputPillTextSecondary}>
        {note.noteB}
      </Text>
    )}
  </View>
) : null}

<Text
  style={{
    fontSize: 11,
    opacity: 0.4,
    marginTop: 6,
  }}
>
  {role === 'owner' || role === 'admin'
  ? 'Double tap to collapse section – Hold to delete'
  : 'Double tap to collapse section'}
</Text>

{/* NOTE (future us):
    Autosave indicator — ACTIVE / CREW NOTES
    Slot is always rendered to prevent layout jump while typing */}
<View style={styles.autosaveSlot}>
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    {/* Autosave indicator */}
    {editMode && saveStateByNote[note.id] ? (
      <Text style={{ fontSize: 11, opacity: 0.5 }}>
        {saveStateByNote[note.id] === 'saving'
          ? 'saving…'
          : 'saved'}
      </Text>
    ) : (
      <View />
    )}

    {/* Root phase hint (only inside grouped bucket) */}
    {isGroupedBucket && (
      <Text
        style={{
          fontSize: 10,
          opacity: 0.45,
        }}
      >
        {note.phase}
      </Text>
    )}
  </View>
</View>

{pendingCompletion[note.id] && (
  <Pressable
    onPress={(e) => {
      e.stopPropagation();
      undoCompletion(note.id);
    }}
    style={{
      marginTop: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: '#dcfce7',
      alignSelf: 'flex-start',
    }}
  >
    <Text
      style={{
        fontSize: 12,
        fontWeight: '700',
        color: '#15803d',
      }}
    >
      Completing… Tap to Undo
    </Text>
  </Pressable>
)}

              {/* NOTE: office-only action to move an item to another phase */}

{editMode && (
  <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
    <Pressable
      onPress={() =>
        setPhasePickerForNote(prev =>
          prev === note.id ? null : note.id
        )
      }
      style={styles.phaseButton}
    >
      <Text style={styles.phaseButtonText}>
        Change Phase
      </Text>
    </Pressable>

{editMode && (
  <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        triggerCompleteWithUndo(note.id);
      }}
      style={styles.pillComplete}
    >
      <Text style={styles.pillTextBlue}>
        Mark Complete
      </Text>
    </Pressable>
  </View>
)}

    {phasePickerForNote === note.id && (
      <View style={styles.phaseDropdown}>
        {allPhases
          .filter(p => p !== note.phase)
          .map(p => (
            <Pressable
              key={p}
              onPress={() => {
                changeNotePhase(note.id, p);
                setPhasePickerForNote(null);
              }}
              style={styles.phaseOption}
            >
              <Text style={styles.phaseOptionText}>
                {p}
              </Text>
            </Pressable>
          ))}
      </View>
    )}
  </View>
)}

{editMode && (
  <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
    {!note.markedCompleteBy ? (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          markAttemptedComplete(note.id, 'crew');
        }}
        style={styles.pillCrewComplete}
      >
        <Text style={styles.pillText}>
          Crew Complete
        </Text>
      </Pressable>
    ) : (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          markOfficeIncomplete(note.id);
        }}
        style={styles.pillSoftReject}
      >
        <Text style={styles.pillTextDark}>
          Mark Incomplete
        </Text>
      </Pressable>
    )}
  </View>
)}

{editMode && (
  <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
    {note.status === 'blank' && (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          markOfficeIncomplete(note.id);
        }}
        style={styles.pillIncomplete}
      >
        <Text style={styles.pillTextDark}>
          Mark Incomplete
        </Text>
      </Pressable>
    )}

    {note.status !== 'blank' && (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          markOfficeBlank(note.id);
        }}
        style={styles.pillBlank}
      >
        <Text style={styles.pillTextDark}>
          Reset to Blank
        </Text>
      </Pressable>
    )}
  </View>
)}

            </Pressable>
          ))}

{/* OFFICE COMPLETED ACCORDION */}
<View style={{ marginTop: 10 }}>
  {officeCompleted.length > 0 && (
    <>
      <Pressable
        onPress={() =>
          setShowCompletedByPhase(prev => ({
            ...prev,
            [phase]: !prev[phase],
          }))
        }
      >
<Text
  style={[
    styles.sectionTitle,
    { marginLeft: 12, fontSize: 16 }
  ]}
>
  {showCompletedByPhase[phase] ? '▼' : '▶'} Completed: {phase}
</Text>
      </Pressable>

      {showCompletedByPhase[phase] &&
        officeCompleted.map(note => (
<Pressable
  key={note.id}
delayLongPress={600}
onLongPress={() => {
  if (role !== 'owner' && role !== 'admin') return;

  Alert.alert(
    'Delete Note?',
    'This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNote(note.id),
      },
    ]
  );
}}
  onPress={() => handleCompletedTap(phase)}
ref={r => {
  if (r) noteRefs.current[note.id] = r;
}}
  style={[
              styles.noteCard,
              { opacity: 0.6 },
            ]}
          >

          {note.status === 'incomplete' && (
  <View
    style={{
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: '#fef3c7',
      marginBottom: 6,
    }}
  >
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: '#b45309',
        letterSpacing: 0.3,
      }}
    >
      INCOMPLETE
    </Text>
  </View>
)}
            {/* NOTE A — primary instruction */}
<View style={styles.inputPillPrimary}>
  {editMode ? (
    <TextInput
      value={note.noteA ?? ''}
      onChangeText={text =>
        updateNoteField(note.id, 'noteA', text)
      }
      style={styles.inputPillTextPrimary}
      multiline
      blurOnSubmit={true}
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
    />
  ) : (
    <Text style={styles.inputPillTextPrimary}>
      {note.noteA ?? note.text}
    </Text>
  )}
</View>

            {/* NOTE B — clarification / context */}
  {note.noteB || editMode ? (
  <View style={styles.inputPillSecondary}>
    {editMode ? (
      <TextInput
        value={note.noteB ?? ''}
        onChangeText={text =>
          updateNoteField(note.id, 'noteB', text)
        }
        placeholder="Add clarification…"
        style={styles.inputPillTextSecondary}
        multiline
        blurOnSubmit={true}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
    ) : (
      <Text style={styles.inputPillTextSecondary}>
        {note.noteB}
      </Text>
    )}
  </View>
) : null}

<Text
  style={{
    fontSize: 11,
    opacity: 0.4,
    marginTop: 6,
  }}
>
  {role === 'owner' || role === 'admin'
  ? 'Double tap to collapse section – Hold to delete'
  : 'Double tap to collapse section'}
</Text>

            {/* Autosave indicator */}
            <View style={styles.autosaveSlot}>
              {editMode && saveStateByNote[note.id] ? (
                <Text style={{ fontSize: 11, opacity: 0.5 }}>
                  {saveStateByNote[note.id] === 'saving'
                    ? 'saving…'
                    : 'saved'}
                </Text>
              ) : null}
            </View>

            {pendingCompletion[note.id] && (
  <Pressable
    onPress={(e) => {
      e.stopPropagation();
      undoCompletion(note.id);
    }}
    style={{
      marginTop: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: '#dcfce7',
      alignSelf: 'flex-start',
    }}
  >
    <Text
      style={{
        fontSize: 12,
        fontWeight: '700',
        color: '#15803d',
      }}
    >
      Completing… Tap to Undo
    </Text>
  </Pressable>
)}

            {note.officeCompletedAt && (
              <Text style={styles.meta}>
                Office completed:{' '}
                {new Date(
                  note.officeCompletedAt
                ).toLocaleDateString()}
              </Text>
            )}

{editMode && (
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
)}

{editMode && (
  <Pressable
    style={styles.action}
    onPress={() => markOfficeBlank(note.id)}
  >
    <Text style={styles.actionText}>
      Reset to blank
    </Text>
  </Pressable>
)}
          </Pressable>
        ))}
    </>
  )}
</View>
        </View>
      )}
    </View>
  );
})}


</ScrollView>
</SafeAreaView>
</>
  );
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  paddingHorizontal: 20,
  paddingTop: 0,
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
  marginTop: 0,
},
sub: {
  fontSize: 14,
  opacity: 0.6,
  marginBottom: 12,
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
  paddingVertical: 10,
  paddingHorizontal: 10,
  borderRadius: 16,
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

phaseButton: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#e2e8f0', // match Reset to Blank tone
},

phaseButtonText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#334155',
},

phaseDropdown: {
  marginTop: 8,
  borderRadius: 10,
  backgroundColor: '#ffffff',
  borderWidth: 1,
  borderColor: '#e5e7eb',
  overflow: 'hidden',
},

phaseOption: {
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},

phaseOptionText: {
  fontSize: 13,
  fontWeight: '500',
},

inputPillPrimary: {
  backgroundColor: '#fafafa',   // soft white (not pure white)
  borderWidth: 1,
  borderColor: '#e5e7eb',       // subtle gray border
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 16,
  alignSelf: 'stretch',
  marginBottom: 8,
},

inputPillSecondary: {
  backgroundColor: '#fafafa',   // exact match
  borderWidth: 1,
  borderColor: '#e5e7eb',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 16,
  alignSelf: 'stretch',
  marginBottom: 8,
},

inputPillTextPrimary: {
  fontSize: 16,
  fontWeight: '600',
  color: '#0f172a',
},

inputPillTextSecondary: {
  fontSize: 16,          // match primary
  fontWeight: '600',     // match primary
  color: '#0f172a',      // match primary
},

pillComplete: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#dbeafe', // soft blue
},

pillTextBlue: {
  fontSize: 12,
  fontWeight: '700',
  color: '#1e40af',
},

pillApprove: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#16a34a',
},

pillReject: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#dc2626',
},

pillText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#fff',
},

pillCrewComplete: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#3b82f6', // soft blue
},

pillSoftReject: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#fee2e2', // soft red
},

pillTextDark: {
  fontSize: 12,
  fontWeight: '700',
  color: '#991b1b', // deep muted red text
},

pillBlank: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#e2e8f0', // soft slate gray
},

pillIncomplete: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 999,
  backgroundColor: '#fef3c7', // soft amber
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