import type { FastifyInstance } from 'fastify'
import ordersRoutes from './routes/routes.orders'

export async function register(app: FastifyInstance) {
  app.register(ordersRoutes, { prefix: '/anymarket/orders' })
}
