//JobHub/app/main/schedule.tsx

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';

export default function ScheduleScreen() {
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

const groupedByDate = scheduledTasks.reduce((acc: any, task: any) => {
  const date = new Date(task.scheduled_at).toLocaleDateString();

  if (!acc[date]) acc[date] = [];
  acc[date].push(task);

  return acc;
}, {});

  useEffect(() => {
    loadScheduledTasks();
  }, []);

  async function loadScheduledTasks() {
    // 1️⃣ Local first
    const local = await AsyncStorage.getItem('scheduled_tasks_v1');
    if (local) {
      setScheduledTasks(JSON.parse(local));
    }

    // 2️⃣ Attempt backend
    try {
      const res = await apiFetch('/api/schedule');
      const tasks = res?.tasks ?? [];

      setScheduledTasks(tasks);

      await AsyncStorage.setItem(
        'scheduled_tasks_v1',
        JSON.stringify(tasks)
      );
    } catch {
      // silent — offline keeps local
    }
  }

  return (
  <View style={styles.container}>
    <Text style={styles.title}>Schedule</Text>

    <View style={styles.toggleRow}>
      <Pressable onPress={() => setViewMode('calendar')}>
        <Text
          style={
            viewMode === 'calendar'
              ? styles.activeTab
              : styles.tab
          }
        >
          Calendar
        </Text>
      </Pressable>

      <Pressable onPress={() => setViewMode('list')}>
        <Text
          style={
            viewMode === 'list'
              ? styles.activeTab
              : styles.tab
          }
        >
          List
        </Text>
      </Pressable>
    </View>

    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {scheduledTasks.length === 0 && (
        <Text style={styles.empty}>
          No scheduled tasks
        </Text>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' &&
        Object.entries(groupedByDate).map(([date, items]: any) => (
          <View key={date} style={styles.dateBlock}>
            <Text style={styles.dateHeader}>{date}</Text>

            {items.map((task: any) => (
              <View key={task.id} style={styles.card}>
                <Text style={styles.job}>
                  {task.job_name ?? task.job_id}
                </Text>

                <Text style={styles.meta}>
                  {task.phase}
                </Text>

                <Text style={styles.meta}>
                  {task.crew_name ?? task.crew_id}
                </Text>
              </View>
            ))}
          </View>
        ))}

      {/* LIST VIEW */}
      {viewMode === 'list' &&
        [...scheduledTasks]
          .sort((a, b) =>
            (a.job_name ?? '').localeCompare(
              b.job_name ?? ''
            )
          )
          .map(task => (
            <View key={task.id} style={styles.card}>
              <Text style={styles.job}>
                {task.job_name ?? task.job_id}
              </Text>

              <Text style={styles.meta}>
                Crew: {task.crew_name ?? task.crew_id}
              </Text>

              <Text style={styles.meta}>
                Phase: {task.phase}
              </Text>

              <Text style={styles.date}>
                {new Date(
                  task.scheduled_at
                ).toLocaleString()}
              </Text>
            </View>
          ))}
    </ScrollView>
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
  toggleRow: {
  flexDirection: 'row',
  gap: 20,
  marginBottom: 20,
},

tab: {
  fontSize: 16,
  opacity: 0.5,
},

activeTab: {
  fontSize: 16,
  fontWeight: '700',
},

dateBlock: {
  marginBottom: 20,
},

dateHeader: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 8,
},
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  empty: {
    opacity: 0.6,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginBottom: 14,
  },
  job: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
    marginTop: 4,
  },
  date: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.7,
  },
});