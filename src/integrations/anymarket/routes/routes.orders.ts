import type { FastifyInstance } from 'fastify'

export default async function anymarketOrdersRoutes(
  app: FastifyInstance
) {
  /**
   * GET /anymarket/orders/resumo
   * Analytics de pedidos AnyMarket
   */
  app.get('/resumo', async (req) => {
    const { start, end, status } = req.query as {
      start?: string
      end?: string
      status?: string
    }

    // 🔧 SQL EXEMPLO (AJUSTAR)
    /*
    SELECT
      status,
      COUNT(*) AS total_pedidos,
      SUM(total) AS valor_total
    FROM anymarket_orders
    WHERE created_at BETWEEN ? AND ?
      AND (? IS NULL OR status = ?)
    GROUP BY status
    */

    return {
      hub: 'anymarket',
      tipo: 'orders',
      filtros: { start, end, status },
      mensagem: 'Base de analytics de pedidos AnyMarket criada'
    }
  })
}
