import type { Place } from './types';
import { ServiceError } from './errors';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// esquerda, topo, direita, base: Niterói e arredores
const VIEWBOX = '-43.35,-22.70,-42.85,-23.05';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface NominatimItem {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
}

function shortName(displayName: string): string {
  return displayName
    .split(',')
    .slice(0, 3)
    .map((s) => s.trim())
    .join(', ');
}

export async function searchPlaces(query: string, fetchFn: FetchFn = defaultFetch): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'br',
    limit: '5',
    'accept-language': 'pt-BR',
    viewbox: VIEWBOX,
    bounded: '1',
  });

  let res: Response;
  try {
    res = await fetchFn(`${NOMINATIM_URL}?${params}`);
  } catch {
    throw new ServiceError('network', 'Falha de rede na busca');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} na busca`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ServiceError('format', 'Resposta da busca não é JSON');
  }
  if (!Array.isArray(body)) throw new ServiceError('format', 'Resposta da busca fora do formato');

  const places: Place[] = [];
  for (const item of body as NominatimItem[]) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof item.display_name !== 'string') continue;
    places.push({ name: shortName(item.display_name), lat, lon });
  }
  return places;
}
