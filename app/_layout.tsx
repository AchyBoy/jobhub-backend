// JobHub/app/_layout.tsx

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/apiClient';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useShareIntent } from 'expo-share-intent';
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  // add near top inside component
const { hasShareIntent } = useShareIntent();
  const router = useRouter();
  const segments = useSegments();


// 1️⃣ Load initial session + subscribe
useEffect(() => {
  let mounted = true;

  async function init() {
    const { data } = await supabase.auth.getSession();
    console.log('🔎 getSession on launch:', data.session);

    if (!mounted) return;

    setSession(data.session ?? null);
    setReady(true);

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session) => {

        if (event === 'PASSWORD_RECOVERY') {
          router.replace('/(auth)/update-password');
          return;
        }

        setSession(session ?? null);
      }
    );

    return () => sub.subscription.unsubscribe();
  }

  init();

  return () => {
    mounted = false;
  };
}, []);

useEffect(() => {
  if (!ready) return;

  const inAuthGroup = segments[0] === '(auth)';

  if (!session && !inAuthGroup) {
    router.replace('/(auth)/login');
    return;
  }

  if (session && inAuthGroup) {
    router.replace('/main');
    return;
  }

}, [ready, session, segments]);


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

useEffect(() => {
  if (!ready) return;

  if (hasShareIntent) {
    console.log('🔥 SHARE INTENT DETECTED — navigating');
    router.replace('/share');
  }
}, [ready, hasShareIntent]);

if (!ready) {
  return null;
}


return (
  <GestureHandlerRootView style={{ flex: 1 }}>
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

<Stack.Screen name="share" options={{ headerShown: false }} />
<Stack.Screen name="share/select-job" options={{ title: 'Select Job' }} />

    {/* Drill-down screens (need back + home) */}
<Stack.Screen
  name="job/[id]"
  options={({ route }: any) => ({
    title:
      typeof route.params?.name === 'string'
        ? route.params.name
        : 'Job',
    headerBackTitle: 'Back',
    headerBackTitleVisible: true,
  })}
/>
    <Stack.Screen name="job/[id]/notes" />
    <Stack.Screen name="job/[id]/materials" />
<Stack.Screen name="job/[id]/send-links" />
<Stack.Screen name="job/[id]/defaults" />
<Stack.Screen name="job/[id]/pdf-editor" options={{ title: 'PDF Editor' }} />
<Stack.Screen name="job/[id]/scheduling" />

    </Stack>
  </GestureHandlerRootView>
);
}