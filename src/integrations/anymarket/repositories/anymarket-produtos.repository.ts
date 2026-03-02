import { poolMonitoramento } from '../../../core/db'
import type { AnymarketProduct, AnymarketProductSku } from '../../../shared/types/anymarket'

export interface ProdutoSalvo {
  id: number
  product_id: number
  title: string
  is_active: boolean
  sku_id: number
  sku_title: string
  partner_id: string
  ean: string | null
  price: number | null
  amount: number | null
  stock_local_id: number | null
  created_at: Date
  updated_at: Date
}

export async function salvarProdutos(produtos: AnymarketProduct[]): Promise<number> {
  if (produtos.length === 0) return 0

  const values: any[] = []
  
  for (const produto of produtos) {
    for (const sku of produto.skus) {
      values.push([
        produto.id,
        produto.title,
        produto.isProductActive ? 1 : 0,
        sku.id,
        sku.title,
        sku.partnerId,
        sku.ean || null,
        sku.price || null,
        sku.amount || null,
        sku.stockLocalId || null
      ])
    }
  }

  if (values.length === 0) return 0

  const sql = `
    INSERT INTO temp_products (
      product_id,
      title,
      is_active,
      sku_id,
      sku_title,
      partner_id,
      ean,
      price,
      amount,
      stock_local_id
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      is_active = VALUES(is_active),
      sku_title = VALUES(sku_title),
      partner_id = VALUES(partner_id),
      ean = VALUES(ean),
      price = VALUES(price),
      amount = VALUES(amount),
      stock_local_id = VALUES(stock_local_id),
      updated_at = CURRENT_TIMESTAMP
  `

  const [result] = await poolMonitoramento.query(sql, [values])
  return (result as any).affectedRows
}

export async function buscarTodosProdutos(): Promise<ProdutoSalvo[]> {
  const sql = 'SELECT * FROM temp_products ORDER BY updated_at DESC'
  const [rows] = await poolMonitoramento.query(sql)
  return rows as ProdutoSalvo[]
}

export async function buscarProdutoPorPartnerId(partnerId: string): Promise<ProdutoSalvo[]> {
  const sql = 'SELECT * FROM temp_products WHERE partner_id = ? ORDER BY updated_at DESC'
  const [rows] = await poolMonitoramento.query(sql, [partnerId])
  return rows as ProdutoSalvo[]
}

export async function buscarProdutoPorEan(ean: string): Promise<ProdutoSalvo[]> {
  const sql = 'SELECT * FROM temp_products WHERE ean = ? ORDER BY updated_at DESC'
  const [rows] = await poolMonitoramento.query(sql, [ean])
  return rows as ProdutoSalvo[]
}

export async function limparTabelaProdutos(): Promise<void> {
  const sql = 'TRUNCATE TABLE temp_products'
  await poolMonitoramento.query(sql)
}
