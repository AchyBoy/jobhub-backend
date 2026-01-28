import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';

type Props = {
  phase: string;
  onPhaseChange: (phase: string) => void;
  onAdd: (text: string) => void;
};

const PHASES = ['Rough', 'Trim', 'Final'];

export default function AddNoteBar({ phase, onPhaseChange, onAdd }: Props) {
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  }

  return (
    <View style={styles.container}>
      {/* Phase selector */}
      <View style={styles.phaseRow}>
        {PHASES.map(p => (
          <Pressable
            key={p}
            onPress={() => onPhaseChange(p)}
            style={[
              styles.phaseButton,
              phase === p && styles.phaseActive,
            ]}
          >
            <Text
              style={[
                styles.phaseText,
                phase === p && styles.phaseTextActive,
              ]}
            >
              {p}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          placeholder={`New ${phase} note`}
          value={text}
          onChangeText={setText}
          style={styles.input}
        />

        <Pressable style={styles.addBtn} onPress={submit}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  phaseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  phaseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },

  phaseActive: {
    backgroundColor: '#2563eb',
  },

  phaseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  phaseTextActive: {
    color: '#fff',
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
