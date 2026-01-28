import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeButton() {
  const router = useRouter();

  function goHome() {
    router.replace('/main');
  }

  return (
    <Pressable onPress={goHome}>
      <Text style={styles.text}>Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
