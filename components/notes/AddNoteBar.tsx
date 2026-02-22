//JobHub/components/notes/AddNoteBar.tsx
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

type Props = {
  phases: string[];
  phase: string;
  onPhaseChange: (phase: string) => void;
  onAdd: (text: string) => void;
};

export default function AddNoteBar({
  phases,
  phase,
  onPhaseChange,
  onAdd,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const noPhases = phases.length === 0;
  const noPhaseSelected = !phase;
  const disabled = noPhases || noPhaseSelected;

  function submit() {
    if (noPhases) {
      router.push('/main/phases');
      return;
    }

    if (noPhaseSelected) return;
    if (!text.trim()) return;

    onAdd(text.trim());
    setText('');
  }

  return (
    <View style={styles.container}>
      {/* PHASE DROPDOWN */}
      <View style={{ marginBottom: 12 }}>
        <Pressable
          onPress={() => setShowDropdown(v => !v)}
          style={styles.dropdownButton}
        >
          <Text style={styles.dropdownText}>
            {noPhases
              ? 'No Phases Configured'
              : noPhaseSelected
              ? 'Choose Phase'
              : phase}
          </Text>
        </Pressable>

        {showDropdown && (
          <View style={styles.dropdownMenu}>
            <ScrollView>
              {phases.map(p => (
                <Pressable
                  key={p}
                  onPress={() => {
                    onPhaseChange(p);
                    setShowDropdown(false);
                  }}
                  style={styles.dropdownItem}
                >
                  <Text style={{ fontWeight: phase === p ? '700' : '500' }}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* INPUT ROW */}
      <View style={styles.inputRow}>
        <TextInput
          placeholder={`New ${phase || ''} note`}
          value={text}
          onChangeText={setText}
          style={styles.input}
        />

        <Pressable
          style={[
            styles.addBtn,
            disabled && {
              backgroundColor: noPhases ? '#dc2626' : '#9ca3af',
            },
          ]}
          onPress={submit}
        >
          <Text style={styles.addText}>
            {noPhases
              ? 'No Phases'
              : noPhaseSelected
              ? 'Choose'
              : 'Add'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  dropdownButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },

  dropdownText: {
    fontWeight: '600',
  },

  dropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 200,
  },

  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },

  addBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#111',
  },

  addText: {
    color: '#fff',
    fontWeight: '700',
  },
});