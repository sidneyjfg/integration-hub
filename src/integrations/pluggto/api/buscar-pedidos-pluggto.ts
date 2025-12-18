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
      console.log('[PLUGGTO][SYNC] Buscando página', { page, next })

      const response: AxiosResponse<
        PluggtoApiResponse<PluggtoOrderApi>
      > = await axios.get(`${pluggtoConfig.PLUGGTO_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: 100,
          created: `${from}to${to}`,
          next: next || undefined
        }
      })

      const lote = response.data.result || []

      console.log('[PLUGGTO][SYNC] Página recebida', {
        page,
        registros: lote.length
      })

      for (const item of lote) {
        const o = item.Order
        const shipment = o.shipments?.[0]
        const payment = o.payments?.[0]

        pedidos.push({
          // ids
          ordnoweb: o.id,
          ordnochannel: o.original_id ?? null,

          // status
          status: o.status,

          // nota fiscal
          nfe_key: shipment?.nfe_key ?? null,
          nfe_number: shipment?.nfe_number ?? null,
          nfe_serie: shipment?.nfe_serie ?? null,
          nfe_date: shipment?.nfe_date ?? null,

          // valores
          total: o.total ?? 0,
          subtotal: o.subtotal ?? null,
          shipping: o.shipping ?? null,
          discount: o.discount ?? null,
          tax: o.tax ?? null,
          total_paid: o.total_paid ?? null,

          // pagamento
          payment_type: payment?.payment_type ?? null,
          payment_method: payment?.payment_method ?? null,
          payment_installments: payment?.payment_installments
            ? Number(payment.payment_installments)
            : null,

          // metadados
          channel: o.channel,
          channel_account: o.channel_account ?? null,
          delivery_type: o.delivery_type ?? null,

          // datas
          created_at: o.created,
          approved_at: o.approved_date ?? null,
          modified_at: o.modified ?? null
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
