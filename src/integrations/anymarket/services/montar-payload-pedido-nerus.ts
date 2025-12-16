import { ResultadoComparacaoPedido } from '../../../shared/types'
import { config } from '../env.schema'

export function montarPayloadPedidoNerus(
  pedido: ResultadoComparacaoPedido
) {
  return {
    scope: 'order_acquire',
    date: new Date().toISOString(),
    type: 'ORDER',
    content: {
      id: pedido.ID_ANYMARKET,
      oi: config.NERUS_OI
    }
  }
}
