import type { Place, SavedPlaces, SlotName } from '../routing/types';

const KEY = 'semaforo-niteroi:places:v1';

function isPlace(x: unknown): x is Place {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lon === 'number';
}

export function loadPlaces(): SavedPlaces {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: SavedPlaces = {};
    if (isPlace(obj.home)) out.home = obj.home;
    if (isPlace(obj.work)) out.work = obj.work;
    return out;
  } catch {
    return {};
  }
}

export function savePlaces(p: SavedPlaces): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // armazenamento indisponível: segue sem persistir
  }
}

export function withPlace(p: SavedPlaces, slot: SlotName, place: Place): SavedPlaces {
  return { ...p, [slot]: place };
}
