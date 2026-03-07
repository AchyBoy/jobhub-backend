//JobHub/jobhub-backend/src/lib/mediaCapture.ts
import * as ImagePicker from 'expo-image-picker';
import { enqueueSync, makeId, nowIso } from './syncEngine';
import { apiFetch } from './apiClient';

export async function capturePhoto(jobId: string) {

  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (result.canceled) return;

  const asset = result.assets[0];

  await queueMedia(jobId, asset.uri, 'image/jpeg');
}

export async function recordVideo(jobId: string) {

  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: 180,
  });

  if (result.canceled) return;

  const asset = result.assets[0];

  await queueMedia(jobId, asset.uri, 'video/mp4');
}

export async function importFromLibrary(jobId: string) {

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Library permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
  });

  if (result.canceled) return;

  const asset = result.assets[0];

  const mimeType = asset.type === 'video'
    ? 'video/mp4'
    : 'image/jpeg';

  await queueMedia(jobId, asset.uri, mimeType);
}

async function queueMedia(
  jobId: string,
  uri: string,
  mimeType: string
) {

  const sizeBytes = 0; // optional later

  const create = await apiFetch('/api/media/create', {
    method: 'POST',
    body: JSON.stringify({
      jobId,
      fileName: uri.split('/').pop(),
      mimeType,
      sizeBytes,
    }),
  });

  const mediaId = create.mediaId;
  const storagePath = create.storagePath;

  await enqueueSync({
    id: makeId(),
    type: 'media_upload',
    coalesceKey: `media_${mediaId}`,
    createdAt: nowIso(),
    payload: {
      mediaId,
      jobId,
      storagePath,
      localUri: uri,
      mimeType,
      fileName: uri.split('/').pop() || 'media',
      sizeBytes,
    },
  });
}