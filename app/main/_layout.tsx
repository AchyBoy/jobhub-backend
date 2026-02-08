import { Stack } from 'expo-router';
import HomeButton from '../../components/HomeButton';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerBackVisible: false,
        headerRight: () => <HomeButton />,
      }}
    />
  );
}