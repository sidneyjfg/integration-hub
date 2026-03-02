import type { FastifyInstance } from 'fastify'
import ordersRoutes from './routes/routes.orders'
import productsRoutes from './routes/routes.products'

export async function register(app: FastifyInstance) {
  app.register(ordersRoutes, { prefix: '/anymarket/orders' })
  app.register(productsRoutes, { prefix: '/anymarket/products' })
}
