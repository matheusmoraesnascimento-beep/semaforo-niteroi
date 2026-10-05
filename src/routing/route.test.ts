import { describe, it, expect, vi } from 'vitest';
import { fetchRoute } from './route';
import { ServiceError, errorMessage } from './errors';

const from = { lat: -22.8832, lon: -43.1036 };
const to = { lat: -22.9, lon: -43.095 };
const TOKEN = 'pk.teste';

const okJson = (data: unknown) =>
  vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, status: 200, json: async () => data }) as Response);

describe('fetchRoute', () => {
  it('converte a geometria [lon,lat] em LatLon e devolve distância e duração com trânsito', async () => {
    const f = okJson({
      code: 'Ok',
      routes: [{ distance: 1234.5, duration: 321, geometry: { coordinates: [[-43.1036, -22.8832], [-43.095, -22.9]] } }],
    });
    const r = await fetchRoute(from, to, f, TOKEN);
    expect(r.line).toEqual([
      { lat: -22.8832, lon: -43.1036 },
      { lat: -22.9, lon: -43.095 },
    ]);
    expect(r.distanceM).toBe(1234.5);
    expect(r.durationS).toBe(321);
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.pathname).toBe('/directions/v5/mapbox/driving-traffic/-43.1036,-22.8832;-43.095,-22.9');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('language')).toBe('pt-BR');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('sem token → ServiceError config, sem chamar a rede', async () => {
    const f = vi.fn();
    await expect(fetchRoute(from, to, f, '')).rejects.toMatchObject({ kind: 'config' });
    expect(f).not.toHaveBeenCalled();
  });

  it('NoRoute e NoSegment → ServiceError no-route', async () => {
    await expect(fetchRoute(from, to, okJson({ code: 'NoRoute' }), TOKEN)).rejects.toMatchObject({ kind: 'no-route' });
    await expect(fetchRoute(from, to, okJson({ code: 'NoSegment' }), TOKEN)).rejects.toMatchObject({ kind: 'no-route' });
  });

  it('routes vazio → ServiceError no-route', async () => {
    await expect(fetchRoute(from, to, okJson({ code: 'Ok', routes: [] }), TOKEN)).rejects.toMatchObject({ kind: 'no-route' });
  });

  it.each([401, 403, 429, 500])('HTTP %i → ServiceError http', async (status) => {
    const f = vi.fn(async () => ({ ok: false, status }) as Response);
    await expect(fetchRoute(from, to, f, TOKEN)).rejects.toMatchObject({ kind: 'http' });
  });

  it('falha de rede → ServiceError network', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const p = fetchRoute(from, to, f, TOKEN);
    await expect(p).rejects.toBeInstanceOf(ServiceError);
    await expect(p).rejects.toMatchObject({ kind: 'network' });
  });

  it('resposta fora do formato → ServiceError format', async () => {
    await expect(fetchRoute(from, to, okJson({ code: 'Ok', routes: [{}] }), TOKEN)).rejects.toMatchObject({ kind: 'format' });
  });
});

describe('errorMessage', () => {
  it('config → pede o token do Mapbox', () => {
    expect(errorMessage(new ServiceError('config', 'x'))).toBe('Token do Mapbox não configurado.');
  });
});
