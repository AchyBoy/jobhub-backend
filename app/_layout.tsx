// JobHub/app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { apiFetch } from '../src/lib/apiClient';
import { Text } from 'react-native';

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
        (_event, session) => {
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

  // 1.5️⃣ Ensure tenant exists before allowing main access
useEffect(() => {
  if (!ready || !session) return;

  async function checkTenant() {
    try {
      const res = await apiFetch('/api/tenant/me');

      if (res.needsCompany) {
        router.replace('/create-company');
      }
    } catch (err) {
      console.warn('Tenant check failed', err);
    }
  }

  checkTenant();
}, [ready, session]);

  // 2️⃣ Handle routing reactively
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