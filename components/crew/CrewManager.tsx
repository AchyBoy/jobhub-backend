//JobHub/components/crew/CrewManager.tsx
import { View, Text, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Crew = {
  id?: string;
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

useEffect(() => {
  loadCrews();
}, [jobId]);

async function loadCrews() {
  const stored = await AsyncStorage.getItem('crews_v1');
  if (!stored) return;
  setCrews(JSON.parse(stored));
}

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>
        Send crew link:
      </Text>

      {crews.length === 0 && (
        <Text style={{ opacity: 0.5, marginBottom: 6 }}>
          No crews added yet
        </Text>
      )}

      {crews.map(crew => (
        <Pressable
          key={crew.id ?? crew.email ?? JSON.stringify(crew)}
          onPress={() => onSelect(crew)}
          style={{ paddingVertical: 6 }}
        >
          <Text>{crew.name} ({crew.email})</Text>
        </Pressable>
      ))}
    </View>
  );
}
