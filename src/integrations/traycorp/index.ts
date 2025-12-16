import type { FastifyInstance } from 'fastify'
import products from './routes.products'

export async function register(app: FastifyInstance) {
  app.register(products, { prefix: '/traycorp/products' })
}
