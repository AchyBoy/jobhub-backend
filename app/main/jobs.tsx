//JobHub/app/main/jobs.tsx

import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { supabase } from '../../src/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import React from 'react';

type Job = {
  id: string;
  name: string;
  type: 'single' | 'multi';
  address?: string;
  notes?: string;
};

export default function JobsScreen() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
const [sortMode, setSortMode] = useState<
  'alpha-asc' | 'alpha-desc' | 'recent'
>('recent');

const [sortButtonLabel, setSortButtonLabel] = useState('Sort Jobs');

async function loadJobs() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  // 🔥 STEP 1 — Try to get cached tenantId first
  let tenantId = await AsyncStorage.getItem('tenantId');

  // 🔥 STEP 2 — If missing, fetch once and cache it
  if (!tenantId) {
    try {
      const me = await apiFetch('/api/tenant/me');
      tenantId = me?.tenantId;

      if (tenantId) {
        await AsyncStorage.setItem('tenantId', tenantId);
      }
    } catch {
      return; // cannot continue without tenant
    }
  }

  if (!tenantId) return;

  const cacheKey = `jobs:${tenantId}`;

  // 🔥 STEP 3 — LOAD CACHE IMMEDIATELY (no network)
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    setJobs(JSON.parse(cached));
  }

  // 🔥 STEP 4 — Network refresh (non-blocking)
apiFetch('/api/job')
  .then(async (res) => {
    setJobs(res.jobs ?? []);
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify(res.jobs ?? [])
    );
  })
.catch((err: any) => {
  console.warn('Offline — using cached jobs');
});
}

async function refreshJobsSilently() {
  try {
    const me = await apiFetch('/api/tenant/me');
    const tenantId = me.tenantId;
    if (!tenantId) return;

    const cacheKey = `jobs:${tenantId}`;

    const res = await apiFetch('/api/job');

    setJobs(res.jobs ?? []);

    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify(res.jobs ?? [])
    );
  } catch {
    // no UI change if it fails
  }
}

  // Reload every time tab is focused
useFocusEffect(
  React.useCallback(() => {
    loadJobs(); // instant load from cache
    loadRoleSilently(); // async, non-blocking
  }, [])
);

async function loadRoleSilently() {
  try {
    const me = await apiFetch('/api/tenant/me');
    setRole(me.role);
  } catch {
    setRole(null);
  }
}

  function getSortedJobs(list: Job[]) {
  const sorted = [...list];

  if (sortMode === 'alpha-asc') {
    sorted.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  if (sortMode === 'alpha-desc') {
    sorted.sort((a, b) =>
      b.name.localeCompare(a.name)
    );
  }

  // recent = default backend order (already DESC by created_at)

  return sorted;
}

function handleSortPress() {
  const order: any = {
    recent: 'alpha-asc',
    'alpha-asc': 'alpha-desc',
    'alpha-desc': 'recent',
  };

  const next = order[sortMode];
  setSortMode(next);

  const label =
    next === 'recent'
      ? 'Recent'
      : next === 'alpha-asc'
      ? 'A–Z'
      : 'Z–A';

  setSortButtonLabel(label);

  setTimeout(() => {
    setSortButtonLabel('Sort Jobs');
  }, 2000);
}

function openJob(job: Job) {
  router.push({
    pathname: `/job/${job.id}`,
    params: { name: job.name },
  });
}

async function deleteJob(job: Job) {
  Alert.alert(
    'Delete Job',
    'This will permanently delete this job and ALL related data.\n\nThis action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/job/${job.id}`, {
              method: 'DELETE',
            });

            // Remove locally
            setJobs(prev => prev.filter(j => j.id !== job.id));

            // Clean cached job data
            await AsyncStorage.multiRemove([
              `job:${job.id}:crews`,
              `job:${job.id}:defaults`,
            ]);

            // Refresh silently to sync everything
            refreshJobsSilently();

          } catch {
            Alert.alert('Delete failed');
          }
        },
      },
    ]
  );
}

return (
<>
  <Stack.Screen options={{ title: 'Jobs' }} />
  <View style={styles.container}>

<View style={styles.headerRow}>

  {/* LEFT */}
  <View style={styles.headerSide}>
    <Pressable
      style={styles.addBtn}
      onPress={() => router.push('/main/add-job')}
    >
      <Text style={styles.addText}>Add Job</Text>
    </Pressable>
  </View>

  {/* RIGHT */}
  <View style={styles.headerSide}>
    <Pressable
      style={styles.addBtn}
      onPress={() => handleSortPress()}
    >
      <Text style={styles.addText}>{sortButtonLabel}</Text>
    </Pressable>
  </View>

</View>

      {jobs.length === 0 ? (
        <Text style={styles.empty}>No jobs yet. Tap “Add Job”.</Text>
      ) : (
        <FlatList
          data={getSortedJobs(jobs)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
<Pressable
  style={styles.card}
  onPress={() => openJob(item)}
  onLongPress={
    role === 'owner' || role === 'admin'
      ? () => deleteJob(item)
      : undefined
  }
>
  <Text style={styles.jobName}>{item.name}</Text>

{(role === 'owner' || role === 'admin') && (
  <Text style={styles.hint}>Hold to delete</Text>
)}

  {/* 👇 JOB TYPE LABEL */}
<Text
  style={[
    styles.jobType,
    item.type === 'multi' ? styles.multi : styles.single,
  ]}
>
  {item.type === 'multi' ? 'Multi-Unit Job' : 'Single Unit Job'}
</Text>

  {!!item.address && (
    <Text style={styles.address}>{item.address}</Text>
  )}
</Pressable>
          )}
        />
      )}
    </View>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
     paddingTop: 16, // tighter to header
    backgroundColor: '#fff',
  },
headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 20,
},

headerSide: {
  width: 130,
  justifyContent: 'center',
},

headerCenter: {
  flex: 1,
  alignItems: 'center',
},

addBtn: {
  paddingVertical: 8,
  paddingHorizontal: 16,
  minWidth: 100,
  alignItems: 'center',
  borderRadius: 999,
  backgroundColor: '#eff6ff',
  borderWidth: 1,
  borderColor: '#bfdbfe',
},

addText: {
  fontSize: 13,
  fontWeight: '600',
  color: '#1e40af',
},
sortText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '600',
},
title: {
  fontSize: 30,
  fontWeight: '800',
   color: '#111',   // black
  textAlign: 'center',
},
  empty: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 40,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
borderWidth: 1,
borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  jobName: {
    fontSize: 18,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  hint: {
  fontSize: 12,
  marginTop: 4,
  opacity: 0.4,
},

  jobType: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },

single: {
  backgroundColor: '#dbeafe',
  color: '#1e3a8a',
},

  multi: {
    backgroundColor: '#dbeafe', // light blue
    color: '#1e40af',           // deep blue
  },
});