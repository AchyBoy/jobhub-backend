//JobHub/app/main/schedule.tsx

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { Stack } from 'expo-router';
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
const [pendingRescheduleTask, setPendingRescheduleTask] = useState<any | null>(null);
const [rescheduleHour, setRescheduleHour] = useState<number>(8);
const [rescheduleMinute, setRescheduleMinute] = useState<number>(0);
const [rescheduleTargetDate, setRescheduleTargetDate] = useState<Date | null>(null);
const [jobSearch, setJobSearch] = useState('');
const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
const [filterCrewId, setFilterCrewId] = useState<string | null>(null);
const [filterPhase, setFilterPhase] = useState<string | null>(null);
const [filterStatus, setFilterStatus] = useState<'scheduled' | 'complete' | null>(null);
const [filterJobId, setFilterJobId] = useState<string | null>(null);
const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
const [showCrewDropdown, setShowCrewDropdown] = useState(false);
const [crewEditTaskId, setCrewEditTaskId] = useState<string | null>(null);
const [newTaskHour, setNewTaskHour] = useState<number>(8);
const [newTaskMinute, setNewTaskMinute] = useState<number>(0); // 0 or 30
const filteredJobs = jobs.filter(j =>
  j.name?.toLowerCase().includes(jobSearch.toLowerCase())
);
const sortedCrews = [...crews].sort((a, b) =>
  (a.name ?? '').localeCompare(b.name ?? '')
);

const filteredTasks = scheduledTasks.filter(task => {
  if (filterCrewId && task.crew_id !== filterCrewId) return false;
  if (filterPhase && task.phase !== filterPhase) return false;
  if (filterStatus && task.status !== filterStatus) return false;
  if (filterJobId && task.job_id !== filterJobId) return false;

  if (filterStartDate || filterEndDate) {
    const taskDate = new Date(task.scheduled_at);

    if (filterStartDate && taskDate < filterStartDate) return false;
    if (filterEndDate && taskDate > filterEndDate) return false;
  }

  return true;
});

const groupedByDate = filteredTasks.reduce((acc: any, task: any) => {
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

async function changeTaskCrew(task: any, newCrewId: string) {
  const updated = scheduledTasks.map(t =>
    t.id === task.id
      ? {
          ...t,
          crew_id: newCrewId,
          crew_name: crews.find(c => c.id === newCrewId)?.name,
        }
      : t
  );

  setScheduledTasks(updated);
  await AsyncStorage.setItem(
    'scheduled_tasks_v1',
    JSON.stringify(updated)
  );

  try {
    await apiFetch(`/api/scheduled-tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        crewId: newCrewId,
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
        crewId: newCrewId,
      },
    });
  }

  flushSyncQueue();
}

async function unscheduleTask(task: any) {
  // 1️⃣ Local first — remove task entirely
  const updated = scheduledTasks.filter(t => t.id !== task.id);

  setScheduledTasks(updated);
  await AsyncStorage.setItem(
    'scheduled_tasks_v1',
    JSON.stringify(updated)
  );

  // 2️⃣ Attempt backend DELETE
  try {
    await apiFetch(`/api/scheduled-tasks/${task.id}`, {
      method: 'DELETE',
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'scheduled_task_delete',
      coalesceKey: `scheduled_task_delete:${task.id}`,
      createdAt: nowIso(),
      payload: {
        taskId: task.id,
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

dateObj.setHours(newTaskHour);
dateObj.setMinutes(newTaskMinute);
dateObj.setSeconds(0);
dateObj.setMilliseconds(0);

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
  return filteredTasks.some(t => {
    if (!t.scheduled_at) return false;
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

  return filteredTasks.filter(t => {
    if (!t.scheduled_at) return false;
const taskDate = new Date(t.scheduled_at);

    return (
      taskDate.getFullYear() === selected.getFullYear() &&
      taskDate.getMonth() === selected.getMonth() &&
      taskDate.getDate() === selected.getDate()
    );
  });
}

return (
<>
  <Stack.Screen options={{ title: 'Schedule' }} />
  <View style={styles.container}>
  <ScrollView
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingBottom: 40 }}
  >


  {/* FILTER TOGGLE */}
  <Pressable
    onPress={() =>
      setExpandedId(expandedId === '__filters' ? null : '__filters')
    }
    style={{ marginBottom: 12 }}
  >
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      Filters
    </Text>
  </Pressable>

{/* FILTER PANEL */}
{expandedId === '__filters' && (
  <View
    style={{
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      backgroundColor: '#f9fafb',
    }}
  >

    {/* CREW FILTER */}
    <Text style={{ fontWeight: '700', marginBottom: 6 }}>
      Crew
    </Text>

    <View
      style={{
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#fff',
        marginBottom: 12,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 6 }}
         nestedScrollEnabled
      >
        <Pressable
          onPress={() => setFilterCrewId(null)}
          style={{
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontWeight: !filterCrewId ? '700' : '400' }}>
            All Crews
          </Text>
        </Pressable>

        {sortedCrews.map(c => (
          <Pressable
            key={c.id}
            onPress={() => setFilterCrewId(c.id)}
            style={{
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: filterCrewId === c.id ? '700' : '400',
                color: filterCrewId === c.id ? '#2563eb' : '#111',
              }}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>


    {/* PHASE FILTER */}
    <Text style={{ fontWeight: '700', marginBottom: 6 }}>
      Phase
    </Text>

    <View
      style={{
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#fff',
        marginBottom: 12,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 6 }}
         nestedScrollEnabled
      >
        <Pressable
          onPress={() => setFilterPhase(null)}
          style={{
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontWeight: !filterPhase ? '700' : '400' }}>
            All Phases
          </Text>
        </Pressable>

        {phases.map(p => (
          <Pressable
            key={p}
            onPress={() => setFilterPhase(p)}
            style={{
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: filterPhase === p ? '700' : '400',
                color: filterPhase === p ? '#2563eb' : '#111',
              }}
            >
              {p}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>


    {/* STATUS FILTER */}
    <Text style={{ fontWeight: '700', marginBottom: 6 }}>
      Status
    </Text>

    <View
      style={{
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#fff',
        marginBottom: 12,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 6 }}
         nestedScrollEnabled
      >
        <Pressable
          onPress={() => setFilterStatus(null)}
          style={{
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontWeight: !filterStatus ? '700' : '400' }}>
            All Statuses
          </Text>
        </Pressable>

        {['scheduled', 'complete'].map(s => (
          <Pressable
            key={s}
            onPress={() => setFilterStatus(s as any)}
            style={{
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: filterStatus === s ? '700' : '400',
                color: filterStatus === s ? '#2563eb' : '#111',
              }}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>


    {/* CLEAR BUTTON */}
    <Pressable
      onPress={() => {
        setFilterCrewId(null);
        setFilterPhase(null);
        setFilterStatus(null);
        setFilterJobId(null);
        setFilterStartDate(null);
        setFilterEndDate(null);
      }}
    >
      <Text style={{ color: 'red', fontWeight: '700' }}>
        Clear Filters
      </Text>
    </Pressable>

  </View>
)}

  {/* VIEW MODE TOGGLE */}
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

<View style={{ paddingVertical: 8 }}>

      {filteredTasks.length === 0 && (
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

    {pendingRescheduleTask && !rescheduleTargetDate && (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      Select a date
    </Text>
  </View>
)}

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

  // If we are rescheduling a task
  if (pendingRescheduleTask) {
    setRescheduleTargetDate(d);
    return;
  }

  // Normal selection mode
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

    {pendingRescheduleTask && rescheduleTargetDate && (
  <View style={{
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eee'
  }}>
    <Text style={{ fontWeight: '700', marginBottom: 10 }}>
      Reschedule to:
    </Text>

{/* Time Wheel (30 min increments, 12hr format) */}
<View
  style={{
    height: 132, // 3 visible rows
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  }}
>
  <ScrollView
    showsVerticalScrollIndicator={false}
    decelerationRate="fast"
  >
    {Array.from({ length: 48 }).map((_, i) => {
      const hour24 = Math.floor(i / 2);
      const minute = i % 2 === 0 ? 0 : 30;

      const hour12 =
        hour24 === 0
          ? 12
          : hour24 > 12
          ? hour24 - 12
          : hour24;

      const ampm = hour24 < 12 ? 'am' : 'pm';

      const isSelected =
        rescheduleHour === hour24 &&
        rescheduleMinute === minute;

      const label = `${hour12}:${minute === 0 ? '00' : '30'} ${ampm}`;

      return (
        <Pressable
          key={i}
          onPress={() => {
            setRescheduleHour(hour24);
            setRescheduleMinute(minute);
          }}
          style={{
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isSelected ? '#2563eb' : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: isSelected ? '#fff' : '#111',
              fontWeight: isSelected ? '700' : '500',
            }}
          >
            {label}
          </Text>
        </Pressable>
      );
    })}
  </ScrollView>
</View>

    <View style={{ flexDirection: 'row', gap: 20 }}>
      <Pressable
        onPress={() => {
          setPendingRescheduleTask(null);
          setRescheduleTargetDate(null);
        }}
      >
        <Text style={{ color: 'red', fontWeight: '700' }}>
          Cancel
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          const d = new Date(rescheduleTargetDate);
          d.setHours(rescheduleHour);
          d.setMinutes(rescheduleMinute);
          d.setSeconds(0);
          d.setMilliseconds(0);

          const newIso = d.toISOString();

          const updated = scheduledTasks.map(t =>
            t.id === pendingRescheduleTask.id
              ? { ...t, scheduled_at: newIso }
              : t
          );

          setScheduledTasks(updated);
          await AsyncStorage.setItem(
            'scheduled_tasks_v1',
            JSON.stringify(updated)
          );

          try {
            await apiFetch(
              `/api/scheduled-tasks/${pendingRescheduleTask.id}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  scheduledAt: newIso,
                }),
              }
            );
          } catch {
            await enqueueSync({
              id: makeId(),
              type: 'scheduled_task_update',
              coalesceKey: `scheduled_task_update:${pendingRescheduleTask.id}`,
              createdAt: nowIso(),
              payload: {
                taskId: pendingRescheduleTask.id,
                scheduledAt: newIso,
              },
            });
          }

          flushSyncQueue();

          setPendingRescheduleTask(null);
          setRescheduleTargetDate(null);
        }}
      >
        <Text style={{ color: 'green', fontWeight: '700' }}>
          OK
        </Text>
      </Pressable>
    </View>
  </View>
)}

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

<TextInput
  placeholder="Search job..."
  value={jobSearch}
  onChangeText={setJobSearch}
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  }}
/>

{jobSearch.length > 0 &&
  filteredJobs.slice(0, 8).map(j => (
    <Pressable
      key={j.id}
      onPress={() => {
        setNewTaskJobId(j.id);
        setJobSearch(j.name);
      }}
      style={{ paddingVertical: 4 }}
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

<Pressable
  onPress={() => setShowPhaseDropdown(!showPhaseDropdown)}
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  }}
>
  <Text>
    {newTaskPhase ?? 'Choose phase'}
  </Text>
</Pressable>

{showPhaseDropdown &&
  phases.map(p => (
    <Pressable
      key={p}
      onPress={() => {
        setNewTaskPhase(p);
        setShowPhaseDropdown(false);
      }}
      style={{ paddingVertical: 4 }}
    >
      <Text>{p}</Text>
    </Pressable>
  ))}

<Text style={{ marginTop: 10 }}>Select Crew:</Text>

<Pressable
  onPress={() => setShowCrewDropdown(!showCrewDropdown)}
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  }}
>
  <Text>
    {crews.find(c => c.id === newTaskCrewId)?.name ?? 'Choose crew'}
  </Text>
</Pressable>

{showCrewDropdown &&
  crews.map(c => (
    <Pressable
      key={c.id}
      onPress={() => {
        setNewTaskCrewId(c.id);
        setShowCrewDropdown(false);
      }}
      style={{ paddingVertical: 4 }}
    >
      <Text>{c.name}</Text>
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
  style={[
    styles.card,
    pendingRescheduleTask?.id === task.id && {
      borderWidth: 2,
      borderColor: '#2563eb',
    },
  ]}
    onPress={() =>
      setExpandedId(
        expandedId === task.id ? null : task.id
      )
    }
onLongPress={() => {
  const original = new Date(task.scheduled_at);

  setPendingRescheduleTask(task);
  setRescheduleHour(original.getHours());
  setRescheduleMinute(original.getMinutes());
}}
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

{pendingRescheduleTask?.id === task.id ? (
  <Text
    style={{
      fontSize: 12,
      marginTop: 6,
      color: '#2563eb',
      fontWeight: '700',
    }}
  >
    Select a date
  </Text>
) : (
  <Text
    style={{
      fontSize: 12,
      marginTop: 6,
      opacity: 0.6,
    }}
  >
    Hold to reschedule
  </Text>
)}

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

<View style={{ marginTop: 12 }}>
  <Pressable
    onPress={() =>
      setCrewEditTaskId(
        crewEditTaskId === task.id ? null : task.id
      )
    }
    style={{
      borderWidth: 1,
      borderColor: '#ddd',
      padding: 8,
      borderRadius: 8,
    }}
  >
    <Text style={{ fontWeight: '700', color: '#2563eb' }}>
      {crewEditTaskId === task.id
        ? 'Close Crew Selector'
        : 'Change Crew'}
    </Text>
  </Pressable>

  {crewEditTaskId === task.id && (
    <View
      style={{
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        maxHeight: 200, // ~4–5 rows visible
      }}
    >
      <ScrollView nestedScrollEnabled>
        {sortedCrews.map(c => (
          <Pressable
            key={c.id}
            onPress={() => {
              changeTaskCrew(task, c.id);
              setCrewEditTaskId(null);
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderBottomWidth: 0.5,
              borderColor: '#eee',
            }}
          >
            <Text>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )}
</View>

<View style={{ marginTop: 12 }}>
  <Pressable
    onPress={() => unscheduleTask(task)}
  >
    <Text style={{ color: 'red', fontWeight: '700' }}>
      Unschedule
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
  [...filteredTasks]
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
    </View>
  </ScrollView>
  </View>
</>
);
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  paddingTop: 10,
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
    marginBottom: 4,
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