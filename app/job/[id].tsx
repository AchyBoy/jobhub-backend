//JobHub/app/job/[id].tsx
import { Text, StyleSheet, Pressable, View } from 'react-native';


import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JobHub() {
const { id, name } = useLocalSearchParams();
const router = useRouter();

const [detailsExpanded, setDetailsExpanded] = useState(false);

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

  {/* 🔷 MANAGEMENT SECTION */}
  <View style={styles.sectionBlock}>

    {/* 🔷 JOB DETAILS (Collapsible) */}
    <Pressable
      style={styles.card}
      onPress={() => setDetailsExpanded(v => !v)}
    >
      <View style={styles.detailHeader}>
        <Text style={styles.cardTitle}>Job Details</Text>
        <Text style={styles.expandIcon}>
          {detailsExpanded ? '▲' : '▼'}
        </Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={styles.detailLabel}>Supervisor</Text>
        <Text style={styles.detailValue}>John Smith</Text>
        <Text style={styles.detailMeta}>555-123-4567</Text>
        <Text style={styles.detailMeta}>john@email.com</Text>
      </View>

      {detailsExpanded && (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={styles.detailLabel}>Primary Contractor</Text>
          <Text style={styles.detailValue}>ABC Electric</Text>

          <Text style={styles.detailLabel}>Inspector</Text>
          <Text style={styles.detailValue}>Not Assigned</Text>

          <Text style={styles.detailLabel}>Permit Company</Text>
          <Text style={styles.detailValue}>Not Assigned</Text>

          <Text style={[styles.detailLabel, { marginTop: 8 }]}>
            Assigned Crews (per phase)
          </Text>
          <Text style={styles.detailValue}>Rough → —</Text>
          <Text style={styles.detailValue}>Trim → —</Text>
          <Text style={styles.detailValue}>Final → —</Text>
        </View>
      )}
    </Pressable>

  </View>

  {/* 🔷 WORK SECTION */}
  <View style={styles.sectionBlock}>

    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/notes`)}
    >
      <Text style={styles.cardTitle}>Notes</Text>
      <Text style={styles.cardSub}>
        General, crew, contractor, phase notes
      </Text>
    </Pressable>

    <View style={[styles.card, styles.disabled]}>
      <Text style={styles.cardTitle}>Material</Text>
      <Text style={styles.cardSub}>
        Job materials & tracking
      </Text>
    </View>

    <View style={[styles.card, styles.disabled]}>
      <Text style={styles.cardTitle}>Dates</Text>
      <Text style={styles.cardSub}>
        Milestones & inspections
      </Text>
    </View>

  </View>

  {/* 🔷 COMMUNICATION SECTION */}
  <View style={styles.sectionBlock}>

    <Pressable
      style={styles.card}
      onPress={() => router.push(`/job/${id}/send-links`)}
    >
      <Text style={styles.cardTitle}>Send Links</Text>
      <Text style={styles.cardSub}>
        Email phase-specific crew links
      </Text>
    </Pressable>

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
  backgroundColor: '#ffffff',
},
detailLabel: {
  fontSize: 13,
  fontWeight: '600',
  opacity: 0.6,
},
detailHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

expandIcon: {
  fontSize: 14,
  fontWeight: '700',
  opacity: 0.5,
},

detailMeta: {
  fontSize: 13,
  opacity: 0.6,
},

detailValue: {
  fontSize: 15,
  fontWeight: '500',
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
sectionBlock: {
  marginBottom: 22,
  width: '100%',
},

card: {
  padding: 18,
  borderRadius: 18,
  backgroundColor: '#eff6ff',   // light blue interior
  borderWidth: 1,
  borderColor: '#93c5fd',       // slightly darker blue border
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
