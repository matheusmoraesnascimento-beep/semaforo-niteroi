import { describe, it, expect, vi } from 'vitest';
import { searchPlaces } from './geocode';

const okJson = (data: unknown) =>
  vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, status: 200, json: async () => data }) as Response);

const feature = (properties: object, lon: number, lat: number) => ({
  features: [{ properties, geometry: { coordinates: [lon, lat] } }],
});

describe('searchPlaces', () => {
  it('converte features: [lon, lat] e nome com rua e número', async () => {
    const f = okJson(feature({ name: 'Plaza Shopping', street: 'Rua 15 de Novembro', housenumber: '8', district: 'Centro' }, -43.124, -22.897));
    const r = await searchPlaces('plaza shopping', f);
    expect(r).toEqual([{ name: 'Plaza Shopping, Rua 15 de Novembro, 8, Centro', lat: -22.897, lon: -43.124 }]);
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.searchParams.get('q')).toBe('plaza shopping');
    expect(url.searchParams.get('bbox')).toBeTruthy();
    expect(url.searchParams.get('lat')).toBeTruthy();
  });

  it('ignora itens sem nome ou com coordenadas inválidas', async () => {
    const data = {
      features: [
        ...feature({ name: 'A' }, Number.NaN, -22.9).features,
        ...feature({}, -43.1, -22.9).features,
        ...feature({ name: 'B' }, -43.1, -22.9).features,
      ],
    };
    const r = await searchPlaces('x', okJson(data));
    expect(r.map((p) => p.name)).toEqual(['B']);
  });

  it('sem resultados → lista vazia', async () => {
    expect(await searchPlaces('zzz', okJson({ features: [] }))).toEqual([]);
  });

  it('HTTP com erro → ServiceError http', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
    await expect(searchPlaces('x', f)).rejects.toMatchObject({ kind: 'http' });
  });

  it('falha de rede → ServiceError network', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(searchPlaces('x', f)).rejects.toMatchObject({ kind: 'network' });
  });

  it('resposta que não é lista → ServiceError format', async () => {
    await expect(searchPlaces('x', okJson({ error: 'x' }))).rejects.toMatchObject({ kind: 'format' });
  });
});
