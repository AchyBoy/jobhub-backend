//JobHub/app/main/settings.tsx

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();

  return (
<ScrollView
  style={styles.container}
  contentContainerStyle={{ paddingBottom: 40 }}
  showsVerticalScrollIndicator={false}
>
  <Text style={styles.title}>Settings</Text>

<Text style={styles.sectionHeader}>App</Text>

<Pressable
  style={styles.item}
  onPress={() => router.push('/main/edit-tabs')}
>
  <Text style={styles.itemText}>Customize Tabs</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 16 }]}
  onPress={() => router.push('/main/phases')}
>
  <Text style={styles.itemText}>Manage Phases</Text>
</Pressable>

<Text style={styles.sectionHeader}>Directories</Text>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/crews')}
>
  <Text style={styles.itemText}>Crews</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/contractors')}
>
  <Text style={styles.itemText}>Contractors</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/supervisors')}
>
  <Text style={styles.itemText}>Supervisors</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/vendors')}
>
  <Text style={styles.itemText}>Vendors</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/permit-companies')}
>
  <Text style={styles.itemText}>Permit Companies</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 12 }]}
  onPress={() => router.push('/main/directories/inspectors')}
>
  <Text style={styles.itemText}>Inspectors</Text>
</Pressable>

<Pressable
  style={[styles.item, { marginTop: 16, backgroundColor: '#fee2e2' }]}
  onPress={async () => {
    await supabase.auth.signOut();
  }}
>
  <Text style={[styles.itemText, { color: '#b91c1c' }]}>
    Logout
  </Text>
</Pressable>
    </ScrollView>
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
  borderRadius: 16,
  backgroundColor: '#eff6ff',   // light blue interior
  borderWidth: 1,
  borderColor: '#bfdbfe',       // slightly darker blue border
  shadowColor: '#93c5fd',
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
},
itemText: {
  fontSize: 18,
  fontWeight: '600',
},

sectionHeader: {
  marginTop: 32,
  marginBottom: 12,
  fontSize: 13,
  fontWeight: '700',
  color: '#2563eb',
  letterSpacing: 1.2,
},
});