// JobHub/app/(auth)/reset-password.tsx
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);

  // Detect recovery mode
  useEffect(() => {
    if (params?.type === 'recovery') {
      setMode('reset');
    }
  }, [params]);

  async function handleResetRequest() {
    if (!email.trim()) return;

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: 'jobhub://reset-password',
      }
    );

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Check Your Email',
      'We sent a password reset link to your email.'
    );

    router.replace('/(auth)/login');
  }

  async function handleSetNewPassword() {
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

    Alert.alert('Success', 'Password updated successfully.');

    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {mode === 'request'
          ? 'Reset Password'
          : 'Set New Password'}
      </Text>

      {mode === 'request' ? (
        <>
          <TextInput
            placeholder="Your email"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <Pressable
            style={styles.button}
            onPress={handleResetRequest}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            placeholder="New password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          <Pressable
            style={styles.button}
            onPress={handleSetNewPassword}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Updating…' : 'Update Password'}
            </Text>
          </Pressable>
        </>
      )}
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
    backgroundColor: '#2563eb',
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