//JobHub/app/main/schedule.tsx

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Keyboard } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Calendar } from 'react-native-calendars';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../src/lib/syncEngine';

export default function ScheduleScreen() {
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
const [crews, setCrews] = useState<any[]>([]);
const [showFilterCrewDropdown, setShowFilterCrewDropdown] = useState(false);
const [showFilterStatusDropdown, setShowFilterStatusDropdown] = useState(false);
const [showFilterPhaseDropdown, setShowFilterPhaseDropdown] = useState(false);
const [phases, setPhases] = useState<string[]>([]);
const [taskSearch, setTaskSearch] = useState('');
const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'ios'>('calendar');
const [currentMonth, setCurrentMonth] = useState(new Date());
const scrollRef = useRef<ScrollView>(null);
const timeWheelRef = useRef<ScrollView>(null);
const { taskId } = useLocalSearchParams<{ taskId?: string }>();
const router = useRouter();
const taskYPositionsRef = useRef<Record<string, number>>({});
const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
const [pendingScrollTaskId, setPendingScrollTaskId] = useState<string | null>(null);
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

const filteredTasks = scheduledTasks
  .filter(task => {
    if (taskSearch.length > 0) {
      const search = taskSearch.toLowerCase();
      const job = (task.job_name ?? '').toLowerCase();
      const phase = (task.phase ?? '').toLowerCase();
      const crew = (task.crew_name ?? '').toLowerCase();

      if (!job.includes(search) &&
          !phase.includes(search) &&
          !crew.includes(search)) {
        return false;
      }
    }

    if (filterCrewId && task.crew_id !== filterCrewId) return false;
    if (filterPhase && task.phase !== filterPhase) return false;
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterJobId && task.job_id !== filterJobId) return false;

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

useEffect(() => {
  if (!rescheduleTargetDate) return;

  const index = rescheduleHour * 2 + (rescheduleMinute === 30 ? 1 : 0);
  const y = index * 44; // row height

  setTimeout(() => {
    timeWheelRef.current?.scrollTo({
      y,
      animated: false,
    });
  }, 50);
}, [rescheduleTargetDate]);

useEffect(() => {
  if (typeof taskId !== 'string' || !taskId) return;

  // List view always renders all tasks, so it’s safest for deep-linking
  setViewMode('list');

  // Expand the card
  setExpandedId(taskId);

  // Request a scroll after layout happens
  setPendingScrollTaskId(taskId);

  // Visual highlight
  setHighlightTaskId(taskId);
  const t = setTimeout(() => setHighlightTaskId(null), 2500);
  return () => clearTimeout(t);
}, [taskId]);

useEffect(() => {
  if (!pendingScrollTaskId) return;

  const y = taskYPositionsRef.current[pendingScrollTaskId];
  if (typeof y !== 'number') return;

  scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
  setPendingScrollTaskId(null);
}, [pendingScrollTaskId, scheduledTasks, viewMode]);

async function sendScheduleEmail(task: any) {
  if (task.task_type === 'service' && !task.scheduled_at) return;
const crew = crews.find(c => c.id === task.crew_id);

if (!crew) {
  console.log('NO CREW FOUND');
  return;
}

const emailContact = crew.contacts?.find(
  (c: any) => c.type === 'email'
);

if (!emailContact?.value) {
  console.log('NO EMAIL CONTACT FOUND');
  return;
}

const crewEmail = emailContact.value;

  // Build full schedule for that crew
  const crewTasks = scheduledTasks
    .filter(t => t.crew_id === task.crew_id)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime()
    );

  const scheduleText = crewTasks
    .map(t => {
      return `${new Date(t.scheduled_at).toLocaleString()}
${t.job_name}
Phase: ${t.phase}
Status: ${t.status}`;
    })
    .join('\n\n');

  const subject = encodeURIComponent(
    `Schedule Update - ${crew.name}`
  );

  const body = encodeURIComponent(
`New Scheduled Item:

${new Date(task.scheduled_at).toLocaleString()}
${task.job_name}
Phase: ${task.phase}

------------------------

Full Schedule:

${scheduleText}`
  );

  const url = `mailto:${crewEmail}?subject=${subject}&body=${body}`;

  // Open native mail app
console.log('📧 Opening URL:', url);

await Linking.openURL(url);

  // Immediately mark as sent (no confirmation model)
  try {
    await apiFetch(`/api/scheduled-tasks/${task.id}`, {
      method: 'PATCH',
     body: JSON.stringify({
  emailConfirmedSentAt: new Date().toISOString(),
}),
    });
  } catch {}
}

  async function updateTaskStatus(taskId: string, newStatus: 'scheduled' | 'complete') {
  const task = scheduledTasks.find(t => t.id === taskId);
  if (task?.task_type === 'service' && !task.scheduled_at) return;
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

function hasOverdueTasksOnDate(day: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return filteredTasks.some(t => {
    if (!t.scheduled_at) return false;
    if (t.status === 'complete') return false;

    const taskDate = new Date(t.scheduled_at);

    return (
      taskDate.getFullYear() === currentMonth.getFullYear() &&
      taskDate.getMonth() === currentMonth.getMonth() &&
      taskDate.getDate() === day &&
      taskDate < today
    );
  });
}

function isToday(day: number) {
  const today = new Date();

  return (
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth() &&
    today.getDate() === day
  );
}

async function rescheduleTask(task: any, daysToAdd: number) {
  if (task.task_type === 'service' && !task.scheduled_at) return;
const original = new Date(task.scheduled_at);

// Always normalize time to 8:00 AM
original.setDate(original.getDate() + daysToAdd);
original.setHours(8);
original.setMinutes(0);
original.setSeconds(0);
original.setMilliseconds(0);

const newIso = original.toISOString();

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
  if (task.task_type === 'service' && !task.scheduled_at) return;
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
  if (task.task_type === 'service' && !task.scheduled_at) return;
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

    // 🔵 Set all notes in this phase to incomplete
try {
  const notesRes = await apiFetch(`/api/job/${newTaskJobId}/notes`);
  const notes = notesRes?.notes ?? [];

  const updatedNotes = notes.map((n: any) => {
    if (n.phase !== newTaskPhase) return n;
    if (n.status === 'complete') return n;

    return {
      ...n,
      status: 'incomplete',
    };
  });

  await apiFetch(`/api/job/${newTaskJobId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ notes: updatedNotes }),
  });
} catch (err) {
  console.warn('Failed to mark phase notes incomplete', err);
}
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
    const names =
  phasesRes?.phases?.map((p: any) => p.name) ?? [];

const sorted = [...names].sort((a, b) =>
  a.localeCompare(b)
);

setPhases(sorted);
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

// 🔴 Fetch unscheduled service cases
let serviceCases: any[] = [];
try {
  const scRes = await apiFetch('/api/service-cases?unscheduled=true');
  serviceCases = scRes?.serviceCases ?? [];
} catch {}

// 🔴 Convert unscheduled cases into synthetic tasks
const synthetic = serviceCases.map(sc => ({
  id: `service-${sc.id}`,
  task_type: 'service',
  service_case_id: sc.id,
  job_id: null,
  job_name: sc.property_name,
  crew_id: null,
  crew_name: null,
  phase: null,
  scheduled_at: null,
  status: 'unscheduled',
  service_data: sc,
}));

const merged = [...tasks, ...synthetic];

setScheduledTasks(merged);

await AsyncStorage.setItem(
  'scheduled_tasks_v1',
  JSON.stringify(merged)
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
  // If searching, ignore date restriction
  if (taskSearch.length > 0) {
    return filteredTasks;
  }

  if (!selectedDate) return [];

  const selected = new Date(selectedDate);

  return filteredTasks.filter(t => {
    // 🔴 Unscheduled service shows on every day
    if (!t.scheduled_at && t.task_type === 'service') {
      return true;
    }

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

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={90}
>
  <View style={styles.container}>
    <ScrollView
ref={scrollRef}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="interactive"
  contentContainerStyle={{ paddingBottom: 300 }}
>

<TextInput
  placeholder="Search job, crew, phase..."
  value={taskSearch}
  onChangeText={setTaskSearch}
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  }}
/>

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

<Pressable
  onPress={() =>
    setShowFilterCrewDropdown(!showFilterCrewDropdown)
  }
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  }}
>
  <Text>
    {filterCrewId
      ? sortedCrews.find(c => c.id === filterCrewId)?.name
      : 'All Crews'}
  </Text>
</Pressable>

{showFilterCrewDropdown && (
  <View
    style={{
      borderWidth: 1,
      borderColor: '#eee',
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: '#fff',
    }}
  >
    <Pressable
      onPress={() => {
        setFilterCrewId(null);
        setShowFilterCrewDropdown(false);
      }}
      style={{ padding: 10 }}
    >
      <Text>All Crews</Text>
    </Pressable>

    {sortedCrews.map(c => (
      <Pressable
        key={c.id}
        onPress={() => {
          setFilterCrewId(c.id);
          setShowFilterCrewDropdown(false);
        }}
        style={{ padding: 10 }}
      >
        <Text>{c.name}</Text>
      </Pressable>
    ))}
  </View>
)}
    


{/* PHASE FILTER */}
<Text style={{ fontWeight: '700', marginBottom: 6 }}>
  Phase
</Text>

<Pressable
  onPress={() =>
    setShowFilterPhaseDropdown(!showFilterPhaseDropdown)
  }
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  }}
>
  <Text>
    {filterPhase ?? 'All Phases'}
  </Text>
</Pressable>

{showFilterPhaseDropdown && (
  <View
    style={{
      borderWidth: 1,
      borderColor: '#eee',
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: '#fff',
    }}
  >
    <Pressable
      onPress={() => {
        setFilterPhase(null);
        setShowFilterPhaseDropdown(false);
      }}
      style={{ padding: 10 }}
    >
      <Text>All Phases</Text>
    </Pressable>

    {phases.map(p => (
      <Pressable
        key={p}
        onPress={() => {
          setFilterPhase(p);
          setShowFilterPhaseDropdown(false);
        }}
        style={{ padding: 10 }}
      >
        <Text>{p}</Text>
      </Pressable>
    ))}
  </View>
)}


{/* STATUS FILTER */}
<Text style={{ fontWeight: '700', marginBottom: 6 }}>
  Status
</Text>

<Pressable
  onPress={() =>
    setShowFilterStatusDropdown(!showFilterStatusDropdown)
  }
  style={{
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  }}
>
  <Text>
    {filterStatus ?? 'All Statuses'}
  </Text>
</Pressable>

{showFilterStatusDropdown && (
  <View
    style={{
      borderWidth: 1,
      borderColor: '#eee',
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: '#fff',
    }}
  >
    <Pressable
      onPress={() => {
        setFilterStatus(null);
        setShowFilterStatusDropdown(false);
      }}
      style={{ padding: 10 }}
    >
      <Text>All Statuses</Text>
    </Pressable>

    {['scheduled', 'complete'].map(s => (
      <Pressable
        key={s}
        onPress={() => {
          setFilterStatus(s as any);
          setShowFilterStatusDropdown(false);
        }}
        style={{ padding: 10 }}
      >
        <Text>{s}</Text>
      </Pressable>
    ))}
  </View>
)}


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

  day && hasOverdueTasksOnDate(day)
    ? styles.overdueDay
    : null,

  day && isToday(day)
    ? styles.today
    : null,

  day &&
  selectedDate ===
    new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    ).toISOString()
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

  // 🔵 RESCHEDULE MODE
  if (pendingRescheduleTask) {
    const eightAm = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      8,
      0,
      0,
      0
    );

    setRescheduleTargetDate(eightAm);
    setRescheduleHour(8);
    setRescheduleMinute(0);

    return; // ⬅️ CRITICAL — prevents selectedDate from changing
  }

  // 🟢 Normal selection mode
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
  ref={timeWheelRef}
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
  const base = new Date(rescheduleTargetDate);

  const finalDate = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    rescheduleHour,
    rescheduleMinute,
    0,
    0
  );

  const newIso = finalDate.toISOString();

  // 🔵 SERVICE SCHEDULING
  if (pendingRescheduleTask?.task_type === 'service') {
    try {
      const res = await apiFetch('/api/scheduled-tasks', {
        method: 'POST',
        body: JSON.stringify({
          serviceCaseId: pendingRescheduleTask.service_case_id,
          crewId: newTaskCrewId || crews[0]?.id,
          scheduledAt: newIso,
        }),
      });

const newTask = res?.task;

if (!newTask?.id) return;

// Ensure it's marked correctly as a real scheduled service
const normalized = {
  ...newTask,
  task_type: 'service',
};

const withoutSynthetic = scheduledTasks.filter(
  t => t.id !== pendingRescheduleTask.id
);

const merged = [...withoutSynthetic, normalized];

      setScheduledTasks(merged);
      await AsyncStorage.setItem(
        'scheduled_tasks_v1',
        JSON.stringify(merged)
      );
    } catch (err) {
      console.log('Service scheduling failed', err);
    }

    setPendingRescheduleTask(null);
    setRescheduleTargetDate(null);
    return;
  }

  // 🟢 NORMAL JOB RESCHEDULE
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
  } catch {}

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

{(selectedDate || taskSearch.length > 0) && (
  <View style={{ marginTop: 20 }}>
  
<Text style={styles.dateHeader}>
  {taskSearch.length > 0
    ? `Search Results (${tasksForSelectedDate().length})`
    : selectedDate
      ? `Tasks for ${new Date(selectedDate).toLocaleDateString('en-US')}`
      : ''}
</Text>

<View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
  <Pressable
    onPress={() => setIsCreating(!isCreating)}
  >
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      + Add Task
    </Text>
  </Pressable>

  <Pressable
    onPress={() => router.push('/main/service')}
  >
    <Text style={{ color: '#16a34a', fontWeight: '700' }}>
      + Service
    </Text>
  </Pressable>
</View>

    {isCreating && (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={140}
  >
    <View style={{ marginBottom: 20 }}>
<Text>Select Job:</Text>

<TextInput
  placeholder="Search job..."
  value={jobSearch}
  onChangeText={setJobSearch}
  onFocus={() => {
  setTimeout(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, 250);
}}
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
  Keyboard.dismiss();
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
  </KeyboardAvoidingView>
)}

{tasksForSelectedDate().map(task => (
<Pressable
  key={task.id}
style={[
  styles.card,

  // 🔴 Unscheduled service styling
task.task_type === 'service' && !task.scheduled_at && {
  borderWidth: 2,
  borderColor: '#dc2626', // red border only
},

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

        {task.task_type === 'service' && task.service_data && (
  <View style={{ marginTop: 6 }}>
    {task.service_data.issue && (
      <Text style={styles.meta}>
        Issue: {task.service_data.issue}
      </Text>
    )}

    {task.service_data.owner_name && (
      <Text style={styles.meta}>
        Owner: {task.service_data.owner_name}
      </Text>
    )}

{Array.isArray(task.service_data.contacts) &&
  task.service_data.contacts.map((c: any, i: number) => {
    if (!c?.value) return null;

    const isPhone = c.type === 'phone';
    const isEmail = c.type === 'email';

    return (
      <Pressable
        key={i}
        onPress={() => {
          if (isPhone) {
            Linking.openURL(`tel:${c.value}`);
          }
          if (isEmail) {
            Linking.openURL(`mailto:${c.value}`);
          }
        }}
      >
        <Text
          style={[
            styles.meta,
            { color: '#2563eb', fontWeight: '600' },
          ]}
        >
          {isPhone ? '📞 ' : '✉️ '}
          {c.value}
        </Text>
      </Pressable>
    );
  })}
  </View>
)}

        {task.task_type === 'service' && !task.scheduled_at && (
  <View
    style={{
      alignSelf: 'flex-start',
      marginTop: 6,
      backgroundColor: '#dc2626',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    }}
  >
    <Text
      style={{
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
      }}
    >
      Unscheduled
    </Text>
  </View>
)}

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

  {task.task_type === 'service' && (
  <View style={{ marginBottom: 12 }}>
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        router.push({
          pathname: '/main/service',
          params: {
            serviceCaseId: task.service_case_id,
          },
        });
      }}
    >
      <Text style={{ color: '#2563eb', fontWeight: '700' }}>
        Edit Service
      </Text>
    </Pressable>
  </View>
)}

{task.task_type === 'service' && !task.scheduled_at && (
  <View style={{ marginBottom: 12 }}>
    <Pressable
      onPress={() => {
        setIsCreating(false);
        setSelectedDate(new Date().toISOString());
        setNewTaskCrewId(null);
        setPendingRescheduleTask({
          ...task,
          __scheduleService: true,
        });
      }}
    >
      <Text style={{ color: '#16a34a', fontWeight: '700' }}>
        Schedule Service
      </Text>
    </Pressable>
  </View>
)}

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
    onPress={(e) => {
      e.stopPropagation();
      if (!task.job_id) return;

router.push({
  pathname: '/job/[id]',
  params: {
    id: task.job_id,
    name: task.job_name ?? '',
  },
});
    }}
  >
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      Go To Job
    </Text>
  </Pressable>
</View>

<View style={{ marginTop: 12 }}>
  <Pressable
    onPress={(e) => {
      e.stopPropagation(); // prevent parent Pressable toggle
      console.log('🔥 SEND PRESSED');
      sendScheduleEmail(task);
    }}
    style={{
      paddingVertical: 8,
    }}
  >
    <Text style={{ color: 'red', fontWeight: '700' }}>
      Send To Crew
    </Text>
  </Pressable>
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
      (a.job_name ?? '').localeCompare((b.job_name ?? ''))
    )
    .map(task => (
      <View
        key={task.id}
        onLayout={(e) => {
          taskYPositionsRef.current[task.id] = e.nativeEvent.layout.y;
        }}
        style={[
          styles.card,
          highlightTaskId === task.id && {
            borderWidth: 2,
            borderColor: '#2563eb',
            backgroundColor: '#eff6ff',
          },
        ]}
      >
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
          {new Date(task.scheduled_at).toLocaleString()}
        </Text>

        <View style={{ marginTop: 8 }}>
  <Pressable
    onPress={() => {
      if (!task.job_id) return;

router.push({
  pathname: '/job/[id]',
  params: {
    id: task.job_id,
    name: task.job_name ?? '',
  },
});
    }}
  >
    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
      Go To Job
    </Text>
  </Pressable>
</View>
      </View>
    ))}
    </View>
    </ScrollView>
  </View>
  </KeyboardAvoidingView>
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

today: {
  borderWidth: 2,
  borderColor: '#2563eb',
  borderRadius: 6,
},

overdueDay: {
  borderWidth: 2,
  borderColor: '#dc2626', // red-600
  borderRadius: 6,
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