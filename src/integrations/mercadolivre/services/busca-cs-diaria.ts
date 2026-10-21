import { createHash } from 'node:crypto'
import { buscarCredenciaisMercadoLivre } from '../repositories/mercadolivre-notas.repository'
import {
  buscarApuracoesCS,
  buscarCheckpointBuscaCS,
  limparCheckpointBuscaCS,
  registrarIncidenteBuscaCS,
  salvarApuracaoCS,
  salvarCheckpointBuscaCS,
  type ApuracaoDiariaCS,
} from '../repositories/busca-cs-diaria.repository'
import { contarNotasMercadoLivre } from '../api/buscar-notas-mercadolivre'
import { buscarResumoDiarioValoresPedidosMercadoLivre } from '../api/buscar-pedidos-mercadolivre'
import { resolverPeriodoD1 } from './busca-cs-google-sheets'

const DIAS_POR_BLOCO = 5

function somarDias(dia: string, quantidade: number): string {
  const data = new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6, 8)) + quantidade))
  return `${data.getUTCFullYear()}${String(data.getUTCMonth() + 1).padStart(2, '0')}${String(data.getUTCDate()).padStart(2, '0')}`
}

function diaAnterior(dia: string, inicioMes: string): string {
  return dia <= inicioMes ? inicioMes : somarDias(dia, -1)
}

export type BlocoBuscaCS = {
  inicio: string
  fim: string
  dias: string[]
  valoresPorDia: Record<string, number>
  notasPorDia: Record<string, number>
}

export type ProgressoBuscaCS = {
  inicio: string
  fim: string
  concluidos: BlocoBuscaCS[]
  blocoAtual?: { inicio: string; fim: string }
  retomarDia?: string
  valoresPorDia?: Record<string, number>
  notasPorDia?: Record<string, number>
}

export async function apurarBuscaCSDiaria(
  d1: string,
  forcar = false,
  aoConcluirBloco?: (bloco: BlocoBuscaCS) => Promise<void>,
  aoIniciarBloco?: (bloco: { inicio: string; fim: string; retomarDia: string }) => Promise<void>,
): Promise<ProgressoBuscaCS> {
  const periodo = resolverPeriodoD1(d1)
  const { inicio, fim } = periodo
  const contas = await buscarCredenciaisMercadoLivre()
  if (!contas.length) throw new Error('Nenhuma conta Mercado Livre encontrada para a Busca CS')

  const chaveContas = createHash('sha256').update([...new Set(contas.map(conta => conta.clienteId))].sort().join(',')).digest('hex')
  const mes = inicio.slice(0, 6)
  const existentes = await buscarApuracoesCS(chaveContas, inicio, fim)
  const porDia = new Map<string, ApuracaoDiariaCS>(existentes.map(item => [item.dia, item]))
  const checkpoint = forcar ? null : await buscarCheckpointBuscaCS(chaveContas, mes)
  let cursor = checkpoint?.retomarDia ?? inicio
  let fimBlocoParaRetomar = checkpoint ? somarDias(checkpoint.blocoFim, 1) : undefined
  if (cursor < inicio) cursor = inicio
  const progresso: ProgressoBuscaCS = { inicio: cursor, fim: d1, concluidos: [] }

  try {
  while (cursor < fim) {
    const blocoInicio = cursor
    const limiteBloco = fimBlocoParaRetomar ?? somarDias(blocoInicio, DIAS_POR_BLOCO)
    const blocoFim = [limiteBloco, fim].sort()[0]
    fimBlocoParaRetomar = undefined
    const retomarDia = diaAnterior(blocoInicio, inicio)
    progresso.blocoAtual = { inicio: blocoInicio, fim: somarDias(blocoFim, -1) }
    progresso.retomarDia = retomarDia
    await salvarCheckpointBuscaCS(chaveContas, mes, {
      retomarDia,
      blocoInicio,
      blocoFim: somarDias(blocoFim, -1),
    })
    await aoIniciarBloco?.({ ...progresso.blocoAtual, retomarDia })

    // Uma consulta de pedidos e um download de XML por conta a cada janela.
    const pedidos = await buscarResumoDiarioValoresPedidosMercadoLivre(blocoInicio, blocoFim)
    const notasPorDia: Record<string, number> = {}
    for (const dia of Object.keys(pedidos.totaisPorDia)) notasPorDia[dia] = 0
    for (const conta of contas) {
      const contagem = await contarNotasMercadoLivre({ ...conta, startDate: blocoInicio, endDate: blocoFim })
      for (const dia of Object.keys(notasPorDia)) {
        notasPorDia[dia] += contagem.notasPorDia[dia] ?? 0
      }
    }

    const diasBloco = Object.keys(pedidos.totaisPorDia).sort()
    for (const dia of diasBloco) {
      const apuracao = {
        dia,
        totalNotas: notasPorDia[dia] ?? 0,
        valorBruto: pedidos.totaisPorDia[dia] ?? 0,
      }
      const anterior = porDia.get(dia)
      if (forcar || !anterior || anterior.totalNotas !== apuracao.totalNotas || anterior.valorBruto !== apuracao.valorBruto) {
        await salvarApuracaoCS(chaveContas, apuracao)
      }
      porDia.set(dia, apuracao)
    }

    let acumuladoBruto = 0
    const valoresBloco: Record<string, number> = {}
    const notasBloco: Record<string, number> = {}
    const diasNoResultado = new Set(Object.keys(pedidos.totaisPorDia))
    for (let dia = inicio; dia < blocoFim; dia = somarDias(dia, 1)) {
      const apuracao = porDia.get(dia)
      if (!apuracao) throw new Error(`Apuração diária ausente para ${dia}; planilha não atualizada`)
      acumuladoBruto += apuracao.valorBruto
      if (dia <= somarDias(blocoFim, -1)) {
        valoresBloco[dia] = acumuladoBruto
        notasBloco[dia] = apuracao.totalNotas
      }
    }

    const bloco = {
      inicio: blocoInicio,
      fim: somarDias(blocoFim, -1),
      dias: [...diasNoResultado].sort(),
      valoresPorDia: valoresBloco,
      notasPorDia: notasBloco,
    }
    await aoConcluirBloco?.(bloco)
    progresso.concluidos.push(bloco)
    cursor = blocoFim
  }
  } catch (error: any) {
    try {
      await registrarIncidenteBuscaCS(chaveContas, mes, String(error?.message ?? error))
    } catch (erroCheckpoint) {
      console.error('[BUSCA-CS][CHECKPOINT] Não foi possível registrar o incidente em tmp_checkpoint', erroCheckpoint)
    }
    throw error
  }

  await limparCheckpointBuscaCS(chaveContas, mes)
  const valoresPorDia: Record<string, number> = {}
  const notasPorDia: Record<string, number> = {}
  let acumuladoBruto = 0
  for (let dia = inicio; dia <= d1; dia = somarDias(dia, 1)) {
    const apuracao = porDia.get(dia)
    if (!apuracao) continue
    acumuladoBruto += apuracao.valorBruto
    valoresPorDia[dia] = acumuladoBruto
    notasPorDia[dia] = apuracao.totalNotas
  }
  progresso.valoresPorDia = valoresPorDia
  progresso.notasPorDia = notasPorDia
  delete progresso.blocoAtual
  delete progresso.retomarDia
  return progresso
}
