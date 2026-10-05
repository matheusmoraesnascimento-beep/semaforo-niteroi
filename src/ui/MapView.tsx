import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MbMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Feature, FeatureCollection } from 'geojson';
import type { Fix, LatLon, TrafficLight } from '../types';
import type { CongestionLevel } from '../routing/types';
import { congestionRuns } from '../routing/congestion';
import { lightsToGeoJSON } from '../store/geojson';
import { circlePolygon, destination, lerpAngle } from '../geo/geo';
import { MAPBOX_TOKEN, STYLE_URL } from '../mapbox';

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
  navigating: boolean; // rota ativa: câmera inclinada e à frente do carro
  draft: Draft | null;
  routeLine: LatLon[] | null;
  routeCongestion: CongestionLevel[] | null;
  routeIds: Set<string> | null; // semáforos da rota; os demais ficam esmaecidos
  fitRoute: boolean; // enquadra a rota inteira (pré-visualização)
  onUserPan(): void;
  onMapClick(lat: number, lon: number): void;
  onLightClick(id: string, lat: number, lon: number): void;
  onReady(map: MbMap): void;
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

function navArrowImage(): ImageData {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(s / 2, 4);
  ctx.lineTo(s - 10, s - 8);
  ctx.lineTo(s / 2, s - 20);
  ctx.lineTo(10, s - 8);
  ctx.closePath();
  ctx.fillStyle = '#1a73e8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

const NAV_PITCH = 60;
const NAV_ZOOM_SLOW = 17.5;
const NAV_ZOOM_FAST = 16.3;
const HEADING_SMOOTHING = 0.5;

function navZoom(speed: number | null): number {
  const t = Math.min(Math.max(((speed ?? 0) * 3.6 - 20) / 60, 0), 1);
  return NAV_ZOOM_SLOW + (NAV_ZOOM_FAST - NAV_ZOOM_SLOW) * t;
}

function addLayers(map: MbMap): void {
  map.addImage('tl-arrow', arrowImage(), { pixelRatio: 2 });
  map.addImage('user-nav', navArrowImage(), { pixelRatio: 2 });
  for (const id of ['lights', 'user', 'accuracy', 'draft', 'route']) map.addSource(id, { type: 'geojson', data: EMPTY });

  map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#2196f3', 'fill-opacity': 0.15 } });
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'level'], 'moderate', '#f9ab00', 'heavy', '#d93025', 'severe', '#7b1113', '#1a73e8'],
      'line-width': 7,
      'line-opacity': 0.9,
    },
  });
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
    id: 'user-dot', type: 'circle', source: 'user', filter: ['!', ['get', 'hasHeading']],
    paint: { 'circle-radius': 9, 'circle-color': '#2196f3', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
  map.addLayer({
    id: 'user-arrow', type: 'symbol', source: 'user', filter: ['get', 'hasHeading'],
    layout: {
      'icon-image': 'user-nav',
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

export function MapView(props: Props) {
  const { fix, heading, lights, nextId, follow, navigating, draft, routeLine, routeCongestion, routeIds, fitRoute } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MbMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const smoothHeading = useRef<number | null>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapError('Token do Mapbox ausente (defina VITE_MAPBOX_TOKEN).');
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current!,
      style: STYLE_URL,
      center: NITEROI_CENTER,
      zoom: 15,
      attributionControl: true,
    });
    mapRef.current = map;
    map.on('load', () => {
      addLayers(map);
      setLoaded(true);
      cb.current.onReady(map);
    });
    map.on('error', (e) => setMapError(String(e.error?.message ?? e.error ?? 'erro desconhecido')));
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
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] }, properties: { hasHeading: heading !== null, heading: heading ?? 0 } }] }
      : EMPTY;
    const accData: FeatureCollection = fix
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(fix, fix.accuracy)] }, properties: {} }] }
      : EMPTY;
    (map.getSource('user') as GeoJSONSource).setData(userData);
    (map.getSource('accuracy') as GeoJSONSource).setData(accData);
  }, [loaded, fix, heading]);

  useEffect(() => {
    if (!loaded || !follow || !fix) return;
    const map = mapRef.current!;
    if (heading !== null) {
      smoothHeading.current =
        smoothHeading.current === null ? heading : lerpAngle(smoothHeading.current, heading, HEADING_SMOOTHING);
    }
    const bearing = smoothHeading.current ?? map.getBearing();
    if (navigating) {
      map.easeTo({
        center: [fix.lon, fix.lat],
        bearing,
        pitch: NAV_PITCH,
        zoom: navZoom(fix.speed),
        padding: { top: map.getContainer().clientHeight * 0.45, bottom: 0, left: 0, right: 0 },
        duration: 1000,
        easing: (t) => t,
      });
      return;
    }
    map.easeTo({
      center: [fix.lon, fix.lat],
      bearing,
      pitch: 0,
      zoom: Math.max(map.getZoom(), 16.5),
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 800,
    });
  }, [loaded, follow, navigating, fix, heading]);

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

  useEffect(() => {
    if (!loaded) return;
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: routeLine
        ? congestionRuns(routeLine, routeCongestion ?? []).map((run) => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: run.coords },
            properties: { level: run.level },
          }))
        : [],
    };
    (mapRef.current!.getSource('route') as GeoJSONSource).setData(data);
  }, [loaded, routeLine, routeCongestion]);

  useEffect(() => {
    if (!loaded || !fitRoute || !routeLine || routeLine.length < 2) return;
    const bounds = new mapboxgl.LngLatBounds();
    routeLine.forEach((p) => bounds.extend([p.lon, p.lat]));
    mapRef.current!.fitBounds(bounds, { padding: { top: 140, bottom: 300, left: 40, right: 40 }, duration: 600 });
  }, [loaded, fitRoute, routeLine]);

  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current!;
    const opacity: number | ExpressionSpecification = routeIds
      ? (['case', ['in', ['get', 'id'], ['literal', [...routeIds]]], 1, 0.25] as ExpressionSpecification)
      : 1;
    map.setPaintProperty('lights-circle', 'circle-opacity', opacity);
    map.setPaintProperty('lights-circle', 'circle-stroke-opacity', opacity);
    map.setPaintProperty('lights-arrow', 'icon-opacity', opacity);
  }, [loaded, routeIds]);

  return (
    <>
      <div ref={containerRef} className="map" />
      {mapError && <div className="map-error">Mapa: {mapError}</div>}
    </>
  );
}
