import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from "../../../core/env.schema"

export async function BuscaInsightsdePedidoAnyXNerus(): Promise<any[]> {
  const storenos = coreConfig.STORENOS
    .split(',')
    .map(s => Number(s.trim()))
    .filter(Boolean)
    .join(',')

  const sql = `
SELECT
    e.date                             AS data_erp,
    t.order_id                         AS order_anymarket,
    t.fulfillment                      AS fulfillment_anymarket,
    e.ordno                            AS order_erp,
    e.s9tatus                          AS fulfillment_erp,
    t.total                            AS total_anymarket,
    SUM(ec.vTotal) / 100               AS total_erp,
    CASE
        WHEN t.order_id IS NOT NULL AND e.ordno IS NOT NULL THEN 'AMBOS'
        WHEN t.order_id IS NOT NULL AND e.ordno IS NULL THEN 'SÓ ANYMARKET'
        WHEN t.order_id IS NULL AND e.ordno IS NOT NULL THEN 'SÓ ERP'
    END AS situacao
FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders t
LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eordchannelp ec
    ON ec.ordnoWeb = t.order_id
LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eord e
    ON e.ordno = ec.ordno
    and e.storeno = ec.storeno
GROUP BY
    t.order_id,
    e.ordno,
    t.total
`

  try {
    const [rows] = await poolMonitoramento.query(sql)
    return rows as any[]
  } catch (erro) {
    console.error('[ANYMARKET][DB] Erro ao buscar insights:', erro)
    throw erro
  }
}
