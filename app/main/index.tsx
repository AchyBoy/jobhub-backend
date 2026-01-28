import { View, Text, StyleSheet } from 'react-native';
import BottomTabs from '../../components/BottomTabs';

export default function MainHome() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Job Hub</Text>
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
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});