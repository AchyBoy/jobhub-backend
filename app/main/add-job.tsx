//JobHub/app/main/add-job.tsx

import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { supabase } from '../../src/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function AddJob() {
    const params = useLocalSearchParams<{
    templateId?: string;
    templateName?: string;
  }>();
const [isSaving, setIsSaving] = useState(false);
const [loadingDots, setLoadingDots] = useState('');
  const templateId = params.templateId;
  const [name, setName] = useState(
  params.templateName
    ? params.templateName.replace(/^Template\s*–\s*/i, '')
    : ''
);
  const [type, setType] = useState<'single' | 'multi'>('single');

  useEffect(() => {
  if (!isSaving) {
    setLoadingDots('');
    return;
  }

  const interval = setInterval(() => {
    setLoadingDots(prev => {
      if (prev.length >= 3) return '';
      return prev + '.';
    });
  }, 350);

  return () => clearInterval(interval);
}, [isSaving]);

async function saveJob() {
  if (!name.trim() || isSaving) return;

  setIsSaving(true);

  const jobId = Date.now().toString();

  try {
    // 🧠 TEMPLATE PATH
    if (templateId) {
      await apiFetch('/api/templates/create/job', {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          jobId,
          jobName: name,
        }),
      });
    }

// 📍 Get current location (optional but recommended)
let latitude: number | null = null;
let longitude: number | null = null;

try {
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status === 'granted') {
    const location =
      await Location.getCurrentPositionAsync({});
    latitude = location.coords.latitude;
    longitude = location.coords.longitude;

    console.log('📍 Saving job with location:', latitude, longitude);
  }
} catch (e) {
  console.log('⚠️ Location capture failed, continuing without it');
}

// 🔐 Persist job to backend (source of truth)
await apiFetch(`/api/job/${jobId}/meta`, {
  method: 'POST',
  body: JSON.stringify({
    name,
    latitude,
    longitude,
  }),
});

    // 1️⃣ Get tenant context
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const me = await apiFetch('/api/tenant/me');
      const tenantId = me.tenantId;

      if (tenantId) {
        const cacheKey = `jobs:${tenantId}`;

        const cached = await AsyncStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : [];

        const newJob = {
          id: jobId,
          name,
          type,
          createdAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify([newJob, ...parsed])
        );
      }
    }

    router.push(`/job/${jobId}`);

  } catch (err) {
    console.warn('Job creation failed', err);
  } finally {
    setIsSaving(false);
  }
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
<View style={styles.singleToggleInner}>
  <Text
    style={[
      styles.toggleText,
      styles.singleToggleText,
      type === 'single'
        ? styles.toggleTextActive
        : styles.toggleTextInactive,
    ]}
  >
    Single Unit
  </Text>
</View>
          </Pressable>

<Pressable
  disabled
  style={[
    styles.toggle,
    styles.disabledToggle,
  ]}
>
  <Text style={styles.disabledToggleText}>
    Multi-Unit
  </Text>

  <Text style={styles.comingSoonText}>
    Coming Soon
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

<Pressable
  style={[
    styles.button,
    isSaving && { backgroundColor: '#6b7280' },
  ]}
  onPress={saveJob}
  disabled={isSaving}
>
  <Text style={styles.buttonText}>
    {isSaving ? `Loading${loadingDots}` : 'Save Job'}
  </Text>
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
  backgroundColor: '#2563eb',
  borderColor: '#2563eb',
},
  toggleText: {
  fontWeight: '600',
},
  disabledToggle: {
  backgroundColor: '#f3f4f6',
  borderColor: '#e5e7eb',
  opacity: 0.7,
},

disabledToggleText: {
  color: '#9ca3af',
  fontWeight: '600',
},

comingSoonText: {
  marginTop: 4,
  fontSize: 18,
  color: '#9ca3af',
  letterSpacing: 0.3,
},
  button: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  singleToggleInner: {
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 36,
},

singleToggleText: {
  fontSize: 18,
  textAlign: 'center',
},
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});