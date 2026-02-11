//JobHub/app/main/add-job.tsx

import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddJob() {
    const params = useLocalSearchParams<{
    templateId?: string;
    templateName?: string;
  }>();

  const templateId = params.templateId;
  const [name, setName] = useState(
  params.templateName
    ? params.templateName.replace(/^Template\s*–\s*/i, '')
    : ''
);
  const [type, setType] = useState<'single' | 'multi'>('single');

  async function saveJob() {
    if (!name.trim()) return;

    const jobId = Date.now().toString();

    // 🧠 TEMPLATE PATH
    if (templateId) {
      try {
        const res = await fetch(
          'https://api.jobhubgo.com/api/templates/create/job',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId,
              jobId,
              jobName: name,
            }),
          }
        );

        if (!res.ok) throw new Error('Template creation failed');
      } catch (err) {
        console.warn(err);
        return;
      }
    }

    // ✅ Save locally (same format as before)
    const newJob = {
      id: jobId,
      name,
      type,
      createdAt: new Date().toISOString(),
    };

    const existing = await AsyncStorage.getItem('jobs');
    const jobs = existing ? JSON.parse(existing) : [];

await AsyncStorage.setItem('jobs', JSON.stringify([...jobs, newJob]));

// 🔐 Persist job to backend (tenant-aware)
try {
  await apiFetch(`/api/job/${jobId}/meta`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
} catch (err) {
  console.warn('Failed to create job in backend', err);
  return;
}

router.push(`/job/${jobId}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
<View style={styles.container}>
  <Text style={styles.title}>Add Job</Text>

        <TextInput
          placeholder="Job name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Text style={styles.label}>Job Type</Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggle,
              type === 'single' && styles.active,
            ]}
            onPress={() => setType('single')}
          >
<Text
  style={[
    styles.toggleText,
    type === 'single' ? styles.toggleTextActive : styles.toggleTextInactive,
  ]}
>
  Single Unit
</Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggle,
              type === 'multi' && styles.active,
            ]}
            onPress={() => setType('multi')}
          >
<Text
  style={[
    styles.toggleText,
    type === 'multi' ? styles.toggleTextActive : styles.toggleTextInactive,
  ]}
>
  Multi-Unit
</Text>
          </Pressable>
        </View>

<Pressable
  style={styles.templateButton}
  onPress={() => router.push('/main/templates')}
>
  <Text style={styles.templateButtonText}>
    Create From Template
  </Text>
</Pressable>

<Pressable style={styles.button} onPress={saveJob}>
  <Text style={styles.buttonText}>Save Job</Text>
</Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    padding: 20,
  },
toggleText: {
  fontWeight: '600',
},

toggleTextActive: {
  color: '#fff',
},

toggleTextInactive: {
  color: '#111827', // dark gray / near black
},
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },

  templateButton: {
  backgroundColor: '#2563eb',
  padding: 16,
  borderRadius: 8,
  alignItems: 'center',
  marginBottom: 12,
},

templateButtonText: {
  color: '#fff',
  fontSize: 18,
  fontWeight: '600',
},

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  toggle: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9ca3af', // clearer gray
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  active: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  toggleText: {
    color: '#fff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});