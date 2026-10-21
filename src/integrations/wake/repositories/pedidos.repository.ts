// src/integrations/wake/repositories/pedidos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { WakeOrderBody } from '../../../shared/types/wake'

export async function salvarPedidosTempWake(
  pedidos: WakeOrderBody[]
): Promise<void> {
  console.log(
    '[WAKE][SYNC][DB] Salvando pedidos temporários, aguarde...',
    { total: pedidos.length }
  )

  if (!pedidos.length) {
    console.log('[WAKE][SYNC][DB] Nenhum pedido para salvar')
    return
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders_wake (
      ordnoweb,
      ordnochannel,

      status,
      status_name,

      total,

      date
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ordnochannel = VALUES(ordnochannel),

      status = VALUES(status),
      status_name = VALUES(status_name),

      total = VALUES(total)
  `

  let salvos = 0

  for (const o of pedidos) {
    if (!o?.ordnoweb) {
      console.warn('[WAKE][SYNC][DB] Pedido inválido ignorado', o)
      continue
    }

    await poolMonitoramento.execute(sql, [
      o.ordnoweb,
      o.ordnochannel,
      o.status,
      o.status_name ?? null,
      o.total ?? null,
      o.date
    ])

    salvos++
  }

  console.log('[WAKE][SYNC][DB] Pedidos temporários salvos/atualizados', {
    salvos
  })
}
