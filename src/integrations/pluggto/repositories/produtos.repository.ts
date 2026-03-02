// repositories/produtos.repository.ts
import { ResultSetHeader } from 'mysql2'
import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'
import { PluggtoProductBody } from '../../../shared/types'

export async function salvarProdutosTempPluggto(produtos: PluggtoProductBody[]) {
  if (!produtos.length) return

  const sql = `
    INSERT INTO ${coreConfig.DB_NAME_MONITORAMENTO}.temp_products
      (idNerus, idPluggto, ean, name, price, pricePromotion, stock)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      ean = VALUES(ean),
      name = VALUES(name),
      price = VALUES(price),
      pricePromotion = VALUES(pricePromotion),
      stock = VALUES(stock)
  `

  const values = produtos.map((p) => [
    p.idNerus,
    p.idPluggto,
    p.ean,
    p.name,
    p.price,
    p.pricePromotion,
    p.stock,
  ])

  await poolMonitoramento.query<ResultSetHeader>(sql, [values])
}
