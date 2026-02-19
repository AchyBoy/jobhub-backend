// JobHub/src/lib/apiClient.ts
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
console.log('🧪 EXPO_PUBLIC_API_BASE (runtime) =', API_BASE);

if (!API_BASE) {
  console.warn('🔴 API_BASE missing — check EXPO_PUBLIC_API_BASE');
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  // 🔐 Device session header
  let deviceSession = await AsyncStorage.getItem('deviceSessionId');

  if (!deviceSession) {
    deviceSession = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem('deviceSessionId', deviceSession);
  }

  headers['x-device-session'] = deviceSession;

// 🔎 DEBUG: confirm which device session we are sending
console.log('🆔 x-device-session (outgoing) =', deviceSession, 'path=', path);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('❌ API ERROR', res.status, text);

let parsed: any;

try {
  parsed = JSON.parse(text);
} catch {
  parsed = null;
}

if (parsed?.code === 'SESSION_CONFLICT') {
  const conflictError: any = new Error('SESSION_CONFLICT');
  conflictError.code = 'SESSION_CONFLICT';
  throw conflictError;
}

throw new Error(text || `Request failed (${res.status})`);
  }

  return res.headers
    .get('content-type')
    ?.includes('application/json')
    ? res.json()
    : res.text();
}