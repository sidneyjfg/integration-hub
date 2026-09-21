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

const OPERACOES_VALOR_BRUTO = [
  'Venda de mercadorias',
  'Devolucao de mercadorias',
] as const

function valorNumerico(valor: NotaCS['valor']): number {
  if (valor == null) return 0
  const normalizado = String(valor).trim().replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

export async function buscarResumoBuscaCS(
  start: string,
  endExclusive: string,
  serie?: string,
): Promise<ResumoBuscaCS> {
  const filtroSerie = serie ? 'AND serie = ?' : ''
  const sql = `
    SELECT
      COUNT(*) AS totalNotas,
      COALESCE(SUM(valorBruto), 0) AS valorBruto
    FROM (
      SELECT
        chave,
        MAX(
          CASE
            WHEN COALESCE(status, '') = 'Cancelada' THEN 0
            WHEN operacao IN (?, ?) THEN COALESCE(
              valor_pedido,
              CAST(REPLACE(valor, ',', '.') AS DECIMAL(18, 2))
            )
            ELSE 0
          END
        ) AS valorBruto
      FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
      WHERE tipo_logistico = ?
        AND emissao >= ?
        AND emissao < ?
        ${filtroSerie}
      GROUP BY chave
    ) notas
  `

  const params: Array<string> = [
    ...OPERACOES_VALOR_BRUTO,
    'Fulfillment',
    start,
    endExclusive,
  ]
  if (serie) params.push(serie)

  const [rows] = await poolMonitoramento.query(sql, params)
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
  serie?: string,
): Promise<ResumoDiarioBuscaCS[]> {
  const filtroSerie = serie ? 'AND serie = ?' : ''
  const sql = `
    SELECT emissao, chave, valor
    FROM (
      SELECT
        MAX(emissao) AS emissao,
        chave,
        MAX(
          CASE
            WHEN COALESCE(status, '') = 'Cancelada' THEN 0
            WHEN operacao IN (?, ?) THEN COALESCE(
              valor_pedido,
              CAST(REPLACE(valor, ',', '.') AS DECIMAL(18, 2))
            )
            ELSE 0
          END
        ) AS valor
      FROM ${coreConfig.DB_NAME_MONITORAMENTO}.tmp_notas
      WHERE tipo_logistico = ?
        AND emissao >= ?
        AND emissao < ?
        ${filtroSerie}
      GROUP BY chave
    ) notas
    ORDER BY emissao ASC
  `

  const params: Array<string | number> = [
    ...OPERACOES_VALOR_BRUTO,
    'Fulfillment',
    start,
    endExclusive,
  ]
  if (serie) params.push(serie)

  const [rows] = await poolMonitoramento.query(sql, params)
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
    // A execução do dia seguinte fecha o dia anterior:
    // no dia 02, a linha do dia 01 recebe o acumulado até o dia 01.
    const diaAtual = porDia.get(diaApuracao)
    if (diaAtual) {
      totalNotas += diaAtual.chaves.size
      valorBruto += diaAtual.valor
    }

    resultado.push({
      dataApuracao: String(diaApuracao).padStart(2, '0'),
      totalNotas,
      valorBruto: Number(valorBruto.toFixed(2)),
    })
  }

  return resultado
}
