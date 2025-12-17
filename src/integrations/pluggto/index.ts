import type { FastifyInstance } from 'fastify'
import analyticsRoutes from './routes/routes.analytics'

export async function register(app: FastifyInstance) {
  app.register(analyticsRoutes, { prefix: '/pluggto' })
}
