// src/integrations/traycommerce/repositories/pedidos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import {
  PedidoNaoIntegradoTraycommerce,
  TraycommerceOrderApi
} from '../../../shared/types/traycommerce'

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
      status_name,

      nfe_key,

      total,

      date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ordnochannel = VALUES(ordnochannel),

      status = VALUES(status),
      status_name = VALUES(status_name),

      nfe_key = VALUES(nfe_key),

      total = VALUES(total)
  `

  let salvos = 0

  for (const o of pedidos) {
    if (o?.id === undefined || o?.id === null) {
      console.warn('[TRAYCOMMERCE][SYNC][DB] Pedido inválido ignorado', o)
      continue
    }

    const invoices = Array.isArray(o.OrderInvoice) ? o.OrderInvoice : []
    if (invoices.length) {
      // A loja de homologacao nao tem nota nenhuma, entao o nome do campo da
      // chave ainda nao foi confirmado contra a API. Loga o bruto para o
      // primeiro cliente real revelar o formato.
      console.log(
        `[TRAYCOMMERCE][SYNC][DB] Pedido ${o.id} com OrderInvoice:`,
        JSON.stringify(invoices)
      )
    }

    await poolMonitoramento.execute(sql, [
      // a TrayCommerce manda o id como string ("77")
      String(o.id),
      // external_code e a unica referencia do canal no pedido; fica vazia
      // quando a integracao nao escreve nesse campo
      o.external_code ?? '',

      String(o.OrderStatus?.id ?? ''),
      o.OrderStatus?.status ?? null,

      null,

      // total vem como string na API ("1000.00")
      o.total === undefined || o.total === null || o.total === ''
        ? null
        : Number(o.total),

      // date e YYYY-MM-DD; o fallback evita gravar data invalida
      parseDateTraycommerce(o.date) ?? new Date()
    ])

    salvos++
  }

  console.log(
    '[TRAYCOMMERCE][SYNC][DB] Pedidos temporários salvos/atualizados',
    { salvos }
  )
}

/**
 * A API devolve só a data (YYYY-MM-DD), sem hora e sem fuso. Montar a
 * meia-noite local evita que o UTC puxe o valor para o dia anterior.
 */
function parseDateTraycommerce(date: string | null | undefined): Date | null {
  if (!date) return null

  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!partes) return null

  const [, ano, mes, dia] = partes
  const resultado = new Date(Number(ano), Number(mes) - 1, Number(dia))

  return Number.isNaN(resultado.getTime()) ? null : resultado
}

export async function buscarPedidosNaoIntegradosTraycommerce(): Promise<
  PedidoNaoIntegradoTraycommerce[]
> {
  console.log('[TRAYCOMMERCE][SYNC][DB] Buscando pedidos não integrados')

  // Mesmo desenho do Pluggto: eordchannelp liga o pedido da TrayCommerce ao
  // ERP. Sem o join em eord de proposito - loja de site proprio nao
  // acompanha pedido cancelado, e o status so existe na outra tabela.
  const sql = `
  SELECT
    t.ordnoweb,
    t.ordnochannel,
    t.status,
    t.status_name,
    DATE_FORMAT(t.date, '%d/%m/%Y %H:%i:%s') AS date,
    t.total,
    t.nfe_key
  FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders_traycommerce t
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

  const result = rows as PedidoNaoIntegradoTraycommerce[]

  console.log('[TRAYCOMMERCE][SYNC][DB] Consulta finalizada', {
    naoIntegrados: result.length
  })

  return result
}
