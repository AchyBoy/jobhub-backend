//JobHub/app/job/[id].tsx
import { Text, TextInput, StyleSheet, Pressable, View, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../src/lib/syncEngine';
import * as Linking from 'expo-linking';
export default function JobHub() {
const { id, name } = useLocalSearchParams();
const router = useRouter();
const [jobSupervisors, setJobSupervisors] = useState<any[]>([]);
const [jobContractor, setJobContractor] = useState<any | null>(null);
const [jobVendor, setJobVendor] = useState<any | null>(null);
const [jobPermitCompany, setJobPermitCompany] = useState<any | null>(null);
const [jobInspectionCompany, setJobInspectionCompany] = useState<any | null>(null);
const [role, setRole] = useState<string | null>(null);
const [detailsExpanded, setDetailsExpanded] = useState(false);
const [assignments, setAssignments] = useState<any[]>([]);
const [crews, setCrews] = useState<any[]>([]);
const [phases, setPhases] = useState<string[]>([]);
const [jobCoords, setJobCoords] = useState<{
  latitude: number | null;
  longitude: number | null;
}>({ latitude: null, longitude: null });
const [noteSummary, setNoteSummary] = useState<{
  incomplete: number;
  complete: number;
} | null>(null);
const [isTemplate, setIsTemplate] = useState(false);
const [jobName, setJobName] = useState<string>('Job');
const [editingName, setEditingName] = useState(false);
const [nameDraft, setNameDraft] = useState('');
const [tenantId, setTenantId] = useState<string | null>(null);

const [showJobSearch, setShowJobSearch] = useState(false);
const [jobSearchQuery, setJobSearchQuery] = useState('');
const [jobsIndex, setJobsIndex] = useState<any[]>([]);

    function handleCall(phone?: string | null) {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`);
}

function handleEmail(email?: string | null) {
  if (!email) return;
  Linking.openURL(`mailto:${email}`);
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

async function loadDefaults() {
  const storageKey = `job:${id}:defaults`;

  // 1️⃣ Load local first (instant UI)
  const local = await AsyncStorage.getItem(storageKey);
if (local) {
  const parsed = JSON.parse(local);

  const cachedSupervisors =
    JSON.parse(
      (await AsyncStorage.getItem('supervisors_v1')) ?? '[]'
    ) ?? [];

  const cachedContractors =
    JSON.parse(
      (await AsyncStorage.getItem('contractors_v1')) ?? '[]'
    ) ?? [];

  const cachedVendors =
    JSON.parse(
      (await AsyncStorage.getItem('vendors_v1')) ?? '[]'
    ) ?? [];

  const cachedPermitCompanies =
    JSON.parse(
      (await AsyncStorage.getItem('permit_companies_v1')) ?? '[]'
    ) ?? [];

  const cachedInspectionCompanies =
    JSON.parse(
      (await AsyncStorage.getItem('inspections_v1')) ?? '[]'
    ) ?? [];

setJobSupervisors(parsed.supervisors ?? []);

  setJobContractor(
    parsed.contractor
      ? cachedContractors.find(
          (c: any) => c.id === parsed.contractor.id
        ) ?? null
      : null
  );

  setJobVendor(
    parsed.vendor
      ? cachedVendors.find(
          (v: any) => v.id === parsed.vendor.id
        ) ?? null
      : null
  );

  setJobPermitCompany(
    parsed.permitCompany
      ? cachedPermitCompanies.find(
          (p: any) => p.id === parsed.permitCompany.id
        ) ?? null
      : null
  );

  setJobInspectionCompany(
    parsed.inspection
      ? cachedInspectionCompanies.find(
          (i: any) => i.id === parsed.inspection.id
        ) ?? null
      : null
  );
}

  // 2️⃣ Attempt API refresh
  try {
    const [
      supRes,
      conRes,
      venRes,
      permitRes,
      inspectionRes,
    ] = await Promise.all([
      apiFetch(`/api/jobs/${id}/supervisors`),
      apiFetch(`/api/jobs/${id}/contractor`),
      apiFetch(`/api/jobs/${id}/vendor`),
      apiFetch(`/api/jobs/${id}/permit-company`),
      apiFetch(`/api/jobs/${id}/inspection`),
    ]);

const updated = {
  supervisors:
    (supRes.assignments ?? []).map(
      (a: any) => String(a.supervisorId)
    ),

  contractor: conRes.contractor ?? null,
  vendor: venRes.vendor ?? null,
  permitCompany: permitRes.permitCompany ?? null,
  inspection: inspectionRes.inspection ?? null,
};

const cachedSupervisors =
  JSON.parse(
    (await AsyncStorage.getItem('supervisors_v1')) ?? '[]'
  ) ?? [];

const hydratedSupervisors =
  (supRes.assignments ?? []).map((a: any) => ({
    id: a.supervisorId,
    name: a.supervisorName,
    phone: a.phone ?? null,
    email: a.email ?? null,
  }));

setJobSupervisors(hydratedSupervisors);

setJobContractor(conRes.contractor ?? null);
setJobVendor(venRes.vendor ?? null);
setJobPermitCompany(permitRes.permitCompany ?? null);
setJobInspectionCompany(inspectionRes.inspection ?? null);

await AsyncStorage.setItem(
  storageKey,
  JSON.stringify({
    supervisors: hydratedSupervisors,   // 🔥 store full objects
    contractor: updated.contractor
      ? { id: updated.contractor.contractorId }
      : null,
    vendor: updated.vendor
      ? { id: updated.vendor.id }
      : null,
    permitCompany: updated.permitCompany
      ? { id: updated.permitCompany.id }
      : null,
    inspection: updated.inspection
      ? { id: updated.inspection.id }
      : null,
  })
);

  } catch {
    // silent fail — offline mode
  }
}

async function loadRole() {
  try {
    const res = await apiFetch('/api/tenant/me');
    setRole(res?.role ?? null);

    const tid = res?.tenantId ?? null;
    setTenantId(tid);

    if (tid) {
      await loadJobsIndex(tid);
    }
  } catch {
    setRole(null);
    setTenantId(null);
  }
}

async function loadJobsIndex(tid: string) {
  const cacheKey = `jobs:${tid}`;

  // 1) local first (instant)
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) setJobsIndex(parsed);
    }
  } catch {}

  // 2) refresh from API
  try {
    const res = await apiFetch('/api/job'); // returns { jobs: [...] }
    const jobs = Array.isArray(res?.jobs) ? res.jobs : [];
    setJobsIndex(jobs);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(jobs));
  } catch {}
}

const filteredJobs =
  jobSearchQuery.trim().length === 0
    ? []
    : jobsIndex
        .filter(j =>
          String(j?.name ?? '')
            .toLowerCase()
            .includes(jobSearchQuery.trim().toLowerCase())
        )
        .slice(0, 8);

async function loadPhases() {
  const local = await AsyncStorage.getItem('phases');
  if (local) setPhases(JSON.parse(local));

  try {
    const [phaseRes, groupRes] = await Promise.all([
      apiFetch('/api/phases'),
      apiFetch('/api/phase-groups'),
    ]);

    const basePhases =
      phaseRes?.phases?.map((p: any) => p.name) ?? [];

    const groupArray =
      groupRes?.phaseGroups ?? [];

// Deduplicate by basePhase
const groupedPhases: string[] = Array.from(
  new Set(
    (groupArray as any[]).map(
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
  } catch (e) {
    console.log('PHASE LOAD ERROR:', e);
  }
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

async function loadJob() {
  try {
    const res = await apiFetch(`/api/job/${id}`);
if (res?.job) {
  setJobName(res.job.name);
  setNameDraft(res.job.name);
  setIsTemplate(!!res.job.isTemplate);

  setJobCoords({
    latitude:
      typeof res.job.latitude === 'number' ? res.job.latitude : null,
    longitude:
      typeof res.job.longitude === 'number' ? res.job.longitude : null,
  });
}
  } catch {}
}

function openJobInMaps() {
  const lat = jobCoords.latitude;
  const lng = jobCoords.longitude;

  if (lat == null || lng == null) {
    Alert.alert(
      'No Location Set',
      'This job does not have GPS coordinates yet. Hold the button to set location here.'
    );
    return;
  }

  const label = encodeURIComponent(jobName || 'Job');
  // Apple Maps (works on iOS simulator)
  const appleUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  // Google Maps fallback
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  Linking.openURL(appleUrl).catch(() => Linking.openURL(googleUrl));
}

async function setLocationHereWithConfirm() {
  if (role !== 'owner' && role !== 'admin') {
    Alert.alert('Unauthorized');
    return;
  }

  let latitude: number | null = null;
  let longitude: number | null = null;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location Denied', 'Enable location permissions to set job location.');
      return;
    }

    const pos = await Location.getCurrentPositionAsync({});
    latitude = pos.coords.latitude;
    longitude = pos.coords.longitude;
  } catch {
    Alert.alert('Error', 'Failed to read current location.');
    return;
  }

  Alert.alert(
    'Set Job Location?',
    `This will overwrite the job’s saved location.\n\nLat: ${latitude}\nLng: ${longitude}`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Set Location',
        style: 'destructive',
        onPress: async () => {
          try {
            // IMPORTANT: send name too, so backend never receives null for name
            await apiFetch(`/api/job/${id}/meta`, {
              method: 'POST',
              body: JSON.stringify({
                name: jobName,
                latitude,
                longitude,
              }),
            });

            setJobCoords({ latitude, longitude });
            Alert.alert('Saved', 'Job location updated.');
          } catch {
            Alert.alert('Error', 'Failed to save job location.');
          }
        },
      },
    ]
  );
}

async function loadNoteSummary() {
  if (!id) return;

  try {
    const res = await apiFetch(`/api/job/${id}/notes`);
    const notes = res?.notes ?? [];

    const incomplete = notes.filter(
      (n: any) => n.status === 'incomplete'
    ).length;

    const complete = notes.filter(
      (n: any) => n.status === 'complete'
    ).length;

    setNoteSummary({ incomplete, complete });
  } catch {}
}

useFocusEffect(
  useCallback(() => {
    if (!id) return;
    loadRole();
    loadCrews();
    loadJob();
    loadPhases();
    loadAssignments();
loadNoteSummary();
    (async () => {
      await loadDefaults();
    })();

  }, [id])
);

  return (

<SafeAreaView
  style={styles.container}
  edges={['left', 'right', 'bottom']}
>

<ScrollView
  contentContainerStyle={{ paddingBottom: 60 }}
  showsVerticalScrollIndicator={false}
>

<View style={{ marginTop: 6, marginBottom: 2 }}>
  {editingName ? (
    <>
      <TextInput
        value={nameDraft}
        onChangeText={setNameDraft}
        style={{
          borderWidth: 1,
          borderColor: '#93c5fd',
          borderRadius: 10,
          padding: 10,
          fontSize: 18,
          fontWeight: '600',
        }}
      />

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <Pressable
          onPress={() => {
            setEditingName(false);
            setNameDraft(jobName);
          }}
        >
          <Text style={{ color: '#64748b', fontWeight: '600' }}>
            Cancel
          </Text>
        </Pressable>

<Pressable
  onPress={async () => {
    if (role !== 'owner' && role !== 'admin') {
      Alert.alert('Unauthorized');
      return;
    }

    try {
      await apiFetch(`/api/job/${id}/meta`, {
        method: 'POST',
        body: JSON.stringify({ name: nameDraft }),
      });

      setJobName(nameDraft);
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to update job name');
    }
  }}
>
          <Text style={{ color: '#2563eb', fontWeight: '700' }}>
            Save
          </Text>
        </Pressable>
      </View>
    </>
) : (
  role === 'owner' || role === 'admin' ? (
<Pressable
  onLongPress={() => setEditingName(true)}
  delayLongPress={400}
>
  <Text style={{ fontSize: 24, fontWeight: '700' }}>
    {jobName}
  </Text>

  <Text
    style={{
      fontSize: 12,
      opacity: 0.45,
      marginTop: 1,
      letterSpacing: 0.3,
    }}
  >
    Hold to edit Job Name
  </Text>
</Pressable>
  ) : (
    <Text style={{ fontSize: 24, fontWeight: '700' }}>
      {jobName}
    </Text>
  )
)}
</View>


{isTemplate && (
  <View
    style={{
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fca5a5',
    }}
  >
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#b91c1c',
      }}
    >
      You are editing a TEMPLATE.
    </Text>
    <Text
      style={{
        fontSize: 12,
        marginTop: 4,
        color: '#7f1d1d',
      }}
    >
      Changes here will affect all future jobs created from this template.
    </Text>
  </View>
)}

<View style={styles.actions}>

  {/* 🔷 MANAGEMENT SECTION */}
  <View style={styles.sectionBlock}>
  
  <View style={{ marginBottom: 6 }}>
  <View style={styles.idSearchRow}>
    <Text style={styles.sub}>Job ID: {id}</Text>
  </View>
</View>


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

      {detailsExpanded && (
        <View style={{ marginTop: 16, gap: 8 }}>

                    <View style={{ marginTop: 12 }}>
  <Text style={styles.detailLabel}>Location</Text>


<Pressable
  style={styles.locationPill}
  onPress={openJobInMaps}
  onLongPress={setLocationHereWithConfirm}
  delayLongPress={450}
>
  <Text style={styles.locationTitle}>Set Location Here</Text>

  <Text style={styles.locationHint}>
    Tap to open map • Hold to overwrite with current GPS
  </Text>

  {jobCoords.latitude != null && jobCoords.longitude != null && (
    <Text style={styles.locationCoords}>
      {jobCoords.latitude.toFixed(5)}, {jobCoords.longitude.toFixed(5)}
    </Text>
  )}
</Pressable>
</View> 

                <View style={{ marginTop: 10 }}>
<Text style={styles.detailLabel}>Supervisors</Text>

{jobSupervisors.length === 0 ? (
  <Text style={styles.detailValue}>Not Assigned</Text>
) : (
jobSupervisors.map((s: any, index: number) => {
  const phone =
    s.phone ??
    s.phoneNumber ??
    s.mobile ??
    null;

  const email =
    s.email ??
    s.primaryEmail ??
    null;

  const emails =
    Array.isArray(s.emails)
      ? s.emails
      : [];

  return (
    <View
      key={`${s?.id ?? s}-${index}`}
      style={styles.assignedPill}
    >
      <Text style={styles.assignedText}>
        {s.name}
      </Text>

{phone && (
  <Pressable onPress={() => handleCall(phone)}>
    <Text style={[styles.assignedMeta, { color: '#2563eb' }]}>
      {phone}
    </Text>
  </Pressable>
)}

{email && (
  <Pressable onPress={() => handleEmail(email)}>
    <Text style={[styles.assignedMeta, { color: '#2563eb' }]}>
      {email}
    </Text>
  </Pressable>
)}

      {emails.map((e: string, i: number) => (
        <Text key={i} style={styles.assignedMeta}>
          {e}
        </Text>
      ))}
    </View>
  );
})
)}
      </View>
      
<Text style={styles.detailLabel}>Primary Contractor</Text>

{jobContractor?.name ? (
  <View style={styles.assignedPill}>
    <Text style={styles.assignedText}>
      {jobContractor.name}
    </Text>

    {jobContractor.phone && (
      <Text style={styles.assignedMeta}>
        {jobContractor.phone}
      </Text>
    )}

    {jobContractor.email && (
      <Text style={styles.assignedMeta}>
        {jobContractor.email}
      </Text>
    )}
  </View>
) : (
  <Text style={styles.detailValue}>Not Assigned</Text>
)}

<Text style={styles.detailLabel}>Vendor</Text>

{jobVendor?.name ? (
  <View style={styles.assignedPill}>
    <Text style={styles.assignedText}>
      {jobVendor.name}
    </Text>
  </View>
) : (
  <Text style={styles.detailValue}>Not Assigned</Text>
)}

<Text style={styles.detailLabel}>Inspection Company</Text>

{jobInspectionCompany?.name ? (
  <View style={styles.assignedPill}>
    <Text style={styles.assignedText}>
      {jobInspectionCompany.name}
    </Text>
  </View>
) : (
  <Text style={styles.detailValue}>Not Assigned</Text>
)}

<Text style={styles.detailLabel}>Permit Company</Text>

{jobPermitCompany?.name ? (
  <View style={styles.assignedPill}>
    <Text style={styles.assignedText}>
      {jobPermitCompany.name}
    </Text>
  </View>
) : (
  <Text style={styles.detailValue}>Not Assigned</Text>
)}

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
      marginTop: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: '#f8fbff',
      borderRadius: 999,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: '#dbeafe',
    }}
  >
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#1e40af',
        letterSpacing: 0.2,
      }}
    >
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
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <Text style={styles.cardTitle}>Notes</Text>

    {noteSummary?.incomplete ? (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: '#fee2e2',
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#b91c1c',
          }}
        >
          {noteSummary.incomplete} Incomplete
        </Text>
      </View>
    ) : noteSummary?.complete ? (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: '#dcfce7',
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#15803d',
          }}
        >
          Complete
        </Text>
      </View>
    ) : null}
  </View>

  <Text style={styles.cardSub}>
    General, crew, contractor, phase notes
  </Text>
</Pressable>

{/* Material */}
<Pressable
  style={styles.card}
  onPress={() => router.push(`/job/${id}/materials`)}
>
  <Text style={styles.cardTitle}>Material</Text>
  <Text style={styles.cardSub}>
    Job materials & tracking
  </Text>
</Pressable>

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

{!isTemplate && (
  <>
    {/* Create Template */}
    <Pressable
      style={[
        styles.card,
        { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' },
      ]}
      onPress={() => {
        Alert.alert(
          'Create Template',
          'This will convert this job into a reusable template.\n\nContinue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create',
              style: 'default',
              onPress: async () => {
                try {
                  await apiFetch(
                    `/api/templates/from-job/${id}`,
                    { method: 'POST' }
                  );

                  Alert.alert(
                    'Success',
                    'Job converted to template.'
                  );

                  setIsTemplate(true);
                } catch {
                  Alert.alert(
                    'Error',
                    'Failed to create template.'
                  );
                }
              },
            },
          ]
        );
      }}
    >
      <Text style={styles.cardTitle}>Create Template</Text>
      <Text style={styles.cardSub}>
        Convert this job into a reusable template
      </Text>
    </Pressable>
  </>
)}

  </View>

</View>
</ScrollView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
container: {
  flex: 1,
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
  fontSize: 14,
  opacity: 0.7,
},
actions: {
  marginTop: 1,
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

assignedPill: {
  marginTop: 10,
  paddingVertical: 12,     // was 6
  paddingHorizontal: 16,   // was 12
  backgroundColor: '#f8fbff',
  borderRadius: 16,        // was 999 (full pill)
  alignSelf: 'stretch',    // allow full width instead of tiny pill
  borderWidth: 1,
  borderColor: '#dbeafe',
},

assignedText: {
  fontSize: 13,
  fontWeight: '600',
  color: '#1e40af',             // theme-aligned blue
  letterSpacing: 0.2,
},
cardSub: {
  marginTop: 4,
  fontSize: 14,
  opacity: 0.7,
},
locationPill: {
  marginTop: 8,
  paddingVertical: 10,
  paddingHorizontal: 14,
  backgroundColor: '#f8fbff',   // same as assignedPill
  borderRadius: 16,             // same radius style
  alignSelf: 'stretch',
  borderWidth: 1,
  borderColor: '#dbeafe',       // same as assignedPill
},

locationTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#1e40af',             // same vibe as assignedText
  letterSpacing: 0.2,
},

locationHint: {
  marginTop: 4,
  fontSize: 12,
  color: '#64748b',             // matches assignedMeta
},
searchTogglePill: {
  paddingVertical: 6,
  paddingHorizontal: 12,
  backgroundColor: '#f8fbff',
  borderRadius: 16,
  alignSelf: 'flex-start',
  borderWidth: 1,
  borderColor: '#dbeafe',
},

searchToggleText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#1e40af',
  letterSpacing: 0.2,
},

searchBoxWrap: {
  marginTop: 10,
},

searchInput: {
  borderWidth: 1,
  borderColor: '#dbeafe',
  backgroundColor: '#ffffff',
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 12,
  fontSize: 15,
},

searchResultsWrap: {
  marginTop: 8,
  borderWidth: 1,
  borderColor: '#dbeafe',
  backgroundColor: '#f8fbff',
  borderRadius: 12,
  overflow: 'hidden',
},

searchResultRow: {
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#dbeafe',
},

searchResultName: {
  fontSize: 14,
  fontWeight: '700',
  color: '#1e40af',
},

searchResultMeta: {
  marginTop: 2,
  fontSize: 11,
  color: '#64748b',
},

searchEmptyText: {
  paddingVertical: 12,
  paddingHorizontal: 12,
  fontSize: 12,
  color: '#64748b',
},
collapsedHint: {
  marginTop: 8,
  fontSize: 12,
  color: '#64748b',
  opacity: 0.75,
},
idSearchRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 4,
},
locationCoords: {
  marginTop: 6,
  fontSize: 12,
  color: '#64748b',
  opacity: 0.85,
},
assignedMeta: {
  fontSize: 11,
  color: '#64748b',   // soft slate gray
  marginTop: 2,
},

disabled: {
  opacity: 0.4,
},
});
