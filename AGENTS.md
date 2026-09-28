# AGENTS.md

Gateway de integrações (Node.js + TypeScript + Fastify + MySQL, sem ORM) que sincroniza pedidos,
produtos e notas fiscais de marketplaces — Anymarket, PluggTo, TrayCorp e Mercado Livre.
Um processo, um contêiner, cron por hub.

## O que este repo faz

A Nérus é o ERP dos clientes. Cada cliente vende em canais externos, e o suporte precisa monitorar
pedidos, produtos (preço/estoque) e notas fiscais sem abrir tela de cada sistema.

- **Hub** = canal do cliente (Anymarket, PluggTo, TrayCorp) → traz **pedidos** e **produtos**.
- **Marketplace** = venda direta (Mercado Livre) → traz **notas fiscais** e **etiquetas**. No código
  o ML também entra como hub (`ACTIVE_INTEGRATIONS`, `executarCronNotas`).

**O papel do repo é alimentar a base de monitoramento.** Cada cron busca na API do hub e grava em
`sqlmonitoramento` / `sqltmp` (`temp_orders`, `temp_products`, `tmp_notas`) — e só isso. O cruzamento
com a base do cliente **não é feito aqui**: o usuário monta a consulta no gerenciador SQL do Nérus
WEB ERP, juntando a base de monitoramento com a base do cliente (`sqldados`) — ex.: "comparação
Nérus x MLI".

Duas regras que decorrem disso:
- **Não adicione lógica de relatório ou cruzamento neste repo** sem pedido explícito — isso é
  trabalho do usuário no ERP.
- **`temp_*` é contrato público**: os relatórios que o usuário já criou no ERP apontam para essas
  tabelas e colunas. Nunca renomeie nem remova coluna; migration só faz `ADD COLUMN`.

Automações que existem **além** do insert (as exceções ao padrão):
- **Pedidos** (Anymarket/PluggTo) comparam com `eordchannelp` e reenviam ao Nérus os não integrados.
  Só liga se `NERUS_RECEIVE_ORDER_URL` / `NERUS_NOTIFICATION_URL` estiverem setados — no compose a
  PluggTo vem ligada e a Anymarket desligada. O reenvio é usado normalmente.
- **Mercado Livre** é o caso mais completo: baixa o XML (batch da API ou SFTP), grava `tmp_notas`,
  compara com `nfeavxml` para **notificar** e fazer **auto-cura de retry** em `ffpreprocnf.retryCount`,
  e atualiza `nfcache` (etiqueta). Único hub que **escreve no banco do cliente**.
- `STORENOS` filtra as lojas do cliente e aparece em quase toda query de comparação.

## Branch: use SOMENTE a `develop`

- Todo trabalho e todo commit vai para a `develop`. **Não commite nem dê push na `master`**:
  ela é intocada por decisão do dev que montou o repo.
- O repositório é clonado na `master`, que fica **atrasada** em relação à `develop`. Antes de
  qualquer coisa: `git fetch origin && git switch develop`. Commitar a partir da `master`
  descarta o trabalho dos colegas.
- `git push origin develop` publica `ghcr.io/sidneyjfg/integrations-hub-develop:latest`;
  a `master` publica `.../integrations-hub:latest` (produção).
- Commits em português.

## Comandos

| Ação | Comando |
| --- | --- |
| Dev (watch) | `npm run dev` — **sempre na raiz do repo** (migrations resolvem `db/` pelo CWD) |
| Build + typecheck | `npm run build` (`tsc` → `dist/`) |
| Rodar o build | `npm start` (= `node dist/core/server.js`) |
| Suíte de testes | `npm test` |
| 1 teste | `npx ts-node --transpile-only -e "require('./tests/mercadolivre/sincronizar-notas.integration.test.ts')()"` |

- **Sem lockfile commitado** (`package-lock.json` está no `.gitignore`): use `npm install`.
  `npm ci` falha.
- **Não existe lint nem formatter.** O estilo é misto (metade dos arquivos usa `;`, metade não):
  siga o arquivo que você está editando.
- `dev` e `test` rodam com `--transpile-only` → **erro de tipo só aparece em `npm run build`**.
  Rode `npm run build` antes de qualquer push.
- Sem `.env` na máquina, `npm run dev` **quebra no boot** (ZodError). O dump do erro no Node 24 é
  confuso (`Cannot read properties of undefined (reading 'value')` dentro do `zod`); a causa real é
  env obrigatório faltando. Local usa Node 24, CI e Docker usam Node 20.

## Onde se testa

O repo **não roda local**: precisa do MySQL do cliente e do Nérus. O fluxo é alterar → `npm run build`
(typecheck; não existe lint) → commit e push na `develop` → a CI monta a imagem → **validação no AWS
do suporte**, que roda essa imagem → depois o cliente. `npm test` é opcional e não substitui o teste
no AWS.

## Testes (runner próprio, sem framework)

`tests/run-tests.ts` é um runner caseiro: faz `require` de uma lista de arquivos e chama a função
exportada por cada um (`export = async function run()`, asserting com `node:assert/strict`). Um teste
novo nunca roda até ser adicionado nessa lista. Os testes usam mocks de pool e de API via
`tests/helpers/module-loader.ts` e env fixo de `tests/helpers/*-env.ts` — é por isso que eles rodam
offline. Nada disso substitui o teste no AWS. Em `tests/` há arquivos soltos que **não são teste** e
nunca rodam: `tests/teste.ts` (inspector manual de `natOp` de XML sobre `./`) e
`tests/busca-pedidos.js` (script manual).

## Env é validado no import (a maior pegadinha do repo)

`src/core/env.schema.ts` e cada `src/integrations/*/env.schema.ts` terminam com
`schema.parse(process.env)` no **carregamento do módulo** e exportam o resultado
(`coreConfig`, `mercadolivreConfig`, ...). Consequências:
- Mudar `process.env` depois do import não tem efeito — por isso os testes setam env **antes** do
  `require` e depois usam `clearModules()` + `requireWithMocks()`.
- `GOOGLE_CHAT_WEBHOOK_URL` é **obrigatório** no schema do core: sem ele o processo não sobe.
- Variável faltante de hub ativo derruba o boot, não só a feature.
- `ATIVA_BUSCA_CS` passa por `cron.validate()` em `registerCrons` e **lança erro no boot** se não
  for expressão cron válida. Deixe **vazio** para desativar; o `docker-compose.yml` traz `"false"`,
  que não é cron válido.
- `GOOGLE_SHEETS_CREDENTIALS_FILE` aponta para um **arquivo** de service account (docker secret
  montado em `/run/secrets/...`), não para o conteúdo da chave.

## Como um hub é carregado (fio do boot)

`src/core/server.ts` → `loader.ts` percorre `ACTIVE_INTEGRATIONS` (separado por vírgula; **a ordem
importa**) e, para cada token:
1. `runHubMigrations(hub)` executa **todos** os arquivos de `db/<hub>/` no pool de monitoramento.
2. `require('../integrations/<hub>')` e chama o `register(app)` exportado pelo hub.

- O `require` é montado a partir da string do env: **o nome da pasta precisa ser idêntico ao token**
  de `ACTIVE_INTEGRATIONS`, e token inválido estoura o boot.
- Migrations resolvem `path.resolve('db', hub)` a partir do **CWD** → rode sempre na raiz.
- Arquivos rodam em **ordem alfabética**: numere (`001-`, `002-`, ...). Os `ALTER` do ML (`001-`,
  `002-`) hoje ordenam **antes** de `tmp_notas.sql` e quebram em banco de monitoramento novo.
- Só `ER_DUP_FIELDNAME` (1060) é tolerado; qualquer outro erro de SQL aborta o boot. SQL novo tem
  que ser idempotente.
- O `cron.ts` do hub precisa exportar `executarCronPedidos | executarCronProdutos |
  executarCronNotas | executarCronSFTP | executarCronEtiqueta | executarCronBuscaCS`; função
  ausente = hub pulado em silêncio. E o hub precisa entrar nas listas fixas `HUBS_COM_PEDIDOS`
  (`src/core/cron/pedidos.cron.ts`) e `HUBS_COM_PRODUTOS` (`produtos.cron.ts`) — notas, SFTP,
  etiqueta e busca CS são exclusivos do Mercado Livre.
- **Os crons não rodam em paralelo**: `enfileirarCron()` (`src/shared/cron-queue.ts`) serializa
  tudo, e o ML ainda tem flag própria (`notasMLRunning`) que ignora o ciclo. Não introduza
  `Promise.all` de crons.

## Banco: a documentação desatualiza

- `poolMain` = `DB_NAME_DADOS`, `poolMonitoramento` = `DB_NAME_MONITORAMENTO` (`src/core/db.ts`);
  os dois usam o mesmo host/usuário `DB_*_MONITORAMENTO`.
- **Tabelas `temp_*` NÃO são namespaced por hub.** `db/anymarket/003-`, `db/pluggto/003-` e
  `db/traycorp/` criam todas `temp_products` com colunas **incompatíveis** no mesmo schema: vence o
  hub que subir primeiro e os outros viram no-op silencioso. O repositório de produtos da Anymarket
  ainda consulta `temp_products` sem qualificar.
- **Mercado Livre escreve no banco principal do cliente** via `poolMain`: `UPDATE ffpreprocnf`
  (retryCount) e `UPDATE nfcache`. Isso contraria a regra "nunca escrever no banco principal" do
  `README.md` e do `docs/GUIA_NOVO_HUB.md` — e exige permissão de escrita em `DB_NAME_DADOS`.
- Credenciais OAuth do ML vêm da tabela `userfull` com um `CASE` fixo `clientSecret → clientId`.
  `MERCADOLIVRE_ACCESS_TOKEN`, `REFRESH_TOKEN`, `CLIENT_ID`, `CLIENTE_ID` e `STORENOS` do
  `docker-compose.yml` são config morta.
- SQL é cru e montado por template; alguns valores são interpolados em vez de parametrizados
  (`STORENOS`, `NO_LOOK_STATUS_TYPE`, nome de tabela). Siga o padrão, mas nunca interpole input novo
  sem sanitizar.
- Ao criar coluna, lembre que as `temp_*` são `MyISAM` em `latin1`, e que coluna nova só pode ser
  **adicionada**: os relatórios do ERP já apontam para as existentes.

## Arquivos locais e segredos

- O SFTP do ML grava em `./notas/normal`, `./notas/sftp` e `./ledger`, relativos ao CWD (estão no
  `.gitignore`). São arquivos de cliente: não versione e não apague sem autorização.
- `.gitignore` também ignora `core` — cuidado com arquivos com esse nome.
- Já existem segredos reais commitados: token do ML em `tests/busca-pedidos.js` (script órfão,
  exclusivo da `develop` — não existe no `master`, ninguém referencia, o runner não pega e não entra
  no build nem na imagem) e webhook do Google Chat em `tests/helpers/mercadolivre-env.ts`. **Não
  copie, não reutilize e não adicione novos segredos ao repo.**

## Deploy

- O fluxo é: alterar → `npm run build` (typecheck) → commit/push na `develop` → a CI monta a imagem
  → validação no AWS do suporte. **Ninguém builda imagem na mão.**
- `.github/workflows/deploy.yml` roda `npm install` → `npm run build` → build/push. Se houver erro
  de tipo, **a imagem não é gerada** — por isso rode `npm run build` antes de dar push.
  **Não há step de teste no CI**: `npm test` é responsabilidade de quem commita.
- `develop` → `ghcr.io/sidneyjfg/integrations-hub-develop:latest`, que é a imagem que o AWS do
  suporte consome. `master` → `.../integrations-hub:latest` (produção, clientes).
- O `Dockerfile` copia um `dist/` **já compilado** e o `db/`. A imagem não leva `.env` nem lockfile e
  instala só deps de produção.
- A lista de variáveis do `docker-compose.yml` (vazio = não setado) é a superfície de configuração do
  deploy. Ao adicionar env, atualize também `docs/variaveis-ambiente.md`.
- Segredo de infra (service account do Google Sheets) entra por `secrets:` do compose, não por env.

## Convenções

- Identificadores, comentários e logs em português. Mantenha.
- Prefixos de log: `[ANYMARKET][DB|CRON|SYNC|REENVIO]`, `[PLUGGTO][SYNC]`,
  `[MERCADOLIVRE][AUTH|DB|CRON|ETIQUETA|NOTIFY|RETRY]`, `[BUSCA-CS][...]`, `[CRON]`.
  Notificação é resumida, nunca por item.
- Aviso/erro usam `notifyGoogleChatWarning` / `notifyGoogleChatError`
  (`GOOGLE_CHAT_WEBHOOK_URL_WARNING` / `_ERROR`); sem elas, caem no webhook principal.
- Camadas por hub: `routes/` → `services/` → `repositories/` + `api/`; tipos em
  `src/shared/types/`. Regra de negócio em `services/`, SQL em `repositories/`.
- Use `valor ?? null` antes de persistir: nunca mande `undefined` para o MySQL.
- CORS é registrado com `methods: ['GET']`, então a única rota POST
  (`/anymarket/products/sync`) não funciona cross-origin via browser.
- A lista de rotas do `README.md` (`POST /pluggto/orders`, etc.) está desatualizada. A superfície
  real está em `src/integrations/*/index.ts` (quase tudo `GET .../resumo`).
- `docs/GUIA_NOVO_HUB.md` é o checklist de hub novo, mas parte das afirmações (isolamento por hub,
  contrato de cron) está desatualizada — confirme sempre no core.

## Referências

- Variáveis de ambiente: `docs/variaveis-ambiente.md`
- Novo hub: `docs/GUIA_NOVO_HUB.md`
- CI/deploy: `.github/workflows/deploy.yml`
