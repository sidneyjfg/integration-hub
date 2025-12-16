import type { FastifyInstance } from 'fastify'
import orders from './routes.orders'

export async function register(app: FastifyInstance) {
  app.register(orders, { prefix: '/anymarket/orders' })
}
