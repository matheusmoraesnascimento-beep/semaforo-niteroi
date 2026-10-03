import type { LatLon } from '../types';
import type { RouteResult } from './types';
import { ServiceError } from './errors';

// Único ponto a trocar se o serviço público ficar instável.
const OSRM_URL = 'https://routing.openstreetmap.de/routed-car/route/v1/driving';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface OsrmResponse {
  code?: string;
  routes?: { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }[];
}

function isLonLat(c: unknown): c is [number, number] {
  return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number';
}

export async function fetchRoute(from: LatLon, to: LatLon, fetchFn: FetchFn = defaultFetch): Promise<RouteResult> {
  const url = `${OSRM_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;

  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new ServiceError('network', 'Falha de rede ao buscar a rota');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} ao buscar a rota`);

  let body: OsrmResponse;
  try {
    body = (await res.json()) as OsrmResponse;
  } catch {
    throw new ServiceError('format', 'Resposta da rota não é JSON');
  }

  if (body.code === 'NoRoute') throw new ServiceError('no-route', 'Sem rota');
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
    distanceM: r.distance,
    durationS: r.duration,
  };
}
