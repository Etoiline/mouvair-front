import type { Forecast, Location } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Le service est momentanément indisponible.");
  }
  return response.json() as Promise<T>;
}

export function searchLocations(query: string, signal?: AbortSignal): Promise<Location[]> {
  const params = new URLSearchParams({ q: query });
  return getJson<Location[]>(`${API_URL}/locations?${params}`, signal);
}

export function getForecast(location: Location): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
  });
  return getJson<Forecast>(`${API_URL}/forecast?${params}`);
}
