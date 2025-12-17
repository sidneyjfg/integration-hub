import axios from 'axios'
import { AnymarketOrderBody } from '../../../shared/types'
import { anymarketConfig } from '../env.schema'
import { formatDateWithFixedTimezone, isFullByAnymarketField, isIgnoredStatus, matchesMode } from '../utils';
import { notifyGoogleChat } from '../notifications/google-chat';

export async function buscarPedidosRecentesAnymarket(): Promise<AnymarketOrderBody[]> {
  const orders: AnymarketOrderBody[] = []
  const limit = 100
  let offset = 0

  const daysToFetch = anymarketConfig.ANYMARKET_DAYS_TO_FETCH
  const createdAfter = formatDateWithFixedTimezone(daysToFetch)

  console.log(
    `[ANYMARKET][BUSCA] Iniciando busca de pedidos`,
    { daysToFetch, createdAfter }
  )

  try {
    while (true) {
      console.log(
        `[ANYMARKET][BUSCA] Requisitando pedidos`,
        { limit, offset }
      )

      const response = await axios.get(
        `${anymarketConfig.ANYMARKET_URL}/v2/orders`,
        {
          headers: {
            'Content-Type': 'application/json',
            gumgaToken: anymarketConfig.ANYMARKET_GUMGATOKEN
          },
          params: { createdAfter, limit, offset }
        }
      )

      if (response.status !== 200) {
        console.warn(
          `[ANYMARKET][BUSCA] Resposta inesperada da API`,
          { status: response.status }
        )
        break
      }

      const content = response.data?.content

      if (!Array.isArray(content)) {
        console.warn('[ANYMARKET][BUSCA] Conteúdo inválido ou vazio')
        break
      }

      const fetchedOrders = content.map((order: any) => ({
        id: order.id,
        marketplaceId: order.marketPlaceId,
        marketPlace: order.marketPlace,
        status: order.status,
        fulfillment: order.fulfillment,
        createdAt: order.createdAt,

        // novos campos vindos da AnyMarket
        gross: order.gross,
        discount: order.discount,
        total: order.total
      }))

      if (fetchedOrders.length > 0) {
        console.log(
          '[ANYMARKET][BUSCA][ANTES FILTRO]',
          fetchedOrders.map(o => ({
            id: o.id,
            status: o.status,
            fulfillment: isFullByAnymarketField(o.fulfillment)
          }))
        )
      }

      const filtered = fetchedOrders.filter(o => {
        const matchesFulfillment = matchesMode(
          o.fulfillment,
          anymarketConfig.FULFILLMENT,
          anymarketConfig.CONVENCIONAL
        )

        const ignored = isIgnoredStatus(
          o.status,
          anymarketConfig.NO_LOOK_STATUS_TYPE
        )
        if (filtered.length > 0) {
          console.log(
            '[ANYMARKET][BUSCA][DEPOIS FILTRO]',
            filtered.map(o => ({
              id: o.id,
              status: o.status,
              fulfillment: isFullByAnymarketField(o.fulfillment)
            }))
          )
        }

        return matchesFulfillment && !ignored
      })

      console.log(
        `[ANYMARKET][BUSCA] Página processada`,
        {
          recebidos: fetchedOrders.length,
          filtrados: filtered.length
        }
      )

      if (filtered.length === 0 && offset === 0) {
        console.log('[ANYMARKET][BUSCA] Nenhum pedido novo encontrado')
        await notifyGoogleChat(
          '⚠️ Não há novos pedidos no painel do Anymarket.'
        )
        break
      }

      orders.push(...filtered)

      if (fetchedOrders.length < limit) {
        console.log(`[ANYMARKET][BUSCA] (${fetchedOrders.length}) Última página atingida`)
        break
      }

      offset += limit
    }

    console.log(
      `[ANYMARKET][BUSCA] Busca finalizada`,
      { totalPedidos: orders.length }
    )

    return orders
  } catch (error: unknown) {
    console.error('[ANYMARKET][BUSCA] Erro ao buscar pedidos', error)
    throw error
  }
}

