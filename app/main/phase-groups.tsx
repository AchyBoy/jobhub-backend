// JobHub/app/main/phase-groups.tsx

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../src/lib/apiClient';
import { Stack } from 'expo-router';

export default function PhaseGroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await apiFetch('/api/phase-groups');
      setGroups(res?.phaseGroups ?? []);
    } catch {}

    try {
      const p = await apiFetch('/api/phases');
      setPhases(p?.phases?.map((x: any) => x.name) ?? []);
    } catch {}
  }

  async function deleteGroup(id: string) {
    try {
      await apiFetch(`/api/phase-groups/${id}`, {
        method: 'DELETE',
      });
      load();
    } catch {}
  }

  async function saveGroupEdits() {
    if (!editingGroup) return;

    try {
      await apiFetch('/api/phase-groups', {
        method: 'POST',
        body: JSON.stringify({
          basePhase: editingGroup.basePhase,
          children: selectedChildren,
        }),
      });

      setEditingGroup(null);
      load();
    } catch {}
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Phase Groups' }} />

      <ScrollView style={styles.container}>
        {groups.map(g => (
          <View key={g.id} style={styles.card}>
            <Text style={styles.base}>
              Base: {g.basePhase}
            </Text>

            <View style={{ marginTop: 8 }}>
              {g.children?.map((c: string) => (
                <Text key={c} style={styles.child}>
                  • {c}
                </Text>
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  setEditingGroup(g);
                  setSelectedChildren(g.children ?? []);
                }}
              >
                <Text style={styles.edit}>
                  Edit
                </Text>
              </Pressable>

              <Pressable
                onPress={() => deleteGroup(g.id)}
              >
                <Text style={styles.delete}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {editingGroup && (
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modal}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>
              Edit Group: {editingGroup.basePhase}
            </Text>

            {phases
              .filter(p => p !== editingGroup.basePhase)
              .map(p => {
                const selected = selectedChildren.includes(p);

                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      if (selected) {
                        setSelectedChildren(prev =>
                          prev.filter(c => c !== p)
                        );
                      } else {
                        setSelectedChildren(prev => [...prev, p]);
                      }
                    }}
                    style={{ paddingVertical: 6 }}
                  >
                    <Text style={{ fontWeight: selected ? '700' : '400' }}>
                      {selected ? '✓ ' : ''}{p}
                    </Text>
                  </Pressable>
                );
              })}

            <View style={{ flexDirection: 'row', marginTop: 16, gap: 20 }}>
              <Pressable onPress={() => setEditingGroup(null)}>
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable onPress={saveGroupEdits}>
                <Text style={{ color: '#16a34a', fontWeight: '700' }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  base: {
    fontWeight: '700',
    fontSize: 16,
  },
  child: {
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 20,
  },
  edit: {
    color: '#2563eb',
    fontWeight: '700',
  },
  delete: {
    color: '#dc2626',
    fontWeight: '700',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
});