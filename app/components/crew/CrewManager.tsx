import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

type Crew = {
  id: string;
  name: string;
  email: string;
};

export default function CrewManager({
  jobId,
  onSelect,
}: {
  jobId: string;
  onSelect: (crew: Crew) => void;
}) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadCrews();
  }, []);

  async function loadCrews() {
    const stored = await AsyncStorage.getItem(`job:${jobId}:crews`);
    if (stored) setCrews(JSON.parse(stored));
  }

  async function addCrew() {
    if (!name || !email) return;

    const newCrew: Crew = {
      id: Date.now().toString(),
      name,
      email,
    };

    const updated = [...crews, newCrew];
    setCrews(updated);
    setName('');
    setEmail('');

    await AsyncStorage.setItem(
      `job:${jobId}:crews`,
      JSON.stringify(updated)
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crews</Text>

      {crews.map(c => (
        <Pressable key={c.id} onPress={() => onSelect(c)}>
          <Text style={styles.crewItem}>{c.name} — {c.email}</Text>
        </Pressable>
      ))}

      <TextInput
        placeholder="Crew name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        placeholder="Crew email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={styles.input}
      />

      <Pressable onPress={addCrew} style={styles.addBtn}>
        <Text style={styles.addText}>Add Crew</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  crewItem: { paddingVertical: 6, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  addBtn: { marginTop: 10, alignItems: 'flex-end' },
  addText: { fontWeight: '600', color: '#2563eb' },
});
