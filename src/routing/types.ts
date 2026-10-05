import type { LatLon } from '../types';

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export type CongestionLevel = 'unknown' | 'low' | 'moderate' | 'heavy' | 'severe';

export interface RouteResult {
  line: LatLon[];
  congestion: CongestionLevel[]; // um nível por trecho (line.length - 1); vazio se o serviço não informou
  distanceM: number;
  durationS: number;
}

export type SlotName = 'home' | 'work';

export interface SavedPlaces {
  home?: Place;
  work?: Place;
}
