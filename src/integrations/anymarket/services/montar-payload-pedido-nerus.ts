import { ResultadoComparacaoPedido } from '../../../shared/types'
import { anymarketConfig } from '../env.schema'

export function montarPayloadPedidoNerus(
  pedido: ResultadoComparacaoPedido
) {
  return {
    scope: 'order_acquire',
    date: new Date().toISOString(),
    type: 'ORDER',
    content: {
      id: pedido.ID_ANYMARKET,
      oi: anymarketConfig.NERUS_OI
    }
  }
}
