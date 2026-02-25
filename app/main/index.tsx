// JobHub/app/main/index.tsx
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { apiFetch } from '../../src/lib/apiClient';
import { useRouter } from 'expo-router';

export default function MainHome() {
  const router = useRouter();
  const [nearbyJobs, setNearbyJobs] = useState<any[]>([]);
  const [currentCoords, setCurrentCoords] = useState<any>(null);

  useEffect(() => {
    initLocation();
  }, []);

  async function initLocation() {
    console.log('🔍 Requesting location permission');

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      console.log('❌ Location denied');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    console.log('📍 Current Location:', location.coords);

    setCurrentCoords(location.coords);

    await checkNearbyJobs(
      location.coords.latitude,
      location.coords.longitude
    );
  }

  async function checkNearbyJobs(lat: number, lng: number) {
    console.log('📦 Fetching jobs');

    const res = await apiFetch('/api/jobs');
    const jobs = res?.jobs ?? [];

    const closeJobs = jobs.filter((job: any) => {
      if (!job.latitude || !job.longitude) return false;

      const distance = getDistanceMiles(
        lat,
        lng,
        job.latitude,
        job.longitude
      );

      console.log(`📏 ${job.name} = ${distance.toFixed(3)} mi`);

      return distance <= 0.1;
    });

    setNearbyJobs(closeJobs);
  }

  function getDistanceMiles(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  return (
    <View style={styles.container}>
      {nearbyJobs.length > 0 ? (
        <>
          <Text style={styles.title}>Nearby Jobs</Text>

          {nearbyJobs.map(job => (
            <Pressable
              key={job.id}
              style={styles.card}
              onPress={() => router.push(`/job/${job.id}`)}
            >
              <Text style={styles.cardText}>{job.name}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <Text style={styles.subtitle}>
          No nearby jobs detected.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
  },
});