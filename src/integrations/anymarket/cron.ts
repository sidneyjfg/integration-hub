

import { sincronizarPedidosAnymarket } from './services//sincronizar-pedidos-anymarket'
import { sincronizarProdutosAnymarket } from './services/sincronizar-produtos-anymarket'

export async function executarCronPedidos() {
  await sincronizarPedidosAnymarket()
}

export async function executarCronProdutos() {
  await sincronizarProdutosAnymarket()
}


