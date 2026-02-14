////JobHub/app/main/materials.tsx
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MaterialScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Material</Text>
        <Text style={styles.subtitle}>Placeholder screen</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming soon</Text>
          <Text style={styles.text}>• Material requests per job</Text>
          <Text style={styles.text}>• Vendor allocations</Text>
          <Text style={styles.text}>• Phase-based material checklists</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Debug</Text>
          <Text style={styles.text}>If you can see this, routing works.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  text: { fontSize: 14, color: '#111827' },
});
