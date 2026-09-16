import type { FastifyInstance } from 'fastify'
import analytics from './routes/routes.analytics'
import notas from './routes/routes.notas'
import buscaCs from './routes/routes.busca-cs'

export async function register(app: FastifyInstance) {
  app.register(analytics, { prefix: '/mercadolivre/analytics' })
  app.register(notas, { prefix: '/mercadolivre/notas' })
  app.register(buscaCs, { prefix: '/mercadolivre/busca-cs' })
}
