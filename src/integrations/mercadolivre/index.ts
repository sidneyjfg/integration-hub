import type { FastifyInstance } from 'fastify'
import notas from './routes.notas'

export async function register(app: FastifyInstance) {
  app.register(notas, { prefix: '/mercadolivre/notas' })
}
