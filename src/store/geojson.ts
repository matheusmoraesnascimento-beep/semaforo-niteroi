import type { TrafficLight } from '../types';
import { normalizeBearing } from '../geo/geo';

export interface LightFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Omit<TrafficLight, 'lat' | 'lon'>;
}
export interface LightFeatureCollection {
  type: 'FeatureCollection';
  features: LightFeature[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function lightsToGeoJSON(lights: TrafficLight[]): LightFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lights.map(({ lat, lon, ...rest }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: rest,
    })),
  };
}

function parseFeature(f: unknown, now: () => string): TrafficLight | null {
  if (!isObj(f)) return null;
  const g = f.geometry;
  const p = f.properties;
  if (!isObj(g) || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const [lon, lat] = g.coordinates as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (!isObj(p)) return null;
  if (typeof p.id !== 'string' || p.id === '') return null;
  const ab = p.approachBearing;
  if (typeof ab !== 'number' || !Number.isFinite(ab) || ab < 0 || ab > 360) return null;

  const light: TrafficLight = {
    id: p.id,
    lat,
    lon,
    approachBearing: normalizeBearing(ab),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : now(),
    source: 'manual',
  };
  if (typeof p.name === 'string' && p.name.trim() !== '') light.name = p.name.trim();
  return light;
}

export function parseLightsGeoJSON(
  data: unknown,
  now: () => string = () => new Date().toISOString(),
): { lights: TrafficLight[]; rejected: number } {
  if (!isObj(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Arquivo não é um GeoJSON FeatureCollection');
  }
  const lights: TrafficLight[] = [];
  let rejected = 0;
  for (const f of data.features) {
    const light = parseFeature(f, now);
    if (light) lights.push(light);
    else rejected++;
  }
  return { lights, rejected };
}

export function mergeLights(base: TrafficLight[], local: TrafficLight[], deletedIds: string[] = []): TrafficLight[] {
  const deleted = new Set(deletedIds);
  const byId = new Map<string, TrafficLight>();
  for (const l of base) byId.set(l.id, l);
  for (const l of local) byId.set(l.id, l);
  return [...byId.values()].filter((l) => !deleted.has(l.id));
}
