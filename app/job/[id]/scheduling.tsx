//JobHub/app/job/[id]/scheduling.tsx
import {
  View,
  Text,
  TextInput, // add this
  StyleSheet,
  ScrollView,
  Pressable,
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
  const [scheduledAt, setScheduledAt] = useState<string>(
  new Date().toISOString()
);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

 async function loadAll() {
  await Promise.all([
    loadCrews(),
    loadPhases(),
    loadAssignments(),
  ]);
}

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
    const local = await AsyncStorage.getItem(`job:${id}:crews`);
    if (local) setAssignments(JSON.parse(local));

    try {
      const res = await apiFetch(`/api/jobs/${id}/crews`);
      setAssignments(res.assignments ?? []);
      await AsyncStorage.setItem(
        `job:${id}:crews`,
        JSON.stringify(res.assignments ?? [])
      );
    } catch {}
  }

async function assignCrew(
  crewId: string,
  phase: string
) {
  if (!id) return;

  const newAssignment = {
    id: Date.now().toString(),
    crewId,
    phase,
    scheduledAt,
  };

  const updated = [...assignments, newAssignment];

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
      <View style={{ marginBottom: 20 }}>
  <Text style={{ fontWeight: '700', marginBottom: 6 }}>
    Scheduled Date/Time (ISO)
  </Text>

  <TextInput
    value={scheduledAt}
    onChangeText={setScheduledAt}
    style={{
      borderWidth: 1,
      borderColor: '#ccc',
      padding: 8,
      borderRadius: 8,
    }}
  />
</View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {phases.map(phase => {
          const phaseAssignments = assignments.filter(
            a => a.phase === phase
          );

          return (
            <View key={phase} style={styles.phaseCard}>
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

              <View style={{ marginTop: 8 }}>
                {crews.map(c => (
                  <Pressable
                    key={`${phase}-${c.id}`}
                    onPress={() => assignCrew(c.id, phase)}
                  >
                    <Text style={styles.assignText}>
                      + Assign {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
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