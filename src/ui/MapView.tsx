import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection } from 'geojson';
import type { Fix, TrafficLight } from '../types';
import { lightsToGeoJSON } from '../store/geojson';
import { circlePolygon, destination } from '../geo/geo';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const NITEROI_CENTER: [number, number] = [-43.1036, -22.8832];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface Draft {
  lat: number;
  lon: number;
  bearing: number | null;
}

interface Props {
  fix: Fix | null;
  heading: number | null;
  lights: TrafficLight[];
  nextId: string | null;
  follow: boolean;
  draft: Draft | null;
  onUserPan(): void;
  onMapClick(lat: number, lon: number): void;
  onLightClick(id: string, lat: number, lon: number): void;
  onReady(map: MlMap): void;
}

function arrowImage(): ImageData {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(s / 2, 2);
  ctx.lineTo(s - 8, s - 6);
  ctx.lineTo(s / 2, s - 16);
  ctx.lineTo(8, s - 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

function addLayers(map: MlMap): void {
  map.addImage('tl-arrow', arrowImage(), { pixelRatio: 2 });
  for (const id of ['lights', 'user', 'accuracy', 'draft']) map.addSource(id, { type: 'geojson', data: EMPTY });

  map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#2196f3', 'fill-opacity': 0.15 } });
  map.addLayer({
    id: 'lights-circle', type: 'circle', source: 'lights',
    paint: { 'circle-radius': 12, 'circle-color': '#e53935', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'lights-arrow', type: 'symbol', source: 'lights',
    layout: {
      'icon-image': 'tl-arrow',
      'icon-rotate': ['get', 'approachBearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'draft-line', type: 'line', source: 'draft', filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ffc107', 'line-width': 4 },
  });
  map.addLayer({
    id: 'draft-point', type: 'circle', source: 'draft', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 8, 'circle-color': '#ffc107', 'circle-stroke-color': '#000000', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'user-dot', type: 'circle', source: 'user',
    paint: { 'circle-radius': 9, 'circle-color': '#2196f3', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
}

export function MapView(props: Props) {
  const { fix, heading, lights, nextId, follow, draft } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: STYLE_URL,
      center: NITEROI_CENTER,
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('load', () => {
      addLayers(map);
      setLoaded(true);
      cb.current.onReady(map);
    });
    map.on('dragstart', () => cb.current.onUserPan());
    map.on('click', (e) => {
      if (map.getLayer('lights-circle')) {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['lights-circle'] })[0];
        const id = hit?.properties?.id;
        if (hit && typeof id === 'string' && hit.geometry.type === 'Point') {
          const [lon, lat] = hit.geometry.coordinates;
          cb.current.onLightClick(id, lat, lon);
          return;
        }
      }
      cb.current.onMapClick(e.lngLat.lat, e.lngLat.lng);
    });
    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (mapRef.current!.getSource('lights') as GeoJSONSource).setData(lightsToGeoJSON(lights));
  }, [loaded, lights]);

  useEffect(() => {
    if (!loaded) return;
    mapRef.current!.setPaintProperty('lights-circle', 'circle-color', [
      'case', ['==', ['get', 'id'], nextId ?? ''], '#ffc107', '#e53935',
    ]);
  }, [loaded, nextId]);

  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current!;
    const userData: FeatureCollection = fix
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] }, properties: {} }] }
      : EMPTY;
    const accData: FeatureCollection = fix
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(fix, fix.accuracy)] }, properties: {} }] }
      : EMPTY;
    (map.getSource('user') as GeoJSONSource).setData(userData);
    (map.getSource('accuracy') as GeoJSONSource).setData(accData);
  }, [loaded, fix]);

  useEffect(() => {
    if (!loaded || !follow || !fix) return;
    const map = mapRef.current!;
    map.easeTo({
      center: [fix.lon, fix.lat],
      bearing: heading ?? map.getBearing(),
      zoom: Math.max(map.getZoom(), 16.5),
      duration: 800,
    });
  }, [loaded, follow, fix, heading]);

  useEffect(() => {
    if (!loaded) return;
    const features: Feature[] = [];
    if (draft) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [draft.lon, draft.lat] }, properties: {} });
      if (draft.bearing !== null) {
        const end = destination(draft, draft.bearing, 30);
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[draft.lon, draft.lat], [end.lon, end.lat]] },
          properties: {},
        });
      }
    }
    (mapRef.current!.getSource('draft') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [loaded, draft]);

  return <div ref={containerRef} className="map" />;
}
