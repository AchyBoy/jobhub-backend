//JobHub/components/BottomTabs.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';

type TabItem = {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
};

export default function BottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const [tabs, setTabs] = useState<TabItem[]>([]);

useFocusEffect(
  useCallback(() => {
    loadTabs();
  }, [])
);

  // ✅ ADD THIS FUNCTION
function goTo(tabKey: string) {
  if (tabKey === 'index') {
    router.push('/main');
  } else {
    router.push(`/main/${tabKey}`);
  }
}

 

async function loadTabs() {
  const stored = await AsyncStorage.getItem('tabConfig_v4');

  if (stored) {
    setTabs(JSON.parse(stored));
  } else {
    const defaults: TabItem[] = [
      { key: 'index', label: 'Home', icon: 'home', enabled: true },
      { key: 'jobs', label: 'Jobs', icon: 'briefcase', enabled: true },
      { key: 'schedule', label: 'Schedule', icon: 'calendar', enabled: true },
      { key: 'settings', label: 'Settings', icon: 'settings', enabled: true },
    ];

    await AsyncStorage.setItem('tabConfig_v4', JSON.stringify(defaults));
    setTabs(defaults);
  }
}

  return (
    <View style={styles.bar}>
      {tabs
        .filter(t => t.enabled)
        .map(tab => {
const active =
  pathname === `/main/${tab.key}` ||
  (tab.key === 'index' && pathname === '/main');

          return (
            <Pressable
              key={tab.key}
              style={styles.item}
              onPress={() => goTo(tab.key)}
              onLongPress={() => router.push('/main/edit-tabs')}
            >
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={active ? '#2563eb' : '#6b7280'}
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
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
  },
  active: {
    color: '#2563eb',
    fontWeight: '600',
  },
});