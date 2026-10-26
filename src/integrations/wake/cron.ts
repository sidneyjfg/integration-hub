// src/integrations/wake/cron.ts
import type { CoreEnv } from '../../core/env.schema'
import { notifyGoogleChatError } from './notifications/google-chat'
import { sincronizarPedidosWake } from './services/sincronizar-pedidos-wake'
import { sincronizarProdutosWake } from './services/sincronizar-produtos-wake'

export async function executarCronPedidos(_coreConfig: CoreEnv) {
  try {
    await sincronizarPedidosWake()
  } catch (erro) {
    // O hub-executor do core só faz console.error, então sem este catch a
    // queda da API não chega ao canal. A notificação vai no webhook de
    // erro e o erro é relançado para o log do core continuar registrando.
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    console.error('[WAKE][CRON] Falha ao sincronizar pedidos', erro)

    await notifyGoogleChatError(
      `Falha no monitoramento de pedidos.\n` +
        `Contexto: sincronizar pedidos da Wake\n` +
        `Erro: ${mensagem}`
    )

    throw erro
  }
}

export async function executarCronProdutos(_coreConfig: CoreEnv) {
  try {
    await sincronizarProdutosWake()
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    console.error('[WAKE][CRON] Falha ao sincronizar preços e estoque', erro)

    await notifyGoogleChatError(
      `Falha no monitoramento de preços e estoque.\n` +
        `Contexto: sincronizar preços e estoque da Wake\n` +
        `Erro: ${mensagem}`
    )

    throw erro
  }
}
