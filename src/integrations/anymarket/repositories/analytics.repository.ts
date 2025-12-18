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
    t.order_id                                AS order_anymarket,
    e.ordno                                   AS order_erp,
    t.marketplace_id                          AS codigo_anymarket,
    ec.storeno                                AS loja_erp,
    t.total                                   AS total_anymarket,
    ec.total_erp,
    CASE
        WHEN t.order_id IS NOT NULL AND e.ordno IS NOT NULL THEN 'AMBOS'
        WHEN t.order_id IS NOT NULL AND e.ordno IS NULL THEN 'SÓ ANYMARKET'
        WHEN t.order_id IS NULL AND e.ordno IS NOT NULL THEN 'SÓ ERP'
    END AS situacao
FROM ${coreConfig.DB_NAME_MONITORAMENTO}.temp_orders t
LEFT JOIN (
    SELECT
        ordnoWeb,
        ordno,
        storeno,
        SUM(vTotal) / 100 AS total_erp
    FROM ${coreConfig.DB_NAME_DADOS}.eordchannelp
    WHERE storeno IN (${storenos})
    GROUP BY
        ordnoWeb,
        ordno,
        storeno
) ec
    ON ec.ordnoWeb = t.order_id
   AND ec.storeno = t.marketplace_id
LEFT JOIN ${coreConfig.DB_NAME_DADOS}.eord e
    ON e.ordno = ec.ordno
   AND e.storeno = ec.storeno
WHERE t.marketplace_id IN (${storenos});
`

  try {
    const [rows] = await poolMonitoramento.query(sql)
    return rows as any[]
  } catch (erro) {
    console.error('[ANYMARKET][DB] Erro ao buscar insights:', erro)
    throw erro
  }
}
