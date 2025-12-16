import axios, { AxiosResponse } from 'axios'
import { getAccessToken } from './auth'
import { pluggtoConfig } from '../env.schema'
import {
  PluggtoApiResponse,
  PluggtoOrderApi,
  PluggtoOrderBody
} from '../../../shared/types'
import { getDateRange } from '../utils'

export async function buscarPedidosPluggto(): Promise<PluggtoOrderBody[]> {
  console.log('[PLUGGTO][SYNC] Iniciando busca de pedidos')

  const token = await getAccessToken()
  if (!token) {
    console.warn('[PLUGGTO][SYNC] Token não obtido')
    return []
  }

  const { from, to } = getDateRange()
  console.log('[PLUGGTO][SYNC] Período de busca', { from, to })

  const pedidos: PluggtoOrderBody[] = []
  let next: string | null = null
  let page = 1

  try {
    do {
      console.log('[PLUGGTO][SYNC] Buscando página', {
        page,
        next
      })

      const response: AxiosResponse<
        PluggtoApiResponse<PluggtoOrderApi>
      > = await axios.get(`${pluggtoConfig.PLUGGTO_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: 100,
          created: `${from}to${to}`,
          next: next || undefined,
        },
      })

      const lote = response.data.result || []

      console.log('[PLUGGTO][SYNC] Página recebida', {
        page,
        registros: lote.length
      })

      for (const item of lote) {
        pedidos.push({
          ordnoweb: item.Order.id,
          ordnochannel: item.Order.original_id || '',
          nfe_key: item.Order.shipments?.[0]?.nfe_key,
          date: item.Order.created,
          status: item.Order.status,
        })
      }

      next = lote.length ? lote[lote.length - 1].Order.id : null
      page++
    } while (next)

    console.log('[PLUGGTO][SYNC] Busca finalizada', {
      totalPedidos: pedidos.length
    })

    return pedidos
  } catch (erro) {
    console.error('[PLUGGTO][SYNC] Erro ao buscar pedidos da Pluggto', erro)
    throw erro
  }
}
