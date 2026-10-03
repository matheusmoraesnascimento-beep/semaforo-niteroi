# Navegação por destino com alertas de semáforo — Design

Data: 2026-10-03

## Objetivo

Hoje o app avisa o próximo semáforo à frente do carro, sem saber para onde o motorista vai. Passa a ter destino: o usuário busca um endereço ou usa um lugar salvo (Casa, Trabalho), o app traça a rota de carro e alerta **apenas os semáforos que estão no caminho**.

Fora do escopo: instruções de curva (voz ou texto), comparação de rotas alternativas, escolha da rota com menos semáforos, mapa offline, servidor próprio de rotas.

## Decisões

- **Serviços:** Nominatim (busca) e OSRM público em `routing.openstreetmap.de` (rota, perfil carro). Gratuitos, sem chave de API, exigem internet. Política de uso justo, adequada ao uso pessoal.
- **Alertas:** o motor atual (`findNextTrafficLight`) não muda. Com rota ativa, ele recebe a lista de semáforos filtrada pela rota em vez da lista completa.
- **Sem destino:** comportamento idêntico ao atual.

## Módulos

Cada módulo tem uma função e é testável sozinho.

| Módulo | Entrada → saída | Depende de |
|---|---|---|
| `src/routing/geocode.ts` | texto → lista de lugares `{ name, lat, lon }` | `fetch` |
| `src/routing/route.ts` | origem + destino → `{ line: LatLon[], distanceM, durationS }` | `fetch` |
| `src/routing/routeLights.ts` | linha + semáforos → semáforos da rota, ordenados pelo percurso, com distância acumulada | `geo` |
| `src/routing/offRoute.ts` | posição + linha → distância até a rota; detector de desvio | `geo` |
| `src/places/savedPlaces.ts` | Casa e Trabalho em `localStorage` | `localStorage` |

### `geocode.ts`
- Consulta Nominatim com `countrycodes=br`, limitada a uma caixa em torno de Niterói e arredores, `limit=5`, `accept-language=pt-BR`.
- A chamada só parte depois de ~400 ms sem digitação (o debounce fica no componente de UI, não neste módulo).
- Resposta fora do esperado ou erro HTTP vira erro tipado, que a UI mostra como faixa.

### `route.ts`
- Chama `https://routing.openstreetmap.de/routed-car/route/v1/driving/{lon},{lat};{lon},{lat}?overview=full&geometries=geojson`.
- Devolve a geometria como `LatLon[]`, a distância em metros e a duração em segundos.
- Sem rota (`code !== "Ok"`) ou erro de rede vira erro tipado.

### `routeLights.ts`
Um semáforo pertence à rota quando as duas condições valem:
1. Está a no máximo 25 m da linha (`pointToSegment`).
2. O sentido da rota no segmento mais próximo difere de `approachBearing` em no máximo 45° (mesma tolerância de `NEAREST_DEFAULTS.approachTolerance`).

A saída é ordenada pela posição ao longo da linha. Isso evita alertar semáforos de ruas paralelas ou de sentido contrário.

### `offRoute.ts`
- `distanceToRoute(pos, line)` devolve a menor distância até a linha.
- O detector pede recálculo quando a distância passa de 50 m por pelo menos 5 s seguidos. Voltar para dentro de 50 m zera a contagem.

### `savedPlaces.ts`
- Guarda `home` e `work` (`{ name, lat, lon }`) em uma chave própria de `localStorage`, seguindo o padrão de `localState.ts`. Leitura e escrita dentro de `try/catch`.
- Salvar é feito pela UI depois de uma busca ("Salvar como Casa/Trabalho").

## Fluxo no `App.tsx`

1. **Escolha:** o usuário busca, ou toca em Casa/Trabalho. Isso define o destino candidato.
2. **Cálculo:** `route()` roda com a posição atual como origem. Sem posição ainda, a UI pede para aguardar o GPS.
3. **Pré-visualização:** a linha é desenhada no mapa e um cartão mostra tempo, distância e quantos semáforos há na rota, com o botão "Iniciar".
4. **Rota ativa:** `routeLights()` produz a lista da rota. `handleFix` passa essa lista ao `findNextTrafficLight` no lugar de `lightsRef.current`. A hysteresis e o resto do motor seguem iguais.
5. **Desvio:** o detector de `offRoute` dispara e o app recalcula a rota a partir da posição atual. Enquanto recalcula, mantém a rota anterior.
6. **Fim:** a menos de 30 m do destino, ou no botão "Encerrar", a rota é limpa e o app volta ao modo sem destino. A chegada mostra uma mensagem.

## Interface

- **Barra de busca** no topo, com sugestões enquanto digita e atalhos Casa/Trabalho. Ocupa o lugar do banner da rua quando está em foco.
- **Cartão de rota** na parte inferior, antes de iniciar: tempo, distância, número de semáforos, botões "Iniciar" e "Cancelar".
- **Durante a rota:** o painel do motorista continua como hoje. Um botão "Encerrar" e a linha da rota no mapa (cor distinta da camada de semáforos). Semáforos da rota ficam destacados; os de fora, esmaecidos.
- Alvos de toque ≥ 44 px, pensados para uso no carro.

## Erros e casos de borda

- Sem internet ou erro nos serviços: faixa de erro, e o app segue funcionando sem destino.
- Busca sem resultado: mensagem "Nenhum lugar encontrado".
- Sem rota possível: mensagem, e a pré-visualização não abre.
- GPS sem posição ao pedir a rota: pede para aguardar.
- Falha ao recalcular depois de um desvio: mantém a rota anterior e tenta de novo no próximo desvio detectado, no máximo uma vez a cada 15 s.
- Rota muito longa: a geometria completa vem da API; o filtro roda uma vez por rota, e não a cada fix.

## Testes

- `routeLights`: rota sintética em L com semáforos na rota, em rua paralela a 40 m, e no sentido contrário; confere inclusão, exclusão e ordem.
- `offRoute`: distância até a linha e o detector (desvio curto não dispara; desvio de 5 s dispara; voltar à rota zera).
- `geocode` e `route`: `fetch` simulado com resposta válida, resposta vazia, erro HTTP e erro de rede.
- `savedPlaces`: leitura vazia, gravação, `localStorage` indisponível.
- Verificação manual no celular: busca, rota, alertas só dos semáforos do caminho, desvio com recálculo.

## Riscos

- O OSRM público pode ficar lento ou indisponível. Mitigação: erro claro e o app continua sem destino. Se virar problema, trocar o endereço do serviço em um único lugar (`route.ts`).
- O Nominatim limita a 1 requisição por segundo. O debounce de 400 ms respeita isso no uso normal.
- Semáforos cadastrados com `approachBearing` impreciso podem ser excluídos da rota. O limite de 45° acompanha o motor atual.
