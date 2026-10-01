// src/integrations/traycommerce/cron.ts
import type { CoreEnv } from '../../core/env.schema'
import { notifyGoogleChatError } from './notifications/google-chat'
import { sincronizarPedidosTraycommerce } from './services/sincronizar-pedidos-traycommerce'

export async function executarCronPedidos(_coreConfig: CoreEnv) {
  try {
    await sincronizarPedidosTraycommerce()
  } catch (erro) {
    // O hub-executor do core só faz console.error, então sem este catch a
    // queda da API não chega ao canal. A notificação vai no webhook de
    // erro e o erro é relançado para o log do core continuar registrando.
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    console.error('[TRAYCOMMERCE][CRON] Falha ao sincronizar pedidos', erro)

    await notifyGoogleChatError(
      `Falha no monitoramento de pedidos.\n` +
        `Contexto: sincronizar pedidos da TrayCommerce\n` +
        `Erro: ${mensagem}`
    )

    throw erro
  }
}