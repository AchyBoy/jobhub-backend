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
const [phasePickerForNote, setPhasePickerForNote] =
  useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
const [highlightedNote, setHighlightedNote] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const scrollRef = useRef<ScrollView>(null);
const notePositions = useRef<Record<string, number>>({});
const lastTapRef = useRef<Record<string, number>>({});
const [searchQuery, setSearchQuery] = useState('');
const [showSearch, setShowSearch] = useState(false);
const [showAddItem, setShowAddItem] = useState(false);

  // NOTE (future us):
  // Prevents accidental data loss on first load.
  // We NEVER sync until backend notes have been loaded at least once.
  const [backendHydrated, setBackendHydrated] = useState(false);

  useEffect(() => {
  latestNotesRef.current = notes;
}, [notes]);

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
const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
const [crewViewPhases, setCrewViewPhases] = useState<string[]>([]);

const allPhases = phases;


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
}, [id]);

async function loadJob() {

if (!id) return;
const name = await fetchJobFromBackend(id);  if (name) {
    setJobName(name);
  }
}

async function loadPhases() {
  // 1️⃣ Load local cache first (offline-first)
  const stored = await AsyncStorage.getItem('phases');

  if (stored) {
    const parsed = JSON.parse(stored);
    setPhases(parsed);

    if (parsed.length && !currentPhase) {
      setCurrentPhase(parsed[0]);
      setExpandedPhase(parsed[0]);
    }
  }

  // 2️⃣ Fetch backend
  const remote = await fetchPhasesFromBackend();

  if (Array.isArray(remote)) {
    setPhases(remote);
    await AsyncStorage.setItem('phases', JSON.stringify(remote));

    if (remote.length && !currentPhase) {
      setCurrentPhase(remote[0]);
      setExpandedPhase(remote[0]);
    }
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

async function markOfficeComplete(noteId: string) {
const updated: JobNote[] = notes.map(n =>    n.id === noteId
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
  if (!id) return;
await syncNotesToBackend(id, updated);
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
  const lastTap = lastTapRef.current[noteId] ?? 0;

  if (now - lastTap < 250) {
    setExpandedPhase(null); // collapse entire phase
  }

  lastTapRef.current[noteId] = now;
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
        Keyboard.dismiss();
        setSearchFocused(false);
      }}
      style={{ marginLeft: 8 }}
    >
      <Text style={{ fontWeight: '600', color: '#2563eb' }}>
        Done
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
          .filter(n =>
            (n.noteA + ' ' + (n.noteB ?? ''))
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
          .slice(0, 20)
          .map(n => (
            <Pressable
              key={n.id}
              onPress={() => {
                setExpandedPhase(n.phase);
                setSearchQuery('');
                Keyboard.dismiss();
                setHighlightedNote(n.id);

                setTimeout(() => {
                  const y = notePositions.current[n.id];
                  if (y != null && scrollRef.current) {
                    scrollRef.current.scrollTo({
                      y: y - 20,
                      animated: true,
                    });
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
      setShowAddItem(false);
      Keyboard.dismiss();
    }}
  />
)}

 <ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  contentContainerStyle={{ paddingBottom: 80 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>

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
<Pressable
  key={note.id}
  onPress={() => handleNoteTap(note.id, phase)}
  onLayout={e => {
    notePositions.current[note.id] = e.nativeEvent.layout.y;
  }}
  style={[
    styles.noteCard,
  note.crewCompletedAt && { backgroundColor: '#dcfce7' },
  highlightedNote === note.id && {
    borderWidth: 2,
    borderColor: '#2563eb',
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

<Text style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
  Double tap to collapse
</Text>

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

{editMode && (
  <View style={{ marginTop: 10 }}>
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

              {note.crewCompletedAt && (
                <Text style={styles.meta}>
                  Crew completed:{' '}
                  {new Date(
                    note.crewCompletedAt
                  ).toLocaleDateString()}
                </Text>
              )}

              {editMode && !note.markedCompleteBy && (

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

{editMode && (
  <Pressable
    style={[styles.action, { marginTop: 6 }]}
    onPress={() => markOfficeComplete(note.id)}
  >
    <Text style={styles.actionText}>
      Office mark complete
    </Text>
  </Pressable>
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
        <Text style={styles.sectionTitle}>
          {showCompletedByPhase[phase] ? '▼' : '▶'} Completed
        </Text>
      </Pressable>

      {showCompletedByPhase[phase] &&
        officeCompleted.map(note => (
<Pressable
  key={note.id}
  onPress={() => handleNoteTap(note.id, phase)}
  onLayout={e => {
    notePositions.current[note.id] = e.nativeEvent.layout.y;
  }}
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

            <Text style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
  Double tap to collapse
</Text>

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
  paddingVertical: 4,
  paddingHorizontal: 6,
  borderRadius: 12,
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
  paddingHorizontal: 12,
  borderRadius: 999,
  backgroundColor: '#e5e7eb',
  alignSelf: 'flex-start',
},

phaseButtonText: {
  fontSize: 12,
  fontWeight: '600',
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