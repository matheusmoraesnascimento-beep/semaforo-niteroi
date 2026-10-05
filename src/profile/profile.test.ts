import { describe, it, expect } from 'vitest';
import {
  addFavorite, addRecent, buildSuggestions, clearRecents, defaultProfile, mergeImported,
  removeFavorite, renameFavorite, setName, setSetting, setSlot, MAX_RECENTS,
} from './profile';
import { destination } from '../geo/geo';
import type { Place } from '../routing/types';

const A: Place = { name: 'Plaza Shopping', lat: -22.8969, lon: -43.1240 };
const B: Place = { name: 'Barra Shopping', lat: -23.0004, lon: -43.3586 };
const near = (p: Place, m: number): Place => ({ ...p, ...destination(p, 90, m), name: 'perto' });
const NOW = '2026-10-05T12:00:00.000Z';

describe('defaultProfile', () => {
  it('nome padrão e ajustes ligados', () => {
    const p = defaultProfile();
    expect(p).toMatchObject({ version: 1, name: 'Motorista', favorites: [], recents: [], settings: { keepAwake: true, showTraffic: true } });
  });
});

describe('favoritos', () => {
  it('adiciona e devolve added=true', () => {
    const r = addFavorite(defaultProfile(), A, 'f1', NOW);
    expect(r.added).toBe(true);
    expect(r.profile.favorites).toEqual([{ ...A, id: 'f1', createdAt: NOW }]);
  });

  it('não duplica a menos de 30 m', () => {
    const once = addFavorite(defaultProfile(), A, 'f1', NOW).profile;
    const twice = addFavorite(once, near(A, 20), 'f2', NOW);
    expect(twice.added).toBe(false);
    expect(twice.profile.favorites).toHaveLength(1);
  });

  it('aceita pontos a mais de 30 m', () => {
    const once = addFavorite(defaultProfile(), A, 'f1', NOW).profile;
    expect(addFavorite(once, near(A, 60), 'f2', NOW).added).toBe(true);
  });

  it('renomeia e ignora nome vazio', () => {
    const p = addFavorite(defaultProfile(), A, 'f1', NOW).profile;
    expect(renameFavorite(p, 'f1', '  Shopping  ').favorites[0].name).toBe('Shopping');
    expect(renameFavorite(p, 'f1', '   ').favorites[0].name).toBe('Plaza Shopping');
  });

  it('remove por id', () => {
    const p = addFavorite(defaultProfile(), A, 'f1', NOW).profile;
    expect(removeFavorite(p, 'f1').favorites).toEqual([]);
  });
});

describe('Casa e Trabalho', () => {
  it('define e limpa o slot', () => {
    const p = setSlot(defaultProfile(), 'home', A);
    expect(p.home).toEqual(A);
    expect(setSlot(p, 'home', undefined).home).toBeUndefined();
    expect(setSlot(defaultProfile(), 'work', B).work).toEqual(B);
  });
});

describe('recentes', () => {
  it('mais novo primeiro', () => {
    const p = addRecent(addRecent(defaultProfile(), A), B);
    expect(p.recents.map((r) => r.name)).toEqual(['Barra Shopping', 'Plaza Shopping']);
  });

  it('repetido (≤30 m) sobe para o topo sem duplicar', () => {
    const p = addRecent(addRecent(addRecent(defaultProfile(), A), B), near(A, 10));
    expect(p.recents).toHaveLength(2);
    expect(p.recents[0].name).toBe('perto');
  });

  it('teto de 20', () => {
    let p = defaultProfile();
    for (let i = 0; i < MAX_RECENTS + 5; i++) p = addRecent(p, { name: `L${i}`, lat: -22.9 + i * 0.01, lon: -43.1 });
    expect(p.recents).toHaveLength(MAX_RECENTS);
    expect(p.recents[0].name).toBe(`L${MAX_RECENTS + 4}`);
  });

  it('limpa', () => {
    expect(clearRecents(addRecent(defaultProfile(), A)).recents).toEqual([]);
  });
});

describe('nome e ajustes', () => {
  it('nome com trim; vazio mantém o anterior', () => {
    expect(setName(defaultProfile(), '  Matheus ').name).toBe('Matheus');
    expect(setName(defaultProfile(), '   ').name).toBe('Motorista');
  });

  it('liga e desliga um ajuste', () => {
    const p = setSetting(defaultProfile(), 'showTraffic', false);
    expect(p.settings).toEqual({ keepAwake: true, showTraffic: false });
  });
});

describe('mergeImported', () => {
  it('une favoritos e recentes sem duplicar; nome e ajustes vêm do arquivo', () => {
    const cur = addRecent(addFavorite(defaultProfile(), A, 'f1', NOW).profile, A);
    const imp = setName(setSetting(addRecent(addFavorite(addFavorite(defaultProfile(), A, 'x1', NOW).profile, B, 'x2', NOW).profile, B), 'keepAwake', false), 'Outro');
    const m = mergeImported(cur, imp);
    expect(m.favorites.map((f) => f.name)).toEqual(['Plaza Shopping', 'Barra Shopping']);
    expect(m.recents.map((r) => r.name)).toEqual(['Plaza Shopping', 'Barra Shopping']);
    expect(m.name).toBe('Outro');
    expect(m.settings.keepAwake).toBe(false);
  });

  it('Casa e Trabalho do arquivo só preenchem o que está vazio', () => {
    const cur = setSlot(defaultProfile(), 'home', A);
    const imp = setSlot(setSlot(defaultProfile(), 'home', B), 'work', B);
    const m = mergeImported(cur, imp);
    expect(m.home).toEqual(A);
    expect(m.work).toEqual(B);
  });

  it('ids de favoritos continuam únicos quando o arquivo repete um id', () => {
    const cur = addFavorite(defaultProfile(), A, 'f1', NOW).profile;
    const imp = addFavorite(defaultProfile(), B, 'f1', NOW).profile;
    const ids = mergeImported(cur, imp).favorites.map((f) => f.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('buildSuggestions', () => {
  it('Casa, Trabalho, favoritos e até 5 recentes, nessa ordem', () => {
    let p = setSlot(setSlot(defaultProfile(), 'home', A), 'work', B);
    p = addFavorite(p, { name: 'Fav', lat: -22.5, lon: -43.0 }, 'f1', NOW).profile;
    for (let i = 0; i < 7; i++) p = addRecent(p, { name: `R${i}`, lat: -22.7 + i * 0.01, lon: -43.2 });
    const s = buildSuggestions(p);
    expect(s.map((x) => x.title)).toEqual(['Casa', 'Trabalho', 'Fav', 'R6', 'R5', 'R4', 'R3', 'R2']);
    expect(s[0].place).toEqual(A);
    expect(new Set(s.map((x) => x.key)).size).toBe(s.length);
  });

  it('perfil vazio → sem sugestões', () => {
    expect(buildSuggestions(defaultProfile())).toEqual([]);
  });
});
