import type { FastifyInstance } from 'fastify'
import { poolMain, poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'

export default async function mercadolivreNotasRoutes(
  app: FastifyInstance
) {
  /**
   * GET /mercadolivre/notas/resumo
   * Notas integradas x não integradas
   */
  app.get('/resumo', async (req) => {
    const { start, end, storeno } = req.query as {
      start?: string
      end?: string
      storeno?: string
    }

    // 🔧 SQL BASE — AJUSTE CONFORME NECESSÁRIO
    /*
    -- Integradas
    SELECT COUNT(*) FROM nfeavxml
     WHERE dhEmi BETWEEN ? AND ?
       AND storeno = ?

    -- Não integradas
    SELECT COUNT(*) FROM tmp_notas t
     WHERE NOT EXISTS (
       SELECT 1 FROM nfeavxml n WHERE n.nfkey = t.chave
     )
    */

    return {
      hub: 'mercadolivre',
      filtros: { start, end, storeno },
      mensagem: 'Resumo de notas Mercado Livre (base criada)'
    }
  })

  /**
   * GET /mercadolivre/notas/valor
   * Valor painel x Nérus
   */
  app.get('/valor', async (req) => {
    const { start, end } = req.query as {
      start?: string
      end?: string
    }

    // 🔧 SQL EXEMPLO
    /*
    SELECT SUM(vNF) FROM nfeavxml WHERE dhEmi BETWEEN ? AND ?
    */

    return {
      hub: 'mercadolivre',
      filtros: { start, end },
      mensagem: 'Comparação de valores (placeholder)'
    }
  })
}
