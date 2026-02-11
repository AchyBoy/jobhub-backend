// JobHub/app/_layout.tsx

import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      setHasSession(!!data.session);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setHasSession(!!session);
      });

      setReady(true);
      return () => sub.subscription.unsubscribe();
    }

    boot();
    return () => { alive = false; };
  }, []);

if (!ready) return null;

return <Slot />;
}