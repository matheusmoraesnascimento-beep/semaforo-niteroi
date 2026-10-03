import { describe, it, expect, vi } from 'vitest';
import { searchPlaces } from './geocode';

const okJson = (data: unknown) =>
  vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, status: 200, json: async () => data }) as Response);

describe('searchPlaces', () => {
  it('converte resultados: lat/lon string → número e nome curto', async () => {
    const f = okJson([
      { lat: '-22.8905', lon: '-43.1248', display_name: 'Plaza Shopping, Rua Quinze de Novembro, Centro, Niterói, Região Geográfica Imediata, Rio de Janeiro, Brasil' },
    ]);
    const r = await searchPlaces('plaza shopping', f);
    expect(r).toEqual([{ name: 'Plaza Shopping, Rua Quinze de Novembro, Centro', lat: -22.8905, lon: -43.1248 }]);
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.searchParams.get('q')).toBe('plaza shopping');
    expect(url.searchParams.get('countrycodes')).toBe('br');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('accept-language')).toBe('pt-BR');
  });

  it('ignora itens com coordenadas inválidas', async () => {
    const r = await searchPlaces('x', okJson([{ lat: 'abc', lon: '1', display_name: 'A' }, { lat: '-22.9', lon: '-43.1', display_name: 'B' }]));
    expect(r.map((p) => p.name)).toEqual(['B']);
  });

  it('sem resultados → lista vazia', async () => {
    expect(await searchPlaces('zzz', okJson([]))).toEqual([]);
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
