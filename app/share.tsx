//JobHub/app/share.tsx
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { useRouter } from 'expo-router';

export default function ShareScreen() {
  const { hasShareIntent, shareIntent } = useShareIntent();
  const router = useRouter();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!hasShareIntent || handled) return;

    if (shareIntent?.files?.length) {
      const file = shareIntent.files[0];

      setHandled(true);

      router.replace({
        pathname: '/share/select-job',
        params: {
          uri: file.path,
          name: file.fileName ?? 'shared.pdf',
        },
      });
    }
  }, [hasShareIntent, shareIntent]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>
        Preparing PDF...
      </Text>
    </View>
  );
}