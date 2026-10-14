import { createHash } from 'node:crypto'
import { buscarCredenciaisMercadoLivre } from '../repositories/mercadolivre-notas.repository'
import { buscarApuracoesCS, salvarApuracaoCS } from '../repositories/busca-cs-diaria.repository'
import { contarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { buscarResumoDiarioValoresPedidosMercadoLivre } from '../api/buscar-pedidos-mercadolivre'
import { resolverPeriodoD1 } from './busca-cs-google-sheets'

export async function apurarBuscaCSDiaria(d1: string, forcar = false) {
  const { inicio, fim } = resolverPeriodoD1(d1)
  const contas = await buscarCredenciaisMercadoLivre()
  if (!contas.length) throw new Error('Nenhuma conta Mercado Livre encontrada para a Busca CS')
  const chaveContas = createHash('sha256').update([...new Set(contas.map(conta => conta.clienteId))].sort().join(',')).digest('hex')
  const existentes = await buscarApuracoesCS(chaveContas, inicio, fim)
  const porDia = new Map(existentes.map(item => [item.dia, item]))
  const valoresPorDia: Record<string, number> = {}
  const notasPorDia: Record<string, number> = {}
  let acumulado = 0
  const data = new Date(`${inicio.slice(0, 4)}-${inicio.slice(4, 6)}-${inicio.slice(6, 8)}T00:00:00Z`)
  for (let dia = inicio; dia < fim; dia = data.toISOString().slice(0, 10).replace(/-/g, '')) {
    data.setUTCDate(data.getUTCDate() + 1)
    const seguinte = data.toISOString().slice(0, 10).replace(/-/g, '')
    const anterior = porDia.get(dia)
    // Revalidar mesmo os dias preenchidos: notas e vendas antigas podem mudar.
    // Sequencial: limita memória dos ZIPs e pressão nas APIs por conta/dia.
    const pedidos = await buscarResumoDiarioValoresPedidosMercadoLivre(dia, seguinte)
    let totalNotas = 0
    for (const conta of contas) {
      const notas = await contarNotasMercadoLivre({ ...conta, startDate: dia, endDate: seguinte })
      totalNotas += notas.notasPorDia[dia] ?? 0
    }
    const apuracao = { dia, totalNotas, valorBruto: pedidos.valoresPorDia[dia] ?? 0 }
    // O histórico serve para detectar diferenças, não para evitar a revalidação.
    // Só grava quando ambas as fontes foram apuradas com sucesso.
    if (forcar || !anterior || anterior.totalNotas !== totalNotas || anterior.valorBruto !== apuracao.valorBruto) {
      await salvarApuracaoCS(chaveContas, apuracao)
    }
    acumulado += apuracao.valorBruto
    valoresPorDia[dia] = Number(acumulado.toFixed(2))
    notasPorDia[dia] = apuracao.totalNotas
  }
  return { valoresPorDia, notasPorDia }
}
