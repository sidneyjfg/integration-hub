import type { FastifyInstance } from 'fastify'
import { vendasPorStatus } from '../repositories/analytics.repository'

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get('/vendas-por-status', async (req) => {
    const { storeno, start, end } = req.query as any

    return vendasPorStatus({
      storeno: Number(storeno),
      start,
      end
    })
  })
}
