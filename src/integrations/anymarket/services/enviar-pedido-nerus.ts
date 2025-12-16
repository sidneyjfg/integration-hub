import axios from 'axios'
import { ResultadoComparacaoPedido } from '../../../shared/types'
import { anymarketConfig } from '../env.schema'
import { montarPayloadPedidoNerus } from './montar-payload-pedido-nerus'

export async function enviarPedidoAoNerus(
  pedido: ResultadoComparacaoPedido
): Promise<boolean> {
  try {
    console.log(
      `[NERUS][REENVIO] Enviando pedido`,
      { pedido: pedido.ID_ANYMARKET }
    )

    const payload = montarPayloadPedidoNerus(pedido)

    const response = await axios.post(
      anymarketConfig.NERUS_NOTIFICATION_URL || '',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    )

    if (response.data === 'OK') {
      console.log(
        `[NERUS][REENVIO] Pedido reenviado com sucesso`,
        { pedido: pedido.ID_ANYMARKET }
      )
      return true
    }

    console.warn(
      `[NERUS][REENVIO] Resposta inesperada`,
      { pedido: pedido.ID_ANYMARKET, response: response.data }
    )

    return false
  } catch (erro) {
    console.error(
      `[NERUS][REENVIO] Erro ao reenviar pedido`,
      { pedido: pedido.ID_ANYMARKET, erro }
    )
    return false
  }
}

