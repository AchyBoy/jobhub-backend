// JobHub/src/lib/mediaCapture.ts
import * as ImagePicker from 'expo-image-picker';
import { enqueueSync, makeId, nowIso } from './syncEngine';
import { apiFetch } from './apiClient';
import * as FileSystem from 'expo-file-system/legacy';

export async function capturePhoto(jobId: string) {
  console.log('📸 capturePhoto start', { jobId });

  const permission = await ImagePicker.requestCameraPermissionsAsync();
console.log('📸 camera permission result', permission);
  if (!permission.granted) {
    throw new Error('Camera permission denied');
  }
console.log('📸 launching camera');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (result.canceled) {
  console.log('📸 capture canceled');
  return;
}

  const asset = result.assets[0];
  console.log('📸 captured asset', asset);

  return await queueMedia(jobId, asset.uri, 'image/jpeg');
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

  return await queueMedia(jobId, asset.uri, 'video/mp4');
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

  return await queueMedia(jobId, asset.uri, mimeType);
}



async function queueMedia(
  jobId: string,
  uri: string,
  mimeType: string
) {

  const info = await FileSystem.getInfoAsync(uri);

  const sizeBytes = info.exists && info.size
    ? info.size
    : 0;

const ext = mimeType.startsWith('video') ? 'mp4' : 'jpg';
const fileName = `${makeId()}.${ext}`;

const create = await apiFetch('/api/media/create', {
  method: 'POST',
  body: JSON.stringify({
    jobId,
    fileName,
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
      fileName: `${mediaId}.${mimeType.startsWith('video') ? 'mp4' : 'jpg'}`,
      sizeBytes,
    },
  });

console.log('📦 queueMedia return', {
  mediaId,
  storagePath,
  mimeType,
  localUri: uri,
});

return {
  mediaId,
  storagePath,
  mimeType,
  localUri: uri,
};

}