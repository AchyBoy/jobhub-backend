//JobHub/app/job/[id].tsx
import { Text, StyleSheet, Pressable, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JobHub() {
const { id, name } = useLocalSearchParams();
const router = useRouter();

const jobName =
  typeof name === 'string' && name.length > 0
    ? name
    : 'Job';

  return (
<SafeAreaView
  style={styles.container}
  edges={['left', 'right', 'bottom']}
>

  <Text style={styles.title}>{jobName}</Text>

  <Text style={styles.sub}>Job ID: {id}</Text>

<View style={styles.actions}>
  <Pressable
    style={styles.card}
    onPress={() => router.push(`/job/${id}/send-links`)}
  >
    <Text style={styles.cardTitle}>Send Links</Text>
    <Text style={styles.cardSub}>
      Email phase-specific crew links
    </Text>
  </Pressable>

  <Pressable
    style={styles.card}
    onPress={() => router.push(`/job/${id}/notes`)}
  >
    <Text style={styles.cardTitle}>Notes</Text>
    <Text style={styles.cardSub}>
      General, crew, contractor, phase notes
    </Text>
  </Pressable>

    {/* PLACEHOLDERS — coming next */}
    <View style={[styles.card, styles.disabled]}>
      <Text style={styles.cardTitle}>Items</Text>
      <Text style={styles.cardSub}>Checklists & installs</Text>
    </View>

    <View style={[styles.card, styles.disabled]}>
      <Text style={styles.cardTitle}>Dates</Text>
      <Text style={styles.cardSub}>Milestones & inspections</Text>
    </View>
  </View>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  alignItems: 'center',
  paddingTop: 0,
  paddingHorizontal: 20,
},
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  sub: {
    fontSize: 16,
    opacity: 0.7,
  },
actions: {
  marginTop: 30,
  gap: 12,
  width: '100%',
},

card: {
  padding: 16,
  borderRadius: 14,
  backgroundColor: '#f3f4f6',
},

cardTitle: {
  fontSize: 18,
  fontWeight: '600',
},

cardSub: {
  marginTop: 4,
  fontSize: 14,
  opacity: 0.7,
},

disabled: {
  opacity: 0.4,
},
});
