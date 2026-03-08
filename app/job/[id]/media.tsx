//JobHub/app/job/[id]/media.tsx

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  ListRenderItem,
} from 'react-native';
import {
  capturePhoto,
  recordVideo,
  importFromLibrary
} from '../../../src/lib/mediaCapture';
import { Video } from 'expo-av';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../src/lib/apiClient';
import * as FileSystem from 'expo-file-system';


type MediaItem = {
  id: string;
  jobId: string;
  mimeType: string;
  storagePath: string;
  signedUrl?: string | null;
  uploadStatus: string;
  createdAt: string;
  localUri?: string;
};

export default function JobMediaScreen() {
  const { id } = useLocalSearchParams();
const [viewer, setViewer] = useState<MediaItem | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);




useEffect(() => {
  async function init() {
    loadMedia(true);
  }

  init();

}, [id]);

  function openCaptureMenu() {

  console.log('📸 openCaptureMenu pressed', { jobId: id });

  Alert.alert(
    'Add Media',
    '',
    [
      {
text: 'Take Photo',
onPress: async () => {

  console.log('📸 Take Photo pressed');

  try {

    const temp = await capturePhoto(id as string);

    console.log('📸 capturePhoto result', temp);

    if (temp) {
  insertOptimistic(temp);

  // refresh gallery after upload likely finishes
  setTimeout(() => {
    loadMedia(true);
  }, 2500);
}

  } catch (err) {

    console.log('❌ capturePhoto error', err);

  }

},
      },
      {
text: 'Record Video',
onPress: async () => {

  console.log('🎥 Record Video pressed');

  try {

    const temp = await recordVideo(id as string);

    console.log('🎥 recordVideo result', temp);

    if (temp) {
  insertOptimistic(temp);

  // refresh gallery after upload likely finishes
  setTimeout(() => {
    loadMedia(true);
  }, 2500);
}

  } catch (err) {

    console.log('❌ recordVideo error', err);

  }

},
      },
      {
text: 'Import from Library',
onPress: async () => {

  console.log('🖼 Import from Library pressed');

  try {

    const temp = await importFromLibrary(id as string);

    console.log('🖼 importFromLibrary result', temp);

    if (temp) {
  insertOptimistic(temp);

  // refresh gallery after upload likely finishes
  setTimeout(() => {
    loadMedia(true);
  }, 2500);
}

  } catch (err) {

    console.log('❌ importFromLibrary error', err);

  }

},
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
}

function insertOptimistic(temp: any) {

  console.log('⚡ optimistic insert', temp);

const optimistic: MediaItem = {
  id: temp.mediaId,
  jobId: id as string,
  mimeType: temp.mimeType,
  storagePath: temp.storagePath,
  uploadStatus: 'pending',
  createdAt: new Date().toISOString(),
  localUri: temp.localUri,
};

  setMedia(prev => [optimistic, ...prev]);
}

async function deleteMedia(item: MediaItem) {

  Alert.alert(
    'Delete media?',
    '',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {

          try {

            // delete from backend
            await apiFetch(`/api/media/${item.id}`, {
              method: 'DELETE',
            });

            // delete cached file if it exists
            if (item.localUri) {
              try {
                await FileSystem.deleteAsync(item.localUri, {
                  idempotent: true,
                });
              } catch (e) {
                console.log('CACHE DELETE ERROR', e);
              }
            }

            // remove from UI
            setMedia(prev =>
              prev.filter(m => m.id !== item.id)
            );

          } catch (err) {

            console.log('MEDIA DELETE ERROR', err);

          }

        },
      },
    ]
  );
}

  async function loadMedia(reset = false) {
    if (!id) return;

    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const res = await apiFetch(
        `/api/media/job/${id}?limit=30${
          cursor && !reset ? `&cursor=${cursor}` : ''
        }`
      );

      console.log('📦 media API response', JSON.stringify(res, null, 2));

const rows: MediaItem[] = (res?.media ?? []).map((m: any) => {
const mapped: MediaItem = {
  id: m.id,
  jobId: m.job_id,
  mimeType: m.mime_type,
  storagePath: m.storage_path,
  signedUrl: m.signed_url ?? null,
  uploadStatus: m.upload_status ?? 'uploaded',
  createdAt: m.created_at,
};

  console.log('🧱 mapped media row', mapped);

  return mapped;
});

      if (reset) {
        setMedia(rows);
      } else {
        setMedia(prev => [...prev, ...rows]);
      }

      setCursor(res?.nextCursor ?? null);
    } catch (err) {
      console.log('MEDIA LOAD ERROR', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

const renderItem: ListRenderItem<MediaItem> = ({ item }) => {

console.log('🖼 renderItem', {
  id: item.id,
  signedUrl: item.signedUrl,
  localUri: item.localUri,
  uploadStatus: item.uploadStatus
});

const isVideo =
  item.mimeType?.startsWith('video') ||
  item.storagePath?.includes('.upload');

console.log('🎬 media type check', {
  id: item.id,
  mimeType: item.mimeType,
  storagePath: item.storagePath,
  isVideo
});

  return (
    <Pressable
  style={styles.cell}
  onLongPress={() => deleteMedia(item)}
>

{item.localUri ? (

  isVideo ? (
    <Pressable onPress={() => setViewer(item)}>
<View style={styles.videoTile}>
  <Text style={styles.videoLabel}>VIDEO</Text>
  <Text style={styles.playIcon}>▶</Text>
</View>
    </Pressable>
  ) : (
    <Image
      source={{ uri: item.localUri }}
      style={styles.image}
      resizeMode="cover"
    />
  )

) : item.signedUrl !== undefined && item.signedUrl !== null ? (

  isVideo ? (
    
    <Pressable onPress={() => setViewer(item)}>
<View style={styles.videoTile}>
  <Text style={styles.videoLabel}>VIDEO</Text>
  <Text style={styles.playIcon}>▶</Text>
</View>
    </Pressable>
  ) : (
    <Image
      source={{ uri: item.signedUrl }}
      style={styles.image}
      resizeMode="cover"
    />
  )

) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {(item.mimeType?.startsWith('video') || item.storagePath?.includes('.upload')) ? 'VIDEO' : 'PHOTO'}
          </Text>
        </View>
      )}

      {item.uploadStatus !== 'uploaded' && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      )}

    </Pressable>
  );
};

  return (
  <>
    <Stack.Screen options={{ title: 'Media' }} />

    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={media}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={renderItem}
          columnWrapperStyle={{ gap: 6 }}
          contentContainerStyle={{ padding: 6 }}
          onEndReached={() => {
            if (cursor && !loadingMore) {
              loadMedia(false);
            }
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginTop: 12 }} />
            ) : null
          }
        />
      )}
  <Pressable
    style={styles.captureButton}
    onPress={openCaptureMenu}
  >
    <Text style={styles.captureText}>+</Text>
  </Pressable>

  {viewer && (
  <View style={styles.viewer}>
    <Pressable
      style={styles.viewerClose}
      onPress={() => setViewer(null)}
    >
      <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
    </Pressable>

    

<Video
  source={{
    uri: viewer.localUri ?? viewer.signedUrl ?? ''
  }}
  style={styles.viewerVideo}
  useNativeControls
  resizeMode={'contain' as any}
  shouldPlay
/>
  </View>
)}

  </View>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  cell: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 6,
  },

  placeholder: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  placeholderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  captureButton: {
  position: 'absolute',
  right: 20,
  bottom: 30,
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: '#0f172a',
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 6,
},

captureText: {
  fontSize: 30,
  color: '#fff',
  marginTop: -2,
},
image: {
  flex: 1,
  borderRadius: 8,
},

  pendingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  videoTile: {
  flex: 1,
  backgroundColor: '#000',
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},

playIcon: {
  fontSize: 26,
  color: '#fff',
},

viewer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#000',
  justifyContent: 'center',
},

viewerVideo: {
  width: '100%',
  height: '80%',
},

viewerClose: {
  position: 'absolute',
  top: 50,
  right: 20,
  zIndex: 10,
},
videoLabel: {
  position: 'absolute',
  top: 6,
  left: 6,
  color: '#fff',
  fontSize: 10,
  fontWeight: '700'
},

  pendingText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
});