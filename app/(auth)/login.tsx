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

    // Fill fields
    setEmail(savedEmail);
    setPassword(savedPassword);

    // Run normal login
    await supabase.auth.signInWithPassword({
      email: savedEmail,
      password: savedPassword,
    });

    await AsyncStorage.setItem('savedEmail', email);
await AsyncStorage.setItem('savedPassword', password);

    router.replace('/main');

  } catch (err) {
    console.warn('Biometric login error:', err);
  }
}

  async function handleLogin() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('🟢 LOGIN result', {
      hasSession: !!data?.session,
      userId: data?.user?.id,
      error: error?.message,
    });

  if (error) {
  setError(error.message);
  setLoading(false);
  return;
}

if (!data.session) {
  setError('No session returned. If this is a new account, confirm the email link first.');
  setLoading(false);
  return;
}

// Force-refresh session to ensure token is available immediately
const { data: freshSessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !freshSessionData.session?.access_token) {
  setError('Failed to retrieve access token after login.');
  await supabase.auth.signOut();
  setLoading(false);
  return;
}

console.log('Fresh token retrieved after login:', freshSessionData.session.access_token.substring(0, 10) + '...');

try {
  // 🔎 Check provisioning state FIRST
  const me = await apiFetch('/api/tenant/me');

  // 🆕 No company yet → go create one
  if (me.needsCompany) {
    console.log('🆕 User not provisioned — redirecting to create company');
    router.replace('/create-company');
    setLoading(false);
    return;
  }

  // 🔐 Must change password
  if (me.mustChangePassword) {
    console.log('🔑 User must change password — redirecting');
    router.replace('/update-password');
    setLoading(false);
    return;
  }

  // 🔐 Verify session ownership (device enforcement)
  await apiFetch('/api/tenant/session');

  router.replace('/main');
  setLoading(false);
  return;

} catch (err: any) {

  // 🔒 Detect session conflict
  if (err?.message?.includes('SESSION_CONFLICT') || err?.message?.includes('Another device')) {

Alert.alert(
  "Session Active",
  "This account is active on another device.\n\nTake over this session?",
  [
    {
      text: "Cancel",
      style: "cancel",
      onPress: async () => {
        await supabase.auth.signOut();
        setLoading(false);
      },
    },
{
  text: "Take Over",
  style: "destructive",
  onPress: async () => {
    try {
      // Optional: Quick sanity check (don't throw – just log)
      const currentSession = await supabase.auth.getSession();
      const tokenPreview = currentSession.data.session?.access_token?.substring(0, 10) + '...' || 'MISSING';
      console.log('Token at takeover attempt:', tokenPreview);

      // If token truly missing here, force sign-out to break loop
      if (!currentSession.data.session?.access_token) {
        console.warn('No token during takeover – forcing sign out');
        await supabase.auth.signOut();
        Alert.alert('Session Issue', 'Authentication token not available. Please log in again.');
        setLoading(false);
        return;
      }

      const newDeviceSession = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem('deviceSessionId', newDeviceSession);

      // Flush delay – increase slightly if still flaky on your device
      await new Promise(r => setTimeout(r, 200));

      console.log('Calling takeover with device session:', newDeviceSession);

      await apiFetch('/api/tenant/takeover', { method: 'POST' });

console.log('Takeover succeeded – verifying ownership');

await apiFetch('/api/tenant/session');

console.log('Verify passed – navigating to main');

router.replace('/main');
    } catch (err: any) {
      console.error('Takeover failed:', err);
      let msg = "Unable to take over session. Please try again.";
      
      if (err.message?.includes('Missing Authorization header')) {
        msg = "Login session invalid during takeover – please log in again.";
        await supabase.auth.signOut(); // Clean up
      } else if (err.message?.includes('SESSION_CONFLICT')) {
        msg = "Another device still holds the session. Try again in a moment.";
      }
      
      setError(msg);
      Alert.alert('Takeover Failed', msg);
    } finally {
      setLoading(false);
    }
  },
},
  ],
  { cancelable: false }
);

return;

  }

  setError("Login verification failed.");
  setLoading(false);
  return;
}
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