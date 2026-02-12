// JobHub/app/main/directories/crews.tsx

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../../src/lib/apiClient';

type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type Crew = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function CrewsScreen() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const prevCrewsRef = useRef<Crew[]>([]);
  const [newCrewName, setNewCrewName] = useState('');
  const [expandedCrew, setExpandedCrew] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, any>>({});
  const [saveStateByCrew, setSaveStateByCrew] =
  useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  async function loadCrews() {
  try {
    const res = await apiFetch('/api/crews');
    setCrews(res.crews ?? []);
prevCrewsRef.current = res.crews ?? [];
  } catch (err) {
    console.warn('Failed to load crews', err);
  }
}

useEffect(() => {
  loadCrews();
}, []);

async function addCrew() {
  if (!newCrewName.trim()) return;

  const id = Date.now().toString();

  try {
    await apiFetch('/api/crews', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: newCrewName.trim(),
        contacts: [],
      }),
    });

    setNewCrewName('');
    await loadCrews();
  } catch (err) {
    console.warn('Failed to save crew', err);
  }
}

async function addContact(
  crewId: string,
  type: 'phone' | 'email'
) {
  const contactId = Date.now().toString();

  try {
    await apiFetch('/api/crews', {
      method: 'POST',
      body: JSON.stringify({
        id: crewId,
        name: crews.find(c => c.id === crewId)?.name,
        contacts: [
          ...(crews.find(c => c.id === crewId)?.contacts ?? []),
          {
            id: contactId,
            type,
            label: '',
            value: '',
          },
        ],
      }),
    });

    await loadCrews();
  } catch (err) {
    console.warn('Failed to add contact', err);
  }
}

function updateContact(
  crewId: string,
  contactId: string,
  value: string
) {
  setCrews(prev => {
    const updated = prev.map(c => {
      if (c.id !== crewId) return c;
      return {
        ...c,
        contacts: c.contacts.map(ct =>
          ct.id === contactId ? { ...ct, value } : ct
        ),
      };
    });

    prevCrewsRef.current = updated;
    return updated;
  });

  triggerAutosave(crewId);
}

function triggerAutosave(crewId: string) {
  // Clear previous timer
if (saveTimers.current[crewId]) {
  clearTimeout(saveTimers.current[crewId]);
}

  setSaveStateByCrew(prev => ({
    ...prev,
    [crewId]: 'saving',
  }));

saveTimers.current[crewId] = setTimeout(async () => {
  const crew = (prevCrewsRef.current || []).find(c => c.id === crewId);
  if (!crew) return;

    try {
      await apiFetch('/api/crews', {
        method: 'POST',
        body: JSON.stringify({
          id: crew.id,
          name: crew.name,
          contacts: crew.contacts,
        }),
      });

      setSaveStateByCrew(prev => ({
        ...prev,
        [crewId]: 'saved',
      }));

      setTimeout(() => {
        setSaveStateByCrew(prev => {
          const { [crewId]: _, ...rest } = prev;
          return rest;
        });
      }, 1500);
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }, 600); // 600ms debounce
}

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.title}>Crews</Text>

      {/* Add Crew */}
      <View style={styles.addRow}>
        <TextInput
          placeholder="Crew name"
          value={newCrewName}
          onChangeText={setNewCrewName}
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addCrew}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {crews.map(crew => (
          <View key={crew.id} style={styles.card}>
            <Pressable
              onPress={() =>
                setExpandedCrew(prev =>
                  prev === crew.id ? null : crew.id
                )
              }
            >
              <Text style={styles.crewName}>
                {crew.name}
              </Text>
            </Pressable>

            {expandedCrew === crew.id && (
              <View style={{ marginTop: 12 }}>
                {crew.contacts.map(contact => (
                  <TextInput
                    key={contact.id}
                    placeholder={
                      contact.type === 'phone'
                        ? 'Phone number'
                        : 'Email address'
                    }
                    value={contact.value}
                    onChangeText={text =>
                      updateContact(
                        crew.id,
                        contact.id,
                        text
                      )
                    }
                    style={styles.input}
                  />
                ))}

<View style={styles.contactBtns}>
  <Pressable
    style={styles.contactAdd}
    onPress={() =>
      addContact(crew.id, 'phone')
    }
  >
    <Text style={styles.contactAddText}>
      + Phone
    </Text>
  </Pressable>

  <Pressable
    style={styles.contactAdd}
    onPress={() =>
      addContact(crew.id, 'email')
    }
  >
    <Text style={styles.contactAddText}>
      + Email
    </Text>
  </Pressable>
</View>

<View style={{ height: 18, marginTop: 6 }}>
  {saveStateByCrew[crew.id] && (
    <Text style={{ fontSize: 12, opacity: 0.5 }}>
      {saveStateByCrew[crew.id] === 'saving'
        ? 'saving…'
        : 'saved'}
    </Text>
  )}
</View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    marginBottom: 8,
  },
  addBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  crewName: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  contactAdd: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
  },
  contactAddText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});