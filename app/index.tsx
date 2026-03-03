// JobHub/app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();

      console.log('INITIAL URL:', url);

      // Share extension launches app with:
      // jobhub://dataurl=jobhubShareKey
      if (url?.includes('dataurl=')) {
        router.replace('/share');
        return;
      }

      router.replace('/main');
    };

    handleInitialURL();
  }, []);

  return null;
}