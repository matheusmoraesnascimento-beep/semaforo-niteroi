import type { LatLon } from '../types';
import type { CongestionLevel } from './types';

export interface CongestionRun {
  level: Exclude<CongestionLevel, 'unknown'>;
  coords: [number, number][]; // [lon, lat]
}

/** Agrupa trechos vizinhos de mesmo nível; sem dados compatíveis, a rota inteira é `low`. */
export function congestionRuns(line: LatLon[], congestion: CongestionLevel[]): CongestionRun[] {
  if (line.length < 2) return [];
  const aligned = congestion.length === line.length - 1;
  const runs: CongestionRun[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const raw = aligned ? congestion[i] : 'low';
    const level = raw === 'unknown' ? 'low' : raw;
    const a: [number, number] = [line[i].lon, line[i].lat];
    const b: [number, number] = [line[i + 1].lon, line[i + 1].lat];
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.coords.push(b);
    else runs.push({ level, coords: [a, b] });
  }
  return runs;
}
