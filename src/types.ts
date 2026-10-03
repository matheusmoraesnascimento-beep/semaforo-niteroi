export interface LatLon {
  lat: number;
  lon: number;
}

export interface Fix extends LatLon {
  accuracy: number; // metros
  speed: number | null; // m/s
  heading: number | null; // graus 0–360, null se desconhecido
  timestamp: number; // ms
}

export interface TrafficLight {
  id: string;
  lat: number;
  lon: number;
  approachBearing: number; // direção de deslocamento dos veículos controlados, 0–360
  name?: string;
  createdAt: string;
  source: 'manual';
}

export type NextResult =
  | { kind: 'found'; light: TrafficLight; distance: number }
  | { kind: 'none' }
  | { kind: 'no-heading' };

export interface RoadSegment {
  id: string;
  name: string | null;
  oneway: 0 | 1 | -1; // 1 = sentido da geometria; -1 = contrário; 0 = mão dupla
  coords: [number, number][]; // [lon, lat]
}

export interface RoadSource {
  segmentsNear(lat: number, lon: number, radiusM: number): RoadSegment[];
  namedSegmentsNear(lat: number, lon: number, radiusM: number): RoadSegment[];
}

export interface LocationSource {
  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void;
  stop(): void;
}

export interface LocalState {
  lights: TrafficLight[];
  deleted: string[];
}
