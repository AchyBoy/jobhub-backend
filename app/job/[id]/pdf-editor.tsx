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
const [overlays, setOverlays] = useState<any[]>([]);

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

    // 🔵 Load overlays
    const overlayRes = await apiFetch(`/api/pdf-overlays/${id}`);
    setOverlays(overlayRes?.overlays ?? []);

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
      style={StyleSheet.absoluteFillObject}
      useWebKit
      startInLoadingState
    />

    {/* 🔵 Overlay Layer */}
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFillObject}
    >
      {overlays.map((item) => (
        <View
          key={item.id}
          style={{
            position: 'absolute',
            top: Number(item.y),
            left: Number(item.x),
            width: Number(item.width || 100),
            height: Number(item.height || 50),
            backgroundColor: item.color || 'rgba(255,0,0,0.3)',
            borderWidth: 1,
            borderColor: item.color || 'red',
          }}
        />
      ))}
    </View>
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