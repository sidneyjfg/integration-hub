import type { FastifyInstance } from 'fastify'
import { buscarResumoBuscaCS } from '../repositories/busca-cs.repository'
import { executarBuscaCS, resolverPeriodoD1 } from '../services/busca-cs-google-sheets'
import { coreConfig } from '../../../core/env.schema'
import { buscarValoresPedidosMercadoLivre } from '../api/buscar-pedidos-mercadolivre'

function d1DaQuery(req: any): string {
  const d1 = String(req.query?.d1 ?? '')
  resolverPeriodoD1(d1)
  return d1
}

function proximoDia(data: string): string {
  const valor = new Date(Date.UTC(
    Number(data.slice(0, 4)),
    Number(data.slice(4, 6)) - 1,
    Number(data.slice(6, 8)) + 1,
  ))
  return `${valor.getUTCFullYear()}${String(valor.getUTCMonth() + 1).padStart(2, '0')}${String(valor.getUTCDate()).padStart(2, '0')}`
}

function validarIntervalo(inicio: unknown, fim: unknown) {
  const inicioTexto = String(inicio ?? '')
  const fimTexto = String(fim ?? '')
  resolverPeriodoD1(inicioTexto)
  resolverPeriodoD1(fimTexto)

  const dataInicio = new Date(Date.UTC(
    Number(inicioTexto.slice(0, 4)),
    Number(inicioTexto.slice(4, 6)) - 1,
    Number(inicioTexto.slice(6, 8)),
  ))
  const dataFim = new Date(Date.UTC(
    Number(fimTexto.slice(0, 4)),
    Number(fimTexto.slice(4, 6)) - 1,
    Number(fimTexto.slice(6, 8)),
  ))
  const dias = Math.floor((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1
  if (dias < 1) throw new Error('O fim deve ser igual ou posterior ao início')
  if (dias > 31) throw new Error('O intervalo máximo para preenchimento é de 31 dias')

  return { inicio: inicioTexto, fim: fimTexto, fimExclusivo: proximoDia(fimTexto) }
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

  app.get('/pedidos', async (req, reply) => {
    try {
      const query = req.query as { d1?: string; serie?: string }
      const d1 = String(query?.d1 ?? '')
      const serie = String(query?.serie ?? '').trim() || undefined
      const periodo = resolverPeriodoD1(d1)
      const pedidos = await buscarValoresPedidosMercadoLivre(
        periodo.inicio,
        periodo.fim,
        serie,
      )
      const resumo = await buscarResumoBuscaCS(periodo.inicio, periodo.fim, serie)

      return {
        modo: 'busca-pedidos-e-resumo',
        d1,
        serie: serie ?? null,
        periodo: { inicio: periodo.inicio, fim: d1 },
        pedidos,
        resumo,
      }
    } catch (error: any) {
      return reply.code(400).send({
        erro: error?.message ?? 'Não foi possível buscar os pedidos e montar o resumo',
      })
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

  app.post('/pedidos/pendentes', async (req, reply) => {
    try {
      if (!coreConfig.ATIVA_BUSCA_CS) {
        return reply.code(409).send({ erro: 'ATIVA_BUSCA_CS está desativada' })
      }

      const body = (req.body ?? {}) as any
      const periodo = validarIntervalo(body.inicio, body.fim)
      const resultado = await buscarValoresPedidosMercadoLivre(
        periodo.inicio,
        periodo.fimExclusivo,
      )

      return {
        modo: 'preenchimento-pedidos-pendentes',
        periodo: { inicio: periodo.inicio, fim: periodo.fim },
        ...resultado,
      }
    } catch (error: any) {
      return reply.code(400).send({
        erro: error?.message ?? 'Não foi possível preencher os pedidos pendentes',
      })
    }
  })

  app.post('/pedidos/serie', async (req, reply) => {
    try {
      const body = (req.body ?? {}) as any
      const serie = String(body.serie ?? '').trim()
      if (!serie) {
        return reply.code(400).send({ erro: 'Informe a série' })
      }

      const periodo = validarIntervalo(body.inicio, body.fim)
      const resultado = await buscarValoresPedidosMercadoLivre(
        periodo.inicio,
        periodo.fimExclusivo,
        serie,
      )

      return {
        modo: 'preenchimento-pedidos-por-serie',
        serie,
        periodo: { inicio: periodo.inicio, fim: periodo.fim },
        ...resultado,
      }
    } catch (error: any) {
      return reply.code(400).send({
        erro: error?.message ?? 'Não foi possível preencher os pedidos da série',
      })
    }
  })
}
