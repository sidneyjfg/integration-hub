import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { sincronizarProdutosAnymarket } from '../services/sincronizar-produtos-anymarket'
import {
  buscarTodosProdutos,
  buscarProdutoPorPartnerId,
  buscarProdutoPorEan
} from '../repositories/anymarket-produtos.repository'

export default async function produtosRoutes(app: FastifyInstance) {
  // POST /anymarket/products/sync - Sincronizar produtos
  app.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await sincronizarProdutosAnymarket()
      return reply.status(200).send({
        success: true,
        message: 'Sincronização de produtos iniciada com sucesso'
      })
    } catch (error) {
      console.error('Erro ao sincronizar produtos:', error)
      return reply.status(500).send({
        success: false,
        message: 'Erro ao sincronizar produtos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    }
  })

  // GET /anymarket/products - Listar todos os produtos
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const produtos = await buscarTodosProdutos()
      return reply.status(200).send({
        success: true,
        data: produtos,
        total: produtos.length
      })
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      return reply.status(500).send({
        success: false,
        message: 'Erro ao buscar produtos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    }
  })

  // GET /anymarket/products/partner/:partnerId - Buscar por partnerId
  app.get(
    '/partner/:partnerId',
    async (request: FastifyRequest<{ Params: { partnerId: string } }>, reply: FastifyReply) => {
      try {
        const { partnerId } = request.params
        const produtos = await buscarProdutoPorPartnerId(partnerId)
        return reply.status(200).send({
          success: true,
          data: produtos,
          total: produtos.length
        })
      } catch (error) {
        console.error('Erro ao buscar produto por partnerId:', error)
        return reply.status(500).send({
          success: false,
          message: 'Erro ao buscar produto',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        })
      }
    }
  )

  // GET /anymarket/products/ean/:ean - Buscar por EAN
  app.get(
    '/ean/:ean',
    async (request: FastifyRequest<{ Params: { ean: string } }>, reply: FastifyReply) => {
      try {
        const { ean } = request.params
        const produtos = await buscarProdutoPorEan(ean)
        return reply.status(200).send({
          success: true,
          data: produtos,
          total: produtos.length
        })
      } catch (error) {
        console.error('Erro ao buscar produto por EAN:', error)
        return reply.status(500).send({
          success: false,
          message: 'Erro ao buscar produto',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        })
      }
    }
  )
}
