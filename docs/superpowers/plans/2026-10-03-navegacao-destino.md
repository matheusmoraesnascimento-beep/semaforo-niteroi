# Navegação por destino com alertas de semáforo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário busca um destino (ou usa Casa/Trabalho), o app traça a rota de carro e alerta só os semáforos que estão no caminho.

**Architecture:** Módulos puros e testáveis em `src/routing/` (busca, rota, filtro de semáforos por proximidade à linha, detector de desvio) mais `src/places/` (Casa/Trabalho). Um hook `useNavigation` guarda o estado (idle → loading → preview → active) e entrega ao `App` a lista de semáforos da rota. O `findNextTrafficLight` não muda: com rota ativa, o `App` passa a ele a lista filtrada em vez da completa.

**Tech Stack:** TypeScript, React 19, MapLibre GL 6, Vitest (ambiente `node`, sem jsdom), Nominatim e OSRM públicos (`routing.openstreetmap.de`).

**Spec:** `docs/superpowers/specs/2026-10-03-navegacao-destino-design.md`

**Convenções:**
- Branch: `feat/navegacao` (já criada, com o spec commitado).
- Todo commit termina com a linha de coautoria. Use sempre: `git commit -m "<mensagem>" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.
- Testes rodam com `npx vitest run <arquivo>`; suíte completa com `npm test`; tipos com `npx tsc --noEmit`.
- Os arquivos `android/app/capacitor.build.gradle` e `android/capacitor.settings.gradle` aparecem como modificados por causa do `cap sync`. **Não os inclua nos commits** (use `git add` com caminhos explícitos).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/routing/types.ts` (novo) | `Place`, `RouteResult`, `SavedPlaces`, `SlotName` |
| `src/routing/errors.ts` (novo) | `ServiceError` e `errorMessage()` (texto para o usuário) |
| `src/routing/routeLights.ts` (novo) | semáforos que pertencem à rota, em ordem |
| `src/routing/offRoute.ts` (novo) | distância até a rota e detector de desvio |
| `src/routing/route.ts` (novo) | cliente OSRM |
| `src/routing/geocode.ts` (novo) | cliente Nominatim |
| `src/routing/useNavigation.ts` (novo) | estado da navegação, recálculo, chegada |
| `src/places/savedPlaces.ts` (novo) | Casa/Trabalho em `localStorage` |
| `src/ui/format.ts` (editar) | `formatDuration` |
| `src/ui/SearchBar.tsx` (novo) | busca com sugestões e atalhos Casa/Trabalho |
| `src/ui/RouteCard.tsx` (novo) | cartão de pré-visualização e barra da rota ativa |
| `src/ui/MapView.tsx` (editar) | camada da linha da rota, enquadramento, semáforos fora da rota esmaecidos |
| `src/App.tsx` (editar) | integra tudo |
| `src/index.css` (editar) | estilos novos |

---

### Task 1: Tipos, erros e `formatDuration`

**Files:**
- Create: `src/routing/types.ts`, `src/routing/errors.ts`
- Modify: `src/ui/format.ts`, `src/ui/format.test.ts`

- [ ] **Step 1: Confirmar o formato das respostas dos serviços e o CORS**

Run (PowerShell ou Git Bash):
```bash
curl -s -i "https://routing.openstreetmap.de/routed-car/route/v1/driving/-43.1036,-22.8832;-43.0950,-22.9000?overview=full&geometries=geojson" | head -c 900
echo
curl -s -i -H "Origin: https://localhost" "https://nominatim.openstreetmap.org/search?q=Plaza+Shopping+Niteroi&format=jsonv2&countrycodes=br&limit=2&accept-language=pt-BR" | head -c 1200
```
Expected:
- OSRM: `200`, JSON com `"code":"Ok"` e `routes[0].geometry.coordinates` (pares `[lon,lat]`), `distance` (m) e `duration` (s).
- Nominatim: `200`, array de objetos com `lat` e `lon` como **strings** e `display_name`; cabeçalho `access-control-allow-origin` presente nas duas respostas.

Se algum serviço não trouxer `access-control-allow-origin`, pare e avise o usuário: o app (origem `https://localhost` no Android) não conseguiria chamá-lo.

- [ ] **Step 2: `src/routing/types.ts`**

```ts
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
```

- [ ] **Step 3: `src/routing/errors.ts`**

```ts
export type ServiceErrorKind = 'network' | 'http' | 'format' | 'no-route';

export class ServiceError extends Error {
  kind: ServiceErrorKind;

  constructor(kind: ServiceErrorKind, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.kind = kind;
  }
}

/** Texto para o usuário, a partir de qualquer erro dos serviços de busca/rota. */
export function errorMessage(e: unknown): string {
  if (e instanceof ServiceError) {
    switch (e.kind) {
      case 'network':
        return 'Sem conexão. Verifique a internet.';
      case 'no-route':
        return 'Não encontrei rota para esse destino.';
      default:
        return 'O serviço respondeu com erro. Tente de novo.';
    }
  }
  return 'Erro inesperado.';
}
```

- [ ] **Step 4: Teste com falha de `formatDuration`** — em `src/ui/format.test.ts`, trocar o import e acrescentar no fim:

```ts
import { formatDistance, formatDuration } from './format';
```
```ts
describe('formatDuration', () => {
  it('mínimo de 1 min', () => {
    expect(formatDuration(20)).toBe('1 min');
  });
  it('minutos abaixo de 1 h', () => {
    expect(formatDuration(600)).toBe('10 min');
  });
  it('horas exatas e com minutos', () => {
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });
});
```

- [ ] **Step 5: Ver falhar** — `npx vitest run src/ui/format.test.ts`. Expected: FAIL (`formatDuration` não existe / não é função).

- [ ] **Step 6: Implementar** — acrescentar ao fim de `src/ui/format.ts`:

```ts

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
```

- [ ] **Step 7: Ver passar e checar tipos** — `npx vitest run src/ui/format.test.ts && npx tsc --noEmit`. Expected: PASS, sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/routing/types.ts src/routing/errors.ts src/ui/format.ts src/ui/format.test.ts
git commit -m "feat(nav): tipos, erros dos serviços e formatDuration" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `routeLights` — semáforos que estão na rota

**Files:**
- Create: `src/routing/routeLights.ts`
- Test: `src/routing/routeLights.test.ts`

- [ ] **Step 1: Teste com falha** — `src/routing/routeLights.test.ts`:

```ts
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
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/routing/routeLights.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/routing/routeLights.ts`:

```ts
import type { LatLon, TrafficLight } from '../types';
import { angleDiff, distanceM, pointToSegment } from '../geo/geo';

export const ROUTE_LIGHT_DEFAULTS = {
  maxOffsetM: 25,
  bearingToleranceDeg: 45,
};

// pré-filtro barato por caixa (~55 m): evita a trigonometria em segmentos distantes
const BBOX_MARGIN_DEG = 0.0005;

export interface RouteLight {
  light: TrafficLight;
  alongM: number;
}

/**
 * Semáforos que pertencem à rota: a no máximo `maxOffsetM` da linha e com o sentido
 * da rota (no segmento) próximo do `approachBearing`. Ordenados pelo percurso.
 */
export function lightsOnRoute(
  line: LatLon[],
  lights: TrafficLight[],
  opts = ROUTE_LIGHT_DEFAULTS,
): RouteLight[] {
  if (line.length < 2) return [];

  const cum: number[] = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + distanceM(line[i - 1], line[i]));

  const result: RouteLight[] = [];
  for (const light of lights) {
    let best: { distance: number; alongM: number } | null = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (
        light.lat < Math.min(a.lat, b.lat) - BBOX_MARGIN_DEG ||
        light.lat > Math.max(a.lat, b.lat) + BBOX_MARGIN_DEG ||
        light.lon < Math.min(a.lon, b.lon) - BBOX_MARGIN_DEG ||
        light.lon > Math.max(a.lon, b.lon) + BBOX_MARGIN_DEG
      ) {
        continue;
      }
      const { distance, bearing } = pointToSegment(light, [a.lon, a.lat], [b.lon, b.lat]);
      if (distance > opts.maxOffsetM) continue;
      if (angleDiff(bearing, light.approachBearing) > opts.bearingToleranceDeg) continue;
      if (!best || distance < best.distance) {
        best = { distance, alongM: cum[i] + Math.min(distanceM(a, b), distanceM(a, light)) };
      }
    }
    if (best) result.push({ light, alongM: best.alongM });
  }
  return result.sort((x, y) => x.alongM - y.alongM);
}
```

- [ ] **Step 4: Ver passar** — `npx vitest run src/routing/routeLights.test.ts`. Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/routing/routeLights.ts src/routing/routeLights.test.ts
git commit -m "feat(nav): filtro de semáforos por proximidade e sentido da rota" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `offRoute` — distância até a rota e detector de desvio

**Files:**
- Create: `src/routing/offRoute.ts`
- Test: `src/routing/offRoute.test.ts`

- [ ] **Step 1: Teste com falha** — `src/routing/offRoute.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OffRouteDetector, distanceToRoute } from './offRoute';
import type { LatLon } from '../types';

const line: LatLon[] = [
  { lat: -22.9, lon: -43.1 },
  { lat: -22.89, lon: -43.1 },
];

describe('distanceToRoute', () => {
  it('sobre a rota é ~0', () => {
    expect(distanceToRoute({ lat: -22.895, lon: -43.1 }, line)).toBeLessThan(1);
  });
  it('0,0005° ao lado é ~51 m', () => {
    const d = distanceToRoute({ lat: -22.895, lon: -43.0995 }, line);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(60);
  });
});

describe('OffRouteDetector', () => {
  it('desvio curto não dispara', () => {
    const d = new OffRouteDetector();
    expect(d.update(80, 0)).toBe(false);
    expect(d.update(80, 3000)).toBe(false);
    expect(d.update(10, 4000)).toBe(false);
    expect(d.update(80, 6000)).toBe(false); // contagem recomeçou em 6000
  });
  it('desvio de 5 s dispara uma vez e exige novos 5 s para disparar de novo', () => {
    const d = new OffRouteDetector();
    expect(d.update(80, 0)).toBe(false);
    expect(d.update(80, 5000)).toBe(true);
    expect(d.update(80, 5001)).toBe(false);
    expect(d.update(80, 10001)).toBe(true);
  });
  it('dentro do limite (50 m) nunca dispara', () => {
    const d = new OffRouteDetector();
    expect(d.update(50, 0)).toBe(false);
    expect(d.update(50, 60000)).toBe(false);
  });
  it('reset zera a contagem', () => {
    const d = new OffRouteDetector();
    d.update(80, 0);
    d.reset();
    expect(d.update(80, 5000)).toBe(false);
  });
});
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/routing/offRoute.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/routing/offRoute.ts`:

```ts
import type { LatLon } from '../types';
import { pointToSegment } from '../geo/geo';

export const OFF_ROUTE_DEFAULTS = { maxM: 50, holdMs: 5000 };

/** Menor distância (m) da posição até a linha da rota. */
export function distanceToRoute(pos: LatLon, line: LatLon[]): number {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const { distance } = pointToSegment(pos, [line[i].lon, line[i].lat], [line[i + 1].lon, line[i + 1].lat]);
    if (distance < min) min = distance;
  }
  return min;
}

/** Dispara quando a distância fica acima de `maxM` por `holdMs` seguidos. */
export class OffRouteDetector {
  private since: number | null = null;

  constructor(
    private maxM = OFF_ROUTE_DEFAULTS.maxM,
    private holdMs = OFF_ROUTE_DEFAULTS.holdMs,
  ) {}

  update(distanceM: number, nowMs: number): boolean {
    if (distanceM <= this.maxM) {
      this.since = null;
      return false;
    }
    if (this.since === null) {
      this.since = nowMs;
      return false;
    }
    if (nowMs - this.since >= this.holdMs) {
      this.since = null;
      return true;
    }
    return false;
  }

  reset(): void {
    this.since = null;
  }
}
```

Nota: se o `tsconfig` tiver `erasableSyntaxOnly`, o `tsc` rejeita as "parameter properties" do construtor. Nesse caso, troque por campos declarados (`private maxM: number;`) atribuídos no corpo do construtor.

- [ ] **Step 4: Ver passar e checar tipos** — `npx vitest run src/routing/offRoute.test.ts && npx tsc --noEmit`. Expected: PASS (6 testes), sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/routing/offRoute.ts src/routing/offRoute.test.ts
git commit -m "feat(nav): distância até a rota e detector de desvio" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `route` — cliente OSRM

**Files:**
- Create: `src/routing/route.ts`
- Test: `src/routing/route.test.ts`

- [ ] **Step 1: Teste com falha** — `src/routing/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchRoute } from './route';
import { ServiceError } from './errors';

const from = { lat: -22.8832, lon: -43.1036 };
const to = { lat: -22.9, lon: -43.095 };

const okJson = (data: unknown) =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => data }) as Response);

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
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/routing/route.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/routing/route.ts`:

```ts
import type { LatLon } from '../types';
import type { RouteResult } from './types';
import { ServiceError } from './errors';

// Único ponto a trocar se o serviço público ficar instável.
const OSRM_URL = 'https://routing.openstreetmap.de/routed-car/route/v1/driving';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface OsrmResponse {
  code?: string;
  routes?: { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }[];
}

function isLonLat(c: unknown): c is [number, number] {
  return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number';
}

export async function fetchRoute(from: LatLon, to: LatLon, fetchFn: FetchFn = defaultFetch): Promise<RouteResult> {
  const url = `${OSRM_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;

  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new ServiceError('network', 'Falha de rede ao buscar a rota');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} ao buscar a rota`);

  let body: OsrmResponse;
  try {
    body = (await res.json()) as OsrmResponse;
  } catch {
    throw new ServiceError('format', 'Resposta da rota não é JSON');
  }

  if (body.code === 'NoRoute') throw new ServiceError('no-route', 'Sem rota');
  const r = body.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (body.code !== 'Ok' || !r || typeof r.distance !== 'number' || typeof r.duration !== 'number' || !Array.isArray(coords) || !coords.every(isLonLat)) {
    throw new ServiceError('format', 'Resposta da rota fora do formato');
  }

  return {
    line: (coords as [number, number][]).map(([lon, lat]) => ({ lat, lon })),
    distanceM: r.distance,
    durationS: r.duration,
  };
}
```

- [ ] **Step 4: Ver passar e checar tipos** — `npx vitest run src/routing/route.test.ts && npx tsc --noEmit`. Expected: PASS (5 testes), sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/routing/route.ts src/routing/route.test.ts
git commit -m "feat(nav): cliente OSRM para a rota de carro" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `geocode` — cliente Nominatim

**Files:**
- Create: `src/routing/geocode.ts`
- Test: `src/routing/geocode.test.ts`

- [ ] **Step 1: Teste com falha** — `src/routing/geocode.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchPlaces } from './geocode';

const okJson = (data: unknown) =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => data }) as Response);

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
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/routing/geocode.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/routing/geocode.ts`:

```ts
import type { Place } from './types';
import { ServiceError } from './errors';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// esquerda, topo, direita, base: Niterói e arredores
const VIEWBOX = '-43.35,-22.70,-42.85,-23.05';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface NominatimItem {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
}

function shortName(displayName: string): string {
  return displayName
    .split(',')
    .slice(0, 3)
    .map((s) => s.trim())
    .join(', ');
}

export async function searchPlaces(query: string, fetchFn: FetchFn = defaultFetch): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'br',
    limit: '5',
    'accept-language': 'pt-BR',
    viewbox: VIEWBOX,
    bounded: '1',
  });

  let res: Response;
  try {
    res = await fetchFn(`${NOMINATIM_URL}?${params}`);
  } catch {
    throw new ServiceError('network', 'Falha de rede na busca');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} na busca`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ServiceError('format', 'Resposta da busca não é JSON');
  }
  if (!Array.isArray(body)) throw new ServiceError('format', 'Resposta da busca fora do formato');

  const places: Place[] = [];
  for (const item of body as NominatimItem[]) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof item.display_name !== 'string') continue;
    places.push({ name: shortName(item.display_name), lat, lon });
  }
  return places;
}
```

- [ ] **Step 4: Ver passar e checar tipos** — `npx vitest run src/routing/geocode.test.ts && npx tsc --noEmit`. Expected: PASS (6 testes), sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/routing/geocode.ts src/routing/geocode.test.ts
git commit -m "feat(nav): busca de lugares via Nominatim" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `savedPlaces` — Casa e Trabalho

**Files:**
- Create: `src/places/savedPlaces.ts`
- Test: `src/places/savedPlaces.test.ts`

- [ ] **Step 1: Teste com falha** — `src/places/savedPlaces.test.ts`:

```ts
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
```

- [ ] **Step 2: Ver falhar** — `npx vitest run src/places/savedPlaces.test.ts`. Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/places/savedPlaces.ts`:

```ts
import type { Place, SavedPlaces, SlotName } from '../routing/types';

const KEY = 'semaforo-niteroi:places:v1';

function isPlace(x: unknown): x is Place {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lon === 'number';
}

export function loadPlaces(): SavedPlaces {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: SavedPlaces = {};
    if (isPlace(obj.home)) out.home = obj.home;
    if (isPlace(obj.work)) out.work = obj.work;
    return out;
  } catch {
    return {};
  }
}

export function savePlaces(p: SavedPlaces): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // armazenamento indisponível: segue sem persistir
  }
}

export function withPlace(p: SavedPlaces, slot: SlotName, place: Place): SavedPlaces {
  return { ...p, [slot]: place };
}
```

- [ ] **Step 4: Ver passar** — `npx vitest run src/places/savedPlaces.test.ts`. Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/places
git commit -m "feat(nav): lugares salvos (Casa e Trabalho)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hook `useNavigation`

Estado da navegação: `idle → loading → preview → active`. Sem testes automáticos (o projeto não tem jsdom nem testing-library; a lógica de decisão já está testada nos módulos puros). Verificação por `tsc` aqui e manual no fim.

**Files:**
- Create: `src/routing/useNavigation.ts`

- [ ] **Step 1: Implementar** — `src/routing/useNavigation.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Fix, TrafficLight } from '../types';
import type { Place, RouteResult } from './types';
import { fetchRoute } from './route';
import { lightsOnRoute } from './routeLights';
import { OffRouteDetector, distanceToRoute } from './offRoute';
import { errorMessage } from './errors';
import { distanceM } from '../geo/geo';

export type NavPhase = 'idle' | 'loading' | 'preview' | 'active';

const ARRIVAL_M = 30;
const REROUTE_MIN_INTERVAL_MS = 15000;
const MESSAGE_MS = 6000;

export function useNavigation(fix: Fix | null, lights: TrafficLight[]) {
  const [phase, setPhase] = useState<NavPhase>('idle');
  const [dest, setDest] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fixRef = useRef(fix);
  fixRef.current = fix;
  const requestId = useRef(0);
  const detector = useRef(new OffRouteDetector());
  const lastReroute = useRef(0);
  const rerouting = useRef(false);

  const routeLights = useMemo(
    () => (route ? lightsOnRoute(route.line, lights).map((r) => r.light) : []),
    [route, lights],
  );
  const routeIds = useMemo(() => new Set(routeLights.map((l) => l.id)), [routeLights]);

  const reset = useCallback(() => {
    requestId.current++;
    rerouting.current = false;
    detector.current.reset();
    setPhase('idle');
    setDest(null);
    setRoute(null);
  }, []);

  const choose = useCallback(
    (place: Place) => {
      const from = fixRef.current;
      if (!from) {
        setMessage('Aguarde o GPS para traçar a rota.');
        return;
      }
      const id = ++requestId.current;
      setMessage(null);
      setDest(place);
      setRoute(null);
      setPhase('loading');
      fetchRoute(from, place)
        .then((r) => {
          if (id !== requestId.current) return;
          setRoute(r);
          setPhase('preview');
        })
        .catch((e: unknown) => {
          if (id !== requestId.current) return;
          reset();
          setMessage(errorMessage(e));
        });
    },
    [reset],
  );

  const start = useCallback(() => {
    detector.current.reset();
    lastReroute.current = 0;
    setPhase((p) => (p === 'preview' ? 'active' : p));
  }, []);

  const cancel = useCallback(() => {
    reset();
    setMessage(null);
  }, [reset]);

  const report = useCallback((msg: string) => setMessage(msg), []);

  // rota ativa: chegada e desvio
  useEffect(() => {
    if (phase !== 'active' || !route || !dest || !fix) return;
    if (distanceM(fix, dest) < ARRIVAL_M) {
      reset();
      setMessage('Você chegou ao destino.');
      return;
    }
    const off = detector.current.update(distanceToRoute(fix, route.line), fix.timestamp);
    if (!off || rerouting.current || fix.timestamp - lastReroute.current < REROUTE_MIN_INTERVAL_MS) return;

    rerouting.current = true;
    lastReroute.current = fix.timestamp;
    const id = requestId.current;
    fetchRoute(fix, dest)
      .then((r) => {
        if (id === requestId.current) setRoute(r);
      })
      .catch(() => {
        if (id === requestId.current) setMessage('Não consegui recalcular a rota.');
      })
      .finally(() => {
        rerouting.current = false;
      });
  }, [fix, phase, route, dest, reset]);

  // mensagens somem sozinhas
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(t);
  }, [message]);

  return { phase, dest, route, routeLights, routeIds, message, choose, start, cancel, report };
}
```

- [ ] **Step 2: Checar tipos** — `npx tsc --noEmit`. Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routing/useNavigation.ts
git commit -m "feat(nav): hook useNavigation (rota, desvio, chegada)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `MapView` — linha da rota, enquadramento e semáforos fora da rota esmaecidos

**Files:**
- Modify: `src/ui/MapView.tsx`

- [ ] **Step 1: Tipos das props** — em `interface Props`, acrescentar depois de `draft: Draft | null;`:

```ts
  routeLine: LatLon[] | null;
  routeIds: Set<string> | null; // semáforos da rota; os demais ficam esmaecidos
  fitRoute: boolean; // enquadra a rota inteira (pré-visualização)
```
E no import de tipos trocar `import type { Fix, TrafficLight } from '../types';` por:
```ts
import type { Fix, LatLon, TrafficLight } from '../types';
```

- [ ] **Step 2: Fonte e camada da rota** — em `addLayers`, trocar a linha do laço de fontes:

```ts
  for (const id of ['lights', 'user', 'accuracy', 'draft']) map.addSource(id, { type: 'geojson', data: EMPTY });
```
por:
```ts
  for (const id of ['lights', 'user', 'accuracy', 'draft', 'route']) map.addSource(id, { type: 'geojson', data: EMPTY });
```
e, logo depois da camada `accuracy-fill` e antes da `lights-circle`, inserir:
```ts
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1a73e8', 'line-width': 7, 'line-opacity': 0.85 },
  });
```

- [ ] **Step 3: Desestruturar as props** — trocar
```ts
  const { fix, heading, lights, nextId, follow, draft } = props;
```
por
```ts
  const { fix, heading, lights, nextId, follow, draft, routeLine, routeIds, fitRoute } = props;
```

- [ ] **Step 4: Efeitos** — antes do `return (` final do componente, acrescentar:

```ts
  useEffect(() => {
    if (!loaded) return;
    const data: FeatureCollection =
      routeLine && routeLine.length >= 2
        ? {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', geometry: { type: 'LineString', coordinates: routeLine.map((p) => [p.lon, p.lat]) }, properties: {} },
            ],
          }
        : EMPTY;
    (mapRef.current!.getSource('route') as GeoJSONSource).setData(data);
  }, [loaded, routeLine]);

  useEffect(() => {
    if (!loaded || !fitRoute || !routeLine || routeLine.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    routeLine.forEach((p) => bounds.extend([p.lon, p.lat]));
    mapRef.current!.fitBounds(bounds, { padding: { top: 140, bottom: 300, left: 40, right: 40 }, duration: 600 });
  }, [loaded, fitRoute, routeLine]);

  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current!;
    const opacity = routeIds ? ['case', ['in', ['get', 'id'], ['literal', [...routeIds]]], 1, 0.25] : 1;
    map.setPaintProperty('lights-circle', 'circle-opacity', opacity);
    map.setPaintProperty('lights-circle', 'circle-stroke-opacity', opacity);
    map.setPaintProperty('lights-arrow', 'icon-opacity', opacity);
  }, [loaded, routeIds]);
```

- [ ] **Step 5: Checar tipos** — `npx tsc --noEmit`. Expected: erro **somente** em `src/App.tsx` (faltam as props novas no `<MapView>`); nenhum erro em `MapView.tsx`. Isso é esperado e some na Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/ui/MapView.tsx
git commit -m "feat(nav): linha da rota no mapa, enquadramento e semáforos fora da rota esmaecidos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `SearchBar`, `RouteCard` e estilos

**Files:**
- Create: `src/ui/SearchBar.tsx`, `src/ui/RouteCard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: `src/ui/SearchBar.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Place, SavedPlaces } from '../routing/types';
import { searchPlaces } from '../routing/geocode';
import { errorMessage } from '../routing/errors';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

interface Props {
  saved: SavedPlaces;
  busy: boolean;
  onChoose(place: Place): void;
  onError(message: string): void; // precisa ser estável (useCallback)
}

export function SearchBar({ saved, busy, onChoose, onError }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const q = query.trim();
    setEmpty(false);
    if (q.length < MIN_CHARS) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPlaces(q);
        if (cancelled) return;
        setResults(r);
        setEmpty(r.length === 0);
      } catch (e) {
        if (!cancelled) onError(errorMessage(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onError]);

  const pick = (place: Place) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onChoose(place);
  };

  const typing = query.trim().length >= MIN_CHARS;

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Para onde?"
        value={query}
        disabled={busy}
        onFocus={() => setOpen(true)}
        // adia o fechamento para o toque na sugestão chegar antes do blur
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="search-list">
          {!typing &&
            (['home', 'work'] as const).map((slot) => {
              const p = saved[slot];
              return (
                p && (
                  <button key={slot} onClick={() => pick(p)}>
                    {slot === 'home' ? '🏠 Casa' : '💼 Trabalho'}
                    <small>{p.name}</small>
                  </button>
                )
              );
            })}
          {!typing && !saved.home && !saved.work && <div className="search-note">Digite um endereço ou lugar.</div>}
          {searching && <div className="search-note">Buscando…</div>}
          {empty && !searching && <div className="search-note">Nenhum lugar encontrado.</div>}
          {results.map((p) => (
            <button key={`${p.lat},${p.lon}`} onClick={() => pick(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `src/ui/RouteCard.tsx`**

```tsx
import type { Place, RouteResult, SlotName } from '../routing/types';
import { formatDistance, formatDuration } from './format';

interface Props {
  phase: 'loading' | 'preview' | 'active';
  dest: Place | null;
  route: RouteResult | null;
  lightCount: number;
  onStart(): void;
  onCancel(): void;
  onSave(slot: SlotName): void;
}

export function RouteCard({ phase, dest, route, lightCount, onStart, onCancel, onSave }: Props) {
  if (phase === 'loading') {
    return (
      <div className="panel route-card">
        <div className="panel-main">Traçando rota…</div>
        <div className="row">
          <button onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    );
  }

  const summary = route
    ? `${formatDuration(route.durationS)} · ${formatDistance(route.distanceM)} · ${lightCount} semáforo${lightCount === 1 ? '' : 's'}`
    : '';

  if (phase === 'active') {
    return (
      <div className="panel route-card">
        <div className="panel-sub">{dest?.name}</div>
        <div className="panel-sub">{summary}</div>
        <div className="row">
          <button className="danger" onClick={onCancel}>Encerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel route-card">
      <div className="panel-main">{dest?.name}</div>
      <div className="panel-sub">{summary}</div>
      <div className="row">
        <button className="primary" onClick={onStart}>Iniciar</button>
        <button onClick={onCancel}>Cancelar</button>
      </div>
      <div className="row">
        <button onClick={() => onSave('home')}>🏠 Salvar como Casa</button>
        <button onClick={() => onSave('work')}>💼 Salvar como Trabalho</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Estilos** — em `src/index.css`:

a) trocar `top: calc(env(safe-area-inset-top, 0px) + 96px)` por `top: calc(env(safe-area-inset-top, 0px) + 152px)` nas duas regras (`.toolbar` e `.sim-hint`), para liberar espaço para a barra de busca;

b) acrescentar ao fim do arquivo:

```css

.search { position: relative; pointer-events: auto; margin-bottom: 8px; }
.search input { width: 100%; box-sizing: border-box; font-size: 1.1rem; padding: 12px 14px; border-radius: 12px; border: none; background: rgba(17, 17, 17, 0.88); color: #fff; }
.search-list { position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px; max-height: 50dvh; overflow-y: auto; background: rgba(17, 17, 17, 0.96); border-radius: 12px; z-index: 10; }
.search-list button { display: block; width: 100%; min-height: 48px; text-align: left; padding: 10px 14px; font-size: 1rem; border: none; border-bottom: 1px solid #333; background: none; color: #fff; }
.search-list small { display: block; color: #aaa; }
.search-note { padding: 12px 14px; color: #aaa; }
.route-card { margin-bottom: 6px; }
.route-card .row { margin-top: 8px; }
```

- [ ] **Step 4: Checar tipos** — `npx tsc --noEmit`. Expected: ainda só o erro de props em `src/App.tsx` (resolvido na Task 10); nada em `SearchBar.tsx` nem `RouteCard.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/SearchBar.tsx src/ui/RouteCard.tsx src/index.css
git commit -m "feat(nav): barra de busca, cartão de rota e estilos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Integrar no `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Imports** — depois de `import { WrongWayAlert } from './ui/WrongWayAlert';` acrescentar:

```ts
import { SearchBar } from './ui/SearchBar';
import { RouteCard } from './ui/RouteCard';
import { useNavigation } from './routing/useNavigation';
import { loadPlaces, savePlaces, withPlace } from './places/savedPlaces';
import type { SavedPlaces, SlotName } from './routing/types';
```

- [ ] **Step 2: Lista de semáforos usada nos alertas** — trocar

```ts
  const lightsRef = useRef(lights);
  lightsRef.current = lights;
```
por
```ts
  // lista que o motor de alertas enxerga: todos os semáforos, ou só os da rota quando há rota ativa
  const alertLightsRef = useRef<TrafficLight[]>(lights);
```
e, em `handleFix`, trocar `lightsRef.current` por `alertLightsRef.current`:
```ts
    const n = findNextTrafficLight(pos, h, alertLightsRef.current, prevNextId.current);
```

- [ ] **Step 3: Estado de navegação e lugares salvos** — logo depois da linha `const [selectedId, setSelectedId] = useState<string | null>(null);` acrescentar:

```ts
  const [saved, setSaved] = useState<SavedPlaces>(() => loadPlaces());
  const nav = useNavigation(fix, lights);
  alertLightsRef.current = nav.phase === 'active' ? nav.routeLights : lights;

  useEffect(() => {
    savePlaces(saved);
  }, [saved]);

  // pré-visualização mostra a rota inteira; sem rota, volta a seguir o carro
  useEffect(() => {
    if (nav.phase === 'preview') setFollow(false);
    if (nav.phase === 'idle') setFollow(true);
  }, [nav.phase]);

  const startRoute = () => {
    nav.start();
    setFollow(true);
  };

  const saveDestination = (slot: SlotName) => {
    if (!nav.dest) return;
    setSaved((s) => withPlace(s, slot, nav.dest!));
    nav.report(slot === 'home' ? 'Salvo como Casa.' : 'Salvo como Trabalho.');
  };
```

- [ ] **Step 4: Props do `<MapView>`** — acrescentar depois de `draft={mode === 'edit' ? draft : null}`:

```tsx
        routeLine={nav.route?.line ?? null}
        routeIds={nav.phase === 'preview' || nav.phase === 'active' ? nav.routeIds : null}
        fitRoute={nav.phase === 'preview'}
```

- [ ] **Step 5: Barra de busca** — no bloco `.top`, colocar a busca antes do `StreetBanner`:

```tsx
      {mode === 'drive' && (
        <div className="top">
          {nav.phase !== 'active' && (
            <SearchBar saved={saved} busy={nav.phase === 'loading'} onChoose={nav.choose} onError={nav.report} />
          )}
          <StreetBanner road={road} heading={heading} />
          <WrongWayAlert active={wrongWay} />
        </div>
      )}
```

- [ ] **Step 6: Mensagem e cartão da rota** — no `<div className="bottom">`, logo depois da linha `{mode === 'drive' && message && <div className="toast">{message}</div>}`, acrescentar:

```tsx
        {mode === 'drive' && nav.message && <div className="toast">{nav.message}</div>}
        {mode === 'drive' && nav.phase !== 'idle' && (
          <RouteCard
            phase={nav.phase}
            dest={nav.dest}
            route={nav.route}
            lightCount={nav.routeLights.length}
            onStart={startRoute}
            onCancel={nav.cancel}
            onSave={saveDestination}
          />
        )}
```

- [ ] **Step 7: Verificar** — `npx tsc --noEmit && npm test && npm run build`. Expected: sem erros de tipo, todos os testes passam (os 81 de antes mais os novos), build conclui.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(nav): integra destino, rota e alertas só da rota no App" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Teste manual, APK e publicação

- [ ] **Step 1: Teste no navegador** — `npm run dev`, abrir com `?sim` na URL (simulação, clique no mapa move o carro). Conferir:
  - digitar "Plaza Shopping" mostra sugestões depois de ~400 ms; "Nenhum lugar encontrado" para texto sem resultado;
  - escolher um lugar mostra a linha azul, o cartão com tempo, distância e nº de semáforos, e os semáforos fora da rota esmaecidos;
  - "Iniciar" fecha a busca e o painel mostra o próximo semáforo só da rota;
  - clicar no mapa longe da rota por mais de 5 s dispara o recálculo;
  - "Salvar como Casa" faz o atalho 🏠 aparecer ao focar a busca vazia; recarregar a página mantém;
  - "Encerrar" volta ao modo sem destino.

- [ ] **Step 2: Gerar o APK** — `npm run apk`. Expected: `release/semaforo-niteroi.apk` atualizado.

- [ ] **Step 3: Teste no celular** — instalar e conferir busca, rota, alertas só dos semáforos do caminho e recálculo ao sair da rota (andando de carro, com o celular na mão do passageiro). Registrar qualquer erro de CORS ou limite de serviço que apareça como faixa/mensagem.

- [ ] **Step 4: Merge e publicação — pedir confirmação ao usuário antes.** O push dispara o deploy do Pages e publica o site. Com o OK:
```bash
git switch main
git merge --ff-only feat/navegacao
git push
```
Acompanhar o run do workflow "Deploy" até sucesso (`gh run list --limit 1`).
