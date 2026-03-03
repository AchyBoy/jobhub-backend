//JobHub/app/job/[id]/pdf-editor.tsx
import { View, ActivityIndicator, StyleSheet, Alert, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { apiFetch } from '../../../src/lib/apiClient';
import { PanResponder } from 'react-native';

export default function PdfEditor() {
  const { id } = useLocalSearchParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [overlays, setOverlays] = useState<any[]>([]);
const [editMode, setEditMode] = useState(false);
const [containerSize, setContainerSize] = useState({
  width: 0,
  height: 0,
});

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

async function createOverlay(x: number, y: number) {
  if (!containerSize.width || !containerSize.height) return;

  const xPercent = x / containerSize.width;
  const yPercent = y / containerSize.height;

  try {
    await apiFetch(`/api/pdf-overlays/${id}`, {
      method: "POST",
      body: JSON.stringify({
        page: 1,
        type: "box",
        x: xPercent,
        y: yPercent,
        width: 0.15,   // 15% width
        height: 0.08,  // 8% height
        color: "rgba(255,0,0,0.4)",
        layer: "default",
      }),
    });

    const overlayRes = await apiFetch(`/api/pdf-overlays/${id}`);
    setOverlays(overlayRes?.overlays ?? []);

  } catch (err) {
    console.log("Overlay create error:", err);
  }
}

return (
  <View
    style={styles.container}
    onLayout={(e) => {
      const { width, height } = e.nativeEvent.layout;
      console.log("📐 Container size:", width, height);
      setContainerSize({ width, height });
    }}
  >

    {/* 🔘 EDIT TOGGLE */}
    <View style={{ position: 'absolute', top: 40, right: 20, zIndex: 20 }}>
      <Text
        style={{
          backgroundColor: 'black',
          color: 'white',
          padding: 10,
          borderRadius: 6,
        }}
        onPress={() => setEditMode(!editMode)}
      >
        {editMode ? "Done" : "Edit"}
      </Text>
    </View>

    {/* 🔵 PDF Layer */}
<ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{ flexGrow: 1 }}
>

  <WebView
    source={{ uri: pdfUrl }}
    style={{ height: containerSize.height }}
    useWebKit
    startInLoadingState
    scrollEnabled={false}
  />

</ScrollView>

    {/* 🔵 Overlay Layer */}
    <View
  style={StyleSheet.absoluteFillObject}
  pointerEvents={editMode ? "auto" : "none"}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(event) => {
        const { locationX, locationY } = event.nativeEvent;
        createOverlay(locationX, locationY);
      }}
    >
{overlays.map((item, index) => {

  const startX = Number(item.x);
  const startY = Number(item.y);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,

    onPanResponderMove: (_, gesture) => {

      const newX =
        startX + gesture.dx / containerSize.width;

      const newY =
        startY + gesture.dy / containerSize.height;

      const updated = [...overlays];
      updated[index] = {
        ...item,
        x: newX,
        y: newY,
      };

      setOverlays(updated);
    },

onPanResponderRelease: async () => {
  const current = overlays[index];

  try {
    await apiFetch(`/api/pdf-overlays/${current.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        x: current.x,
        y: current.y,
      }),
    });
  } catch (err) {
    console.log("Overlay update error:", err);
  }
},
  });

  return (
    <View
      key={item.id}
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        top: Number(item.y) * containerSize.height,
        left: Number(item.x) * containerSize.width,
        width: Number(item.width || 0.15) * containerSize.width,
        height: Number(item.height || 0.08) * containerSize.height,
        backgroundColor: item.color || 'rgba(255,0,0,0.3)',
        borderWidth: 1,
        borderColor: item.color || 'red',
      }}
    />
  );

})}
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