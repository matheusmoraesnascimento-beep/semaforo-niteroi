# Perfil local — favoritos, recentes, ajustes e meus semáforos

Parte do sub-projeto 3 ("lugares") da evolução "app parecido com o Google Maps, com o semáforo como diferencial". Independente do sub-projeto 2 (navegação curva a curva).

## Objetivo e contexto

Uso pessoal, Android (Capacitor) e web. Hoje o app guarda só Casa e Trabalho (`places/savedPlaces.ts`, chave `semaforo-niteroi:places:v1`) e os semáforos cadastrados (`store/localStore.ts`). O usuário quer um **perfil** com favoritos e afins.

Decisão do usuário: o perfil é **só no aparelho** (sem conta, login ou servidor). Como desinstalar o app apaga os dados, o perfil tem exportar/importar por arquivo.

Sucesso: o usuário abre o perfil por um botão ao lado da busca, vê e gerencia favoritos, recentes, ajustes e o resumo dos seus semáforos; a busca vazia sugere Casa, Trabalho, favoritos e recentes; os dados sobrevivem a reiniciar o app e podem ser exportados e importados.

## Escopo

Dentro: favoritos (com Casa e Trabalho), recentes, nome e ajustes, resumo de "meus semáforos" com exportar/importar, backup do perfil em JSON, botão de perfil na tela inicial, sugestões na busca vazia, botão "Favoritar" na pré-visualização da rota.

Fora: conta e sincronização, foto de perfil, voz, ordenação manual de favoritos, pastas/listas.

## Modelo de dados

Chave única `semaforo-niteroi:profile:v1`, JSON:

```ts
interface Favorite { id: string; name: string; lat: number; lon: number; createdAt: string }
interface Profile {
  version: 1;
  name: string;                 // padrão "Motorista"
  home?: Place;                 // Casa
  work?: Place;                 // Trabalho
  favorites: Favorite[];
  recents: Place[];             // máx. 20, mais novo primeiro
  settings: { keepAwake: boolean; showTraffic: boolean }; // padrão: ambos true
}
```

`Place` é o tipo já existente (`name`, `lat`, `lon`).

Regras:
- **Proximidade:** dois lugares a menos de 30 m são o mesmo ponto. Vale para não duplicar favoritos e recentes.
- **Recentes:** entram quando o usuário toca em **Iniciar** (não na pré-visualização). Se o ponto já existe, sobe para o topo; passando de 20, o mais antigo sai.
- **Migração:** na primeira carga, se não existe o perfil novo e existe `semaforo-niteroi:places:v1`, `home` e `work` são copiados dali. A chave antiga não é apagada (permite voltar a uma versão antiga). Depois da migração, só o perfil novo é lido e escrito.
- **Armazenamento indisponível:** o app funciona em memória e não persiste, como hoje.

## Lógica (funções puras, testadas)

`src/profile/profile.ts`: tipos e `defaultProfile`, `addFavorite`, `renameFavorite`, `removeFavorite`, `setSlot(home|work)`, `addRecent`, `clearRecents`, `setName`, `setSetting`, `isNear`, `mergeImported`.
`src/profile/profileStore.ts`: `loadProfile` (com migração e validação), `saveProfile`, `parseProfile(unknown)` (rejeita lixo, descarta campos desconhecidos), `serializeProfile`.

**Importar** mescla: favoritos e recentes do arquivo entram sem duplicar (regra dos 30 m); nome e ajustes do arquivo substituem os atuais; Casa e Trabalho do arquivo só preenchem o que está vazio. Arquivo inválido → mensagem "Arquivo inválido", nada muda.

## Telas

1. **Botão do perfil** à direita da barra "Para onde?" na tela inicial: círculo com a inicial do nome. Abre a tela do perfil.
2. **Tela do perfil** (tela cheia, fundo claro como as folhas do Maps), com botão de voltar:
   - Cabeçalho: avatar, nome e botão de editar o nome.
   - **Favoritos:** Casa e Trabalho primeiro (vazios mostram "Definir"); tocar em um lugar fecha o perfil e traça a rota; menu ⋯ → Renomear, Remover.
   - **Recentes:** tocar traça a rota; ⭐ favorita; "Limpar histórico".
   - **Ajustes:** interruptores "Manter tela ligada" e "Mostrar trânsito na rota".
   - **Meus semáforos:** quantidade cadastrada neste aparelho, **Exportar**, **Importar**, **Modo cadastro** (os mesmos fluxos de hoje).
   - **Backup do perfil:** **Exportar perfil** e **Importar perfil** (JSON).
3. **Busca vazia** (campo focado, sem digitar): Casa, Trabalho, favoritos e até 5 recentes; tocar traça a rota. Hoje só mostra Casa e Trabalho.
4. **Pré-visualização da rota:** novo botão **⭐ Favoritar** ao lado de Casa e Trabalho. Se o destino já está nos favoritos (30 m), mostra "Já está nos favoritos."

## Integração com o código existente

- `App.tsx`: o estado `saved` (`SavedPlaces`) é substituído pelo estado do perfil, via um hook `useProfile` que carrega, salva a cada mudança e expõe as ações. `savedPlaces.ts` deixa de ser usado (a migração lê a chave antiga diretamente do perfil store); o arquivo e seu teste são removidos.
- `SearchBar`: recebe a lista de sugestões (Casa, Trabalho, favoritos, recentes) em vez de `SavedPlaces`.
- `useWakeLock(mode === 'drive' && profile.settings.keepAwake)`.
- `MapView`: `routeCongestion` só é passado quando `settings.showTraffic` é verdadeiro; senão a rota fica toda azul.
- `store/exportFile.ts`: extrair do `exportLights` uma função genérica `shareTextFile(filename, text, mime)` (web: download; Android: grava no cache e abre o Compartilhar), usada também pelo backup do perfil. Importar usa `<input type="file">`, como o modo cadastro já faz.
- Tela do perfil em `src/ui/ProfilePanel.tsx` (um componente, seções internas pequenas).

## Tratamento de erro

- Arquivo de importação ilegível ou fora do formato: "Arquivo inválido", sem alterar o perfil.
- Falha ao exportar no Android: "Erro ao exportar." (cancelar o Compartilhar não é erro, como hoje).
- Nome vazio ao editar: mantém o anterior.
- Coordenadas inválidas (NaN) em qualquer lugar vindo de arquivo: o item é descartado.

## Testes

Lógica pura em Vitest (ambiente `node`, sem DOM): adicionar/renomear/remover favorito, dedupe por 30 m, recentes (ordem, teto de 20, subir ao repetir), `setSlot`, `setSetting`, migração a partir da chave antiga, `parseProfile` (válido, inválido, campos extras, NaN), `mergeImported`. A tela é verificada à mão no celular via `adb` (prints).

## Riscos

- `localStorage` do WebView pode ser limpo pelo Android; por isso o backup em arquivo.
- Perfil exportado contém lugares pessoais (casa, trabalho): fica só no arquivo que o usuário compartilha; o app não envia nada a servidor.
