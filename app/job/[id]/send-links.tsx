//JobHub/app/job/[id]/send-links.tsx
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../../../src/lib/apiClient';
import * as Linking from 'expo-linking';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CrewManager from '../../../components/crew/CrewManager';

type JobNote = {
  id: string;
  phase: string;
};

export default function SendLinks() {
  const { id } = useLocalSearchParams();
const [jobName, setJobName] = useState<string>('');

  const [notes, setNotes] = useState<JobNote[]>([]);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [viewPhases, setViewPhases] = useState<string[]>([]);
  const [editableMode, setEditableMode] = useState(false);

const [phases, setPhases] = useState<string[]>([]);
// Backend (Railway backend service)
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  'https://adorable-passion-production-5ab7.up.railway.app';

// Web app (Next.js frontend for crew links)
const WEB_BASE =
  process.env.EXPO_PUBLIC_APP_URL ||
  'https://jobhub-web-production.up.railway.app';

// Load phases from storage
async function loadPhases() {
  try {
    const res = await apiFetch('/api/phases');

    if (Array.isArray(res?.phases)) {
      setPhases(res.phases.map((p: any) => p.name));
    } else {
      setPhases([]);
    }
  } catch (err) {
    console.error('Phase load failed', err);
    setPhases([]);
  }
}


useEffect(() => {
  if (!id) return;
  loadPhases();
  loadNotes();
  loadJob();
}, [id]);

  async function loadNotes() {
    const stored = await AsyncStorage.getItem(`job:${id}:notes`);
    if (!stored) return;
    setNotes(JSON.parse(stored));
  }


function buildCrewUrl() {
  if (!activePhase) return null;

  const params = new URLSearchParams();
  params.set('phase', activePhase);

  if (viewPhases.length) {
    params.set('view', viewPhases.join(','));
  }

  if (editableMode) {
    params.set('editable', '1');
  }

  return `${WEB_BASE}/crew/job/${id}?${params.toString()}`;
}

async function loadJob() {
  try {
    const stored = await AsyncStorage.getItem(`job:${id}:meta`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.name) {
        setJobName(parsed.name);
        return;
      }
    }
  } catch {}

// fallback to backend
try {
const res = await apiFetch(`/api/job/${id}`);

if (res?.job?.name) {
  setJobName(res.job.name);

  await AsyncStorage.setItem(
    `job:${id}:meta`,
    JSON.stringify({ name: res.job.name })
  );
}

  if (!res.ok) {
    console.error('Failed to load job name', res.status);
    return;
  }

  const json = await res.json();

  if (json?.job?.name) {
    setJobName(json.job.name);

    await AsyncStorage.setItem(
      `job:${id}:meta`,
      JSON.stringify({ name: json.job.name })
    );
  }
} catch (err) {
  console.error('Job load failed', err);
}
}

function sendCrewLink() {
  const url = buildCrewUrl();
  if (!url) return;

  console.log('CREW LINK:', url);
}

  return (
    <>
      <Stack.Screen
  options={{
    title: jobName
      ? `Send ${jobName} Links`
      : 'Send Links',
  }}
/>

      <SafeAreaView style={styles.container}>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
<Text style={styles.sub}>Job ID: {id}</Text>

{phases.length > 0 ? (
  <>
    <Text style={styles.section}>Active phase for this crew:</Text>
    {phases.map(p => (
      <Pressable key={p} onPress={() => setActivePhase(p)}>
        <Text style={{ opacity: activePhase === p ? 1 : 0.4 }}>
          {activePhase === p ? '✓ ' : '○ '} {p}
        </Text>
      </Pressable>
    ))}
  </>
) : (
  <Text style={{ color: 'gray', marginTop: 16 }}>No phases available yet</Text>
)}

        {activePhase && (
          <>
            <Text style={styles.section}>View-only phases:</Text>

            {phases
              .filter(p => p !== activePhase)
              .map(p => (
                <Pressable
                  key={p}
                  onPress={() =>
                    setViewPhases(v =>
                      v.includes(p)
                        ? v.filter(x => x !== p)
                        : [...v, p]
                    )
                  }
                >
                  <Text style={{ opacity: viewPhases.includes(p) ? 1 : 0.4 }}>
                    {viewPhases.includes(p) ? '✓ ' : '○ '} {p}
                  </Text>
                </Pressable>
              ))}
          </>
        )}

{activePhase && (
  <View style={{ marginTop: 20 }}>

    <Text style={{ fontWeight: '700', marginBottom: 10 }}>
      Link Type
    </Text>

    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
      <Pressable
        onPress={() => setEditableMode(false)}
        style={{
          padding: 8,
          borderRadius: 6,
          backgroundColor: !editableMode ? '#dbeafe' : '#f3f4f6'
        }}
      >
        <Text>Read Only</Text>
      </Pressable>

      <Pressable
        onPress={() => setEditableMode(true)}
        style={{
          padding: 8,
          borderRadius: 6,
          backgroundColor: editableMode ? '#dbeafe' : '#f3f4f6'
        }}
      >
        <Text>Editable Link</Text>
      </Pressable>
    </View>

    <Text style={{ fontWeight: '700', marginBottom: 6 }}>
      Generated link:
    </Text>

    <Text selectable style={{ marginBottom: 10 }}>
      {buildCrewUrl()}
    </Text>

    <Pressable
      onPress={async () => {
        const url = buildCrewUrl();
        if (!url) return;
        await Clipboard.setStringAsync(url);
      }}
      style={{ paddingVertical: 6 }}
    >
      <Text style={{ color: '#16a34a', fontWeight: '600' }}>
        Copy Link to Clipboard
      </Text>
    </Pressable>

    <Pressable
      onPress={() => {
        const url = buildCrewUrl();
        if (url) {
          Linking.openURL(url);
        }
      }}
      style={{ paddingVertical: 6 }}
    >
      <Text style={{ color: '#2563eb', fontWeight: '600' }}>
        Open Link in Browser
      </Text>
    </Pressable>
  </View>
)}

<CrewManager
  jobId={id as string}
  onSelect={sendCrewLink}
/>
      </ScrollView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sub: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
  },
  section: {
    marginTop: 16,
    fontWeight: '600',
  },
});
