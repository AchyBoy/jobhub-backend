// JobHub/src/lib/apiClient.ts

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

if (!API_BASE) {
  console.warn('🔴 API_BASE missing — check EXPO_PUBLIC_API_BASE');
}

type ApiFetchOptions = RequestInit & {
  json?: boolean;
};

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
) {
  const url = `${API_BASE}${path}`;

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  return res.headers.get('content-type')?.includes('application/json')
    ? res.json()
    : res.text();
}