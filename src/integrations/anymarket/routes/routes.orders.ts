import type { FastifyInstance } from 'fastify'
import { BuscaInsightsdePedidoAnyXNerus } from '../repositories/analytics.repository'

export default async function anymarketOrdersRoutes(
  app: FastifyInstance
) {
  /**
   * GET /anymarket/orders/resumo
   * Analytics / conferência AnyMarket x ERP
   */
  app.get('/resumo', async (req, reply) => {
    const { start, end, status } = req.query as {
      start?: string
      end?: string
      status?: string
    }

    try {
      const dados = await BuscaInsightsdePedidoAnyXNerus()

      return {
        hub: 'anymarket',
        tipo: 'orders',
        filtros: {
          start,
          end,
          status
        },
        total_registros: dados.length,
        dados
      }
    } catch (error) {
      req.log.error(error, 'Erro ao buscar resumo AnyMarket')

      return reply.status(500).send({
        message: 'Erro ao buscar resumo de pedidos AnyMarket'
      })
    }
  })
}
