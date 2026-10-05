import { describe, it, expect } from 'vitest';
import { loadProfile, parseProfile, saveProfile, serializeProfile, type KV } from './profileStore';
import { addFavorite, addRecent, defaultProfile, setSlot } from './profile';

const A = { name: 'Plaza Shopping', lat: -22.8969, lon: -43.124 };

function fakeKV(initial: Record<string, string> = {}): KV & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const KEY = 'semaforo-niteroi:profile:v1';
const OLD = 'semaforo-niteroi:places:v1';

describe('parseProfile', () => {
  it('ida e volta preserva o perfil', () => {
    let p = setSlot(defaultProfile(), 'home', A);
    p = addFavorite(p, A, 'f1', '2026-10-05T00:00:00.000Z').profile;
    p = addRecent(p, A);
    expect(parseProfile(JSON.parse(serializeProfile(p)))).toEqual(p);
  });

  it.each([null, 'x', 42, [], {}, { version: 2 }])('rejeita %j', (raw) => {
    expect(parseProfile(raw)).toBeNull();
  });

  it('descarta itens com coordenadas inválidas e campos desconhecidos', () => {
    const raw = {
      version: 1,
      name: 'X',
      hacker: true,
      favorites: [
        { id: 'a', name: 'ok', lat: -22.9, lon: -43.1, createdAt: 'd' },
        { id: 'b', name: 'nan', lat: NaN, lon: -43.1, createdAt: 'd' },
        { id: 'c', name: 'str', lat: '1', lon: 2, createdAt: 'd' },
        { id: 'd', name: 'fora', lat: 95, lon: 0, createdAt: 'd' },
        { name: 'sem id', lat: -22.8, lon: -43.1 },
      ],
      recents: [{ name: 'r', lat: -22.9, lon: 190 }, { name: 'r2', lat: -22.7, lon: -43.2 }],
      home: { name: 'h', lat: 'x', lon: 1 },
      settings: { keepAwake: 'sim', showTraffic: false },
    };
    const p = parseProfile(raw)!;
    expect(p.favorites.map((f) => f.id)).toEqual(['a']);
    expect(p.recents.map((r) => r.name)).toEqual(['r2']);
    expect(p.home).toBeUndefined();
    expect(p.settings).toEqual({ keepAwake: true, showTraffic: false });
    expect('hacker' in p).toBe(false);
  });

  it('nome vazio vira o padrão', () => {
    expect(parseProfile({ version: 1, name: '  ' })!.name).toBe('Motorista');
  });

  it('favoritos a menos de 30 m viram um só', () => {
    const f = (id: string, lon: number) => ({ id, name: id, lat: -22.9, lon, createdAt: 'd' });
    expect(parseProfile({ version: 1, favorites: [f('a', -43.1), f('b', -43.10005)] })!.favorites).toHaveLength(1);
  });
});

describe('loadProfile / saveProfile', () => {
  it('sem nada guardado → perfil padrão', () => {
    expect(loadProfile(fakeKV())).toEqual(defaultProfile());
  });

  it('guarda e relê', () => {
    const kv = fakeKV();
    const p = addRecent(defaultProfile(), A);
    saveProfile(p, kv);
    expect(loadProfile(kv)).toEqual(p);
  });

  it('migra Casa e Trabalho da chave antiga e mantém a chave antiga', () => {
    const old = JSON.stringify({ home: A, work: { name: 'Trab', lat: -22.9, lon: -43.2 } });
    const kv = fakeKV({ [OLD]: old });
    const p = loadProfile(kv);
    expect(p.home).toEqual(A);
    expect(p.work?.name).toBe('Trab');
    expect(kv.data.get(OLD)).toBe(old);
  });

  it('perfil novo existente vence a chave antiga', () => {
    const mine = setSlot(defaultProfile(), 'home', { name: 'Nova', lat: -22.5, lon: -43.5 });
    const kv = fakeKV({ [KEY]: serializeProfile(mine), [OLD]: JSON.stringify({ home: A }) });
    expect(loadProfile(kv).home?.name).toBe('Nova');
  });

  it('JSON corrompido → perfil padrão, sem exceção', () => {
    expect(loadProfile(fakeKV({ [KEY]: '{"version":1,"na' }))).toEqual(defaultProfile());
    expect(loadProfile(fakeKV({ [OLD]: '{not json' }))).toEqual(defaultProfile());
  });

  it('armazenamento que lança → padrão e não propaga', () => {
    const boom: KV = {
      getItem: () => {
        throw new Error('negado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    expect(loadProfile(boom)).toEqual(defaultProfile());
    expect(() => saveProfile(defaultProfile(), boom)).not.toThrow();
  });
});
