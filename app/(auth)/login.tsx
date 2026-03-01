// JobHub/app/(auth)/login.tsx
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { router } from 'expo-router';
import { apiFetch } from '../../src/lib/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoginWithCredentials(
  loginEmail: string,
  loginPassword: string
) {
  setLoading(true);
  setError(null);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: loginPassword,
  });

  if (error || !data.session) {
    setError(error?.message || 'Login failed');
    setLoading(false);
    return;
  }

  const { data: freshSessionData } = await supabase.auth.getSession();

  if (!freshSessionData.session?.access_token) {
    await supabase.auth.signOut();
    setLoading(false);
    return;
  }

  try {
    const me = await apiFetch('/api/tenant/me');

    if (me.needsCompany) {
      router.replace('/create-company');
      return;
    }

    if (me.mustChangePassword) {
      router.replace('/update-password');
      return;
    }

    await apiFetch('/api/tenant/session');

    await AsyncStorage.setItem('savedEmail', loginEmail);
    await AsyncStorage.setItem('savedPassword', loginPassword);

    router.replace('/main');

} catch (err: any) {

  const isSessionConflict =
    err?.code === 'SESSION_CONFLICT' ||
    err?.message?.includes('SESSION_CONFLICT') ||
    err?.message?.includes('Another device');

  if (isSessionConflict) {

    Alert.alert(
      "Session Active",
      "This account is active on another device.\n\nTake over this session?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
        {
          text: "Take Over",
          style: "destructive",
          onPress: async () => {
            try {

              const newDeviceSession =
                `${Date.now()}-${Math.random().toString(36).slice(2)}`;

              await AsyncStorage.setItem(
                'deviceSessionId',
                newDeviceSession
              );

              await apiFetch('/api/tenant/takeover', {
                method: 'POST',
              });

              await apiFetch('/api/tenant/session');

              await AsyncStorage.setItem('savedEmail', loginEmail);
              await AsyncStorage.setItem('savedPassword', loginPassword);

              router.replace('/main');

            } catch (takeErr) {
              console.warn('Takeover failed:', takeErr);
              await supabase.auth.signOut();
            }
          },
        },
      ],
      { cancelable: false }
    );

  } else {
    console.warn('Login verification failed:', err);
    await supabase.auth.signOut();
  }
}
}

async function handleBiometricLogin() {
  try {
    const savedEmail = await AsyncStorage.getItem('savedEmail');
    const savedPassword = await AsyncStorage.getItem('savedPassword');

    if (!savedEmail || !savedPassword) {
      Alert.alert('No saved credentials', 'Log in manually once first.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login with Face ID',
    });

    if (!result.success) return;

    // 🔥 Call the SAME login function
    setEmail(savedEmail);
    setPassword(savedPassword);

    await handleLoginWithCredentials(savedEmail, savedPassword);

  } catch (err) {
    console.warn('Biometric login error:', err);
  }
}

async function handleLogin() {
  await handleLoginWithCredentials(email, password);
}

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
  onPress={() => router.push('/(auth)/reset-password')}
  style={{ marginBottom: 12 }}
>
  <Text style={{ textAlign: 'center', color: '#2563eb', fontWeight: '600' }}>
    Forgot password?
  </Text>
</Pressable>

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Logging in…' : 'Login'}
        </Text>
      </Pressable>

      <Pressable
  style={[styles.button, { backgroundColor: '#111' }]}
  onPress={handleBiometricLogin}
>
  <Text style={styles.buttonText}>
    Login with Face ID
  </Text>
</Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
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
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  error: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
});