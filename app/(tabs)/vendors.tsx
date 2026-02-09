import { View, Text, StyleSheet } from 'react-native';
import BackButton from '../../components/BackButton';

export default function VendorsScreen() {
  return (
    <View style={styles.container}>
      <BackButton />

      <Text style={styles.title}>Vendors</Text>
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