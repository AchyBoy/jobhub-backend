//JobHub/app/job/[id]/pdf-editor.tsx
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { apiFetch } from '../../../src/lib/apiClient';

export default function PdfEditor() {
  const { id } = useLocalSearchParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPdf() {
    try {
      const jobRes = await apiFetch(`/api/job/${id}`);
      const pdfId = jobRes?.job?.pdfId;

      if (!pdfId) {
        Alert.alert('No PDF attached');
        return;
      }

      const res = await apiFetch(`/api/job-pdfs/${pdfId}/url`);
      if (!res?.url) {
        Alert.alert('Unable to retrieve PDF');
        return;
      }

      setPdfUrl(res.url);
    } catch (err) {
      console.log('PDF load error:', err);
      Alert.alert('Error loading PDF');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPdf();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!pdfUrl) {
    return <View style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: pdfUrl }}
        style={{ flex: 1 }}
        useWebKit
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});