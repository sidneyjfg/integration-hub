import type { FastifyInstance } from 'fastify'
import orders from './routes.orders'
import products from './routes.products'

export async function register(app: FastifyInstance) {
  app.register(orders, { prefix: '/pluggto/orders' })
  app.register(products, { prefix: '/pluggto/products' })
}
