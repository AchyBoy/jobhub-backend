//JobHub/components/notes/AddNoteBar.tsx
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useState, useRef } from 'react';
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
const submittingRef = useRef(false);
const lastSubmittedRef = useRef<string | null>(null);
  const noPhases = phases.length === 0;
  const noPhaseSelected = !phase;
  const disabled = noPhases || noPhaseSelected;

  function normalizeForCompare(s: string) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

// Removes common dictation duplication:
// "foo bar ... foo bar ..." -> "foo bar ..."
function dedupeDictation(text: string) {
  const cleaned = normalizeForCompare(text);
  if (!cleaned) return cleaned;

  const words = cleaned.split(' ').filter(Boolean);
  const n = words.length;

  // If it's exactly two identical halves, keep one half
  if (n >= 6 && n % 2 === 0) {
    const half = n / 2;
    const a = words.slice(0, half).join(' ');
    const b = words.slice(half).join(' ');
    if (a === b) return a;
  }

  // If it ends with a repeated tail phrase, remove the duplicate tail
  // Example: "... hopefully not hopefully not"
  for (let k = Math.floor(n / 2); k >= 3; k--) {
    const tail1 = words.slice(n - 2 * k, n - k).join(' ');
    const tail2 = words.slice(n - k).join(' ');
    if (tail1 === tail2) {
      return words.slice(0, n - k).join(' ');
    }
  }

  return cleaned;
}

function submit() {
  if (submittingRef.current) return;

  if (noPhases) {
    router.push('/main/phases');
    return;
  }

  if (noPhaseSelected) return;

const trimmed = text.trim();
if (!trimmed) return;

const cleaned = dedupeDictation(trimmed);
if (!cleaned) return;

// 🔒 Prevent double-submit (including Siri finalize event)
if (lastSubmittedRef.current === cleaned) {
  return;
}

submittingRef.current = true;
lastSubmittedRef.current = cleaned;

onAdd(cleaned);

  setText('');

  // release lock shortly after
  setTimeout(() => {
    submittingRef.current = false;
    lastSubmittedRef.current = null;
  }, 500);
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