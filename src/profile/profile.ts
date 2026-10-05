import type { Place, SlotName } from '../routing/types';
import { distanceM } from '../geo/geo';

export const NEAR_M = 30;
export const MAX_RECENTS = 20;
export const DEFAULT_NAME = 'Motorista';
const SUGGESTED_RECENTS = 5;

export interface Favorite extends Place {
  id: string;
  createdAt: string;
}

export interface Settings {
  keepAwake: boolean;
  showTraffic: boolean;
}

export interface Profile {
  version: 1;
  name: string;
  home?: Place;
  work?: Place;
  favorites: Favorite[];
  recents: Place[];
  settings: Settings;
}

export interface Suggestion {
  key: string;
  icon: string;
  title: string;
  place: Place;
}

export const defaultProfile = (): Profile => ({
  version: 1,
  name: DEFAULT_NAME,
  favorites: [],
  recents: [],
  settings: { keepAwake: true, showTraffic: true },
});

export const isNear = (a: Place, b: Place): boolean => distanceM(a, b) < NEAR_M;

export function addFavorite(
  p: Profile,
  place: Place,
  id: string,
  createdAt: string,
): { profile: Profile; added: boolean } {
  if (p.favorites.some((f) => isNear(f, place))) return { profile: p, added: false };
  return { profile: { ...p, favorites: [...p.favorites, { ...place, id, createdAt }] }, added: true };
}

export function renameFavorite(p: Profile, id: string, name: string): Profile {
  const trimmed = name.trim();
  if (!trimmed) return p;
  return { ...p, favorites: p.favorites.map((f) => (f.id === id ? { ...f, name: trimmed } : f)) };
}

export const removeFavorite = (p: Profile, id: string): Profile => ({
  ...p,
  favorites: p.favorites.filter((f) => f.id !== id),
});

export function setSlot(p: Profile, slot: SlotName, place: Place | undefined): Profile {
  const { [slot]: _previous, ...rest } = p;
  return place ? { ...rest, [slot]: place } : rest;
}

export function addRecent(p: Profile, place: Place): Profile {
  const others = p.recents.filter((r) => !isNear(r, place));
  return { ...p, recents: [place, ...others].slice(0, MAX_RECENTS) };
}

export const clearRecents = (p: Profile): Profile => ({ ...p, recents: [] });

export function setName(p: Profile, name: string): Profile {
  const trimmed = name.trim();
  return trimmed ? { ...p, name: trimmed } : p;
}

export const setSetting = (p: Profile, key: keyof Settings, value: boolean): Profile => ({
  ...p,
  settings: { ...p.settings, [key]: value },
});

export function mergeImported(current: Profile, imported: Profile): Profile {
  const favorites = [...current.favorites];
  const ids = new Set(favorites.map((f) => f.id));
  for (const f of imported.favorites) {
    if (favorites.some((x) => isNear(x, f))) continue;
    let id = f.id;
    while (ids.has(id)) id = `${id}-i`;
    ids.add(id);
    favorites.push({ ...f, id });
  }
  let recents = [...current.recents];
  for (const r of imported.recents) if (!recents.some((x) => isNear(x, r))) recents.push(r);
  recents = recents.slice(0, MAX_RECENTS);
  return {
    ...current,
    name: imported.name,
    settings: imported.settings,
    home: current.home ?? imported.home,
    work: current.work ?? imported.work,
    favorites,
    recents,
  };
}

export function buildSuggestions(p: Profile): Suggestion[] {
  const out: Suggestion[] = [];
  if (p.home) out.push({ key: 'home', icon: '🏠', title: 'Casa', place: p.home });
  if (p.work) out.push({ key: 'work', icon: '💼', title: 'Trabalho', place: p.work });
  for (const f of p.favorites) out.push({ key: `fav:${f.id}`, icon: '⭐', title: f.name, place: f });
  p.recents.slice(0, SUGGESTED_RECENTS).forEach((r, i) =>
    out.push({ key: `recent:${i}`, icon: '🕘', title: r.name, place: r }),
  );
  return out;
}
