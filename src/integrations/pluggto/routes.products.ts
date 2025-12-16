import { poolMonitoramento } from '../../core/db'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PluggtoProductBody } from '../../shared/types'

export default async function (app: FastifyInstance) {
  app.post(
    '/',
    async (req: FastifyRequest<{ Body: PluggtoProductBody }>) => {
      const {
        idNerus,
        idPluggto,
        ean,
        name,
        price,
        pricePromotion,
        stock
      } = req.body

      await poolMonitoramento.execute(
        `
        INSERT INTO temp_products
        (idNerus, idPluggto, ean, name, price, pricePromotion, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [idNerus, idPluggto, ean, name, price, pricePromotion, stock]
      )

      return { status: 'ok' }
    }
  )
}
