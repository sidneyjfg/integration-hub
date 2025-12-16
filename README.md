# Integrations Hub

## 📌 Visão Geral

O **Integrations Hub** é um gateway de integrações desenvolvido em **Node.js + TypeScript**, com foco em **centralizar integrações de marketplaces e hubs externos** em um único serviço.

Ele expõe **rotas HTTP padronizadas** para que ferramentas como **n8n**, **cron jobs** ou outros sistemas possam enviar dados de **pedidos**, **produtos** e **notas fiscais**, armazenando-os em **tabelas temporárias de monitoramento** no MySQL do cliente.

---

## 🎯 Objetivos do Projeto

- Centralizar integrações (Anymarket, PluggTo, TrayCorp, Mercado Livre)
- Isolar dados por **hub**
- Criar tabelas automaticamente se não existirem
- Nunca alterar estruturas já existentes
- Nunca escrever no banco principal do cliente
- Trabalhar apenas com **MySQL**
- Ser **plugável**, **idempotente** e **escalável**

---

## 🧱 Arquitetura Geral

### Bancos de Dados

O projeto trabalha com **dois contextos de banco**:

1. **Banco principal do cliente (`DB_NAME_DADOS`)**
   - Apenas leitura
   - Usado para validações e cruzamento de dados
   - Nunca recebe `INSERT`, `UPDATE` ou `DELETE`

2. **Banco de monitoramento (`DB_NAME_MONITORAMENTO`)**
   - Sempre existe no cliente
   - Contém as tabelas `temp_*`
   - Recebe os dados enviados pelas integrações

---

## 📂 Estrutura do Projeto

```text
.
├── db
│   ├── anymarket
│   │   └── temp_orders.sql
│   ├── init.sql
│   ├── mercadolivre
│   │   └── tmp_notas.sql
│   ├── pluggto
│   │   ├── temp_orders.sql
│   │   └── temp_products.sql
│   └── traycorp
│       └── temp_products.sql
├── docker-compose.yml
├── Dockerfile
├── nodemon.json
├── package.json
├── src
│   ├── core
│   │   ├── db.ts
│   │   ├── env.schema.ts
│   │   ├── integrations.controller.ts
│   │   ├── loader.ts
│   │   ├── migrations.ts
│   │   └── server.ts
│   ├── integrations
│   │   ├── anymarket
│   │   ├── mercadolivre
│   │   ├── pluggto
│   │   └── traycorp
│   └── shared
│       └── types
│           ├── anymarket.ts
│           ├── mercadolivre.ts
│           ├── pluggto.ts
│           └── traycorp.ts
└── tsconfig.json
```

---

## ⚙️ Funcionamento das Integrações

1. O container sobe  
2. Lê a variável `ACTIVE_INTEGRATIONS`  
3. Para cada hub ativo:
   - Executa os scripts SQL em `db/<hub>`
   - Cria as tabelas usando `CREATE TABLE IF NOT EXISTS`
   - Registra as rotas HTTP do hub  

Todo o processo é **idempotente** e **seguro para ambientes já existentes**.

---

## 🔌 Integrações Disponíveis

### 🟢 Anymarket
- **Dados monitorados:** pedidos  
- **Tabela:** `anymarket.temp_orders`  
- **Rota:**
```http
POST /anymarket/orders
```

---

### 🔵 PluggTo
- **Dados monitorados:** pedidos e produtos  
- **Tabelas:**
  - `pluggto.temp_orders`
  - `pluggto.temp_products`
- **Rotas:**
```http
POST /pluggto/orders
POST /pluggto/products
```

---

### 🟡 TrayCorp
- **Dados monitorados:** produtos  
- **Tabela:** `traycorp.temp_products`  
- **Rota:**
```http
POST /traycorp/products
```

---

### 🔴 Mercado Livre
- **Dados monitorados:** notas fiscais  
- **Tabela:** `mercadolivre.tmp_notas`  
- **Rota:**
```http
POST /mercadolivre/notas
```

---

## 🔐 Variáveis de Ambiente

### Obrigatórias

```env
DB_HOST_MONITORAMENTO=localhost
DB_PORT_MONITORAMENTO=3306
DB_USER_MONITORAMENTO=user
DB_PASS_MONITORAMENTO=password

DB_NAME_DADOS=sqldados
DB_NAME_MONITORAMENTO=sqlmonitoramento

ACTIVE_INTEGRATIONS=anymarket,pluggto,traycorp,mercadolivre
```

### Variáveis por Integração

Cada hub possui seu próprio arquivo `env.schema.ts`.

Exemplo:

```env
ANYMARKET_TOKEN=xxx
PLUGGTO_TOKEN=yyy
MERCADOLIVRE_TOKEN=zzz
```

> ⚠️ Se uma integração estiver ativa e a variável obrigatória não existir,  
> o container **falha no boot**.

---

## 🛠️ Como Rodar

### Desenvolvimento

```bash
npm install
npm run dev
```

### Docker

```bash
docker-compose up -d
```

Serviço disponível em:

```
http://localhost:3000
```

---

## 🌐 Endpoints Globais

### Healthcheck

```http
GET /health
```

Resposta:

```json
{ "status": "ok" }
```

---

### Integrações Ativas

```http
GET /integrations
```

Resposta:

```json
{
  "active": ["anymarket", "pluggto", "traycorp"]
}
```

---

## 🧩 Tipagem e Qualidade

- TypeScript com `strict: true`
- Nenhum uso de `any`
- Tipos centralizados em `src/shared/types`
- Rotas tipadas com `FastifyRequest<{ Body: ... }>`

Pronto para evoluir para **validação com Zod**.

---

## ➕ Como Adicionar um Novo HUB

1. Criar diretório SQL:
```bash
db/novohub/
```

2. Criar scripts usando:
```sql
CREATE TABLE IF NOT EXISTS ...
```

3. Criar integração:
```bash
src/integrations/novohub/
```

4. Criar os arquivos:
- `index.ts`
- `routes.*.ts`
- `env.schema.ts`
- types em `shared/types`

5. Ativar no `.env`:
```env
ACTIVE_INTEGRATIONS=novohub
```

---

## 🧠 Boas Práticas

- Auto-provisionamento de tabelas
- Isolamento por hub
- Zero impacto em clientes existentes
- SQL explícito
- Sem ORM
- Código desacoplado