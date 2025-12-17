import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import {
  AnymarketOrderBody,
  ResultadoComparacaoPedido
} from '../../../shared/types'
import { formatDateForMysql } from '../utils'

/**
 * 💾 Salva pedidos da Anymarket na base de monitoramento
 * Operação idempotente (UPSERT)
 */
export async function salvarPedidosAnymarketMonitoramento(
  pedidos: AnymarketOrderBody[]
): Promise<void> {
  if (pedidos.length === 0) {
    console.log('[ANYMARKET][DB] Nenhum pedido para salvar.')
    return
  }

  const sql = `
  INSERT INTO temp_orders
    (
      order_id,
      marketplace_id,
      marketplace,
      status,
      fulfillment,
      created_at,
      gross,
      discount,
      total
    )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    marketplace_id = VALUES(marketplace_id),
    marketplace    = VALUES(marketplace),
    status         = VALUES(status),
    fulfillment    = VALUES(fulfillment),
    created_at     = VALUES(created_at),
    gross          = VALUES(gross),
    discount       = VALUES(discount),
    total          = VALUES(total)
`


  try {
    for (const pedido of pedidos) {
      const createdAt = pedido.createdAt
        ? new Date(pedido.createdAt)
        : new Date()
      console.log('[ANYMARKET][DEBUG] Pedido recebido:', pedido);

      await poolMonitoramento.execute(sql, [
        pedido.id ?? null,
        pedido.marketplaceId ?? null,
        pedido.marketPlace ?? null,
        pedido.status ?? null,
        pedido.fulfillment ?? null,
        formatDateForMysql(createdAt),
        pedido.gross ?? null,
        pedido.discount ?? null,
        pedido.total ?? null
      ])
    }

    console.log(
      `[ANYMARKET][DB] ${pedidos.length} pedidos salvos/atualizados em temp_orders`
    )
  } catch (erro) {
    console.error('[ANYMARKET][DB] Erro ao salvar pedidos:', erro)
    throw erro
  }
}

/**
 * 🔍 Busca pedidos da Anymarket que ainda não foram integrados no Nérus
 */
export async function buscarPedidosAnymarketNaoIntegradosNerus():
  Promise<ResultadoComparacaoPedido[]> {

  const sql = `
    SELECT
    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i:%s') AS DATA,
    t.order_id AS ID_ANYMARKET,
    t.marketplace_id AS PEDIDO,
    t.marketplace AS MARKETPLACE,
    t.status AS STATUS_ANY,
    t.fulfillment AS FULFILLMENT
FROM
    ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders t
WHERE
    NOT EXISTS (
        SELECT 1 
        FROM ${coreConfig.DB_NAME_DADOS}.eordchannelp e
        WHERE e.ordnoweb = t.order_id
    )
ORDER BY 
    t.order_id;
  `

  try {
    const [rows] = await poolMonitoramento.query(sql)

    const resultado = rows as ResultadoComparacaoPedido[]

    console.log(
      `[ANYMARKET][DB] ${resultado.length} pedidos não integrados encontrados`
    )

    return resultado
  } catch (erro) {
    console.error(
      '[ANYMARKET][DB] Erro ao buscar pedidos não integrados:',
      erro
    )
    throw erro
  }
}
