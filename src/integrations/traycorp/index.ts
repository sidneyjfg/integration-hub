import type { FastifyInstance } from 'fastify'
import productsRoutes from './routes/routes.products'

export async function register(app: FastifyInstance) {
  app.register(productsRoutes, { prefix: '/traycorp/products' })
}
