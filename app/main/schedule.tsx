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
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../src/lib/syncEngine';

export default function ScheduleScreen() {
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
const [crews, setCrews] = useState<any[]>([]);
const [phases, setPhases] = useState<string[]>([]);
const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
const [currentMonth, setCurrentMonth] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [expandedId, setExpandedId] = useState<string | null>(null);
const [isCreating, setIsCreating] = useState(false);
const [newTaskJobId, setNewTaskJobId] = useState<string | null>(null);
const [newTaskPhase, setNewTaskPhase] = useState<string | null>(null);
const [newTaskCrewId, setNewTaskCrewId] = useState<string | null>(null);

const groupedByDate = scheduledTasks.reduce((acc: any, task: any) => {
  const date = new Date(task.scheduled_at).toLocaleDateString();

  if (!acc[date]) acc[date] = [];
  acc[date].push(task);

  return acc;
}, {});

useEffect(() => {
  loadScheduledTasks();
  loadDirectories();
}, []);

  async function updateTaskStatus(taskId: string, newStatus: 'scheduled' | 'complete') {
  // 1️⃣ Immediate local update
  const updated = scheduledTasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          status: newStatus,
          completed_at: newStatus === 'complete' ? new Date().toISOString() : null,
        }
      : task
  );

  setScheduledTasks(updated);
  await AsyncStorage.setItem('scheduled_tasks_v1', JSON.stringify(updated));

  // 2️⃣ Attempt backend
  try {
    await apiFetch(`/api/scheduled-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: newStatus,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'scheduled_task_update',
      coalesceKey: `scheduled_task_update:${taskId}`,
      createdAt: nowIso(),
      payload: {
        taskId,
        status: newStatus,
      },
    });
  }

  flushSyncQueue();
}

async function rescheduleTask(task: any, daysToAdd: number) {
  const newDate = new Date(task.scheduled_at);
  newDate.setDate(newDate.getDate() + daysToAdd);

  const newIso = newDate.toISOString();

  // 1️⃣ Local update
  const updated = scheduledTasks.map(t =>
    t.id === task.id
      ? { ...t, scheduled_at: newIso }
      : t
  );

  setScheduledTasks(updated);
  await AsyncStorage.setItem(
    'scheduled_tasks_v1',
    JSON.stringify(updated)
  );

  // 2️⃣ Attempt backend
  try {
    await apiFetch(`/api/scheduled-tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduledAt: newIso,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'scheduled_task_update',
      coalesceKey: `scheduled_task_update:${task.id}`,
      createdAt: nowIso(),
      payload: {
        taskId: task.id,
        scheduledAt: newIso,
      },
    });
  }

  flushSyncQueue();
}

async function createTaskFromCalendar() {
  if (!selectedDate || !newTaskJobId || !newTaskCrewId || !newTaskPhase) {
    return;
  }

  // Default to 8:00 AM
  const dateObj = new Date(selectedDate);
  dateObj.setHours(8, 0, 0, 0);

  const iso = dateObj.toISOString();

  const localTask = {
    id: makeId(),
    job_id: newTaskJobId,
    crew_id: newTaskCrewId,
    phase: newTaskPhase,
    scheduled_at: iso,
    status: 'scheduled',
    job_name: jobs.find(j => j.id === newTaskJobId)?.name,
    crew_name: crews.find(c => c.id === newTaskCrewId)?.name,
  };

  // 1️⃣ Local update
  const updated = [...scheduledTasks, localTask];
  setScheduledTasks(updated);
  await AsyncStorage.setItem(
    'scheduled_tasks_v1',
    JSON.stringify(updated)
  );

  // 2️⃣ Attempt backend
  try {
    await apiFetch('/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify({
        jobId: newTaskJobId,
        crewId: newTaskCrewId,
        phase: newTaskPhase,
        scheduledAt: iso,
      }),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'scheduled_task_create',
      coalesceKey: `scheduled_task_create:${newTaskJobId}:${newTaskCrewId}:${iso}`,
      createdAt: nowIso(),
      payload: {
        jobId: newTaskJobId,
        crewId: newTaskCrewId,
        phase: newTaskPhase,
        scheduledAt: iso,
      },
    });
  }

  flushSyncQueue();

  // Reset creator
  setIsCreating(false);
  setNewTaskJobId(null);
  setNewTaskCrewId(null);
  setNewTaskPhase(null);
}

async function loadDirectories() {
  try {
const jobsRes = await apiFetch('/api/job');
setJobs(jobsRes?.jobs ?? []);
  } catch {}

  try {
    const crewsRes = await apiFetch('/api/crews');
    setCrews(crewsRes.crews ?? []);
  } catch {}

  try {
    const phasesRes = await apiFetch('/api/phases');
    const names = phasesRes?.phases?.map((p: any) => p.name) ?? [];
    setPhases(names);
  } catch {}
}

  async function loadScheduledTasks() {
    // 1️⃣ Local first
    const local = await AsyncStorage.getItem('scheduled_tasks_v1');
    if (local) {
      setScheduledTasks(JSON.parse(local));
    }

    // 2️⃣ Attempt backend
    try {
      const res = await apiFetch('/api/scheduled-tasks');
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

  function getMonthMatrix(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const matrix: (number | null)[][] = [];
  let day = 1 - startDay;

  for (let week = 0; week < 6; week++) {
    const row: (number | null)[] = [];

    for (let d = 0; d < 7; d++) {
      if (day < 1 || day > daysInMonth) {
        row.push(null);
      } else {
        row.push(day);
      }
      day++;
    }

    matrix.push(row);
  }

  return matrix;
}

function hasTasksOnDate(day: number) {
  return scheduledTasks.some(t => {
    const taskDate = new Date(t.scheduled_at);

    return (
      taskDate.getFullYear() === currentMonth.getFullYear() &&
      taskDate.getMonth() === currentMonth.getMonth() &&
      taskDate.getDate() === day
    );
  });
}

function tasksForSelectedDate() {
  if (!selectedDate) return [];

  const selected = new Date(selectedDate);

  return scheduledTasks.filter(t => {
    const taskDate = new Date(t.scheduled_at);

    return (
      taskDate.getFullYear() === selected.getFullYear() &&
      taskDate.getMonth() === selected.getMonth() &&
      taskDate.getDate() === selected.getDate()
    );
  });
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
{viewMode === 'calendar' && (
  <>
    <View style={styles.monthHeader}>
      <Pressable
        onPress={() =>
          setCurrentMonth(
            new Date(
              currentMonth.getFullYear(),
              currentMonth.getMonth() - 1,
              1
            )
          )
        }
      >
        <Text style={styles.monthNav}>{'<'}</Text>
      </Pressable>

      <Text style={styles.monthTitle}>
        {currentMonth.toLocaleString('default', {
          month: 'long',
        })}{' '}
        {currentMonth.getFullYear()}
      </Text>

      <Pressable
        onPress={() =>
          setCurrentMonth(
            new Date(
              currentMonth.getFullYear(),
              currentMonth.getMonth() + 1,
              1
            )
          )
        }
      >
        <Text style={styles.monthNav}>{'>'}</Text>
      </Pressable>
    </View>

    {getMonthMatrix(currentMonth).map((week, wi) => (
      <View key={wi} style={styles.weekRow}>
        {week.map((day, di) => (
          <Pressable
            key={di}
            style={[
              styles.dayCell,
              day &&
              selectedDate ===
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day
                ).toLocaleDateString()
                ? styles.selectedDay
                : null,
            ]}
            onPress={() => {
              if (!day) return;
const d = new Date(
  currentMonth.getFullYear(),
  currentMonth.getMonth(),
  day
);

setSelectedDate(d.toISOString());
            }}
          >
            {day && (
              <>
                <Text style={styles.dayText}>{day}</Text>
                {hasTasksOnDate(day) && (
                  <View style={styles.dot} />
                )}
              </>
            )}
          </Pressable>
        ))}
      </View>
    ))}

{selectedDate && (
  <View style={{ marginTop: 20 }}>
<Text style={styles.dateHeader}>
  Tasks for {selectedDate}
</Text>

<Pressable
  onPress={() => setIsCreating(!isCreating)}
  style={{ marginBottom: 12 }}
>
  <Text style={{ color: '#2563eb', fontWeight: '700' }}>
    + Add Task
  </Text>
</Pressable>

    {isCreating && (
  <View style={{ marginBottom: 20 }}>
    <Text>Select Job:</Text>
    {Array.isArray(jobs) &&
  jobs.map(j => (
      <Pressable
        key={j.id}
        onPress={() => setNewTaskJobId(j.id)}
      >
        <Text
          style={{
            fontWeight:
              newTaskJobId === j.id ? '700' : '400',
          }}
        >
          {j.name}
        </Text>
      </Pressable>
    ))}

    <Text style={{ marginTop: 10 }}>Select Phase:</Text>
    {phases.map(p => (
      <Pressable
        key={p}
        onPress={() => setNewTaskPhase(p)}
      >
        <Text
          style={{
            fontWeight:
              newTaskPhase === p ? '700' : '400',
          }}
        >
          {p}
        </Text>
      </Pressable>
    ))}

    <Text style={{ marginTop: 10 }}>Select Crew:</Text>
    {crews.map(c => (
      <Pressable
        key={c.id}
        onPress={() => setNewTaskCrewId(c.id)}
      >
        <Text
          style={{
            fontWeight:
              newTaskCrewId === c.id ? '700' : '400',
          }}
        >
          {c.name}
        </Text>
      </Pressable>
    ))}

    <Pressable
      onPress={createTaskFromCalendar}
      style={{ marginTop: 10 }}
    >
      <Text style={{ color: 'green', fontWeight: '700' }}>
        Save Task
      </Text>
    </Pressable>
  </View>
)}

    {tasksForSelectedDate().map(task => (
      <Pressable
        key={task.id}
        style={styles.card}
        onPress={() =>
          setExpandedId(
            expandedId === task.id ? null : task.id
          )
        }
      >
        <Text style={styles.job}>
          {task.job_name}
        </Text>

        <Text style={styles.meta}>
          {task.crew_name}
        </Text>

        <Text style={styles.meta}>
          {task.phase}
        </Text>

{expandedId === task.id && (
  <View style={{ marginTop: 12 }}>

    {task.status !== 'complete' && (
      <Pressable
        onPress={() =>
          updateTaskStatus(task.id, 'complete')
        }
      >
        <Text
          style={{
            color: 'green',
            fontWeight: '700',
          }}
        >
          Mark Complete
        </Text>
      </Pressable>
    )}

    {task.status === 'complete' && (
      <Pressable
        onPress={() =>
          updateTaskStatus(task.id, 'scheduled')
        }
      >
        <Text
          style={{
            color: 'red',
            fontWeight: '700',
          }}
        >
          Mark Incomplete
        </Text>
      </Pressable>
    )}

    <View style={{ marginTop: 10 }}>
      <Pressable
        onPress={() => rescheduleTask(task, 1)}
      >
        <Text
          style={{
            color: '#2563eb',
            fontWeight: '700',
          }}
        >
          Reschedule +1 Day
        </Text>
      </Pressable>
    </View>

  </View>
)}
      </Pressable>
    ))}
  </View>
)}
  </>
)}

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
  monthHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
},

monthTitle: {
  fontSize: 18,
  fontWeight: '700',
},

monthNav: {
  fontSize: 18,
  fontWeight: '700',
},

weekRow: {
  flexDirection: 'row',
},

dayCell: {
  flex: 1,
  height: 48,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 0.5,
  borderColor: '#eee',
},

selectedDay: {
  backgroundColor: '#e0f2fe',
},

dayText: {
  fontSize: 14,
},

dot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: '#2563eb',
  marginTop: 4,
},
  date: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.7,
  },
});