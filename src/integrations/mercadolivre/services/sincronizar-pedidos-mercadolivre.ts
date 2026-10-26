import axios from 'axios'
import { getCachedAccessToken, refreshAccessToken } from '../api/auth'
import { buscarCredenciaisMercadoLivre } from '../repositories/mercadolivre-notas.repository'
import { mercadolivreConfig } from '../env.schema'
import {
  PedidoMonitorado,
  registrarErroPedidos,
  salvarCheckpointPedidos,
  salvarPedidoMonitorado,
} from '../repositories/pedidos.repository'

const espera = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const diaMs = 24 * 60 * 60 * 1000

type RespostaPedidos = { results?: PedidoMonitorado[]; paging?: { total?: number } }

async function requisitar<T>(url: string, params: Record<string, unknown>, credencial: any, tokens: Map<string, string>): Promise<T> {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const token = tokens.get(credencial.clienteId) ?? getCachedAccessToken(credencial.clienteId) ?? credencial.accessToken
      const resposta = await axios.get<T>(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-format-new': 'true' },
        params,
        timeout: 30000,
      })
      return resposta.data
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401 && !tokens.has(credencial.clienteId)) {
        const novoToken = await refreshAccessToken({
          clientId: credencial.clientId,
          clientSecret: credencial.clientSecret,
          refreshToken: credencial.refreshToken,
          clienteId: credencial.clienteId,
        })
        tokens.set(credencial.clienteId, novoToken)
        continue
      }
      if (status === 429 || status >= 500 || ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.code)) {
        await espera([3000, 8000, 15000, 30000][tentativa - 1])
        continue
      }
      throw error
    }
  }
  throw new Error(`Falha persistente na API do Mercado Livre: ${url}`)
}

async function consultarTipoLogistico(shippingId: string | null, credencial: any, tokens: Map<string, string>): Promise<string | null> {
  if (!shippingId) return null
  const shipment = await requisitar<{ logistic?: { type?: string }; logistic_type?: string }>(
    `https://api.mercadolibre.com/shipments/${encodeURIComponent(shippingId)}`, {}, credencial, tokens,
  )
  return shipment.logistic?.type ?? shipment.logistic_type ?? null
}

async function sincronizarConta(credencial: any): Promise<{ pedidos: number; cursor: string }> {
  const agora = new Date()
  const inicio = new Date(agora.getTime() - mercadolivreConfig.MERCADOLIVRE_ORDERS_TO_FETCH * diaMs)
  const tokens = new Map<string, string>()
  let offset = 0
  let total = 0

  while (true) {
    const pagina = await requisitar<RespostaPedidos>('https://api.mercadolibre.com/orders/search', {
      seller: credencial.clienteId,
      'order.date_created.from': inicio.toISOString(),
      'order.date_created.to': agora.toISOString(),
      limit: 50,
      offset,
      sort: 'date_asc',
    }, credencial, tokens)
    if (!Array.isArray(pagina.results) || !Number.isFinite(Number(pagina.paging?.total))) {
      throw new Error(`Resposta inválida de pedidos para a conta ${credencial.clienteId}`)
    }

    for (const pedido of pagina.results) {
      const tipo = await consultarTipoLogistico(pedido.shipping?.id == null ? null : String(pedido.shipping.id), credencial, tokens)
      await salvarPedidoMonitorado(credencial.clienteId, pedido, tipo)
      total++
    }
    offset += pagina.results.length
    if (offset >= Number(pagina.paging?.total) || pagina.results.length === 0) break
    await espera(1200)
  }

  return { pedidos: total, cursor: agora.toISOString() }
}

export async function sincronizarPedidosMercadoLivre(): Promise<void> {
  const credenciais = await buscarCredenciaisMercadoLivre()
  let falhas = 0
  for (const credencial of credenciais) {
    try {
      const resultado = await sincronizarConta(credencial)
      await salvarCheckpointPedidos(credencial.clienteId, resultado.cursor, null)
      console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Conta sincronizada', {
        clienteId: credencial.clienteId,
        pedidos: resultado.pedidos,
        cursor: resultado.cursor,
      })
    } catch (error: any) {
      falhas++
      const detalhe = String(error?.response?.data?.message ?? error?.message ?? error).slice(0, 4000)
      await registrarErroPedidos(credencial.clienteId, detalhe, new Date(Date.now() - mercadolivreConfig.MERCADOLIVRE_ORDERS_TO_FETCH * diaMs).toISOString())
      console.error('[MERCADOLIVRE][PEDIDOS][SYNC] Falha; checkpoint preservado para retomada', {
        clienteId: credencial.clienteId,
        erro: detalhe,
      })
    }
  }
  if (falhas) throw new Error(`Monitoramento de pedidos ML falhou em ${falhas} conta(s); erros registrados no checkpoint`)
}
