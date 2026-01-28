import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

function handleBack() {
  // If we're on the Jobs screen, go Home
  if (pathname === '/main/jobs') {
    router.replace('/main');
    return;
  }

  // Normal back behavior
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/main');
  }
}

  return (
    <Pressable style={styles.button} onPress={handleBack}>
      <Ionicons name="chevron-back" size={24} />
      <Text style={styles.text}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
});