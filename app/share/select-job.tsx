//JobHub/app/share/select-job.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/lib/apiClient';

export default function ShareSelectJob() {
  const { uri, name } = useLocalSearchParams<{
    uri: string;
    name: string;
  }>();

  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const res = await apiFetch('/api/job');
      setJobs(res?.jobs ?? []);
    } catch {
      Alert.alert('Error', 'Failed to load jobs.');
    }
  }

  async function attachToJob(jobId: string) {
    if (!uri) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('pdf', {
        uri,
        name: name ?? 'shared.pdf',
        type: 'application/pdf',
      } as any);

      const res = await apiFetch('/api/job-pdfs/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res?.file?.id) {
        throw new Error('Upload failed');
      }

      Alert.alert('Success', 'PDF attached to job.');

      router.replace('/');
    } catch (e) {
      Alert.alert('Error', 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
        Select Job
      </Text>

      {jobs.map(job => (
        <Pressable
          key={job.id}
          onPress={() => attachToJob(job.id)}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderColor: '#eee',
          }}
          disabled={uploading}
        >
          <Text style={{ fontSize: 16 }}>
            {job.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}