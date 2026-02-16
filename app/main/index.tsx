// JobHub/app/main/index.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function MainHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Future automations and convenience features will live here.
      </Text>

      <Text style={styles.comingSoon}>
        Coming soon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 12,
  },
  comingSoon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
});