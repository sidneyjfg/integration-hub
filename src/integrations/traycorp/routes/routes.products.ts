import type { FastifyInstance } from 'fastify'

export default async function traycorpProductsRoutes(
  app: FastifyInstance
) {
  /**
   * GET /traycorp/products/resumo
   * Analytics de produtos TrayCorp
   */
  app.get('/resumo', async (req) => {
    const { start, end, sku } = req.query as {
      start?: string
      end?: string
      sku?: string
    }

    // 🔧 SQL EXEMPLO
    /*
    SELECT
      sku,
      COUNT(*) AS qtd_vendas,
      SUM(valor) AS faturamento
    FROM tray_products
    WHERE created_at BETWEEN ? AND ?
      AND (? IS NULL OR sku = ?)
    GROUP BY sku
    */

    return {
      hub: 'traycorp',
      tipo: 'products',
      filtros: { start, end, sku },
      mensagem: 'Base de analytics de produtos TrayCorp criada'
    }
  })
}
