import { poolMonitoramento } from '../../core/db'
import type { AnymarketOrderBody } from '../../shared/types'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export default async function (app: FastifyInstance) {
app.post(
    '/',
    async (req: FastifyRequest<{ Body: AnymarketOrderBody }>) => {    const {
      order_id,
      marketplace_id,
      marketplace,
      status,
      fulfillment,
      created_at
    } = req.body as any

    await poolMonitoramento.execute(
      `
      INSERT IGNORE INTO temp_orders
      (order_id, marketplace_id, marketplace, status, fulfillment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        order_id,
        marketplace_id,
        marketplace,
        status,
        fulfillment,
        created_at
      ]
    )

    return { status: 'ok' }
  })
}
