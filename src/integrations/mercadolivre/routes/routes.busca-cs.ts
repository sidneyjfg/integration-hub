import type { FastifyInstance } from 'fastify'
import { buscarResumoBuscaCS } from '../repositories/busca-cs.repository'
import { executarBuscaCS, resolverPeriodoD1 } from '../services/busca-cs-google-sheets'
import { coreConfig } from '../../../core/env.schema'
import { buscarResumoDiarioValoresPedidosMercadoLivre } from '../api/buscar-pedidos-mercadolivre'

function d1DaQuery(req: any): string {
  const d1 = String(req.query?.d1 ?? '')
  resolverPeriodoD1(d1)
  return d1
}

function normalizarDataForcada(valor: unknown): string {
  const texto = String(valor ?? '').trim()
  const d1 = /^\d{2}\/\d{2}\/\d{4}$/.test(texto)
    ? `${texto.slice(6, 10)}${texto.slice(3, 5)}${texto.slice(0, 2)}`
    : texto

  if (!/^\d{8}$/.test(d1)) {
    throw new Error('Informe a data no formato DD/MM/YYYY ou YYYYMMDD')
  }

  const data = new Date(Date.UTC(
    Number(d1.slice(0, 4)),
    Number(d1.slice(4, 6)) - 1,
    Number(d1.slice(6, 8)),
  ))
  if (
    data.getUTCFullYear() !== Number(d1.slice(0, 4)) ||
    data.getUTCMonth() + 1 !== Number(d1.slice(4, 6)) ||
    data.getUTCDate() !== Number(d1.slice(6, 8))
  ) {
    throw new Error('Data inválida')
  }

  return d1
}

function diaAnterior(data: string): string {
  const valor = new Date(Date.UTC(
    Number(data.slice(0, 4)),
    Number(data.slice(4, 6)) - 1,
    Number(data.slice(6, 8)) - 1,
  ))
  return `${valor.getUTCFullYear()}${String(valor.getUTCMonth() + 1).padStart(2, '0')}${String(valor.getUTCDate()).padStart(2, '0')}`
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

  app.post('/forcar-dia', async (req, reply) => {
    try {
      const body = (req.body ?? {}) as any
      const dataReferencia = normalizarDataForcada(body.data ?? body.dia ?? body.d1)
      const d1 = diaAnterior(dataReferencia)
      const periodo = resolverPeriodoD1(d1)
      const pedidos = await buscarResumoDiarioValoresPedidosMercadoLivre(
        periodo.inicio,
        periodo.fim,
      )
      const planilha = await executarBuscaCS(d1, [d1], pedidos.valoresPorDia)

      return {
        modo: 'forcar-busca-cs',
        dataReferencia,
        ultimoDiaIncluido: d1,
        periodo: {
          inicio: periodo.inicio,
          fimExclusivo: periodo.fim,
        },
        pedidos,
        planilha,
      }
    } catch (error: any) {
      return reply.code(400).send({
        erro: error?.message ?? 'Não foi possível forçar a Busca CS',
      })
    }
  })
}
