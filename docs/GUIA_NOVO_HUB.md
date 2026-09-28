# Integrations Hub – Guia de Implementação de Novos Hubs

## ✅ Validação da Documentação Atual

A documentação atual **está consistente** com tudo o que foi implementado até agora no projeto e **pode ser usada como base para os próximos hubs**, com os seguintes pontos confirmados:

### ✔ Arquitetura
- Separação correta entre **core** e **integrations**
- Loader dinâmico por `ACTIVE_INTEGRATIONS`
- Crons centralizados no core e executados por hub
- Execução idempotente de migrations SQL
- Uso exclusivo do banco `_MONITORAMENTO` para escrita

### ✔ Banco de Dados
- Pool único (`poolMonitoramento`)
- Escrita apenas em tabelas `temp_*`
- Leitura opcional do banco de dados principal
- Nenhum ORM (SQL explícito)

### ✔ Integrações
Cada hub deve conter obrigatoriamente:
- `index.ts` → registra rotas
- `cron.ts` → expõe funções de cron
- `env.schema.ts` → valida variáveis do hub
- `repositories/*` → acesso a dados
- `services/*` → regras de negócio
- Tipos em `src/shared/types`

### ✔ Crons
- Crons globais configurados no `.env`
- Execução dinâmica por hub ativo
- Cada hub decide se implementa:
  - pedidos
  - produtos
  - notas

---

## ⚠️ O QUE ESTAVA FALTANDO NA DOC (IMPORTANTE)

Para facilitar novos hubs, **recomendo adicionar explicitamente estas seções**, que refletem o que já foi implementado no código:

### 🔁 Padrão de Cron por Hub

Cada hub **deve exportar funções nomeadas** no arquivo `cron.ts`:

```ts
export async function executarCronPedidos(coreConfig: CoreEnv) {}
export async function executarCronProdutos(coreConfig: CoreEnv) {}
export async function executarCronNotas(coreConfig: CoreEnv) {}
```

O hub pode exportar apenas o que fizer sentido.

---

### 🔌 Contrato esperado pelo Core

O `hub-executor.ts` espera:

```ts
require(`../integrations/${hub}/cron`)
```

E verifica dinamicamente:
- `executarCronPedidos`
- `executarCronProdutos`
- `executarCronNotas`

👉 **Se a função não existir, o cron simplesmente ignora o hub.**

---

### 🧾 Logging (Padrão recomendado)

Prefixos obrigatórios:
- `[HUB][SYNC]`
- `[HUB][DB]`
- `[HUB][CRON]`
- `[HUB][REENVIO]`

Exemplo:
```ts
console.log('[ANYMARKET][DB] 20 pedidos salvos')
```

---

### 🚨 Tratamento de Dados Opcionais

- Nunca enviar `undefined` para o banco
- Sempre usar:
```ts
valor ?? null
```

Ou defaults antes de persistir.

---

### 📣 Notificações

- Notificação global via Google Chat
- Notificação **resumida**, nunca por item
- Em caso de erro de configuração:
  - Notificar **uma única vez**
  - Informar total afetado

---

## 🧩 Checklist para Criar um Novo HUB

1. Criar pasta SQL:
```bash
db/novohub/
```

2. Criar integração:
```bash
src/integrations/novohub/
```

3. Criar arquivos:
- `index.ts`
- `cron.ts`
- `env.schema.ts`
- `repositories/*`
- `services/*`

4. Criar tipos:
```bash
src/shared/types/novohub.ts
```

5. Ativar no `.env`:
```env
ACTIVE_INTEGRATIONS=novohub
```

---

## ✅ Conclusão

📌 **Sua documentação está correta e alinhada com a implementação atual.**  
📌 O conteúdo acima apenas **complementa** pontos que estavam implícitos no código.  

👉 Este arquivo pode ser usado como **template oficial para novos hubs** sem ajustes estruturais.
