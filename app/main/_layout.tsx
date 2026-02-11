// JobHub/app/main/_layout.tsx
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import BottomTabs from '../../components/BottomTabs';

export default function MainLayout() {
  return (
    <View style={styles.container}>
<View style={styles.content}>
  <Slot />
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