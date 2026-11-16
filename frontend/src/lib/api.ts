// Typed API client for the FastAPI backend.
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      // Keep the raw response when it is not JSON.
    }
    throw new Error(detail || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface FoodItem {
  name: string;
  approx_kg: number;
}

export interface ScanResponse {
  draft_id: string;
  items: FoodItem[];
  portions: number;
  tier: string;
  ambient_temp_c: number;
  humidity_pct: number;
  weather_source: string;
  safe_window_min: number;
  expires_at: string;
  needs_manual_entry: boolean;
}

export interface Batch {
  id: string;
  donor_id: string;
  items: FoodItem[];
  total_kg: number;
  portions: number;
  tier: string;
  ambient_temp_c: number | null;
  humidity_pct: number | null;
  weather_source: string | null;
  safe_window_min: number | null;
  created_at: string;
  expires_at: string | null;
  status: string;
  shelter_id: string | null;
  volunteer_id: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  is_demo: boolean;
  remaining_min: number;
  urgency: number | null;
  urgency_band: string;
  shelter: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    contact: string | null;
  } | null;
}

export interface Stats {
  meals: number;
  kg: number;
  co2e_kg: number;
  active_batches: number;
  delivered_batches: number;
  demo: { meals: number; kg: number; co2e_kg: number };
  real: { meals: number; kg: number; co2e_kg: number };
}

export function scanBatch(form: FormData): Promise<ScanResponse> {
  return apiFetch<ScanResponse>('/api/batches/scan', {
    method: 'POST',
    body: form,
  });
}

export function confirmBatch(
  id: string,
  payload: { items: FoodItem[]; portions: number; expires_in_minutes?: number; tier?: string },
): Promise<{ batch: Batch; status: string }> {
  return apiFetch(`/api/batches/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listBatches(status?: string): Promise<Batch[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Batch[]>(`/api/batches${query}`);
}

export function getBatch(id: string): Promise<Batch> {
  return apiFetch<Batch>(`/api/batches/${id}`);
}

export function pickupBatch(id: string, token: string): Promise<{ batch: Batch }> {
  return apiFetch(`/api/batches/${id}/pickup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getStats(): Promise<Stats> {
  return apiFetch<Stats>('/api/stats');
}
