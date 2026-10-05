import type { Map as MbMap } from 'mapbox-gl';
import type { LatLon, RoadSegment, RoadSource } from '../types';

/** Classes da camada `road` do estilo Mapbox streets consideradas vias de carro. */
const ROAD_CLASSES = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'street', 'street_limited', 'service',
]);
const SOURCE_ID = 'composite';
const SOURCE_LAYER = 'road';

export interface SourceFeature {
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates?: unknown };
}

function toLine(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
    out.push([p[0], p[1]]);
  }
  return out;
}

export function featuresToSegments(features: SourceFeature[], requireRoadClass = true): RoadSegment[] {
  const out: RoadSegment[] = [];
  const seen = new Set<string>();
  features.forEach((f) => {
    const props = f.properties ?? {};
    if (requireRoadClass) {
      const cls = props.class;
      if (typeof cls !== 'string' || !ROAD_CLASSES.has(cls)) return;
      if (cls === 'service' && props.type === 'service:parking_aisle') return;
    }
    const name = typeof props.name === 'string' && props.name !== '' ? props.name : null;
    const oneway: 0 | 1 | -1 = props.oneway === 'true' ? 1 : 0;

    let lines: unknown[] = [];
    if (f.geometry.type === 'LineString') lines = [f.geometry.coordinates];
    else if (f.geometry.type === 'MultiLineString' && Array.isArray(f.geometry.coordinates)) lines = f.geometry.coordinates;

    lines.forEach((raw, li) => {
      const coords = toLine(raw);
      if (!coords) return;
      const first = coords[0];
      const last = coords[coords.length - 1];
      // Sem id (comum em querySourceFeatures): id estável derivado dos dados, não do índice.
      const id =
        f.id !== undefined && f.id !== null
          ? `${f.id}:${li}`
          : `${name ?? ''}|${oneway}|${first[0]},${first[1]}|${last[0]},${last[1]}|${li}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, name, oneway, coords });
    });
  });
  return out;
}

/** Mantém segmentos cujo retângulo envolvente cruza o quadrado de lado 2×radiusM em volta do centro. */
export function filterNear(segments: RoadSegment[], center: LatLon, radiusM: number): RoadSegment[] {
  const dLat = radiusM / 111195;
  const dLon = dLat / Math.cos((center.lat * Math.PI) / 180);
  const minLat = center.lat - dLat;
  const maxLat = center.lat + dLat;
  const minLon = center.lon - dLon;
  const maxLon = center.lon + dLon;
  return segments.filter((s) => {
    let sMinLon = Infinity, sMaxLon = -Infinity, sMinLat = Infinity, sMaxLat = -Infinity;
    for (const [lon, lat] of s.coords) {
      if (lon < sMinLon) sMinLon = lon;
      if (lon > sMaxLon) sMaxLon = lon;
      if (lat < sMinLat) sMinLat = lat;
      if (lat > sMaxLat) sMaxLat = lat;
    }
    return sMaxLon >= minLon && sMinLon <= maxLon && sMaxLat >= minLat && sMinLat <= maxLat;
  });
}

/** Lê as vias dos tiles vetoriais já carregados no mapa (independe de a camada estar desenhada). */
export function createTileRoadSource(map: MbMap): RoadSource {
  const query = (requireClass: boolean, lat: number, lon: number, r: number) =>
    filterNear(
      featuresToSegments(
        map.querySourceFeatures(SOURCE_ID, { sourceLayer: SOURCE_LAYER }) as SourceFeature[],
        requireClass,
      ),
      { lat, lon },
      r,
    );
  return {
    segmentsNear: (lat, lon, r) => query(true, lat, lon, r),
    namedSegmentsNear: (lat, lon, r) => query(false, lat, lon, r),
  };
}
