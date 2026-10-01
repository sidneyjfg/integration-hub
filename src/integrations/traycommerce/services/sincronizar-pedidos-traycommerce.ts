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
  notifyGoogleChat,
  notifyGoogleChatWarning
} from '../notifications/google-chat'

export async function sincronizarPedidosTraycommerce() {
  console.log('[TRAYCOMMERCE][SYNC] Iniciando pedidos')

  const pedidos = await buscarPedidosTraycommerce()
  const resumo = getUltimoResumoBuscaPedidosTraycommerce()

  logResumoFiltroStatus(resumo)

  if (pedidos.length === 0) {
    console.log('[TRAYCOMMERCE][SYNC] Nenhum pedido encontrado')

    await notifyGoogleChat(
      `Nenhum pedido encontrado na TrayCommerce na janela consultada.\n` +
        `Janela: ${formatarJanela(resumo.from, resumo.to)}`
    )
    return
  }

  await salvarPedidosTempTraycommerce(pedidos)

  // A comparação usa a mesma janela da busca, então os três números abaixo
  // saem sempre da mesma fonte e não ficam inconsistentes entre si.
  const linhas = await buscarPedidosNaoIntegradosTraycommerce({
    from: resumo.from,
    to: resumo.to
  })

  const verificados = linhas.length
  const naoIntegrados = linhas.filter(l => l.nao_integrado === 1).length
  const integrados = verificados - naoIntegrados

  console.log('[TRAYCOMMERCE][SYNC] Resumo da janela', {
    janela: `${resumo.from}-${resumo.to}`,
    verificados,
    integrados,
    naoIntegrados
  })

  if (naoIntegrados === 0) {
    console.log('[TRAYCOMMERCE][SYNC] Nenhum pedido pendente de integração')

    await notifyGoogleChat(
      `${verificados} de ${verificados} pedidos integrados na TrayCommerce.\n` +
        blocoContagem({ verificados, integrados, naoIntegrados })
    )
    return
  }

  // Reenvio ao Nérus ainda não implementado: por ora só avisa.
  await notifyGoogleChatWarning(
    `${naoIntegrados} de ${verificados} pedidos não integrados na TrayCommerce.\n` +
      blocoContagem({ verificados, integrados, naoIntegrados })
  )
}

/**
 * O nome da variável e a contagem de ignorados são informação de
 * diagnóstico, não de operação: ficam no log e não no canal, que é para
 * quem precisa agir.
 */
function logResumoFiltroStatus(resumo: {
  ignorados: number
  statusIgnorados: string[]
}) {
  console.log('[TRAYCOMMERCE][SYNC] Filtro de status', {
    variavel: 'TRAYCOMMERCE_ORDER_STATUS_TO_GET',
    status: resumo.statusIgnorados.join(', ') || '(nenhum configurado)',
    ignorados: resumo.ignorados
  })
}

function blocoContagem(contagem: {
  verificados: number
  integrados: number
  naoIntegrados: number
}) {
  return (
    `📦 Pedidos verificados: ${contagem.verificados}\n` +
    `✅ Integrados no ERP: ${contagem.integrados}\n` +
    `❌ Não integrados: ${contagem.naoIntegrados}`
  )
}

function formatarJanela(from: string, to: string) {
  const formatar = (valor: string) =>
    valor.length === 8
      ? `${valor.slice(0, 4)}/${valor.slice(4, 6)}/${valor.slice(6, 8)}`
      : valor

  return `${formatar(from)} a ${formatar(to)}`
}