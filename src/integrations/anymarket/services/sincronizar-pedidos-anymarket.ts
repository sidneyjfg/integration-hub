import { buscarPedidosRecentesAnymarket } from '../api/anymarket-pedidos.api'
import { notifyGoogleChat } from '../notifications/google-chat'
import {
  salvarPedidosAnymarketMonitoramento,
  buscarPedidosAnymarketNaoIntegradosNerus
} from '../repositories/anymarket-pedidos.repository'
import { reenviarPedidosAnymarketNaoIntegradosNerus } from './reenviar-pedidos-anymarket'
import { registrarLogSincronizacaoPedidosAnymarket } from './registro-sincronizacao-anymarket'


export const sincronizarPedidosAnymarket = async (): Promise<void> => {
  console.log('[ANYMARKET][SYNC] Iniciando sincronização de pedidos')

  try {
    const pedidos = await buscarPedidosRecentesAnymarket()

    if (pedidos.length === 0) {
      console.log('[ANYMARKET][SYNC] Nenhum pedido encontrado')
      await notifyGoogleChat('Nenhum pedido encontrado no Anymarket.')
      return
    }

    console.log(
      '[ANYMARKET][SYNC] Salvando pedidos no monitoramento',
      { total: pedidos.length }
    )

    await salvarPedidosAnymarketMonitoramento(pedidos)

    const pedidosNaoIntegrados =
      await buscarPedidosAnymarketNaoIntegradosNerus()

    console.log(
      '[ANYMARKET][SYNC] Comparação concluída',
      { naoIntegrados: pedidosNaoIntegrados.length }
    )

    await registrarLogSincronizacaoPedidosAnymarket(
      { totalPedidos: pedidos.length },
      200
    )

    if (pedidosNaoIntegrados.length > 0) {
      const mensagens = await reenviarPedidosAnymarketNaoIntegradosNerus(
        pedidosNaoIntegrados
      )

      await notifyGoogleChat(mensagens.join('\n'))
    } else {
      console.log('[ANYMARKET][SYNC] Todos os pedidos integrados')

      await notifyGoogleChat(
        'Todos os pedidos da Anymarket foram encontrados no Nérus.'
      )
    }
  } catch (erro) {
    console.error('[ANYMARKET][SYNC] Erro na sincronização', erro)

    await registrarLogSincronizacaoPedidosAnymarket(
      { erro },
      500
    )

    await notifyGoogleChat(
      'Erro ao executar sincronização de pedidos da Anymarket.'
    )

    throw erro
  }
}
