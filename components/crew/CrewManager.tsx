//JobHub/components/crew/CrewManager.tsx
import { View, Text, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Contact = {
  id: string;
  type: 'phone' | 'email';
  label?: string;
  value: string;
};

type CrewSelection = {
  id: string;
  name: string;
  email: string;
};

type Crew = {
  id: string;
  name: string;
  contacts: Contact[];
};

export default function CrewManager({
  jobId,
  onSelect,
}: {
  jobId: string;
  onSelect: (crew: CrewSelection) => void;
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

{crews.map(crew => {
  const emailContact = crew.contacts?.find(
    c => c.type === 'email' && c.value?.trim()
  );

  const email = emailContact?.value ?? '';

  return (
    <Pressable
      key={crew.id}
      onPress={() =>
        onSelect({
          id: crew.id,
          name: crew.name,
          email,
        })
      }
      style={{ paddingVertical: 6 }}
    >
      <Text>
        {crew.name}
        {email ? ` (${email})` : ' (No email)'}
      </Text>
    </Pressable>
  );
})}
    </View>
  );
}
