import { supabase } from "./supabase";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  "http://localhost:8787";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
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
    throw new Error(
      `API ${res.status}: ${text || res.statusText}`
    );
  }

  return res.json();
}
