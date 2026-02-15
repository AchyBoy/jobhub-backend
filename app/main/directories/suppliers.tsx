//Jobhub/app/main/directories/suppliers.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../src/lib/apiClient';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    loadSuppliers();
    setTimeout(() => flushSyncQueue(), 50);
  }, []);

  async function loadSuppliers() {
    const local = await AsyncStorage.getItem('suppliers_v1');
    if (local) setSuppliers(JSON.parse(local));

    try {
      const res = await apiFetch('/api/suppliers');
      const list = res?.suppliers ?? [];
      setSuppliers(list);
      await AsyncStorage.setItem('suppliers_v1', JSON.stringify(list));
    } catch {}
  }

async function createSupplier() {
  if (!newName) return;

  const supplierId = makeId();

  const contacts = [];

if (newEmail) {
  contacts.push({
    id: `${makeId()}-email`,
    type: 'email',
    label: 'Primary',
    value: newEmail,
  });
}

if (newPhone) {
  contacts.push({
    id: `${makeId()}-phone`,
    type: 'phone',
    label: 'Main',
    value: newPhone,
  });
}

  const localSupplier = {
    id: supplierId,
    name: newName,
    isInternal: false,
    contacts,
  };

  const updated = [localSupplier, ...suppliers];
  setSuppliers(updated);
  await AsyncStorage.setItem('suppliers_v1', JSON.stringify(updated));

  try {
    await apiFetch('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(localSupplier),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'supplier_upsert',
      coalesceKey: `supplier_upsert:${supplierId}`,
      createdAt: nowIso(),
      payload: localSupplier,
    });
  }

  flushSyncQueue();

  setNewName('');
  setNewEmail('');
  setNewPhone('');
}

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        <Text style={styles.title}>Suppliers</Text>

        <View style={styles.card}>
          <TextInput
            placeholder="Supplier name"
            value={newName}
            onChangeText={setNewName}
            style={styles.input}
          />

          <TextInput
            placeholder="Email (optional)"
            value={newEmail}
            onChangeText={setNewEmail}
            style={styles.input}
          />

          <TextInput
            placeholder="Phone (optional)"
            value={newPhone}
            onChangeText={setNewPhone}
            style={styles.input}
          />

          <Pressable onPress={createSupplier}>
            <Text style={styles.addBtn}>Add Supplier</Text>
          </Pressable>
        </View>

{suppliers.map(s => (
  <View key={s.id} style={styles.card}>
    <Text style={styles.itemTitle}>{s.name}</Text>

{Array.isArray(s.contacts) &&
  s.contacts.map((c: any, index: number) => (
    <Text key={`${c.id}-${index}`} style={styles.meta}>
      {c.type}: {c.value}
    </Text>
  ))
}
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
  addBtn: { color: 'green', fontWeight: '700', marginTop: 8 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, opacity: 0.7 },
});