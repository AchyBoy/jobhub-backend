// JobHub/app/(auth)/index.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function AuthIndex() {
  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.text}>Login</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push('/(auth)/signup')}>
        <Text style={styles.text}>Sign Up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 20,
    backgroundColor: '#f7f9fc',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#2563eb', // blue
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});