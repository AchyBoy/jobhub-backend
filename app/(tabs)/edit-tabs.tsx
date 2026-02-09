import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

type TabItem = {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
};

export default function EditTabsScreen() {
  const router = useRouter();
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [version, setVersion] = useState('0');

  useEffect(() => {
    loadTabs();
  }, []);

async function loadTabs() {
  const [[, tabData], [, versionData]] = await AsyncStorage.multiGet([
    'tabConfig',
    'tabConfigVersion',
  ]);

  if (tabData) {
    setTabs(JSON.parse(tabData));
  }

  if (versionData) {
    setVersion(versionData);
  }
}

  async function saveTabs(updated: TabItem[]) {
  setTabs(updated);

  await AsyncStorage.multiSet([
    ['tabConfig', JSON.stringify(updated)],
    ['tabConfigVersion', Date.now().toString()], // 👈 CRITICAL
  ]);
}

  function toggleTab(key: string) {
    const updated = tabs.map(t =>
      t.key === key ? { ...t, enabled: !t.enabled } : t
    );
    saveTabs(updated);
  }

  function moveTab(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tabs.length) return;

    const updated = [...tabs];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    saveTabs(updated);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customize Tabs</Text>

      <FlatList
        data={tabs}
        keyExtractor={item => item.key}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Pressable onPress={() => toggleTab(item.key)}>
              <Text
                style={[
                  styles.label,
                  !item.enabled && styles.disabled,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>

            <View style={styles.controls}>
              <Pressable onPress={() => moveTab(index, -1)}>
                <Text style={styles.arrow}>↑</Text>
              </Pressable>
              <Pressable onPress={() => moveTab(index, 1)}>
                <Text style={styles.arrow}>↓</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

<Pressable
  style={styles.done}
  onPress={() => {
    router.replace('/main');
  }}
>
  <Text style={styles.doneText}>Done</Text>
</Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  row: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
    textDecorationLine: 'line-through',
  },
  controls: {
    flexDirection: 'row',
    gap: 14,
  },
  arrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  done: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 10,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});