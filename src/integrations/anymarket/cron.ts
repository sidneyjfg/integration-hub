

import { sincronizarPedidosAnymarket } from './services//sincronizar-pedidos-anymarket'

export async function executarCronPedidos() {
  await sincronizarPedidosAnymarket()
}


