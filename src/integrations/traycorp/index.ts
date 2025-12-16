import type { FastifyInstance } from 'fastify'
import { registrarRotasProdutosTraycorp } from './routes.products'

export async function register(app: FastifyInstance) {
  app.register(registrarRotasProdutosTraycorp, { prefix: '/traycorp/products' })
}
