import { ResultadoComparacaoPedido } from '../../../shared/types'
import { anymarketConfig } from '../env.schema'
import { enviarPedidoAoNerus } from './enviar-pedido-nerus'

export const reenviarPedidosAnymarketNaoIntegradosNerus = async (
  pedidos: ResultadoComparacaoPedido[]
): Promise<string[]> => {
  console.log('[ANYMARKET][REENVIO] Iniciando processo', {
    totalPedidos: pedidos.length
  })

  // 🚫 Reenvio desativado → listar pedidos e avisar UMA vez no final
  if (!anymarketConfig.NERUS_NOTIFICATION_URL) {
    console.warn(
      '[ANYMARKET][REENVIO] Reenvio desativado (NERUS_NOTIFICATION_URL ausente)'
    )

    const linhas: string[] = []
    linhas.push(
      '⚠️ Reenvio não executado: variável NERUS_NOTIFICATION_URL não definida.'
    )

    return linhas
  }

  // ===============================
  // 🔁 Reenvio normal
  // ===============================
  const TAMANHO_LOTE = 5
  const MAX_TENTATIVAS = 2
  const mensagensResultado: string[] = []

  for (let i = 0; i < pedidos.length; i += TAMANHO_LOTE) {
    const lote = pedidos.slice(i, i + TAMANHO_LOTE)

    console.log('[ANYMARKET][REENVIO] Processando lote', {
      inicio: i + 1,
      fim: i + lote.length
    })

    await Promise.all(
      lote.map(async (pedido) => {
        let sucesso = false

        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
          console.log(`[ANYMARKET][REENVIO] Tentativa ${tentativa}`, {
            pedido: pedido.ID_ANYMARKET
          })

          sucesso = await enviarPedidoAoNerus(pedido)
          if (sucesso) break
        }

        mensagensResultado.push(
          sucesso
            ? `✅ Pedido ${pedido.ID_ANYMARKET} reenviado`
            : `❌ Falha ao reenviar pedido ${pedido.ID_ANYMARKET}`
        )
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.log('[ANYMARKET][REENVIO] Processo finalizado')

  return mensagensResultado
}
