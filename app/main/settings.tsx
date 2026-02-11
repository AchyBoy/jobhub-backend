//JobHub/app/main/settings.tsx

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  return (
<View style={styles.container}>
  <Text style={styles.title}>Settings</Text>

      <Pressable
        style={styles.item}
        onPress={() => router.push('/main/edit-tabs')}
      >
        <Text style={styles.itemText}>Customize Tabs</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
  },
  item: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  itemText: {
    fontSize: 18,
    fontWeight: '600',
  },
});