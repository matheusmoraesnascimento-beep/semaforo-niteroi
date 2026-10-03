import type { LatLon } from '../types';

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface RouteResult {
  line: LatLon[];
  distanceM: number;
  durationS: number;
}

export type SlotName = 'home' | 'work';

export interface SavedPlaces {
  home?: Place;
  work?: Place;
}
