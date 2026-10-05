import type { Place } from '../routing/types';
import {
  DEFAULT_NAME, MAX_RECENTS, defaultProfile, isNear, type Favorite, type Profile,
} from './profile';

const KEY = 'semaforo-niteroi:profile:v1';
const OLD_PLACES_KEY = 'semaforo-niteroi:places:v1';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function parsePlace(x: unknown): Place | null {
  if (!isRecord(x)) return null;
  const { name, lat, lon } = x;
  if (typeof name !== 'string' || !name.trim()) return null;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  return { name: name.trim(), lat, lon };
}

function parseFavorite(x: unknown): Favorite | null {
  const place = parsePlace(x);
  if (!place || !isRecord(x) || typeof x.id !== 'string' || !x.id || typeof x.createdAt !== 'string') return null;
  return { ...place, id: x.id, createdAt: x.createdAt };
}

const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export function parseProfile(raw: unknown): Profile | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const base = defaultProfile();
  const favorites: Favorite[] = [];
  for (const item of list(raw.favorites)) {
    const f = parseFavorite(item);
    if (f && !favorites.some((x) => isNear(x, f))) favorites.push(f);
  }
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const profile: Profile = {
    version: 1,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_NAME,
    favorites,
    recents: list(raw.recents).map(parsePlace).filter((p): p is Place => p !== null).slice(0, MAX_RECENTS),
    settings: {
      keepAwake: typeof settings.keepAwake === 'boolean' ? settings.keepAwake : base.settings.keepAwake,
      showTraffic: typeof settings.showTraffic === 'boolean' ? settings.showTraffic : base.settings.showTraffic,
    },
  };
  const home = parsePlace(raw.home);
  const work = parsePlace(raw.work);
  if (home) profile.home = home;
  if (work) profile.work = work;
  return profile;
}

export const serializeProfile = (p: Profile): string => JSON.stringify(p, null, 2);

function migrateOldPlaces(kv: KV): Profile {
  const profile = defaultProfile();
  const old = kv.getItem(OLD_PLACES_KEY);
  if (!old) return profile;
  const obj = JSON.parse(old) as unknown;
  if (!isRecord(obj)) return profile;
  const home = parsePlace(obj.home);
  const work = parsePlace(obj.work);
  if (home) profile.home = home;
  if (work) profile.work = work;
  return profile;
}

export function loadProfile(kv: KV = localStorage): Profile {
  try {
    const raw = kv.getItem(KEY);
    if (raw === null) return migrateOldPlaces(kv);
    return parseProfile(JSON.parse(raw)) ?? defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile, kv: KV = localStorage): void {
  try {
    kv.setItem(KEY, serializeProfile(p));
  } catch {
    // armazenamento indisponível: segue sem persistir
  }
}
