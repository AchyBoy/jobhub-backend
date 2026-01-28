import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';

type TabItem = {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
};

export default function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [tabs, setTabs] = useState<TabItem[]>([]);

  useEffect(() => {
    loadTabs();
  }, []);

  async function loadTabs() {
    const stored = await AsyncStorage.getItem('tabConfig');
    if (stored) {
      setTabs(JSON.parse(stored));
    }
  }

  function goTo(tabKey: string) {
    router.push(`/(tabs)/${tabKey}`);
  }

  return (
    <View style={styles.bar}>
      {tabs
        .filter(t => t.enabled)
        .map(tab => {
          const active = pathname.includes(tab.key);

          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(tab.key)}
              onLongPress={() => router.push('/(tabs)/edit-tabs')}
              style={styles.item}
            >
              <Ionicons
                name={tab.icon as any}
                size={24}
                color={active ? '#1976d2' : '#555'}
              />
              <Text style={[styles.label, active && styles.active]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingBottom: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  active: {
    color: '#1976d2',
    fontWeight: '600',
  },
});
