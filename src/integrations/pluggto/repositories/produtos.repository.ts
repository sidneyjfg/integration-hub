// repositories/produtos.repository.ts
import { poolMonitoramento } from '../../../core/db'

export async function salvarProdutosTempPluggto(produtos: any[]) {
  const sql = `
    INSERT INTO temp_products (idPluggto, sku, ean, name, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `

  for (const p of produtos) {
    await poolMonitoramento.execute(sql, [
      p.Product.id,
      p.Product.sku,
      p.Product.ean,
      p.Product.name,
      p.Product.price,
      p.Product.quantity,
    ])
  }
}
