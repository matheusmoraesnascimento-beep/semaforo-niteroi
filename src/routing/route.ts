import type { LatLon } from '../types';
import type { CongestionLevel, RouteResult } from './types';
import { ServiceError } from './errors';
import { MAPBOX_TOKEN } from '../mapbox';

const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface DirectionsResponse {
  code?: string;
  routes?: {
    distance?: unknown;
    duration?: unknown;
    geometry?: { coordinates?: unknown };
    legs?: { annotation?: { congestion?: unknown } }[];
  }[];
}

const LEVELS = new Set<CongestionLevel>(['low', 'moderate', 'heavy', 'severe']);

function parseCongestion(legs: NonNullable<DirectionsResponse['routes']>[number]['legs'], segments: number): CongestionLevel[] {
  const all = (legs ?? []).flatMap((l) => (Array.isArray(l.annotation?.congestion) ? (l.annotation.congestion as unknown[]) : []));
  if (all.length !== segments) return [];
  return all.map((v) => (LEVELS.has(v as CongestionLevel) ? (v as CongestionLevel) : 'unknown'));
}

function isLonLat(c: unknown): c is [number, number] {
  return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number';
}

export async function fetchRoute(
  from: LatLon,
  to: LatLon,
  fetchFn: FetchFn = defaultFetch,
  token: string = MAPBOX_TOKEN,
): Promise<RouteResult> {
  if (!token) throw new ServiceError('config', 'Token do Mapbox ausente');

  const params = new URLSearchParams({
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    annotations: 'congestion',
    language: 'pt-BR',
    access_token: token,
  });
  const url = `${DIRECTIONS_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?${params}`;

  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new ServiceError('network', 'Falha de rede ao buscar a rota');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} ao buscar a rota`);

  let body: DirectionsResponse;
  try {
    body = (await res.json()) as DirectionsResponse;
  } catch {
    throw new ServiceError('format', 'Resposta da rota não é JSON');
  }

  if (body.code === 'NoRoute' || body.code === 'NoSegment') throw new ServiceError('no-route', 'Sem rota');
  if (body.code === 'Ok' && body.routes?.length === 0) throw new ServiceError('no-route', 'Sem rota');
  const r = body.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (
    body.code !== 'Ok' ||
    !r ||
    typeof r.distance !== 'number' ||
    typeof r.duration !== 'number' ||
    !Array.isArray(coords) ||
    !coords.every(isLonLat)
  ) {
    throw new ServiceError('format', 'Resposta da rota fora do formato');
  }

  return {
    line: (coords as [number, number][]).map(([lon, lat]) => ({ lat, lon })),
    congestion: parseCongestion(r.legs, coords.length - 1),
    distanceM: r.distance,
    durationS: r.duration,
  };
}
