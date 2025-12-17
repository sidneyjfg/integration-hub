import type { FastifyInstance } from 'fastify'
import analytics from './routes/routes.analytics'
import notas from './routes/routes.notas'

export async function register(app: FastifyInstance) {
  app.register(analytics, { prefix: '/mercadolivre/analytics' })
  app.register(notas, { prefix: '/mercadolivre/notas' })
}
