//JobHub/app/job/[id]/materials.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function MaterialsScreen() {
  const { id } = useLocalSearchParams();
  const jobId = id as string;
const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [newName, setNewName] = useState('');
  const [newPhase, setNewPhase] = useState<string | null>(null);
  const [newSupplierId, setNewSupplierId] = useState<string | null>(null);
  const materialsByPhase = materials.reduce((acc: any, m: any) => {
  if (!acc[m.phase]) acc[m.phase] = [];
  acc[m.phase].push(m);
  return acc;
}, {});

  useEffect(() => {
    loadMaterials();
    loadPhases();
    loadSuppliers();

    setTimeout(() => flushSyncQueue(), 50);
  }, [jobId]);

  async function loadMaterials() {
    const key = `job:${jobId}:materials`;

    const local = await AsyncStorage.getItem(key);
    if (local) setMaterials(JSON.parse(local));

    try {
      const res = await apiFetch(`/api/materials?jobId=${jobId}`);
      const list = res?.materials ?? [];
      setMaterials(list);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }

  async function loadPhases() {
    const local = await AsyncStorage.getItem('phases');
    if (local) setPhases(JSON.parse(local));

    try {
      const res = await apiFetch('/api/phases');
      const names = res?.phases?.map((p: any) => p.name) ?? [];
      setPhases(names);
      await AsyncStorage.setItem('phases', JSON.stringify(names));
    } catch {}
  }

  async function loadSuppliers() {
    try {
      const res = await apiFetch('/api/suppliers');
      setSuppliers(res?.suppliers ?? []);
    } catch {}
  }

  async function createMaterial() {
    if (!newName || !newPhase) return;

    const localMaterial = {
      id: makeId(),
      job_id: jobId,
      item_name: newName,
      phase: newPhase,
      supplier_id: newSupplierId,
      qty_needed: 0,
      status: 'draft',
    };

    const updated = [...materials, localMaterial];
    setMaterials(updated);
    await AsyncStorage.setItem(
      `job:${jobId}:materials`,
      JSON.stringify(updated)
    );

    try {
      await apiFetch('/api/materials', {
        method: 'POST',
        body: JSON.stringify({
          id: localMaterial.id,
          jobId,
          itemName: newName,
          phase: newPhase,
          supplierId: newSupplierId,
          qtyNeeded: 0,
        }),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'material_create',
        coalesceKey: `material_create:${localMaterial.id}`,
        createdAt: nowIso(),
        payload: {
          ...localMaterial,
        },
      });
    }

    flushSyncQueue();
    setNewName('');
  }

  async function updateQty(material: any, delta: number) {
    const updated = materials.map(m =>
      m.id === material.id
        ? { ...m, qty_needed: Math.max(0, m.qty_needed + delta) }
        : m
    );

    setMaterials(updated);
    await AsyncStorage.setItem(
      `job:${jobId}:materials`,
      JSON.stringify(updated)
    );

    try {
      await apiFetch(`/api/materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          qtyNeeded: Math.max(0, material.qty_needed + delta),
        }),
      });
    } catch {
      await enqueueSync({
        id: makeId(),
        type: 'material_update',
        coalesceKey: `material_update:${material.id}`,
        createdAt: nowIso(),
        payload: {
          materialId: material.id,
          qtyNeeded: Math.max(0, material.qty_needed + delta),
        },
      });
    }

    flushSyncQueue();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        <Text style={styles.title}>Materials</Text>

        {/* CREATE */}
        <View style={styles.card}>
          <TextInput
            placeholder="Item name"
            value={newName}
            onChangeText={setNewName}
            style={styles.input}
          />

          <Text style={styles.label}>Phase</Text>
          {phases.map(p => (
            <Pressable key={p} onPress={() => setNewPhase(p)}>
              <Text style={newPhase === p ? styles.selected : undefined}>
                {p}
              </Text>
            </Pressable>
          ))}

          <Text style={styles.label}>Supplier</Text>
          {suppliers.map(s => (
            <Pressable key={s.id} onPress={() => setNewSupplierId(s.id)}>
              <Text style={newSupplierId === s.id ? styles.selected : undefined}>
                {s.name}
              </Text>
            </Pressable>
          ))}

          <Pressable onPress={createMaterial}>
            <Text style={styles.addBtn}>Add Material</Text>
          </Pressable>
        </View>

{/* LIST GROUPED BY PHASE */}
{Object.keys(materialsByPhase).map(phase => (
  <View key={phase} style={{ marginBottom: 16 }}>

    {/* Phase Header */}
    <Pressable
      onPress={() =>
        setExpandedPhases(prev => ({
          ...prev,
          [phase]: !prev[phase],
        }))
      }
      style={{
        backgroundColor: '#dbeafe',
        padding: 12,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16 }}>
        {phase} {expandedPhases[phase] ? '▲' : '▼'}
      </Text>
    </Pressable>

    {/* Phase Materials */}
    {expandedPhases[phase] &&
      materialsByPhase[phase].map((material: any) => (
        <View key={material.id} style={styles.card}>
          <Text style={styles.itemTitle}>
            {material.item_name}
          </Text>

          <Text style={styles.meta}>
            Qty Needed: {material.qty_needed}
          </Text>

          <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
            <Pressable onPress={() => updateQty(material, -1)}>
              <Text style={styles.qtyBtn}>−</Text>
            </Pressable>

            <Pressable onPress={() => updateQty(material, 1)}>
              <Text style={styles.qtyBtn}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}
  </View>
))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  label: { fontWeight: '700', marginTop: 8 },
  selected: { color: '#2563eb', fontWeight: '700' },
  addBtn: { color: 'green', fontWeight: '700', marginTop: 12 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, opacity: 0.7 },
  qtyBtn: { fontSize: 20, fontWeight: '700' },
});