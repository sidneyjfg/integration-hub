// src/integrations/traycommerce/services/sincronizar-pedidos-traycommerce.ts
import {
  buscarPedidosTraycommerce,
  getUltimoResumoBuscaPedidosTraycommerce
} from '../api/traycommerce-client'
import {
  buscarPedidosNaoIntegradosTraycommerce,
  salvarPedidosTempTraycommerce
} from '../repositories/pedidos.repository'
import {
  formatarLinhaPedido,
  notifyGoogleChat,
  notifyGoogleChatWarning
} from '../notifications/google-chat'

export async function sincronizarPedidosTraycommerce() {
  console.log('[TRAYCOMMERCE][SYNC] Iniciando pedidos')

  const pedidos = await buscarPedidosTraycommerce()
  const resumoFiltro = formatarResumoFiltroStatus(
    getUltimoResumoBuscaPedidosTraycommerce()
  )

  if (pedidos.length === 0) {
    console.log('[TRAYCOMMERCE][SYNC] Nenhum pedido encontrado')
    await notifyGoogleChat(
      ['✅ Nenhum pedido encontrado na TrayCommerce', '', ...resumoFiltro].join(
        '\n'
      )
    )
    return
  }

  await salvarPedidosTempTraycommerce(pedidos)

  const naoIntegrados = await buscarPedidosNaoIntegradosTraycommerce()

  if (!naoIntegrados.length) {
    console.log('[TRAYCOMMERCE][SYNC] Nenhum pedido pendente de integração')
    await notifyGoogleChat(
      '✅ Todos os pedidos TrayCommerce foram integrados no Nérus'
    )
    return
  }

  // Reenvio ao Nérus ainda não implementado: por ora só avisa.
  await notifyGoogleChatWarning(
    [
      '⚠️ *Pedidos TrayCommerce não integrados encontrados*',
      '',
      `Total: ${naoIntegrados.length}`,
      '',
      ...resumoFiltro,
      '',
      ...naoIntegrados.map(formatarLinhaPedido)
    ].join('\n')
  )
}

function formatarResumoFiltroStatus(resumo: {
  ignorados: number
  statusIgnorados: string[]
}) {
  if (!resumo.statusIgnorados.length) {
    return [
      'Filtro TRAYCOMMERCE_ORDER_STATUS_TO_GET: nenhum status configurado'
    ]
  }

  return [
    `Filtro TRAYCOMMERCE_ORDER_STATUS_TO_GET: ${resumo.statusIgnorados.join(', ')}`,
    `Pedidos ignorados pelo filtro: ${resumo.ignorados}`
  ]
}
