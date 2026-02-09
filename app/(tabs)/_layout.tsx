// JobHub/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticTab } from '../../components/haptic-tab';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

type TabItem = {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [tabs, setTabs] = useState<TabItem[] | null>(null);

  useEffect(() => {
    loadTabs();
  }, []);

  async function loadTabs() {
    const stored = await AsyncStorage.getItem('tabConfig');
    if (stored) {
      setTabs(JSON.parse(stored));
    }
  }

  if (!tabs) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}
    >
      {tabs
        .filter(t => t.enabled)
        .map(tab => (
          <Tabs.Screen
            key={tab.key}
            name={tab.key}
            options={{
              title: tab.label,
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name={tab.icon} color={color} />
              ),
            }}
          />
        ))}
    </Tabs>
  );
}