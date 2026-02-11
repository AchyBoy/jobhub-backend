// JobHub/app/main/index.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function MainHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Job Hub</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});