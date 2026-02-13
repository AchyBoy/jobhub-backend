//Jobhub/app/main/directories/inspections.tsx
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';

type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type Inspection = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function InspectionsScreen() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const prevRef = useRef<Inspection[]>([]);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, any>>({});
  const [saveState, setSaveState] =
    useState<Record<string, 'saving' | 'saved'>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const cached = await AsyncStorage.getItem('inspections_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        setInspections(parsed);
        prevRef.current = parsed;
      }

      const res = await apiFetch('/api/inspections');
      const remote = res.inspections ?? [];

      setInspections(remote);
      prevRef.current = remote;

      await AsyncStorage.setItem(
        'inspections_v1',
        JSON.stringify(remote)
      );
    } catch {
      console.warn('Using cached inspections');
    }
  }

  async function addInspection() {
    if (!newName.trim()) return;

    const id = Date.now().toString();

    await apiFetch('/api/inspections', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: newName.trim(),
        contacts: [],
      }),
    });

    setNewName('');
    await load();
  }

  async function addContact(id: string, type: 'phone' | 'email') {
    const inspection = inspections.find(i => i.id === id);
    if (!inspection) return;

    const contactId = Date.now().toString();

    await apiFetch('/api/inspections', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: inspection.name,
        contacts: [
          ...inspection.contacts,
          { id: contactId, type, value: '' },
        ],
      }),
    });

    await load();
  }

  function updateContact(
    inspectionId: string,
    contactId: string,
    value: string
  ) {
    setInspections(prev => {
      const updated = prev.map(i =>
        i.id === inspectionId
          ? {
              ...i,
              contacts: i.contacts.map(ct =>
                ct.id === contactId
                  ? { ...ct, value }
                  : ct
              ),
            }
          : i
      );

      prevRef.current = updated;
      return updated;
    });

    triggerAutosave(inspectionId);
  }

  function triggerAutosave(inspectionId: string) {
    if (saveTimers.current[inspectionId]) {
      clearTimeout(saveTimers.current[inspectionId]);
    }

    setSaveState(prev => ({
      ...prev,
      [inspectionId]: 'saving',
    }));

    saveTimers.current[inspectionId] = setTimeout(
      async () => {
        const inspection = prevRef.current.find(
          i => i.id === inspectionId
        );
        if (!inspection) return;

        await apiFetch('/api/inspections', {
          method: 'POST',
          body: JSON.stringify(inspection),
        });

        await AsyncStorage.setItem(
          'inspections_v1',
          JSON.stringify(prevRef.current)
        );

        setSaveState(prev => ({
          ...prev,
          [inspectionId]: 'saved',
        }));

        setTimeout(() => {
          setSaveState(prev => {
            const { [inspectionId]: _, ...rest } =
              prev;
            return rest;
          });
        }, 1500);
      },
      600
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inspection Companies</Text>

      <View style={styles.addRow}>
        <TextInput
          placeholder="Inspection company name"
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addInspection}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView>
        {inspections.map(inspection => (
          <View key={inspection.id} style={styles.card}>
            <Pressable
              onPress={() =>
                setExpanded(prev =>
                  prev === inspection.id
                    ? null
                    : inspection.id
                )
              }
            >
              <Text style={styles.name}>
                {inspection.name}
              </Text>
            </Pressable>

            {expanded === inspection.id && (
              <View style={{ marginTop: 10 }}>
                {inspection.contacts.map(contact => (
                  <TextInput
                    key={contact.id}
                    placeholder={
                      contact.type === 'phone'
                        ? 'Phone'
                        : 'Email'
                    }
                    value={contact.value}
                    onChangeText={text =>
                      updateContact(
                        inspection.id,
                        contact.id,
                        text
                      )
                    }
                    style={styles.input}
                  />
                ))}

                <View style={styles.contactBtns}>
                  <Pressable
                    onPress={() =>
                      addContact(inspection.id, 'phone')
                    }
                  >
                    <Text style={styles.link}>
                      + Phone
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      addContact(inspection.id, 'email')
                    }
                  >
                    <Text style={styles.link}>
                      + Email
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: 18 }}>
                  {saveState[inspection.id] && (
                    <Text style={{ fontSize: 12, opacity: 0.5 }}>
                      {saveState[inspection.id] ===
                      'saving'
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
    padding: 20,
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
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});