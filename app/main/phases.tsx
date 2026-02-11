//JobHub/app/main/phases.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { apiFetch } from '../../src/lib/apiClient';

type Phase = {
  id: string;
  name: string;
  position: number;
  active: boolean;
};

export default function PhaseScreen() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [newPhase, setNewPhase] = useState('');

  useEffect(() => {
    loadPhases();
  }, []);

  async function loadPhases() {
    const res = await apiFetch('/api/phases');
    setPhases(res?.phases ?? []);
  }

  async function addPhase() {
    if (!newPhase.trim()) return;

    await apiFetch('/api/phases', {
      method: 'POST',
      body: JSON.stringify({ name: newPhase }),
    });

    setNewPhase('');
    loadPhases();
  }

  async function deletePhase(id: string) {
    await apiFetch(`/api/phases/${id}`, {
      method: 'DELETE',
    });

    loadPhases();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Phases</Text>

      <View style={styles.addRow}>
        <TextInput
          value={newPhase}
          onChangeText={setNewPhase}
          placeholder="New phase name"
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addPhase}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      <ScrollView style={{ marginTop: 20 }}>
        {phases.map(p => (
          <View key={p.id} style={styles.phaseRow}>
            <Text style={{ fontSize: 16 }}>{p.name}</Text>

            <Pressable onPress={() => deletePhase(p.id)}>
              <Text style={{ color: '#b91c1c', fontWeight: '600' }}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  addBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 10,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
});