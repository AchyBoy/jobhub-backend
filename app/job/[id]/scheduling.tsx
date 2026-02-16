//JobHub/app/job/[id]/scheduling.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function SchedulingScreen() {
  const { id } = useLocalSearchParams();

  const [crews, setCrews] = useState<any[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
const [editingPhase, setEditingPhase] = useState<string | null>(null);
const [phaseToSchedule, setPhaseToSchedule] = useState<string | null>(null);


useEffect(() => {
  if (!id) return;

  loadCrews();        // fire immediately
  loadPhases();       // fire immediately
  loadAssignments();  // fire immediately
}, [id]);


  async function loadCrews() {
    const local = await AsyncStorage.getItem('crews_v1');
    if (local) setCrews(JSON.parse(local));

    try {
      const res = await apiFetch('/api/crews');
      setCrews(res.crews ?? []);
      await AsyncStorage.setItem('crews_v1', JSON.stringify(res.crews ?? []));
    } catch {}
  }

  async function loadPhases() {
    const local = await AsyncStorage.getItem('phases');
    if (local) setPhases(JSON.parse(local));

    try {
      const res = await apiFetch('/api/phases');
      const names = res?.phases?.map((p: any) => p.name) ?? [];
      setPhases(names);
      await AsyncStorage.setItem('phases', JSON.stringify(names));
    } catch {}
  }

async function loadAssignments() {
  const key = `job:${id}:crews`;

  // 1️⃣ Load local immediately (instant UI)
  const local = await AsyncStorage.getItem(key);
  if (local) {
    setAssignments(JSON.parse(local));
  }

  // 2️⃣ Refresh from API in background
  try {
    const res = await apiFetch(`/api/scheduled-tasks?jobId=${id}`);

    const normalizedRaw = (res.tasks ?? []).map((t: any) => ({
      id: t.id,
      crewId: t.crewId ?? t.crew_id,
      phase: t.phase,
      scheduledAt: t.scheduledAt ?? t.scheduled_at,
    }));

    // keep only latest per phase
    const byPhase: Record<string, any> = {};
    normalizedRaw.forEach(t => {
      byPhase[t.phase] = t;
    });

    const normalized = Object.values(byPhase);

    setAssignments(normalized);

    await AsyncStorage.setItem(
      key,
      JSON.stringify(normalized)
    );

  } catch {}
}

async function assignCrew(
  crewId: string,
  phase: string
) {
  if (!id) return;

const scheduledAt = new Date().toISOString();

const newAssignment = {
  id: Date.now().toString(),
  crewId,
  phase,
  scheduledAt,
};

  const filtered = assignments.filter(a => a.phase !== phase);
const updated = [...filtered, newAssignment];

  // 1️⃣ Immediate UI update
  setAssignments(updated);

  // 2️⃣ Persist locally
  await AsyncStorage.setItem(
    `job:${id}:crews`,
    JSON.stringify(updated)
  );

// 3️⃣ Attempt backend scheduled task endpoint
try {
  await apiFetch(`/api/scheduled-tasks`, {
    method: 'POST',
    body: JSON.stringify({
      jobId: id,
      crewId,
      phase,
      scheduledAt,
    }),
  });
} catch {
  await enqueueSync({
    id: makeId(),
    type: 'scheduled_task_create',
    coalesceKey: `scheduled_task_create:${id}:${crewId}:${phase}`,
    createdAt: nowIso(),
    payload: {
      jobId: id as string,
      crewId,
      phase,
      scheduledAt,
    },
  });
}

  flushSyncQueue();
}

    return (
    <>
      <Stack.Screen options={{ title: 'Scheduling' }} />

      <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Scheduling</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {phases.map(phase => {
          const phaseAssignments = assignments.filter(
            a => a.phase === phase
          );

          return (
            <Pressable
  key={phase}
  style={styles.phaseCard}
  onLongPress={() => {
    if (phaseAssignments.length === 0) {
      Alert.alert('Select crew first');
      return;
    }

    setPhaseToSchedule(phase);
  }}
>
              <Text style={styles.phaseTitle}>{phase}</Text>

              {phaseAssignments.length === 0 && (
                <Text style={styles.empty}>
                  No crew assigned
                </Text>
              )}

              {phaseAssignments.map(a => {
                const crew = crews.find(c => c.id === a.crewId);

                return (
                  <View key={a.id} style={styles.tag}>
                    <Text style={styles.tagText}>
                      {crew?.name ?? 'Unknown'}
                    </Text>
                  </View>
                );
              })}

{/* ASSIGN SECTION */}

{phaseAssignments.length === 0 && (
  <>
    <Pressable
      onPress={() =>
        setExpandedPhase(prev =>
          prev === phase ? null : phase
        )
      }
      style={{ marginTop: 10 }}
    >
      <Text style={styles.assignText}>
        + Assign Crew
      </Text>
    </Pressable>

    {expandedPhase === phase &&
      crews.map(c => (
        <Pressable
          key={`${phase}-${c.id}`}
          onPress={() => {
            assignCrew(c.id, phase);
            setExpandedPhase(null);
          }}
        >
          <Text style={styles.assignText}>
            {c.name}
          </Text>
        </Pressable>
      ))}
  </>
)}

{phaseAssignments.length > 0 && (
  <View style={{ marginTop: 8 }}>
    <Pressable
      onPress={() =>
        setEditingPhase(prev =>
          prev === phase ? null : phase
        )
      }
      style={{ position: 'absolute', top: 0, right: 0 }}
    >
      <Text style={{ fontSize: 12, color: '#2563eb' }}>
        {editingPhase === phase ? 'Done' : 'Edit'}
      </Text>
    </Pressable>

    {editingPhase === phase &&
      crews.map(c => (
        <Pressable
          key={`${phase}-edit-${c.id}`}
          onPress={async () => {
  await assignCrew(c.id, phase);
  setEditingPhase(null);
}}
        >
          <Text style={styles.assignText}>
            Change to {c.name}
          </Text>
        </Pressable>
      ))}
  </View>
)}
            </Pressable>
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
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },
  phaseCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    marginBottom: 16,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  empty: {
    opacity: 0.5,
    marginTop: 6,
  },
  tag: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  assignText: {
    marginTop: 4,
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
});