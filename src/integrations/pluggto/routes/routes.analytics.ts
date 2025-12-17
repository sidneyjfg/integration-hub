import type { FastifyInstance } from 'fastify'

export default async function pluggtoAnalyticsRoutes(
  app: FastifyInstance
) {
  /**
   * GET /pluggto/orders/resumo
   * Analytics de pedidos PluggTo
   */
  app.get('/orders/resumo', async (req) => {
    const { start, end, status } = req.query as {
      start?: string
      end?: string
      status?: string
    }

    // 🔧 SQL EXEMPLO
    /*
    SELECT
      status,
      COUNT(*) AS total_pedidos
    FROM pluggto_orders
    WHERE created_at BETWEEN ? AND ?
    GROUP BY status
    */

    return {
      hub: 'pluggto',
      tipo: 'orders',
      filtros: { start, end, status },
      mensagem: 'Base de analytics de pedidos PluggTo criada'
    }
  })

  /**
   * GET /pluggto/products/resumo
   * Analytics de produtos PluggTo
   */
  app.get('/products/resumo', async (req) => {
    const { start, end, sku } = req.query as {
      start?: string
      end?: string
      sku?: string
    }

    // 🔧 SQL EXEMPLO
    /*
    SELECT
      sku,
      SUM(qty) AS quantidade,
      SUM(valor_total) AS faturamento
    FROM pluggto_items
    WHERE created_at BETWEEN ? AND ?
    GROUP BY sku
    */

    return {
      hub: 'pluggto',
      tipo: 'products',
      filtros: { start, end, sku },
      mensagem: 'Base de analytics de produtos PluggTo criada'
    }
  })
}
