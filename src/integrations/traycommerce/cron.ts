// src/integrations/traycommerce/cron.ts
import type { CoreEnv } from '../../core/env.schema'
import { sincronizarPedidosTraycommerce } from './services/sincronizar-pedidos-traycommerce'

export async function executarCronPedidos(_coreConfig: CoreEnv) {
  await sincronizarPedidosTraycommerce()
}
