import { describe, it, expect, vi } from 'vitest';
import { fetchRoute } from './route';
import { ServiceError } from './errors';

const from = { lat: -22.8832, lon: -43.1036 };
const to = { lat: -22.9, lon: -43.095 };

const okJson = (data: unknown) =>
  vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, status: 200, json: async () => data }) as Response);

describe('fetchRoute', () => {
  it('converte a geometria [lon,lat] em LatLon e devolve distância e duração', async () => {
    const f = okJson({
      code: 'Ok',
      routes: [{ distance: 1234.5, duration: 321, geometry: { coordinates: [[-43.1036, -22.8832], [-43.095, -22.9]] } }],
    });
    const r = await fetchRoute(from, to, f);
    expect(r.line).toEqual([
      { lat: -22.8832, lon: -43.1036 },
      { lat: -22.9, lon: -43.095 },
    ]);
    expect(r.distanceM).toBe(1234.5);
    expect(r.durationS).toBe(321);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/driving/-43.1036,-22.8832;-43.095,-22.9');
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=geojson');
  });

  it('sem rota → ServiceError no-route', async () => {
    await expect(fetchRoute(from, to, okJson({ code: 'NoRoute' }))).rejects.toMatchObject({ kind: 'no-route' });
  });

  it('HTTP com erro → ServiceError http', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    await expect(fetchRoute(from, to, f)).rejects.toMatchObject({ kind: 'http' });
  });

  it('falha de rede → ServiceError network', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const p = fetchRoute(from, to, f);
    await expect(p).rejects.toBeInstanceOf(ServiceError);
    await expect(p).rejects.toMatchObject({ kind: 'network' });
  });

  it('resposta fora do formato → ServiceError format', async () => {
    await expect(fetchRoute(from, to, okJson({ code: 'Ok', routes: [{}] }))).rejects.toMatchObject({ kind: 'format' });
  });
});
