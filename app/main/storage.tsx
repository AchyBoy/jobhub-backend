//JobHub/app/main/storage.tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../src/lib/apiClient';
import { makeId } from '../../src/lib/syncEngine';

export default function StorageSettingsScreen() {
  const [supplier, setSupplier] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInternalSupplier();
  }, []);

  async function loadInternalSupplier() {
    try {
      const res = await apiFetch('/api/suppliers/internal');
      const s = res?.supplier;

      if (s) {
        setSupplier(s);
        const emailContact = s.contacts?.find((c: any) => c.type === 'email');
        if (emailContact) {
          setEmail(emailContact.value);
        }
      }
    } catch {
      console.warn('Failed to load internal supplier');
    }
  }

  async function save() {
    if (saving) return;

    setSaving(true); // instant visual feedback

    try {
      const id = supplier?.id ?? makeId();

      await apiFetch('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: 'Storage',
          isInternal: true,
          contacts: email
            ? [
                {
                  id: makeId(),
                  type: 'email',
                  label: 'Orders',
                  value: email,
                },
              ]
            : [],
        }),
      });

      Alert.alert('Saved');
      loadInternalSupplier();
    } catch {
      Alert.alert('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
  style={styles.container}
  keyboardShouldPersistTaps="handled"
>
      <Text style={styles.title}>Storage (Internal / On-Hand)</Text>

      <Text style={styles.label}>Order Receipt Email</Text>
      <TextInput
        placeholder="storage@yourcompany.com"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Pressable
        style={[
          styles.button,
          saving && { backgroundColor: '#94a3b8' },
        ]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});