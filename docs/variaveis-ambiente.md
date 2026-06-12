# Variaveis de ambiente implementadas

Somente as variaveis que existem no schema e sao usadas no codigo atual.

## Core

| Variavel | Para que serve | Como usar |
| --- | --- | --- |
| `PORT` | Porta do servidor. | Defina o numero da porta, ex: `3000`. |
| `DB_HOST_MONITORAMENTO` | Host do banco de monitoramento. | Informe o IP ou hostname do MySQL. |
| `DB_PORT_MONITORAMENTO` | Porta do banco de monitoramento. | Normalmente `3306`. |
| `DB_USER_MONITORAMENTO` | Usuario do banco de monitoramento. | Informe o usuario do MySQL. |
| `DB_PASS_MONITORAMENTO` | Senha do banco de monitoramento. | Informe a senha do usuario. |
| `DB_NAME_DADOS` | Banco principal de dados. | Nome do schema usado nas consultas. |
| `DB_NAME_MONITORAMENTO` | Banco de tabelas temporarias. | Nome do schema de apoio/temporarios. |
| `ACTIVE_INTEGRATIONS` | Quais integrações ficam ativas. | Separe por virgula, ex: `anymarket,mercadolivre`. |
| `STORENOS` | Filtra lojas nas consultas SQL. | Separe por virgula, ex: `1,2,4`. |
| `CRON_PEDIDOS` | Agenda o cron de pedidos. | Use uma expressao cron valida ou deixe vazio. |
| `CRON_PRODUTOS` | Agenda o cron de produtos. | Use uma expressao cron valida ou deixe vazio. |
| `CRON_NOTAS_ML` | Agenda a sincronizacao normal do Mercado Livre. | Use uma expressao cron valida ou deixe vazio. |
| `CRON_NOTAS_SFTP` | Agenda a sincronizacao SFTP do Mercado Livre. | Use uma expressao cron valida ou deixe vazio. |
| `USA_ETIQUETA` | Agenda o cron de etiqueta. | Use uma expressao cron valida ou deixe vazio. |
| `GOOGLE_CHAT_WEBHOOK_URL` | Envia notificacoes para o Google Chat. | Informe a URL completa do webhook. |
| `TZ` | Define o fuso horario do processo. | Ex: `America/Sao_Paulo`. |

## Mercado Livre

| Variavel | Para que serve | Como usar |
| --- | --- | --- |
| `CLIENT_NAME` | Nome exibido nas notificacoes. | Ex: `FG`. |
| `MERCADOLIVRE_SFTP_HOST` | Host do SFTP de destino. | Informe o IP ou hostname. |
| `MERCADOLIVRE_SFTP_PORT` | Porta do SFTP. | Normalmente `22`. |
| `MERCADOLIVRE_SFTP_USER` | Usuario do SFTP. | Informe o usuario de acesso. |
| `MERCADOLIVRE_SFTP_PASSWORD` | Senha do SFTP. | Informe a senha do usuario. |
| `MERCADOLIVRE_DAYS_TO_FETCH` | Quantos dias voltar na busca de notas. | Ex: `3` para buscar os ultimos 3 dias. |
| `ETIQUE_DAYS_TO_FETCH` | Quantos dias considerar na atualizacao do nfcache de etiqueta. | Ex: `3` para atualizar hoje e os 2 dias anteriores. Se vazio, usa `1`. |
| `MERCADOLIVRE_END_TO_FETCH` | Dia final da busca normal. | Use `0` para fechar em hoje. |
| `MERCADOLIVRE_END_SFTP` | Dia final da busca SFTP. | Use `0` para fechar em hoje. |
| `MERCADOLIVRE_MAX_RETRY_COUNT` | Limite de retry para notas nao integradas. | Informe um numero, ex: `5000`. |
| `MERCADOLIVRE_SFTP_ENABLED` | Define se o envio usa SFTP. | Use `true` ou `false`. |
| `MERCADOLIVRE_SFTP_DIR` | Diretorio raiz remoto do envio. | Ex: `/ML_FULL`. |
| `MERCADOLIVRE_USE_LEDGER` | Ativa controle de enviados. | Use `true` ou `false`. |
| `MERCADOLIVRE_SFTP_ORGANIZE_BY_DATE` | Organiza o destino por data. | Use `true` ou `false`. |
| `MERCADOLIVRE_SFTP_IGNORE_END_FILE` | Ignora arquivos por sufixo/nome. | Separe por virgula, ex: `ct_e,evento`. |
| `MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA` | Ignora tipos de nota no SFTP. | Separe por virgula, ex: `DEVOLUCAO`. |
| `MERCADOLIVRE_IGNORE_SERIE` | Ignora series especificas. | Separe por virgula. |
| `MERCADOLIVRE_IS_VONDER` | Forca o modo Vonder no SFTP. | Use `true` quando o cliente for Vonder. |
| `MERCADOLIVRE_SFTP_UID` | UID usado em operacoes locais. | Informe o UID numerico. |
| `MERCADOLIVRE_SFTP_GID` | GID usado em operacoes locais. | Informe o GID numerico. |
| `GOOGLE_CHAT_WEBHOOK_URL` | Envia notificacoes do Mercado Livre. | Informe a URL completa do webhook. |

## AnyMarket

| Variavel | Para que serve | Como usar |
| --- | --- | --- |
| `ANYMARKET_URL` | Base da API AnyMarket. | Informe a URL completa, sem barra final. |
| `ANYMARKET_GUMGATOKEN` | Token usado nas chamadas da API. | Informe o token fornecido pela AnyMarket. |
| `ANYMARKET_DAYS_TO_FETCH` | Quantos dias voltar na busca. | Ex: `1`, `3`, `7`. |
| `FULFILLMENT` | Filtra pedidos fulfillment. | Use `true` ou `false`. |
| `CONVENCIONAL` | Filtra pedidos convencionais. | Use `true` ou `false`. |
| `NO_LOOK_STATUS_TYPE` | Ignora status especificos. | Separe por virgula, ex: `canceled,approved`. |
| `NERUS_NOTIFICATION_URL` | Endpoint do Nerus para reenvio. | Informe a URL completa ou deixe vazio para desativar. |
| `NERUS_OI` | Campo `oi` no payload enviado ao Nerus. | Informe o identificador da conta. |

## Pluggto

| Variavel | Para que serve | Como usar |
| --- | --- | --- |
| `PLUGGTO_URL` | Base da API Pluggto. | Informe a URL completa. |
| `PLUGGTO_CLIENT_ID` | Credencial OAuth da Pluggto. | Informe o client id. |
| `PLUGGTO_CLIENT_SECRET` | Credencial OAuth da Pluggto. | Informe o client secret. |
| `PLUGGTO_USERNAME` | Usuario para autenticação. | Informe o usuario da conta. |
| `PLUGGTO_PASSWORD` | Senha para autenticação. | Informe a senha da conta. |
| `PLUGGTO_NO_LOOK_STATUS_TYPES` | Ignora status no filtro. | Separe por virgula, ex: `canceled,approved`. |
| `NERUS_RECEIVE_ORDER_URL` | Endpoint para reenvio de pedidos. | Informe a URL completa ou deixe vazio. |

## Traycorp

| Variavel | Para que serve | Como usar |
| --- | --- | --- |
| `TRAY_URL` | Base da API TrayCorp. | Informe a URL completa. |
| `TRAY_TOKEN` | Token usado nas chamadas da API. | Informe um token com pelo menos 10 caracteres. |
