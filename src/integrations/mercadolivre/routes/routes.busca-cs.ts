import type { FastifyInstance } from 'fastify'
import { buscarResumoBuscaCS } from '../repositories/busca-cs.repository'
import { executarBuscaCS, resolverPeriodoD1 } from '../services/busca-cs-google-sheets'
import { coreConfig } from '../../../core/env.schema'

function d1DaQuery(req: any): string {
  const d1 = String(req.query?.d1 ?? '')
  resolverPeriodoD1(d1)
  return d1
}

export default async function buscaCsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    try {
      const d1 = d1DaQuery(req)
      const periodo = resolverPeriodoD1(d1)
      const resumo = await buscarResumoBuscaCS(periodo.inicio, periodo.fim)
      return { modo: 'preview', d1, periodo: { inicio: periodo.inicio, fim: d1 }, ...resumo }
    } catch (error: any) {
      return reply.code(400).send({ erro: error?.message ?? 'Parâmetro d1 inválido' })
    }
  })

  app.post('/', async (req, reply) => {
    try {
      if (!coreConfig.ATIVA_BUSCA_CS) return reply.code(409).send({ erro: 'ATIVA_BUSCA_CS está desativada' })
      const d1 = String((req.body as any)?.d1 ?? '')
      resolverPeriodoD1(d1)
      const resultado = await executarBuscaCS(d1)
      return { modo: 'publicacao', ...resultado }
    } catch (error: any) {
      return reply.code(400).send({ erro: error?.message ?? 'Não foi possível publicar no Sheets' })
    }
  })
}
