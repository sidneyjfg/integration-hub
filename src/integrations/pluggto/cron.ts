// src/integrations/pluggto/cron.ts

import { sincronizarPedidosPluggto } from "./services/sincronizar-pedidos-pluggto"
import { sincronizarProdutosPluggto } from "./services/sincronizar-produtos-pluggto"

export async function executarCronPedidos() {
  await sincronizarPedidosPluggto()
}

export async function executarCronProdutos() {
  await sincronizarProdutosPluggto()
}
