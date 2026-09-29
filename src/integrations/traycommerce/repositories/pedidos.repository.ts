// src/integrations/traycommerce/repositories/pedidos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { TraycommerceOrderApi } from '../../../shared/types/traycommerce'
import { PedidoNaoIntegradoTraycommerce } from '../../../shared/types/traycommerce'

export async function salvarPedidosTempTraycommerce(
  pedidos: TraycommerceOrderApi[]
): Promise<void> {
  console.log(
    '[TRAYCOMMERCE][SYNC][DB] Salvando pedidos temporários, aguarde...',
    { total: pedidos.length }
  )

  if (!pedidos.length) {
    console.log('[TRAYCOMMERCE][SYNC][DB] Nenhum pedido para salvar')
    return
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders_traycommerce (
      ordnoweb,
      ordnochannel,
      status,
      nfe_key,
      date
    )
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ordnochannel = VALUES(ordnochannel),
      status = VALUES(status),
      nfe_key = VALUES(nfe_key)
  `

  let salvos = 0

  for (const o of pedidos) {
    if (o?.id === undefined || o?.id === null) {
      console.warn('[TRAYCOMMERCE][SYNC][DB] Pedido inválido ignorado', o)
      continue
    }

    const v = <T>(value: T | undefined | null): T | null =>
      value === undefined ? null : value

    await poolMonitoramento.execute(sql, [
      String(o.id),
      v(o.reference) ?? String(o.id),
      v(o.OrderStatus?.id !== undefined ? String(o.OrderStatus.id) : null) ?? '',
      null,
      o.creation_date ? new Date(o.creation_date) : new Date()
    ])

    salvos++
  }

  console.log(
    '[TRAYCOMMERCE][SYNC][DB] Pedidos temporários salvos/atualizados',
    { salvos }
  )
}

export async function buscarPedidosNaoIntegradosTraycommerce(): Promise<
  PedidoNaoIntegradoTraycommerce[]
> {
  console.log('[TRAYCOMMERCE][SYNC][DB] Buscando pedidos não integrados')

  // eordchannelp não tem status: entra o eord para tratar pedido cancelado
  // (status 4 e 5) como não integrado.
  const sql = `
  SELECT
    t.ordnoweb,
    t.ordnochannel,
    t.status,
    DATE_FORMAT(t.date, '%d/%m/%Y %H:%i:%s') AS date,
    t.nfe_key
  FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders_traycommerce t
  LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eordchannelp e
    ON t.ordnoweb = e.ordnoweb
   AND e.storeno IN (${coreConfig.STORENOS
     .split(',')
     .map(s => `'${s.trim()}'`)
     .join(',')})
  LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eord r
    ON r.ordno = e.ordno
   AND r.storeno = e.storeno
  WHERE e.ordnoweb IS NULL
     OR r.status IS NULL
     OR r.status IN (4, 5)
  ORDER BY t.date DESC
`

  const [rows] = await poolMonitoramento.query(sql)

  const result = rows as PedidoNaoIntegradoTraycommerce[]

  console.log('[TRAYCOMMERCE][SYNC][DB] Consulta finalizada', {
    naoIntegrados: result.length
  })

  return result
}
