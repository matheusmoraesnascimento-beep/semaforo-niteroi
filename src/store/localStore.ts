import type { LocalState, TrafficLight } from '../types';
import { lightsToGeoJSON, parseLightsGeoJSON } from './geojson';

const KEY = 'semaforo-niteroi:v1';

export function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lights: [], deleted: [] };
    const obj = JSON.parse(raw) as { collection?: unknown; deleted?: unknown };
    const { lights } = parseLightsGeoJSON(obj.collection);
    const deleted = Array.isArray(obj.deleted) ? obj.deleted.filter((x): x is string => typeof x === 'string') : [];
    return { lights, deleted };
  } catch {
    return { lights: [], deleted: [] };
  }
}

export function saveLocal(s: LocalState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ collection: lightsToGeoJSON(s.lights), deleted: s.deleted }));
  } catch {
    // armazenamento indisponível (modo privado etc.): segue sem persistir
  }
}

export async function loadBaseLights(url: string): Promise<{ lights: TrafficLight[]; warning?: string }> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { lights: parseLightsGeoJSON(await r.json()).lights };
  } catch {
    return { lights: [], warning: 'Base de semáforos não carregou; usando só os cadastros deste aparelho.' };
  }
}

export function downloadTextFile(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
