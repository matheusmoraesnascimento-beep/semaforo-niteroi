import type { Place } from './types';
import { ServiceError } from './errors';

const PHOTON_URL = 'https://photon.komoot.io/api/';
// esquerda, base, direita, topo: Niterói e arredores
const BBOX = '-43.35,-23.05,-42.85,-22.70';
const BIAS = { lat: -22.8832, lon: -43.1036 };

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface PhotonProps {
  name?: unknown;
  street?: unknown;
  housenumber?: unknown;
  district?: unknown;
  city?: unknown;
  countrycode?: unknown;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: PhotonProps;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function placeName(p: PhotonProps): string | null {
  const street = str(p.street);
  const number = str(p.housenumber);
  const parts = [
    str(p.name),
    street && number ? `${street}, ${number}` : street,
    str(p.district) ?? str(p.city),
  ].filter((x): x is string => x !== null);
  return parts.length ? [...new Set(parts)].join(', ') : null;
}

export async function searchPlaces(query: string, fetchFn: FetchFn = defaultFetch): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: 'default',
    lat: String(BIAS.lat),
    lon: String(BIAS.lon),
    bbox: BBOX,
  });

  let res: Response;
  try {
    res = await fetchFn(`${PHOTON_URL}?${params}`);
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
  const features = (body as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new ServiceError('format', 'Resposta da busca fora do formato');

  const places: Place[] = [];
  for (const f of features as PhotonFeature[]) {
    const c = f.geometry?.coordinates;
    if (!Array.isArray(c)) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    const name = f.properties ? placeName(f.properties) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !name) continue;
    places.push({ name, lat, lon });
  }
  return places;
}
