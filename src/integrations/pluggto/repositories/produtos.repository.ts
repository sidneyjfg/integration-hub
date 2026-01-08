// repositories/produtos.repository.ts
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { PluggtoProductBody } from '../../../shared/types'

export async function salvarProdutosTempPluggto(produtos: PluggtoProductBody[]) {
  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_products
      (idNerus, idPluggto, ean, name, price, pricePromotion, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ean = VALUES(ean),
      name = VALUES(name),
      price = VALUES(price),
      pricePromotion = VALUES(pricePromotion),
      stock = VALUES(stock)
  `

  for (const p of produtos) {
    await poolMonitoramento.execute(sql, [
      p.idNerus,
      p.idPluggto,
      p.ean,
      p.name,
      p.price,
      p.pricePromotion,
      p.stock,
    ])
  }
}
