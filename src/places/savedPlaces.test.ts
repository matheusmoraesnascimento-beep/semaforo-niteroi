import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadPlaces, savePlaces, withPlace } from './savedPlaces';

function stubStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('savedPlaces', () => {
  it('vazio → {}', () => {
    stubStorage();
    expect(loadPlaces()).toEqual({});
  });

  it('grava e lê de volta', () => {
    stubStorage();
    const p = withPlace({}, 'home', { name: 'Casa X', lat: -22.9, lon: -43.1 });
    savePlaces(p);
    expect(loadPlaces()).toEqual({ home: { name: 'Casa X', lat: -22.9, lon: -43.1 } });
  });

  it('withPlace troca só o espaço pedido', () => {
    const a = { name: 'A', lat: 1, lon: 2 };
    const b = { name: 'B', lat: 3, lon: 4 };
    expect(withPlace({ home: a }, 'work', b)).toEqual({ home: a, work: b });
    expect(withPlace({ home: a }, 'home', b)).toEqual({ home: b });
  });

  it('JSON inválido ou lugar malformado → ignora', () => {
    stubStorage({ 'semaforo-niteroi:places:v1': '{nao é json' });
    expect(loadPlaces()).toEqual({});
    stubStorage({ 'semaforo-niteroi:places:v1': JSON.stringify({ home: { name: 'X' }, work: { name: 'W', lat: 1, lon: 2 } }) });
    expect(loadPlaces()).toEqual({ work: { name: 'W', lat: 1, lon: 2 } });
  });

  it('armazenamento indisponível não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadPlaces()).toEqual({});
    expect(() => savePlaces({ home: { name: 'A', lat: 1, lon: 2 } })).not.toThrow();
  });
});
