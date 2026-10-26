import axios from 'axios'
import { randomUUID } from 'node:crypto'
import { MercadoLivreCredential } from '../repositories/mercadolivre-notas.repository'
import { mercadolivreConfig } from '../env.schema'

const TAMANHO_LOTE = 5

export interface ResultadoReenvioPedidosNotas {
  executado: boolean
  reenviados: string[]
  falhas: string[]
}

/** Reenvia ao Nérus notificações de pedidos pendentes associados às notas. */
export async function reenviarPedidosPendentesNotasMercadoLivre(
  pedidos: string[],
  conta: MercadoLivreCredential,
): Promise<ResultadoReenvioPedidosNotas> {
  const url = mercadolivreConfig.MERCADOLIVRE_NOTIFICATION_URL
  if (!url) {
    console.warn('[MERCADOLIVRE][REENVIO] Reenvio desativado (MERCADOLIVRE_NOTIFICATION_URL ausente)')
    return { executado: false, reenviados: [], falhas: [] }
  }

  const unicos = [...new Set(pedidos)]
  const reenviados: string[] = []
  const falhas: string[] = []
  const sent = new Date().toISOString()
  const userId = Number(conta.clienteId)
  const applicationId = Number(conta.clientId)

  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(applicationId)) {
    console.error('[MERCADOLIVRE][REENVIO] Conta sem user_id ou application_id válido', {
      clienteId: conta.clienteId,
    })
    return { executado: true, reenviados, falhas: unicos }
  }

  console.log('[MERCADOLIVRE][REENVIO] Iniciando reenvio de pedidos pendentes', {
    clienteId: conta.clienteId,
    total: unicos.length,
  })

  for (let inicio = 0; inicio < unicos.length; inicio += TAMANHO_LOTE) {
    const lote = unicos.slice(inicio, inicio + TAMANHO_LOTE)
    const resultados = await Promise.all(lote.map(async pedido => {
      const recebido = new Date().toISOString()
      try {
        await axios.post(url, {
          _id: randomUUID(),
          topic: 'orders_v2',
          resource: `/orders/${pedido}`,
          user_id: userId,
          application_id: applicationId,
          sent,
          attempts: 1,
          received,
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        })
        return { pedido, sucesso: true }
      } catch (erro: any) {
        console.error('[MERCADOLIVRE][REENVIO] Falha ao reenviar pedido', {
          pedido,
          clienteId: conta.clienteId,
          status: erro?.response?.status,
          erro: erro?.response?.data ?? erro?.message,
        })
        return { pedido, sucesso: false }
      }
    }))

    for (const resultado of resultados) {
      ;(resultado.sucesso ? reenviados : falhas).push(resultado.pedido)
    }
  }

  console.log('[MERCADOLIVRE][REENVIO] Reenvio finalizado', {
    clienteId: conta.clienteId,
    reenviados: reenviados.length,
    falhas: falhas.length,
  })

  return { executado: true, reenviados, falhas }
}
