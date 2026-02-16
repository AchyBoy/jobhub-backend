// JobHub/app/main/_layout.tsx
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import BottomTabs from '../../components/BottomTabs';

export default function MainLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
<Stack
  screenOptions={{
    headerBackTitle: 'Back',
  }}
>
  <Stack.Screen
    name="index"
    options={{ title: 'Job Hub' }}
  />
</Stack>
      </View>

      <BottomTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
});