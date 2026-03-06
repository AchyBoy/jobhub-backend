// app/main/service.tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { apiFetch } from '../../src/lib/apiClient';

export default function ServiceScreen() {
const router = useRouter();
const { serviceCaseId } = useLocalSearchParams<{ serviceCaseId?: string }>();
const [scheduleDate, setScheduleDate] = useState<string | null>(null);
const isEditMode =
  typeof serviceCaseId === 'string' &&
  serviceCaseId.length > 0;
  const [jobs, setJobs] = useState<any[]>([]);
const [search, setSearch] = useState('');
const [ownerName, setOwnerName] = useState('');
const [description, setDescription] = useState('');
const [contacts, setContacts] = useState<
  { type: 'phone' | 'email'; value: string }[]
>([]);

const [existingCases, setExistingCases] = useState<any[]>([]);

useEffect(() => {
  if (!isEditMode) return;

  async function loadCase() {
    try {
      const res = await apiFetch(`/api/service-cases/${serviceCaseId}`);
      const sc = res?.serviceCase;

      if (!sc) return;

      // 🔹 Property name stored in `search`
      setSearch(sc.property_name ?? '');

      setOwnerName(sc.owner_name ?? '');
      setDescription(sc.description ?? '');

      if (Array.isArray(sc.contacts)) {
        setContacts(sc.contacts);
      }

    } catch (err) {
      console.warn('Failed to load service case', err);
    }
  }

  loadCase();
}, [serviceCaseId]);

useEffect(() => {
  loadJobs();
}, []);

useEffect(() => {
  if (!search || search.trim().length < 3) {
    setExistingCases([]);
    return;
  }

  let cancelled = false;

  async function checkExisting() {
    try {
      const res = await apiFetch(
        `/api/service-cases?propertyName=${encodeURIComponent(search)}`
      );

      if (!cancelled) {
        setExistingCases(res?.serviceCases ?? []);
      }
    } catch {
      if (!cancelled) {
        setExistingCases([]);
      }
    }
  }

  checkExisting();

  return () => {
    cancelled = true;
  };
}, [search]);

async function loadJobs() {
  try {
    const res = await apiFetch('/api/job');
    setJobs(res?.jobs ?? []);
  } catch {}
}

  return (
    <>
      <Stack.Screen options={{ title: 'Service Request' }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Property / Address</Text>

<TextInput
  placeholder="Search existing job or enter address..."
  value={search}
  onChangeText={setSearch}
  style={styles.input}
/>

{search.length > 0 &&
  jobs
    .filter(j =>
      j.name?.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 6)
    .map(j => (
      <Pressable
        key={j.id}
        onPress={() => setSearch(j.name)}
        style={{ paddingVertical: 4 }}
      >
        <Text style={{ fontWeight: '600' }}>{j.name}</Text>
      </Pressable>
    ))}

<Text style={styles.label}>Owner Name</Text>
<TextInput
  placeholder="Owner name"
  value={ownerName}
  onChangeText={setOwnerName}
  style={styles.input}
/>

          <Text style={styles.label}>Contacts</Text>

{contacts.map((c, i) => (
  <View key={i} style={{ marginBottom: 8 }}>
    <Pressable
      onPress={() => {
        if (c.type === 'phone') {
          Linking.openURL(`tel:${c.value}`);
        } else {
          Linking.openURL(`mailto:${c.value}`);
        }
      }}
    >
      <Text style={{ color: '#2563eb', fontWeight: '600' }}>
        {c.type === 'phone' ? '📞' : '✉️'} {c.value}
      </Text>
    </Pressable>
  </View>
))}

<View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
  <Pressable
    onPress={() =>
      setContacts([...contacts, { type: 'phone', value: '' }])
    }
  >
    <Text style={{ color: '#16a34a', fontWeight: '700' }}>
      + Phone
    </Text>
  </Pressable>

  <Pressable
    onPress={() =>
      setContacts([...contacts, { type: 'email', value: '' }])
    }
  >
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      + Email
    </Text>
  </Pressable>
</View>

{contacts.map((c, i) => (
  <TextInput
    key={`input-${i}`}
    placeholder={c.type === 'phone' ? 'Phone number' : 'Email'}
    value={c.value}
    onChangeText={text => {
      const updated = [...contacts];
      updated[i].value = text;
      setContacts(updated);
    }}
    style={styles.input}
  />
))}

          <Text style={styles.label}>Issue Description</Text>
          <TextInput
            placeholder="Describe the issue..."
            value={description}
            onChangeText={setDescription}
            multiline
            style={[styles.input, { height: 100 }]}
          />

          <Text style={styles.label}>Schedule Date (optional)</Text>

<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <Pressable
    onPress={() => {
      const today = new Date();
      today.setHours(8, 0, 0, 0);
      setScheduleDate(today.toISOString());
    }}
    style={{
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      padding: 10,
      flex: 1,
      backgroundColor: '#fff',
    }}
  >
    <Text>
      {scheduleDate
        ? new Date(scheduleDate).toLocaleDateString()
        : 'Tap to set today'}
    </Text>
  </Pressable>

  <Pressable
    onPress={() =>
      Alert.alert(
        'Scheduling Service',
        'If you set a date now, the service will be scheduled immediately and crews will receive push notifications. If left empty, the service will appear as an unscheduled request until scheduled later.'
      )
    }
  >
    <Text style={{ color: '#16a34a', fontWeight: '700' }}>?</Text>
  </Pressable>
</View>

<Pressable
  style={styles.button}
  onPress={async () => {
    if (!search.trim()) return;

const payload = {
  propertyName: search.trim(),
  ownerName: ownerName || null,
  description: description || null,
  contacts,
  scheduledAt: scheduleDate,
};

    try {
      if (isEditMode) {
        await apiFetch(`/api/service-cases/${serviceCaseId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/service-cases', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      router.back();
    } catch (err) {
      console.log('SERVICE SAVE FAILED', err);
    }
  }}
>
  <Text style={styles.buttonText}>
    {isEditMode ? 'Save Changes' : 'Create Service Case'}
  </Text>
</Pressable>

          <Pressable
            onPress={() => router.back()}
            style={{ marginTop: 20 }}
          >
            <Text style={{ color: 'red', fontWeight: '700' }}>
              Cancel
            </Text>
          </Pressable>

          {!isEditMode && existingCases.length > 0 && (
  <View
    style={{
      marginTop: 30,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
    }}
  >
    <Text style={{ fontWeight: '700', marginBottom: 6 }}>
      Existing Open Service Case
    </Text>

    {existingCases.map(sc => (
      <View key={sc.id} style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: '600' }}>
          {sc.property_name}
        </Text>

        {sc.description && (
          <Text style={{ fontSize: 13, opacity: 0.7 }}>
            {sc.description}
          </Text>
        )}

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/main/service',
              params: { serviceCaseId: sc.id },
            })
          }
        >
          <Text style={{ color: '#2563eb', fontWeight: '700' }}>
            Edit This Case
          </Text>
        </Pressable>
      </View>
    ))}
  </View>
)}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  label: {
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});