//JobHub/app/main/tasks.tsx
import { View, Text, StyleSheet } from 'react-native';


export default function TasksScreen() {
  return (
<View style={styles.container}>
  <Text style={styles.title}>Tasks</Text>
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
    fontSize: 24,
    fontWeight: '600',
    marginTop: 10,
  },
});