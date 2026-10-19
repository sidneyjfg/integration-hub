// src/integrations/traycommerce/services/reenviar-pedidos-traycommerce.ts
import { traycommerceConfig } from '../env.schema'
import { PedidoNaoIntegradoTraycommerce } from '../../../shared/types/traycommerce'
import { enviarPedidoNerusTraycommerce } from './enviar-pedido-nerus-traycommerce'

const CONCORRENCIA = 5
const DELAY_MS = 200
const SEGUNDA_PASSADA_MS = 10000

export interface ResultadoReenvioTraycommerce {
  /** false quando NERUS_NOTIFICATION_URL não está configurada (reenvio desativado). */
  executado: boolean
  reenviados: string[]
  falhas: string[]
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function reenviarEmLote(ordnowebs: string[]): Promise<string[]> {
  const falhas: string[] = []
  let proximo = 0

  const worker = async () => {
    while (true) {
      const indice = proximo++
      if (indice >= ordnowebs.length) break

      const ordnoweb = ordnowebs[indice]

      try {
        await enviarPedidoNerusTraycommerce(ordnoweb)
      } catch (erro: any) {
        console.error('[TRAYCOMMERCE][REENVIO] Falha ao reenviar pedido', {
          ordnoweb,
          erro: erro.response?.data || erro.message
        })

        falhas.push(ordnoweb)
      }

      await delay(DELAY_MS)
    }
  }

  const quantidade = Math.max(1, Math.min(CONCORRENCIA, ordnowebs.length))
  await Promise.all(Array.from({ length: quantidade }, () => worker()))

  return falhas
}

/**
 * Reenvia ao Nérus os pedidos não integrados. Uma segunda passada cobre
 * falhas transitórias do endpoint antes de dar o pedido como perdido.
 */
export async function reenviarPedidosTraycommerce(
  pedidos: PedidoNaoIntegradoTraycommerce[]
): Promise<ResultadoReenvioTraycommerce> {
  if (!traycommerceConfig.NERUS_NOTIFICATION_URL) {
    console.warn(
      '[TRAYCOMMERCE][REENVIO] Reenvio desativado (NERUS_NOTIFICATION_URL ausente)'
    )

    return { executado: false, reenviados: [], falhas: [] }
  }

  const ordnowebs = pedidos.map(pedido => String(pedido.ordnoweb))

  console.log('[TRAYCOMMERCE][REENVIO] Iniciando reenvio', {
    total: ordnowebs.length
  })

  let falhas = await reenviarEmLote(ordnowebs)

  if (falhas.length > 0) {
    console.warn('[TRAYCOMMERCE][REENVIO] Segunda passada agendada', {
      falhas: falhas.length,
      esperaMs: SEGUNDA_PASSADA_MS
    })

    await delay(SEGUNDA_PASSADA_MS)

    falhas = await reenviarEmLote(falhas)
  }

  const reenviados = ordnowebs.filter(ordnoweb => !falhas.includes(ordnoweb))

  console.log('[TRAYCOMMERCE][REENVIO] Reenvio finalizado', {
    reenviados: reenviados.length,
    falhas: falhas.length
  })

  return { executado: true, reenviados, falhas }
}
