// src/integrations/traycommerce/services/enviar-pedido-nerus-traycommerce.ts
import axios from 'axios'
import { traycommerceConfig } from '../env.schema'

/**
 * Notifica o hub do Nérus para reprocessar o pedido (auto-cura).
 * Mesmo contrato usado pelo nerus-sync-hub para pedidos da Tray:
 * POST /api/v1/order/receive-notification com { orderId, act: "create" }.
 */
export async function enviarPedidoNerusTraycommerce(
  ordnoweb: string
): Promise<void> {
  const url = traycommerceConfig.NERUS_NOTIFICATION_URL

  if (!url) {
    throw new Error('NERUS_NOTIFICATION_URL não configurada')
  }

  const payload = {
    orderId: Number(ordnoweb),
    act: 'create'
  }

  console.log('[TRAYCOMMERCE][NERUS][REENVIO] Enviando pedido', { ordnoweb })

  await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  })

  console.log('[TRAYCOMMERCE][NERUS][REENVIO] Pedido reenviado com sucesso', {
    ordnoweb
  })
}
