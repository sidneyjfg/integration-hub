import { poolMonitoramento } from '../../../core/db'

export type PedidoMonitorado = {
  id: string | number
  pack_id?: string | number | null
  date_created?: string | null
  date_closed?: string | null
  status?: string | null
  currency_id?: string | null
  total_amount?: number | string | null
  shipping?: { id?: string | number | null } | null
  order_items?: Array<{
    item?: { id?: string | null; title?: string | null; variation_id?: string | number | null } | null
    quantity?: number | string | null
    unit_price?: number | string | null
  }>
}

export type CheckpointPedidos = { cursorData: string }
const ORIGEM = 'mercadolivre'
const PROCESSO = 'pedidos'

export async function buscarCheckpointPedidos(clienteId: string): Promise<CheckpointPedidos | null> {
  const [rows] = await poolMonitoramento.execute(
    "SELECT DATE_FORMAT(cursor_data, '%Y-%m-%dT%H:%i:%sZ') AS cursorData FROM tmp_checkpoint WHERE origem = ? AND processo = ? AND cliente_id = ?",
    [ORIGEM, PROCESSO, clienteId],
  )
  const row = (rows as any[])[0]
  return row ? { cursorData: new Date(row.cursorData).toISOString() } : null
}

export async function salvarCheckpointPedidos(clienteId: string, cursorData: string, erro: string | null): Promise<void> {
  await poolMonitoramento.execute(
    `INSERT INTO tmp_checkpoint (origem, processo, cliente_id, cursor_data, ultima_execucao, incidente_em, ultimo_erro)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?)
     ON DUPLICATE KEY UPDATE cursor_data = VALUES(cursor_data), ultima_execucao = CURRENT_TIMESTAMP, incidente_em = NULL, ultimo_erro = VALUES(ultimo_erro)`,
    [ORIGEM, PROCESSO, clienteId, cursorData.slice(0, 19).replace('T', ' '), erro],
  )
}

export async function registrarErroPedidos(clienteId: string, erro: string): Promise<void> {
  await poolMonitoramento.execute(
    `INSERT INTO tmp_checkpoint (origem, processo, cliente_id, cursor_data, ultima_execucao, incidente_em, ultimo_erro)
     VALUES (?, ?, ?, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
     ON DUPLICATE KEY UPDATE ultimo_erro = VALUES(ultimo_erro), incidente_em = CURRENT_TIMESTAMP, ultima_execucao = CURRENT_TIMESTAMP`,
    [ORIGEM, PROCESSO, clienteId, erro.slice(0, 4000)],
  )
}

export async function salvarPedidoMonitorado(clienteId: string, pedido: PedidoMonitorado, tipoLogistico: string | null): Promise<void> {
  const conexao = await poolMonitoramento.getConnection()
  try {
    await conexao.beginTransaction()
    await conexao.execute(
      `INSERT INTO tmp_order
       (origem, cliente_id, pedido_id, pack_id, data_criacao, data_fechamento, status, moeda, valor_total, shipping_id, tipo_logistico)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pack_id=VALUES(pack_id), data_criacao=VALUES(data_criacao), data_fechamento=VALUES(data_fechamento),
       status=VALUES(status), moeda=VALUES(moeda), valor_total=VALUES(valor_total), shipping_id=VALUES(shipping_id), tipo_logistico=VALUES(tipo_logistico)`,
      [ORIGEM, clienteId, String(pedido.id), pedido.pack_id == null ? null : String(pedido.pack_id), pedido.date_created?.slice(0, 19).replace('T', ' ') ?? null,
        pedido.date_closed?.slice(0, 19).replace('T', ' ') ?? null, pedido.status ?? null, pedido.currency_id ?? null,
        pedido.total_amount == null ? null : Number(pedido.total_amount), pedido.shipping?.id == null ? null : String(pedido.shipping.id), tipoLogistico],
    )
    await conexao.execute('DELETE FROM tmp_order_items WHERE origem = ? AND cliente_id = ? AND pedido_id = ?', [ORIGEM, clienteId, String(pedido.id)])
    for (const [indice, itemPedido] of (pedido.order_items ?? []).entries()) {
      const item = itemPedido.item
      if (!item?.id) continue
      const quantidade = itemPedido.quantity == null ? null : Number(itemPedido.quantity)
      const preco = itemPedido.unit_price == null ? null : Number(itemPedido.unit_price)
      await conexao.execute(
        `INSERT INTO tmp_order_items (origem, cliente_id, pedido_id, item_id, indice, titulo, variacao_id, quantidade, preco_unitario, total_item)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ORIGEM, clienteId, String(pedido.id), item.id, indice, item.title ?? null, item.variation_id == null ? null : String(item.variation_id),
          quantidade, preco, quantidade == null || preco == null ? null : quantidade * preco],
      )
    }
    await conexao.commit()
  } catch (error) {
    await conexao.rollback()
    throw error
  } finally {
    conexao.release()
  }
}

export async function listarPedidosMonitorados(limite = 100): Promise<any[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limite), 1), 500)
  const [rows] = await poolMonitoramento.query(
    `SELECT p.cliente_id, p.pedido_id, p.pack_id, p.data_criacao, p.data_fechamento, p.status, p.moeda,
            p.valor_total, p.shipping_id, p.tipo_logistico,
            i.item_id, i.titulo, i.variacao_id, i.quantidade, i.preco_unitario, i.total_item
       FROM tmp_order p LEFT JOIN tmp_order_items i
         ON i.origem = p.origem AND i.cliente_id = p.cliente_id AND i.pedido_id = p.pedido_id
      WHERE p.origem = 'mercadolivre' ORDER BY p.data_criacao DESC LIMIT ${safeLimit}`,
  )
  return rows as any[]
}
