import { describe, it, expect } from 'vitest';
import { lightsOnRoute } from './routeLights';
import type { LatLon, TrafficLight } from '../types';

const mk = (id: string, lat: number, lon: number, approachBearing: number): TrafficLight => ({
  id,
  lat,
  lon,
  approachBearing,
  createdAt: '2026-01-01T00:00:00Z',
  source: 'manual',
});

// rota reta para o norte (rumo 0°), ~1,1 km
const line: LatLon[] = [
  { lat: -22.9, lon: -43.1 },
  { lat: -22.89, lon: -43.1 },
];

describe('lightsOnRoute', () => {
  it('inclui os da rota (mesmo sentido, perto) e exclui rua paralela e sentido contrário', () => {
    const lights = [
      mk('D', -22.8925, -43.1, 10), // na rota, 10° de diferença
      mk('B', -22.895, -43.0996, 0), // ~41 m ao lado: rua paralela
      mk('C', -22.895, -43.1, 180), // na rota, mas sentido contrário
      mk('A', -22.895, -43.1, 0), // na rota
      mk('E', -22.8975, -43.0998, 0), // ~20 m ao lado: ainda conta
    ];
    expect(lightsOnRoute(line, lights).map((r) => r.light.id)).toEqual(['E', 'A', 'D']);
  });

  it('devolve a distância acumulada ao longo da rota, crescente', () => {
    const r = lightsOnRoute(line, [mk('A', -22.895, -43.1, 0), mk('D', -22.8925, -43.1, 0)]);
    expect(r[0].alongM).toBeGreaterThan(500);
    expect(r[0].alongM).toBeLessThan(600);
    expect(r[1].alongM).toBeGreaterThan(r[0].alongM);
  });

  it('rota com menos de 2 pontos não tem semáforos', () => {
    expect(lightsOnRoute([{ lat: -22.9, lon: -43.1 }], [mk('A', -22.9, -43.1, 0)])).toEqual([]);
  });
});
