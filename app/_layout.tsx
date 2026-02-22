// JobHub/app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/apiClient';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);

  const router = useRouter();
  const segments = useSegments();

// 1️⃣ Load initial session + subscribe
useEffect(() => {
let mounted = true;
async function init() {
const { data } = await supabase.auth.getSession();
if (!mounted) return;
setSession(data.session);
const { data: sub } = supabase.auth.onAuthStateChange(
  (event, session) => {

    if (event === 'PASSWORD_RECOVERY') {
      router.replace('/(auth)/update-password');
      return;
    }

    setSession(session);
  }
);
setReady(true);
return () => sub.subscription.unsubscribe();
    }
init();
return () => {
mounted = false;
    };
  }, []);

useEffect(() => {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (
          data &&
          data.screen === "schedule" &&
          typeof data.taskId === "string"
        ) {
          router.push({
            pathname: "/main/schedule",
            params: { taskId: data.taskId },
          });
        }
      }
    );

  return () => subscription.remove();
}, []);
  
// 1.5️⃣ Ensure tenant exists and password state is valid
useEffect(() => {
  if (!ready || !session) return;

  const inAuthGroup = segments[0] === '(auth)';
  if (inAuthGroup) return;

  async function checkTenant() {
    try {
      const res = await apiFetch('/api/tenant/me');

      if (res.needsCompany) {
        router.replace('/create-company');
        return;
      }

      if (res.mustChangePassword) {
        router.replace('/(auth)/update-password');
        return;
      }

    } catch (err) {
      console.warn('Tenant check failed', err);
    }
  }

  checkTenant();

}, [ready, session, segments]);

// 2️⃣ Handle routing reactively
useEffect(() => {
if (!ready) return;
const inAuthGroup = segments[0] === '(auth)';
if (!session && !inAuthGroup) {
router.replace('/(auth)/login');
return;
    }

// Allow update-password screen while logged in
const segment0 = segments[0];
const segment1 = segments.at(1);

const isUpdatePassword =
  segment0 === '(auth)' &&
  segment1 === 'update-password';

if (session && inAuthGroup && !isUpdatePassword) {
  router.replace('/main');
  return;
}

  }, [ready, session, segments]);
// 3️⃣ Heartbeat to detect session takeover
useEffect(() => {
  if (!ready || !session) return;

  let signingOut = false;

  const interval = setInterval(async () => {
    try {
      await apiFetch('/api/tenant/session');
    } catch (err: any) {

      const message =
        typeof err?.message === 'string'
          ? err.message
          : '';

      const isSessionConflict =
        err?.code === 'SESSION_CONFLICT';

      const isAuthFailure =
        message.includes('Invalid or expired token') ||
        message.includes('Invalid JWT') ||
        message.includes('Missing Authorization header');

      if (isSessionConflict || isAuthFailure) {

        if (signingOut) return;
        signingOut = true;

        console.warn('🚨 Authentication lost — logging out');

        try {
          await supabase.auth.signOut();
        } catch {}

        try {
          await AsyncStorage.removeItem('tenantId');
          await AsyncStorage.removeItem('deviceSessionId');
        } catch {}

        router.replace('/(auth)/login');
        return;
      }

      console.warn('Heartbeat non-auth error', err);
    }
  }, 15000); // 15s for faster testing

  return () => clearInterval(interval);

}, [ready, session]);

if (!ready) return null;

return (
  <Stack
    screenOptions={{
      headerBackTitle: 'Back',
      headerRight: () => {
        const isInsideMain = segments[0] === 'main';

        // No Home button inside main shell (tabs handle nav)
        if (isInsideMain) return null;

        return (
          <Text
            onPress={() => router.push('/main')}
            style={{ marginRight: 16, fontWeight: '600' }}
          >
            Home
          </Text>
        );
      },
    }}
  >
    {/* Auth screens */}
    <Stack.Screen name="(auth)" options={{ headerShown: false }} />

{/* Main tab shell */}
<Stack.Screen
  name="main"
  options={{ headerShown: false }}
/>

    {/* Drill-down screens (need back + home) */}
    <Stack.Screen
  name="job/[id]"
  options={({ route }: any) => ({
    title:
      typeof route.params?.name === 'string'
        ? route.params.name
        : 'Job',
  })}
/>
    <Stack.Screen name="job/[id]/notes" />
  </Stack>
);
}