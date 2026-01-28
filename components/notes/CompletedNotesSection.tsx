import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';

export default function CompletedNotesSection({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginTop: 30 }}>
      <Pressable onPress={() => setOpen(!open)} style={styles.header}>
        <Text style={styles.title}>
          Completed Notes ({count})
        </Text>
        <Text style={styles.toggle}>
          {open ? 'Hide' : 'Show'}
        </Text>
      </Pressable>

      {open && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
  },

  toggle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});
