import { poolMonitoramento } from '../../../core/db'
import { coreConfig } from '../../../core/env.schema'

export type ResumoBuscaCS = {
  totalNotas: number
  valorBruto: number
}

export type ResumoDiarioBuscaCS = ResumoBuscaCS & {
  dataApuracao: string
}

type NotaCS = {
  emissao: string | null
  chave: string
  valor: string | number | null
}

function valorNumerico(valor: NotaCS['valor']): number {
  if (valor == null) return 0
  const normalizado = String(valor).trim().replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export async function buscarResumoBuscaCS(
  start: string,
  endExclusive: string,
): Promise<ResumoBuscaCS> {
  const sql = `
    SELECT
      COUNT(DISTINCT chave) AS totalNotas,
      COALESCE(SUM(CAST(REPLACE(valor, ',', '.') AS DECIMAL(18, 2))), 0) AS valorBruto
    FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
    WHERE tipo_logistico = ?
      AND emissao >= ?
      AND emissao < ?
  `

  const [rows] = await poolMonitoramento.query(sql, ['Fulfillment', start, endExclusive])
  const row = (rows as any[])[0] ?? {}

  return {
    totalNotas: Number(row.totalNotas ?? 0),
    valorBruto: Number(row.valorBruto ?? 0),
  }
}

export async function buscarResumoDiarioBuscaCS(
  start: string,
  endExclusive: string,
  diasNoMes: number,
): Promise<ResumoDiarioBuscaCS[]> {
  const sql = `
    SELECT emissao, chave, valor
    FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
    WHERE tipo_logistico = ?
      AND emissao >= ?
      AND emissao < ?
    ORDER BY emissao ASC
  `

  const [rows] = await poolMonitoramento.query(sql, ['Fulfillment', start, endExclusive])
  const notas = rows as NotaCS[]
  const porDia = new Map<number, { chaves: Set<string>; valor: number }>()

  for (const nota of notas) {
    if (!nota.emissao || nota.emissao.length < 8) continue
    const dia = Number(nota.emissao.slice(6, 8))
    if (dia < 1 || dia > diasNoMes) continue

    const atual = porDia.get(dia) ?? { chaves: new Set<string>(), valor: 0 }
    atual.chaves.add(nota.chave)
    atual.valor += valorNumerico(nota.valor)
    porDia.set(dia, atual)
  }

  let totalNotas = 0
  let valorBruto = 0
  const resultado: ResumoDiarioBuscaCS[] = []

  for (let diaApuracao = 1; diaApuracao <= diasNoMes; diaApuracao++) {
    const diaAnterior = porDia.get(diaApuracao - 1)
    if (diaAnterior) {
      totalNotas += diaAnterior.chaves.size
      valorBruto += diaAnterior.valor
    }

    resultado.push({
      dataApuracao: String(diaApuracao).padStart(2, '0'),
      totalNotas,
      valorBruto: Number(valorBruto.toFixed(2)),
    })
  }

  return resultado
}
