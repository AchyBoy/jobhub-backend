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
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);

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
      setUploadingJobId(jobId);

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
      setUploadingJobId(null);
    }
  }

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
        Select Job
      </Text>

{jobs.map(job => {
  const isUploading = uploadingJobId === job.id;

  return (
    <Pressable
      key={job.id}
      onPress={() => attachToJob(job.id)}
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: '#eee',
        opacity: uploadingJobId && !isUploading ? 0.4 : 1,
      }}
      disabled={uploadingJobId !== null}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: isUploading ? '700' : '500',
        }}
      >
        {job.name}
      </Text>

      {isUploading && (
        <Text
          style={{
            marginTop: 6,
            fontSize: 12,
            color: '#2563eb',
            fontWeight: '600',
          }}
        >
          Uploading PDF...
        </Text>
      )}
    </Pressable>
  );
})}
    </ScrollView>
  );
}