const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}
