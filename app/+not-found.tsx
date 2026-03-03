//Jobhub/app/+not-found.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';

export default function NotFoundScreen() {
  const router = useRouter();
  const { hasShareIntent } = useShareIntent();

  useEffect(() => {
    // If the app was opened by the share extension, jump into share flow
    if (hasShareIntent) {
      router.replace('/share');
      return;
    }

    // Otherwise, treat unknown routes as "go home"
    router.replace('/main');
  }, [hasShareIntent]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Opening…</Text>
    </View>
  );
}