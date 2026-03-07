//JobHub/app/job/[id]/media.tsx

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../../src/lib/apiClient';

type MediaItem = {
  id: string;
  jobId: string;
  mimeType: string;
  storagePath: string;
  uploadStatus: string;
  createdAt: string;
};

export default function JobMediaScreen() {
  const { id } = useLocalSearchParams();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadMedia(true);
  }, [id]);

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

      const rows: MediaItem[] = res?.media ?? [];

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

  function renderItem({ item }: { item: MediaItem }) {
    return (
      <View style={styles.cell}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {item.mimeType.startsWith('video') ? 'VIDEO' : 'PHOTO'}
          </Text>
        </View>

        {item.uploadStatus !== 'uploaded' && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
      </View>
    );
  }

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

  pendingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  pendingText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
});