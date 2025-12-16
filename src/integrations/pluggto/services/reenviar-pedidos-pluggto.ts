import { pluggtoConfig } from '../env.schema'

const url = pluggtoConfig.NERUS_RECEIVE_ORDER_URL
const user = pluggtoConfig.PLUGGTO_USERNAME

/**
 * Reenvia o notify de criação do pedido
 * @param ordnoweb ID do pedido (t.ordnoweb)
 */
export async function reenviarPedidoPluggto(
  ordnoweb: string
): Promise<void> {
  if (!url || !user) {
    console.info(
      '[PLUGGTO][REENVIO] Reenvio ignorado (URL ou usuário não configurado)',
      { ordnoweb }
    )
    return
  }

  console.log('[PLUGGTO][REENVIO] Enviando notify de pedido', { ordnoweb })

  const payload = {
    id: ordnoweb,
    action: 'created',
    user,
    changes: {
      status: false,
      stock: false,
      price: false,
    },
    type: 'orders',
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[PLUGGTO][REENVIO] Falha ao reenviar pedido', {
      ordnoweb,
      status: res.status,
      response: text || res.statusText,
    })
    throw new Error(`Notify falhou (${res.status})`)
  }

  console.log('[PLUGGTO][REENVIO] Pedido reenviado com sucesso', { ordnoweb })
}
