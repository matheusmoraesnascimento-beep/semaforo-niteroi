# Base Mapbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o mapa para Mapbox GL e as rotas para o Mapbox Directions (`driving-traffic`), mantendo semáforos, GPS, busca (Photon) e leitura de ruas funcionando.

**Architecture:** `src/mapbox.ts` concentra token e estilo. `routing/route.ts` chama o Directions mantendo `fetchRoute(from, to)` e `RouteResult`. `roads/tileRoads.ts` lê a camada `road` da fonte `composite` do estilo Mapbox mantendo o contrato `RoadSource`. `MapView.tsx` e `App.tsx` só trocam a biblioteca.

**Tech Stack:** TypeScript, React 19, `mapbox-gl` v3, Vite, Vitest (ambiente `node`), Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-10-05-base-mapbox-design.md`

## Global Constraints

- Mapa: `mapbox-gl` v3, estilo `mapbox://styles/mapbox/streets-v12`; token público `pk.…` em `VITE_MAPBOX_TOKEN` (`.env.local`, ignorado pelo git).
- Rotas: Directions perfil `driving-traffic`, `geometries=geojson`, `overview=full`, `language=pt-BR`. Nada da resposta é armazenado.
- Busca continua no Photon (`routing/geocode.ts` não muda).
- Contratos que não mudam: `fetchRoute(from, to, fetchFn?)` → `RouteResult { line, distanceM, durationS }`; `RoadSource`; `RoadSegment { id, name, oneway: 0|1|-1, coords }`; `ServiceError` com os kinds atuais.
- Sem `any`; sem comentários óbvios; sem helpers de uso único; sem error handling impossível.
- Português do Brasil nas mensagens ao usuário.

## Review Focus

- Token ausente: mapa mostra erro claro e `fetchRoute` lança erro de configuração, sem chamar a rede (Tasks 2 e 4).
- `oneway` vem como texto `'false'` no Mapbox: `'false'` não pode virar mão única (Task 3).
- Resposta do Directions com `routes: []` ou 401/403/429: vira `ServiceError` com mensagem útil, nunca exceção crua (Task 2).
- Vias de estacionamento e caminhos a pé não podem entrar como vias de carro (Task 3).
- Camada `road` sem `name` (só `class`): nome nulo, sem quebrar o banner da rua (Task 3).

---

### Task 1: Commitar o trabalho pendente

Há alterações já validadas (typecheck e 116 testes) que ainda não foram commitadas: precisão do GPS, câmera de navegação e busca Photon. Separar em commits antes de mexer em mapa e rotas.

**Files:** os já modificados no working tree.

- [ ] **Step 1: Conferir o estado**

Run: `git status --short`
Expected: lista com `M src/App.tsx`, `M src/geo/geo.ts`, `M src/geo/geo.test.ts`, `M src/location/browserGps.ts`, `M src/location/capacitorGps.ts`, `M src/ui/MapView.tsx`, `M src/routing/geocode.ts`, `M src/routing/geocode.test.ts`, `?? src/location/fixFilter.ts`, `?? src/location/fixFilter.test.ts`.

- [ ] **Step 2: Testes passam antes de commitar**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck sem erro; todos os testes passam.

- [ ] **Step 3: Commit da busca**

```bash
git add src/routing/geocode.ts src/routing/geocode.test.ts
git commit -m "feat(busca): troca Nominatim por Photon

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Commit do GPS e da câmera**

```bash
git add src
git commit -m "feat(gps): filtro de fixes, projeção na rota e câmera de navegação

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Token, tipos e cliente de rotas Mapbox

**Files:**
- Create: `src/mapbox.ts`
- Create: `src/vite-env.d.ts`
- Create: `.env.example`
- Modify: `src/routing/errors.ts`
- Modify: `src/routing/route.ts`
- Modify: `src/routing/route.test.ts`

**Interfaces:**
- Produces: `MAPBOX_TOKEN: string` (vazio se ausente) e `STYLE_URL: string` em `src/mapbox.ts`; `ServiceErrorKind` ganha `'config'`; `fetchRoute(from: LatLon, to: LatLon, fetchFn?: FetchFn, token?: string): Promise<RouteResult>`.
- Consumes: `ServiceError`, `RouteResult` (já existem).

- [ ] **Step 1: Escrever os testes novos (falham)**

Substituir todo o conteúdo de `src/routing/route.test.ts` por:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/routing/route.test.ts`
Expected: FAIL (kind `config` inexistente / URL ainda do OSRM).

- [ ] **Step 3: Criar token, estilo e tipos**

`src/mapbox.ts`:

```ts
export const MAPBOX_TOKEN: string = import.meta.env.VITE_MAPBOX_TOKEN ?? '';
export const STYLE_URL = 'mapbox://styles/mapbox/streets-v12';
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
}
```

`.env.example`:

```
# Token público do Mapbox (pk.…). Copie para .env.local e preencha.
VITE_MAPBOX_TOKEN=
```

- [ ] **Step 4: Ajustar os erros**

Em `src/routing/errors.ts`: trocar a primeira linha por

```ts
export type ServiceErrorKind = 'network' | 'http' | 'format' | 'no-route' | 'config';
```

e, dentro do `switch` de `errorMessage`, acrescentar antes de `default`:

```ts
      case 'config':
        return 'Token do Mapbox não configurado.';
```

- [ ] **Step 5: Reescrever o cliente de rotas**

Substituir todo o conteúdo de `src/routing/route.ts` por:

```ts
import type { LatLon } from '../types';
import type { RouteResult } from './types';
import { ServiceError } from './errors';
import { MAPBOX_TOKEN } from '../mapbox';

const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';

type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (input, init) => fetch(input, init);

interface DirectionsResponse {
  code?: string;
  routes?: { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }[];
}

function isLonLat(c: unknown): c is [number, number] {
  return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number';
}

export async function fetchRoute(
  from: LatLon,
  to: LatLon,
  fetchFn: FetchFn = defaultFetch,
  token: string = MAPBOX_TOKEN,
): Promise<RouteResult> {
  if (!token) throw new ServiceError('config', 'Token do Mapbox ausente');

  const params = new URLSearchParams({
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    language: 'pt-BR',
    access_token: token,
  });
  const url = `${DIRECTIONS_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?${params}`;

  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new ServiceError('network', 'Falha de rede ao buscar a rota');
  }
  if (!res.ok) throw new ServiceError('http', `HTTP ${res.status} ao buscar a rota`);

  let body: DirectionsResponse;
  try {
    body = (await res.json()) as DirectionsResponse;
  } catch {
    throw new ServiceError('format', 'Resposta da rota não é JSON');
  }

  if (body.code === 'NoRoute' || body.code === 'NoSegment') throw new ServiceError('no-route', 'Sem rota');
  if (body.code === 'Ok' && body.routes?.length === 0) throw new ServiceError('no-route', 'Sem rota');
  const r = body.routes?.[0];
  const coords = r?.geometry?.coordinates;
  if (
    body.code !== 'Ok' ||
    !r ||
    typeof r.distance !== 'number' ||
    typeof r.duration !== 'number' ||
    !Array.isArray(coords) ||
    !coords.every(isLonLat)
  ) {
    throw new ServiceError('format', 'Resposta da rota fora do formato');
  }

  return {
    line: (coords as [number, number][]).map(([lon, lat]) => ({ lat, lon })),
    distanceM: r.distance,
    durationS: r.duration,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx tsc --noEmit && npx vitest run src/routing`
Expected: typecheck limpo; testes de `routing` passam.

- [ ] **Step 7: Commit**

```bash
git add src/mapbox.ts src/vite-env.d.ts .env.example src/routing
git commit -m "feat(rotas): Mapbox Directions com trânsito no lugar do OSRM

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Leitura de ruas no esquema do Mapbox

**Files:**
- Modify: `src/roads/tileRoads.ts`
- Modify: `src/roads/tileRoads.test.ts`

**Interfaces:**
- Consumes: tipos `RoadSegment`, `RoadSource`, `LatLon` de `src/types.ts`.
- Produces: `featuresToSegments(features: SourceFeature[], requireRoadClass = true): RoadSegment[]` (mesma assinatura), `filterNear` (inalterado), `createTileRoadSource(map: MbMap): RoadSource`.

No estilo `streets-v12` a camada é `road` da fonte `composite`. Propriedades: `class` (`motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `street`, `street_limited`, `service`, e também `*_link`, `path`, `pedestrian`, `track`, `ferry`, `major_rail`…), `type` (ex. `service:parking_aisle`), `name`, `oneway` como texto `'true'`/`'false'`. Mão única `'true'` segue o sentido da geometria; não existe equivalente a `-1`.

- [ ] **Step 1: Reescrever os testes de `featuresToSegments` (falham)**

Em `src/roads/tileRoads.test.ts`, substituir o bloco `describe('featuresToSegments', …)` inteiro por (o bloco `filterNear` e os imports ficam como estão):

```ts
describe('featuresToSegments', () => {
  it('LineString de via primária com oneway "true"', () => {
    const [s] = featuresToSegments([feat({ class: 'primary', oneway: 'true' }, LINE, 7)]);
    expect(s).toEqual({ id: '7:0', name: null, oneway: 1, coords: [[-43.1, -22.9], [-43.1, -22.899]] });
  });

  it('MultiLineString vira um segmento por linha', () => {
    const multi = { type: 'MultiLineString', coordinates: [LINE.coordinates, LINE.coordinates] };
    expect(featuresToSegments([feat({ class: 'street' }, multi, 1)]).map((s) => s.id)).toEqual(['1:0', '1:1']);
  });

  it('oneway "false" ou ausente → 0 (mão dupla)', () => {
    expect(featuresToSegments([feat({ class: 'street', oneway: 'false' }, LINE)])[0].oneway).toBe(0);
    expect(featuresToSegments([feat({ class: 'street' }, LINE)])[0].oneway).toBe(0);
  });

  it('aceita classes de ligação e street_limited', () => {
    const r = featuresToSegments([
      feat({ class: 'motorway_link' }, LINE),
      feat({ class: 'street_limited' }, LINE, 2),
    ]);
    expect(r).toHaveLength(2);
  });

  it('ignora path, pedestrian, ferrovia e service de estacionamento', () => {
    const r = featuresToSegments([
      feat({ class: 'path' }, LINE, 1),
      feat({ class: 'pedestrian' }, LINE, 2),
      feat({ class: 'major_rail' }, LINE, 3),
      feat({ class: 'service', type: 'service:parking_aisle' }, LINE, 4),
      feat({ class: 'service' }, LINE, 5),
    ]);
    expect(r).toHaveLength(1);
  });

  it('sem exigir classe mantém o nome; sem nome fica null', () => {
    const [named] = featuresToSegments([feat({ name: 'Rua da Conceição' }, LINE)], false);
    expect(named.name).toBe('Rua da Conceição');
    const [unnamed] = featuresToSegments([feat({ class: 'street' }, LINE)]);
    expect(unnamed.name).toBeNull();
  });

  it('ids de features sem id independem da ordem do array', () => {
    const B = { type: 'LineString', coordinates: [[-43.2, -22.8], [-43.2, -22.799]] };
    const a = feat({ class: 'street', name: 'A' }, LINE);
    const b = feat({ class: 'street', name: 'B', oneway: 'true' }, B);
    const ids1 = featuresToSegments([a, b]).map((s) => s.id).sort();
    const ids2 = featuresToSegments([b, a]).map((s) => s.id).sort();
    expect(ids1).toEqual(ids2);
    expect(new Set(ids1).size).toBe(2);
  });

  it('features idênticas sem id (tiles vizinhos) viram um só segmento', () => {
    expect(featuresToSegments([feat({ class: 'street' }, LINE), feat({ class: 'street' }, LINE)])).toHaveLength(1);
  });

  it('ignora geometrias inválidas', () => {
    expect(featuresToSegments([
      feat({ class: 'street' }, { type: 'LineString', coordinates: [[-43.1, -22.9]] }),
      feat({ class: 'street' }, { type: 'Point', coordinates: [-43.1, -22.9] }),
      feat({ class: 'street' }, { type: 'LineString', coordinates: [['x', 1], [2, 3]] }),
    ])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/roads/tileRoads.test.ts`
Expected: FAIL (classes `street`/`motorway_link` rejeitadas, `oneway: 'true'` não reconhecido).

- [ ] **Step 3: Adaptar `tileRoads.ts`**

Substituir as linhas iniciais do arquivo (até `export interface SourceFeature`) por:

```ts
import type { Map as MbMap } from 'mapbox-gl';
import type { LatLon, RoadSegment, RoadSource } from '../types';

/** Classes da camada `road` do estilo Mapbox streets consideradas vias de carro. */
const ROAD_CLASSES = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'street', 'street_limited', 'service',
]);
const SOURCE_ID = 'composite';
const SOURCE_LAYER = 'road';
```

Em `featuresToSegments`, trocar as linhas do filtro de classe e de `oneway`:

```ts
    if (requireRoadClass) {
      const cls = props.class;
      if (typeof cls !== 'string' || !ROAD_CLASSES.has(cls)) return;
      if (cls === 'service' && props.type === 'service:parking_aisle') return;
    }
    const name = typeof props.name === 'string' && props.name !== '' ? props.name : null;
    const oneway: 0 | 1 | -1 = props.oneway === 'true' ? 1 : 0;
```

Substituir a função `createTileRoadSource` inteira por:

```ts
/** Lê as vias dos tiles vetoriais já carregados no mapa (independe de a camada estar desenhada). */
export function createTileRoadSource(map: MbMap): RoadSource {
  const query = (requireClass: boolean, lat: number, lon: number, r: number) =>
    filterNear(
      featuresToSegments(
        map.querySourceFeatures(SOURCE_ID, { sourceLayer: SOURCE_LAYER }) as SourceFeature[],
        requireClass,
      ),
      { lat, lon },
      r,
    );
  return {
    segmentsNear: (lat, lon, r) => query(true, lat, lon, r),
    namedSegmentsNear: (lat, lon, r) => query(false, lat, lon, r),
  };
}
```

(`mapbox-gl` ainda não está instalado; o typecheck só fecha na Task 4. Os testes de `tileRoads` não importam o tipo em runtime, então rodam.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/roads`
Expected: todos os testes de `roads` passam (match, wrongWay, tileRoads).

- [ ] **Step 5: Commit**

```bash
git add src/roads
git commit -m "feat(ruas): lê a camada road do estilo Mapbox

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Trocar MapLibre por Mapbox GL

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/ui/MapView.tsx`
- Modify: `src/App.tsx:2`

**Interfaces:**
- Consumes: `MAPBOX_TOKEN`, `STYLE_URL` de `src/mapbox.ts` (Task 2); `createTileRoadSource(map: MbMap)` (Task 3).
- Produces: `MapView` com as mesmas props de antes; `onReady(map: MbMap)`.

- [ ] **Step 1: Trocar a dependência**

Run: `npm uninstall maplibre-gl && npm install mapbox-gl@^3`
Expected: `package.json` sem `maplibre-gl` e com `mapbox-gl` 3.x.

- [ ] **Step 2: Editar imports e inicialização do `MapView.tsx`**

Substituir o bloco do topo (da linha `import * as maplibregl …` até `maplibregl.setWorkerUrl(workerUrl);`, incluindo o comentário do worker) por:

```ts
import mapboxgl from 'mapbox-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MbMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
```

Remover a linha `export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';` e importar do módulo novo, junto dos outros imports:

```ts
import { MAPBOX_TOKEN, STYLE_URL } from '../mapbox';
```

Trocar em todo o arquivo `MlMap` por `MbMap` e `maplibregl.` por `mapboxgl.`:

Run: `sed -i 's/MlMap/MbMap/g; s/maplibregl\./mapboxgl./g' src/ui/MapView.tsx`

No `useEffect` que cria o mapa, antes de `const map = new mapboxgl.Map({`, acrescentar:

```ts
    if (!MAPBOX_TOKEN) {
      setMapError('Token do Mapbox ausente (defina VITE_MAPBOX_TOKEN).');
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;
```

- [ ] **Step 3: Ajustar `App.tsx`**

Run: `sed -i "s#import type { Map as MlMap } from 'maplibre-gl';#import type { Map as MbMap } from 'mapbox-gl';#; s/MlMap/MbMap/g" src/App.tsx`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. Se reclamar que `ExpressionSpecification` não é exportado por `mapbox-gl`, trocar o import por `import type { Expression, GeoJSONSource, Map as MbMap } from 'mapbox-gl';` e usar `Expression` no lugar de `ExpressionSpecification` (duas ocorrências em `MapView.tsx`). Se reclamar de outra API (ex.: `LngLatBounds`, `icon-pitch-alignment`), seguir a mensagem do compilador; os nomes são os mesmos do MapLibre.

- [ ] **Step 5: Testes e build**

Run: `npx vitest run && VITE_MAPBOX_TOKEN=pk.teste npm run build`
Expected: todos os testes passam; build conclui.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src
git commit -m "feat(mapa): troca MapLibre/OpenFreeMap por Mapbox GL

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verificação manual com token real

**Files:** nenhum código novo (a menos que a verificação ache diferença nas propriedades das ruas).

- [ ] **Step 1: Configurar o token**

Criar `.env.local` na raiz com `VITE_MAPBOX_TOKEN=pk.…` (token do usuário). Não commitar (`*.local` já é ignorado).

- [ ] **Step 2: Conferir as propriedades reais da camada `road`**

Em `App.tsx`, dentro de `onReady`, acrescentar temporariamente:

```ts
map.once('idle', () => {
  const sample = map.querySourceFeatures('composite', { sourceLayer: 'road' }).slice(0, 5);
  console.log(JSON.stringify(sample.map((f) => f.properties)));
});
```

Rodar `npm run dev`, abrir `http://localhost:5173/?sim` no navegador, ler o console. Confirmar que existem `class`, `name`, `oneway` (`"true"`/`"false"`) e `type`. Se algum nome divergir, ajustar `tileRoads.ts` e seus testes (Task 3) e commitar `fix(ruas): …`. Remover o `console.log` temporário.

- [ ] **Step 3: Conferir no navegador (`?sim`)**

Clicar no mapa para mover o carro por uma via de mão única conhecida e por uma de mão dupla. Esperado: banner mostra o nome da rua e "Mão única"/"Mão dupla" corretos; andar no sentido contrário numa mão única dispara o alerta de contramão.

- [ ] **Step 4: Conferir a rota**

Buscar "Plaza Shopping Niterói", escolher o resultado. Esperado: linha azul no mapa, cartão com tempo, distância e número de semáforos; o tempo difere do que o OSRM dava em horário de movimento.

- [ ] **Step 5: Conferir no Android**

```bash
npm run cap:sync
cd android && JAVA_HOME=$HOME/android-studio/jbr ANDROID_HOME=$HOME/Android/Sdk JAVA_OPTS="-Djdk.http.auth.tunneling.disabledSchemes= -Djdk.http.auth.proxying.disabledSchemes=" sh ./gradlew assembleDebug --console=plain -q
```

Instalar o APK em celular (ou emulador com acesso à rede) e repetir os passos 3 e 4 com GPS real. Restringir o token no painel do Mapbox às origens do Pages e `https://localhost`.

- [ ] **Step 6: Commit de ajustes (se houve)**

```bash
git add -A src
git commit -m "fix(ruas): ajusta propriedades após verificação no Mapbox

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
