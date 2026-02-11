// JobHub/src/lib/apiClient.ts
import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
console.log(
  '🧪 EXPO_PUBLIC_API_BASE (runtime) =',
  API_BASE
);

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

  const headers: HeadersInit = {
    ...(options.headers || {}),
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  return res.headers
    .get('content-type')
    ?.includes('application/json')
    ? res.json()
    : res.text();
}