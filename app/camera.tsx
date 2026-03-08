//JobHub/app/camera.tsx
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { capturePhoto } from '../src/lib/mediaCapture';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const router = useRouter();
  const { jobId } = useLocalSearchParams();
const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    requestPermission();
    return <View />;
  }

async function takePhoto() {
  if (!cameraRef.current || capturing) return;

  try {
    setCapturing(true);

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      skipProcessing: true,
    });

    if (!photo?.uri) {
      setCapturing(false);
      return;
    }

    await capturePhoto(jobId as string, photo.uri);

  } catch (err) {
    console.log('📸 camera capture error', err);
  }

  setTimeout(() => {
    setCapturing(false);
  }, 120);
}

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      <View style={styles.controls}>
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>

        <Pressable
  style={[
    styles.shutter,
    capturing && styles.shutterPressed
  ]}
  onPress={takePhoto}
/>

        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
  },

  doneButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  shutterPressed: {
  transform: [{ scale: 0.8 }],
  opacity: 0.7,
},

  doneText: {
    color: '#fff',
    fontWeight: '600',
  },
});