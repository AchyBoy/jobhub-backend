//JobHub/app/job/[id].tsx
import { Text, StyleSheet, Pressable, View } from 'react-native';


import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../src/lib/syncEngine';

export default function JobHub() {
const { id, name } = useLocalSearchParams();
const router = useRouter();
const [jobSupervisors, setJobSupervisors] = useState<any[]>([]);
const [jobContractor, setJobContractor] = useState<any | null>(null);

const [detailsExpanded, setDetailsExpanded] = useState(false);
const [assignments, setAssignments] = useState<any[]>([]);
const [crews, setCrews] = useState<any[]>([]);
const [phases, setPhases] = useState<string[]>([]);


const jobName =
  typeof name === 'string' && name.length > 0
    ? name
    : 'Job';

useEffect(() => {
  if (!id) return;
  loadCrews();
  loadPhases();
  loadAssignments();
  flushSyncQueue();
  loadDefaults();
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

async function loadDefaults() {
  try {
    const supRes = await apiFetch(`/api/jobs/${id}/supervisors`);
    setJobSupervisors(supRes.supervisors ?? []);

    const conRes = await apiFetch(`/api/jobs/${id}/contractor`);
    setJobContractor(conRes.contractor ?? null);
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

async function assignCrew(crewId: string, phase: string) {
  const newAssignment = {
    id: Date.now().toString(),
    crewId,
    phase,
  };

  const updated = [...assignments, newAssignment];
  setAssignments(updated);

  await AsyncStorage.setItem(
    `job:${id}:crews`,
    JSON.stringify(updated)
  );

  await enqueueSync({
    id: makeId(),
    type: 'crew_assignment',
    coalesceKey: `crew_assignment:${id}:${crewId}:${phase}`,
    createdAt: nowIso(),
    payload: {
      jobId: id as string,
      crewId,
      phase,
    },
  });

  // attempt immediately (and loop will keep retrying if it fails)
  await flushSyncQueue();
}

  return (

<SafeAreaView
  style={styles.container}
  edges={['left', 'right', 'bottom']}
>

  <Text style={styles.title}>{jobName}</Text>

  <Text style={styles.sub}>Job ID: {id}</Text>

<View style={styles.actions}>

  {/* 🔷 MANAGEMENT SECTION */}
  <View style={styles.sectionBlock}>

    {/* 🔷 JOB DETAILS (Collapsible) */}
    <Pressable
      style={styles.card}
      onPress={() => setDetailsExpanded(v => !v)}
    >
      <View style={styles.detailHeader}>
        <Text style={styles.cardTitle}>Job Details</Text>
        <Text style={styles.expandIcon}>
          {detailsExpanded ? '▲' : '▼'}
        </Text>
      </View>

      <View style={{ marginTop: 10 }}>
<Text style={styles.detailLabel}>Supervisors</Text>

{jobSupervisors.length === 0 ? (
  <Text style={styles.detailValue}>Not Assigned</Text>
) : (
  jobSupervisors.map(s => (
    <Text key={s.id} style={styles.detailValue}>
      {s.name}
    </Text>
  ))
)}
      </View>

      {detailsExpanded && (
        <View style={{ marginTop: 16, gap: 8 }}>
<Text style={styles.detailLabel}>Primary Contractor</Text>

<Text style={styles.detailValue}>
  {jobContractor?.name ?? "Not Assigned"}
</Text>

          <Text style={styles.detailLabel}>Inspector</Text>
          <Text style={styles.detailValue}>Not Assigned</Text>

          <Text style={styles.detailLabel}>Permit Company</Text>
          <Text style={styles.detailValue}>Not Assigned</Text>

<Text style={[styles.detailLabel, { marginTop: 12 }]}>
  Assigned Crews (per phase)
</Text>

{phases.length === 0 && (
  <Text style={{ opacity: 0.5, marginTop: 4 }}>
    No phases configured
  </Text>
)}

{phases.map(phase => {
  const phaseAssignments = assignments.filter(
    a => a.phase === phase
  );

  return (
    <View
      key={phase}
      style={{ marginTop: 10 }}
    >
      <Text style={{ fontWeight: '700', fontSize: 14 }}>
        {phase}
      </Text>

      {phaseAssignments.length === 0 ? (
        <Text style={{ opacity: 0.5, marginTop: 2 }}>
          No crew assigned
        </Text>
      ) : (
        phaseAssignments.map(a => {
          const crew = crews.find(c => c.id === a.crewId);

          return (
            <View
              key={a.id}
              style={{
                marginTop: 4,
                paddingVertical: 4,
                paddingHorizontal: 8,
                backgroundColor: '#dbeafe',
                borderRadius: 999,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600' }}>
                {crew?.name ?? 'Unknown'}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
})}
        </View>
      )}
    </Pressable>

  </View>

  {/* 🔷 WORK SECTION */}
  <View style={styles.sectionBlock}>

    {/* Notes */}
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/notes`)}
    >
      <Text style={styles.cardTitle}>Notes</Text>
      <Text style={styles.cardSub}>
        General, crew, contractor, phase notes
      </Text>
    </Pressable>

    {/* Material */}
    <View style={[styles.card, styles.disabled]}>
      <Text style={styles.cardTitle}>Material</Text>
      <Text style={styles.cardSub}>
        Job materials & tracking
      </Text>
    </View>

    {/* Send Links */}
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/send-links`)}
    >
      <Text style={styles.cardTitle}>Send Links</Text>
      <Text style={styles.cardSub}>
        Email phase-specific crew links
      </Text>
    </Pressable>

        {/* Set Defaults */}
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/defaults`)}
    >
      <Text style={styles.cardTitle}>Set Defaults</Text>
      <Text style={styles.cardSub}>
        Contractor, supervisors, inspector, etc
      </Text>
    </Pressable>

    {/* Scheduling (renamed from Dates) */}
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/scheduling`)}
    >
      <Text style={styles.cardTitle}>Scheduling</Text>
      <Text style={styles.cardSub}>
        Assign crews per phase
      </Text>
    </Pressable>

  </View>

</View>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  alignItems: 'center',
  paddingTop: 0,
  paddingHorizontal: 20,
  backgroundColor: '#ffffff',
},
detailLabel: {
  fontSize: 13,
  fontWeight: '600',
  opacity: 0.6,
},
detailHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

expandIcon: {
  fontSize: 14,
  fontWeight: '700',
  opacity: 0.5,
},

detailMeta: {
  fontSize: 13,
  opacity: 0.6,
},

detailValue: {
  fontSize: 15,
  fontWeight: '500',
},
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  sub: {
    fontSize: 16,
    opacity: 0.7,
  },
actions: {
  marginTop: 30,
  gap: 12,
  width: '100%',
},
sectionBlock: {
  marginBottom: 22,
  width: '100%',
},

card: {
  padding: 18,
  borderRadius: 18,
  backgroundColor: '#eff6ff',   // light blue interior
  borderWidth: 1,
  borderColor: '#93c5fd',       // slightly darker blue border
},

cardTitle: {
  fontSize: 18,
  fontWeight: '600',
},

cardSub: {
  marginTop: 4,
  fontSize: 14,
  opacity: 0.7,
},

disabled: {
  opacity: 0.4,
},
});
