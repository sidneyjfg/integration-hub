import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { PluggtoOrderBody } from '../../../shared/types'

export async function salvarPedidosTempPluggto(
  pedidos: PluggtoOrderBody[]
): Promise<void> {
  console.log('[PLUGGTO][SYNC][DB] Salvando pedidos temporários', {
    total: pedidos.length,
  })

  if (!pedidos.length) {
    console.log('[PLUGGTO][SYNC][DB] Nenhum pedido para salvar')
    return
  }

  const sql = `
    INSERT INTO temp_orders (
      ordnoweb,
      ordnochannel,
      nfe_key,
      status,
      date
    )
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ordnochannel = VALUES(ordnochannel),
      nfe_key = VALUES(nfe_key),
      status = VALUES(status),
      date = VALUES(date)
  `

  let salvos = 0

  for (const p of pedidos) {
    if (!p?.ordnoweb) {
      console.warn('[PLUGGTO][SYNC][DB] Pedido inválido ignorado', p)
      continue
    }

    await poolMonitoramento.execute(sql, [
      p.ordnoweb,
      p.ordnochannel ?? null,
      p.nfe_key ?? null,
      p.status,
      new Date(p.date),
    ])

    salvos++
  }

  console.log('[PLUGGTO][SYNC][DB] Pedidos temporários salvos com sucesso', {
    salvos,
  })
}


export async function buscarPedidosNaoIntegrados(): Promise<{ ordnoweb: string }[]> {
  console.log('[PLUGGTO][SYNC][DB] Buscando pedidos não integrados')

  const sql = `
    SELECT t.ordnoweb
    FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders t
    LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eordchannelp e
      ON t.ordnoweb = e.ordnoweb
    WHERE e.ordnoweb IS NULL
  `

  const [rows] = await poolMonitoramento.query(sql)

  const result = rows as { ordnoweb: string }[]

  console.log('[PLUGGTO][SYNC][DB] Consulta finalizada', {
    naoIntegrados: result.length,
  })

  return result
}
