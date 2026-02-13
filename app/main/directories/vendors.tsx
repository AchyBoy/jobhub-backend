//Jobhub/app/main/directories/vendors.tsx
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

type Vendor = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function VendorsScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const prevRef = useRef<Vendor[]>([]);
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
      const cached = await AsyncStorage.getItem('vendors_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        setVendors(parsed);
        prevRef.current = parsed;
      }

      const res = await apiFetch('/api/vendors');
      const remote = res.vendors ?? [];

      setVendors(remote);
      prevRef.current = remote;

      await AsyncStorage.setItem(
        'vendors_v1',
        JSON.stringify(remote)
      );
    } catch {
      console.warn('Using cached vendors');
    }
  }

  async function addVendor() {
    if (!newName.trim()) return;

    const id = Date.now().toString();

    await apiFetch('/api/vendors', {
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
    const vendor = vendors.find(v => v.id === id);
    if (!vendor) return;

    const contactId = Date.now().toString();

    await apiFetch('/api/vendors', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: vendor.name,
        contacts: [
          ...vendor.contacts,
          { id: contactId, type, value: '' },
        ],
      }),
    });

    await load();
  }

  function updateContact(
    vendorId: string,
    contactId: string,
    value: string
  ) {
    setVendors(prev => {
      const updated = prev.map(v =>
        v.id === vendorId
          ? {
              ...v,
              contacts: v.contacts.map(ct =>
                ct.id === contactId
                  ? { ...ct, value }
                  : ct
              ),
            }
          : v
      );

      prevRef.current = updated;
      return updated;
    });

    triggerAutosave(vendorId);
  }

  function triggerAutosave(vendorId: string) {
    if (saveTimers.current[vendorId]) {
      clearTimeout(saveTimers.current[vendorId]);
    }

    setSaveState(prev => ({
      ...prev,
      [vendorId]: 'saving',
    }));

    saveTimers.current[vendorId] = setTimeout(
      async () => {
        const vendor = prevRef.current.find(
          v => v.id === vendorId
        );
        if (!vendor) return;

        await apiFetch('/api/vendors', {
          method: 'POST',
          body: JSON.stringify(vendor),
        });

        await AsyncStorage.setItem(
          'vendors_v1',
          JSON.stringify(prevRef.current)
        );

        setSaveState(prev => ({
          ...prev,
          [vendorId]: 'saved',
        }));

        setTimeout(() => {
          setSaveState(prev => {
            const { [vendorId]: _, ...rest } =
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
      <Text style={styles.title}>Vendors</Text>

      <View style={styles.addRow}>
        <TextInput
          placeholder="Vendor name"
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
        />
        <Pressable style={styles.addBtn} onPress={addVendor}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView>
        {vendors.map(vendor => (
          <View key={vendor.id} style={styles.card}>
            <Pressable
              onPress={() =>
                setExpanded(prev =>
                  prev === vendor.id
                    ? null
                    : vendor.id
                )
              }
            >
              <Text style={styles.name}>
                {vendor.name}
              </Text>
            </Pressable>

            {expanded === vendor.id && (
              <View style={{ marginTop: 10 }}>
                {vendor.contacts.map(contact => (
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
                        vendor.id,
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
                      addContact(vendor.id, 'phone')
                    }
                  >
                    <Text style={styles.link}>
                      + Phone
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      addContact(vendor.id, 'email')
                    }
                  >
                    <Text style={styles.link}>
                      + Email
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: 18 }}>
                  {saveState[vendor.id] && (
                    <Text style={{ fontSize: 12, opacity: 0.5 }}>
                      {saveState[vendor.id] ===
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
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
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
  addBtnText: { color: '#fff', fontWeight: '600' },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  name: { fontSize: 18, fontWeight: '600' },
  contactBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  link: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});