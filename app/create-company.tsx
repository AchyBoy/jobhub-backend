//JobHub/app/create-company.tsx
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/apiClient';

export default function CreateCompany() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function createCompany() {
    if (!name.trim()) return;

    setLoading(true);

    try {
      await apiFetch('/api/tenant/create', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      router.replace('/main');
    } catch (err) {
      console.warn('Failed to create tenant', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create Your Company</Text>

      <TextInput
        placeholder="Company name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Pressable
        style={styles.button}
        onPress={createCompany}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating…' : 'Create Company'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
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