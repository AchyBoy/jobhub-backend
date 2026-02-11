//JobHub/app/job/[id]/send-links.tsx
import * as Clipboard from 'expo-clipboard';

import * as Linking from 'expo-linking';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CrewManager from '../../../components/crew/CrewManager';

type JobNote = {
  id: string;
  phase: string;
};

export default function SendLinks() {
  const { id } = useLocalSearchParams();

  const [notes, setNotes] = useState<JobNote[]>([]);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [viewPhases, setViewPhases] = useState<string[]>([]);

const [phases, setPhases] = useState<string[]>([]);

// Load phases from storage
async function loadPhases() {
  const stored = await AsyncStorage.getItem(`job:${id}:phases`);
  if (stored) {
    setPhases(JSON.parse(stored));
  } else {
    // Fallback to current hardcoded ones if nothing saved yet
    const defaults = ['Rough', 'Trim', 'Final'];
    setPhases(defaults);
    // Optional: auto-save defaults so next time it's persistent
    await AsyncStorage.setItem(`job:${id}:phases`, JSON.stringify(defaults));
  }
}


useEffect(() => {
  if (!id) return;
  loadPhases();
  loadNotes();
}, [id]);

  async function loadNotes() {
    const stored = await AsyncStorage.getItem(`job:${id}:notes`);
    if (!stored) return;
    setNotes(JSON.parse(stored));
  }

const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://jobhub-web-production.up.railway.app';

function buildCrewUrl() {
  if (!activePhase) return null;

  const params = new URLSearchParams();
  params.set('phase', activePhase);

  if (viewPhases.length) {
    params.set('view', viewPhases.join(','));
  }

  return `${APP_BASE_URL}/crew/job/${id}?${params.toString()}`;
}

function sendCrewLink() {
  const url = buildCrewUrl();
  if (!url) return;

  console.log('CREW LINK:', url);
}

  return (
  <SafeAreaView style={styles.container}>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Send Crew Link</Text>
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
