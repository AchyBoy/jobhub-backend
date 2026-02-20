// JobHub/app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/apiClient';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

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