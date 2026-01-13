import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { PluggtoOrderBody } from '../../../shared/types'
import { pluggtoConfig } from '../env.schema'

export async function salvarPedidosTempPluggto(
  pedidos: PluggtoOrderBody[]
): Promise<void> {

  console.log('[PLUGGTO][SYNC][DB] Salvando pedidos temporários, aguarde...', {
    total: pedidos.length
  })

  if (!pedidos.length) {
    console.log('[PLUGGTO][SYNC][DB] Nenhum pedido para salvar')
    return
  }

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders (
      ordnoweb,
      ordnochannel,

      status,

      nfe_key,
      nfe_number,
      nfe_serie,
      nfe_date,

      total,
      subtotal,
      shipping,
      discount,
      tax,
      total_paid,

      payment_type,
      payment_method,
      payment_installments,

      channel,
      channel_account,
      delivery_type,

      date,
      approved_at,
      modified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ordnochannel = VALUES(ordnochannel),

      status = VALUES(status),

      nfe_key = VALUES(nfe_key),
      nfe_number = VALUES(nfe_number),
      nfe_serie = VALUES(nfe_serie),
      nfe_date = VALUES(nfe_date),

      total = VALUES(total),
      subtotal = VALUES(subtotal),
      shipping = VALUES(shipping),
      discount = VALUES(discount),
      tax = VALUES(tax),
      total_paid = VALUES(total_paid),

      payment_type = VALUES(payment_type),
      payment_method = VALUES(payment_method),
      payment_installments = VALUES(payment_installments),

      modified_at = VALUES(modified_at)
  `

  let salvos = 0

  for (const p of pedidos) {
    if (!p?.ordnoweb) {
      console.warn('[PLUGGTO][SYNC][DB] Pedido inválido ignorado', p)
      continue
    }
    const v = <T>(value: T | undefined | null): T | null =>
      value === undefined ? null : value

    await poolMonitoramento.execute(sql, [
      p.ordnoweb,

      v(p.ordnochannel),

      v(p.status),

      v(p.nfe_key),
      v(p.nfe_number),
      v(p.nfe_serie),
      p.nfe_date ? new Date(p.nfe_date) : null,

      v(p.total) ?? 0,               // 👈 total nunca pode ser undefined
      v(p.subtotal),
      v(p.shipping),
      v(p.discount),
      v(p.tax),
      v(p.total_paid),

      v(p.payment_type),
      v(p.payment_method),
      v(p.payment_installments),

      v(p.channel) ?? 'Pluggto',      // 👈 default seguro
      v(p.channel_account),
      v(p.delivery_type),

      p.created_at ? new Date(p.created_at) : new Date(), // 👈 fallback
      p.approved_at ? new Date(p.approved_at) : null,
      p.modified_at ? new Date(p.modified_at) : null
    ])

    salvos++
  }

  console.log('[PLUGGTO][SYNC][DB] Pedidos temporários salvos/atualizados', {
    salvos
  })
}

export async function buscarPedidosNaoIntegrados():
  Promise<{
    ordnoweb: string
    status: string
    date: string
    total_paid: number | null
    channel: string | null
  }[]> {

  console.log('[PLUGGTO][SYNC][DB] Buscando pedidos não integrados')

  const sql = `
  SELECT
    t.ordnoweb,
    t.status,
    DATE_FORMAT(t.date, '%d/%m/%Y %H:%i:%s') AS date,
    t.total_paid,
    t.channel
  FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders t
  LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eordchannelp e
    ON t.ordnoweb = e.ordnoweb
   AND e.storeno IN (${coreConfig.STORENOS
      .split(',')
      .map(s => `'${s.trim()}'`)
      .join(',')})
  WHERE e.ordnoweb IS NULL
  ORDER BY t.date DESC
`

  const [rows] = await poolMonitoramento.query(sql)

  const result = rows as {
    ordnoweb: string
    status: string
    date: string
    total_paid: number | null
    channel: string | null
  }[]


  console.log('[PLUGGTO][SYNC][DB] Consulta finalizada', {
    naoIntegrados: result.length
  })

  return result
}
