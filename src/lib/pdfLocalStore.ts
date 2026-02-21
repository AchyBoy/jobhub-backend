// JobHub/src/lib/pdfLocalStore.ts
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PDF_DIR = FileSystem.documentDirectory + 'orders/';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getKey(orderId: string) {
  return `order:${orderId}:pdf`;
}

function getPath(orderId: string) {
  return PDF_DIR + `${orderId}.pdf`;
}

async function ensureDir() {
  const dirInfo = await FileSystem.getInfoAsync(PDF_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PDF_DIR, {
      intermediates: true,
    });
  }
}

export async function persistLocalPdf(orderId: string, tempUri: string) {
  await ensureDir();

  const destPath = getPath(orderId);

await FileSystem.copyAsync({
  from: tempUri,
  to: destPath,
});

  const expiresAt = Date.now() + ONE_WEEK_MS;

  await AsyncStorage.setItem(
    getKey(orderId),
    JSON.stringify({
      localUri: destPath,
      expiresAt,
    })
  );

  return destPath;
}

export async function getValidLocalPdf(orderId: string) {
  const raw = await AsyncStorage.getItem(getKey(orderId));
  if (!raw) return null;

  const parsed = JSON.parse(raw);

  if (Date.now() > parsed.expiresAt) {
    // expired — delete file + metadata
    try {
      await FileSystem.deleteAsync(parsed.localUri, { idempotent: true });
    } catch {}

    await AsyncStorage.removeItem(getKey(orderId));
    return null;
  }

  const fileInfo = await FileSystem.getInfoAsync(parsed.localUri);
  if (!fileInfo.exists) {
    await AsyncStorage.removeItem(getKey(orderId));
    return null;
  }

  return parsed.localUri;
}

export async function downloadAndPersistPdf(
  orderId: string,
  signedUrl: string
) {
  await ensureDir();

  const destPath = getPath(orderId);

  const result = await FileSystem.downloadAsync(
    signedUrl,
    destPath
  );

  const expiresAt = Date.now() + ONE_WEEK_MS;

  await AsyncStorage.setItem(
    getKey(orderId),
    JSON.stringify({
      localUri: result.uri,
      expiresAt,
    })
  );

  return result.uri;
}