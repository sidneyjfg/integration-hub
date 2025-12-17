import { poolMain } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'

export async function vendasPorStatus(params: {
  storeno: number
  start: string
  end: string
}) {
    //sqlexample
  const sql = `
    SELECT
      status,
      COUNT(*) AS total,
      SUM(vNF) AS valor_total
    FROM ${coreConfig.DB_NAME_DADOS}.nfeavxml
    WHERE storeno = ?
      AND dhEmi BETWEEN ? AND ?
    GROUP BY status
  `

  const [rows] = await poolMain.query(sql, [
    params.storeno,
    params.start,
    params.end
  ])

  return rows
}
