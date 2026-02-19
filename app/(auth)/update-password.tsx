// JobHub/app/(auth)/update-password.tsx
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/lib/supabase';
import { router } from 'expo-router';
import { apiFetch } from '../../src/lib/apiClient';

export default function UpdatePasswordScreen() {

  useEffect(() => {
  async function hydrateRecoverySession() {
    const url = await Linking.getInitialURL();

    if (!url) return;

    console.log('🔎 Incoming recovery URL:', url);

    // Supabase puts tokens in the hash fragment
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return;

    const hash = url.substring(hashIndex + 1);

    const params = Object.fromEntries(
      new URLSearchParams(hash) as any
    );

    if (params?.access_token && params?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        console.log('❌ Failed to hydrate recovery session:', error.message);
      } else {
        console.log('✅ Recovery session hydrated');
      }
    }
  }

  hydrateRecoverySession();
}, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('🔎 Recovery session on load:', data.session);
    });
  }, []);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!password.trim()) return;

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

try {
  await apiFetch('/api/tenant/users/clear-password-flag', {
    method: 'POST',
  });
} catch {}

Alert.alert('Success', 'Password updated successfully.');
router.replace('/main');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>

      <TextInput
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <Pressable
        style={styles.button}
        onPress={handleUpdate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Updating…' : 'Update Password'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});