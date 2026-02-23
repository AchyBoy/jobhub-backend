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
import { Stack } from 'expo-router';
import { enqueueSync, flushSyncQueue, makeId, nowIso } from '../../../src/lib/syncEngine';

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

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
  if (!newName.trim()) return;

  const id = Date.now().toString();

  const newSupplier = {
    id,
    name: newName.trim(),
    contacts: [],
    isInternal: false,
  };

  const updated = [newSupplier, ...suppliers];

  setSuppliers(updated);
  setNewName('');

  await AsyncStorage.setItem(
    'suppliers_v1',
    JSON.stringify(updated)
  );

  try {
    await apiFetch('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(newSupplier),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'supplier_upsert',
      coalesceKey: `supplier_upsert:${id}`,
      createdAt: nowIso(),
      payload: newSupplier,
    });
  }

  flushSyncQueue();
}

async function addContact(id: string, type: 'phone' | 'email') {
  const contactId = Date.now().toString();

  const updated = suppliers.map(s =>
    s.id === id
      ? {
          ...s,
          contacts: [
            ...s.contacts,
            { id: contactId, type, value: '' },
          ],
        }
      : s
  );

  setSuppliers(updated);

  await AsyncStorage.setItem(
    'suppliers_v1',
    JSON.stringify(updated)
  );

  const supplierToSync = updated.find(s => s.id === id);

  try {
    await apiFetch('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierToSync),
    });
  } catch {
    await enqueueSync({
      id: makeId(),
      type: 'supplier_upsert',
      coalesceKey: `supplier_upsert:${id}`,
      createdAt: nowIso(),
      payload: supplierToSync,
    });
  }

  flushSyncQueue();
}

  return (
  <>
    <Stack.Screen
      options={{
        title: 'Suppliers',
        headerShadowVisible: false,
      }}
    />

    <SafeAreaView
      style={styles.container}
      edges={['left','right','bottom']}
    >
      <ScrollView
  keyboardShouldPersistTaps="handled"
  contentContainerStyle={{ paddingBottom: 60 }}
>

<View style={styles.addRow}>
  <TextInput
    placeholder="Supplier name"
    value={newName}
    onChangeText={setNewName}
    style={styles.input}
  />

  <Pressable
    style={styles.addBtn}
    onPress={createSupplier}
  >
    <Text style={styles.addBtnText}>Add</Text>
  </Pressable>
</View>

{suppliers.map(supplier => (
  <View key={supplier.id} style={styles.card}>
    <Pressable
      onPress={() =>
        setExpanded(prev =>
          prev === supplier.id
            ? null
            : supplier.id
        )
      }
    >
      <Text style={styles.itemTitle}>
        {supplier.name}
      </Text>

      {expanded !== supplier.id && (
        <Text
          style={{
            fontSize: 12,
            opacity: 0.5,
            marginTop: 4,
          }}
        >
          Tap to edit supplier details
        </Text>
      )}
    </Pressable>

    {expanded === supplier.id && (
      <View style={{ marginTop: 10 }}>
        {supplier.contacts.map((contact: any) => (
          <TextInput
            key={contact.id}
            placeholder={
              contact.type === 'phone'
                ? 'Phone'
                : 'Email'
            }
            value={contact.value}
            onChangeText={async text => {
              const updated = suppliers.map(sp =>
                sp.id === supplier.id
                  ? {
                      ...sp,
                      contacts: sp.contacts.map((ct: any) =>
                        ct.id === contact.id
                          ? { ...ct, value: text }
                          : ct
                      ),
                    }
                  : sp
              );

              setSuppliers(updated);

              await AsyncStorage.setItem(
                'suppliers_v1',
                JSON.stringify(updated)
              );

              try {
                await apiFetch('/api/suppliers', {
                  method: 'POST',
                  body: JSON.stringify(
                    updated.find(x => x.id === supplier.id)
                  ),
                });
              } catch {
                await enqueueSync({
                  id: makeId(),
                  type: 'supplier_upsert',
                  coalesceKey: `supplier_upsert:${supplier.id}`,
                  createdAt: nowIso(),
                  payload: updated.find(
                    x => x.id === supplier.id
                  ),
                });
              }

              flushSyncQueue();
            }}
            style={styles.input}
          />
        ))}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable
            onPress={() =>
              addContact(supplier.id, 'phone')
            }
          >
            <Text style={styles.link}>
              + Phone
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              addContact(supplier.id, 'email')
            }
          >
            <Text style={styles.link}>
              + Email
            </Text>
          </Pressable>
        </View>
      </View>
    )}
  </View>
))}

      </ScrollView>
    </SafeAreaView>
      </>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
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

  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  link: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});