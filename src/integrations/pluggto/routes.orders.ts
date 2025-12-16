import { poolMonitoramento } from '../../core/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PluggtoOrderBody } from '../../shared/types'

export default async function (app: FastifyInstance) {
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: PluggtoOrderBody }>) => {
      const {
        ordnoweb,
        ordnochannel,
        nfe_key,
        date,
        status
      } = req.body

      await poolMonitoramento.execute(
        `
        INSERT INTO temp_orders
        (ordnoweb, ordnochannel, nfe_key, date, status)
        VALUES (?, ?, ?, ?, ?)
        `,
        [ordnoweb, ordnochannel, nfe_key, date, status]
      )

      return { status: 'ok' }
    }
  )
}
