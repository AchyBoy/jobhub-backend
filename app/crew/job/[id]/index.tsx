console.log("🔴 BAKED API_BASE =", process.env.NEXT_PUBLIC_API_BASE);
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const norm = (v?: string) =>
  (v || '').trim().toLowerCase();

type JobNote = {
  id: string;
  phase: string;
  text: string;
  status: 'blank' | 'incomplete' | 'complete';

  markedCompleteBy?: 'crew' | 'contractor';
  crewCompletedAt?: string;

  officeCompletedAt?: string;
  createdAt: string;
};

export default function CrewJobNotes() {
  const params = useLocalSearchParams();

  const jobId = params.id as string;
  const editablePhase = params.phase as string;
  const viewOnlyPhases =
    typeof params.view === 'string'
      ? params.view.split(',').map(p => p.trim())
      : [];

  const [notes, setNotes] = useState<JobNote[]>([]);

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function loadNotes() {
    const stored = await AsyncStorage.getItem(`job:${jobId}:notes`);
    if (stored) setNotes(JSON.parse(stored));
  }

  async function crewMarkComplete(noteId: string) {
    const updated = notes.map(n =>
      n.id === noteId
        ? {
            ...n,
            markedCompleteBy: 'crew',
            crewCompletedAt: new Date().toISOString(),
          }
        : n
    );

    setNotes(updated);

    await AsyncStorage.setItem(`job:${jobId}:notes`, JSON.stringify(updated));
  }

  // Group notes by phase (keeps phases together)
  const grouped = notes.reduce<Record<string, JobNote[]>>((acc, note) => {
    (acc[note.phase] ||= []).push(note);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Crew Job Notes</Text>

        {Object.entries(grouped).map(([phase, phaseNotes]) => {
          const isEditable = norm(phase) === norm(editablePhase);
          const isViewOnly = viewOnlyPhases.map(norm).includes(norm(phase));

          if (!isEditable && !isViewOnly) return null;

          return (
            <View key={phase} style={{ marginBottom: 24 }}>
              <Text style={styles.phaseHeader}>
                {phase}
                {!isEditable && <Text style={styles.viewOnly}>  (view only)</Text>}
              </Text>

              {phaseNotes.map(note => (
                <View
                  key={note.id}
                  style={[styles.noteCard, !isEditable && styles.viewOnlyCard]}
                >
                  <Text style={styles.noteText}>{note.text}</Text>

                  {note.crewCompletedAt && (
                    <Text style={styles.meta}>
                      Crew completed: {new Date(note.crewCompletedAt).toLocaleDateString()}
                    </Text>
                  )}

                  {isEditable && note.status !== 'complete' && (
                    <Pressable style={styles.action} onPress={() => crewMarkComplete(note.id)}>
                      <Text style={styles.actionText}>Mark complete</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginVertical: 20,
  },

  phaseHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },

  viewOnly: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },

  noteCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
  },

  viewOnlyCard: {
    backgroundColor: '#f9fafb',
    opacity: 0.85,
  },

  noteText: {
    fontSize: 15,
  },

  meta: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.6,
  },

  action: {
    marginTop: 10,
    alignItems: 'flex-end',
  },

  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
});
