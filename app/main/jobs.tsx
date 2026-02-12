//JobHub/app/main/jobs.tsx

import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { supabase } from '../../src/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';

type Job = {
  id: string;
  name: string;
  type: 'single' | 'multi';
  address?: string;
  notes?: string;
};

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
const [sortMode, setSortMode] = useState<
  'alpha-asc' | 'alpha-desc' | 'recent'
>('recent');

async function loadJobs() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const userId = session.user.id;

  try {
    // 1️⃣ Get tenant context
    const me = await apiFetch('/api/tenant/me');
    const tenantId = me.tenantId;

    if (!tenantId) return;

    const cacheKey = `jobs:${tenantId}`;

    // 2️⃣ Fetch backend (source of truth)
    const res = await apiFetch('/api/job');

    setJobs(res.jobs);

    // 3️⃣ Cache per-tenant
    await AsyncStorage.setItem(cacheKey, JSON.stringify(res.jobs));
  } catch (err) {
    console.warn('Backend unavailable — loading cached jobs');

    try {
      const me = await apiFetch('/api/tenant/me');
      const tenantId = me.tenantId;
      if (!tenantId) return;

      const cacheKey = `jobs:${tenantId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setJobs(JSON.parse(cached));
      }
    } catch {}
  }
}

  // Reload every time tab is focused
  useFocusEffect(() => {
    loadJobs();
  });

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

function openJob(job: Job) {
  router.push({
    pathname: `/job/${job.id}`,
    params: { name: job.name },
  });
}

return (
<View style={styles.container}>
  <View style={styles.headerRow}>
  <Text style={styles.title}>Jobs</Text>

  <Pressable
    style={styles.sortBtn}
    onPress={() => {
      const order: any = {
        recent: 'alpha-asc',
        'alpha-asc': 'alpha-desc',
        'alpha-desc': 'recent',
      };
      setSortMode(order[sortMode]);
    }}
  >
    <Text style={styles.sortText}>
      {sortMode === 'recent'
        ? 'Recent'
        : sortMode === 'alpha-asc'
        ? 'A–Z'
        : 'Z–A'}
    </Text>
  </Pressable>
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
>
  <Text style={styles.jobName}>{item.name}</Text>

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
  position: 'relative',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 20,
},

sortBtn: {
  position: 'absolute',
  right: 0,
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 999,
  backgroundColor: '#2563eb',
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