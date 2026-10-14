import { poolMonitoramento } from '../../../core/db'

export type ApuracaoDiariaCS = { dia: string; totalNotas: number; valorBruto: number }

export async function buscarApuracoesCS(contas: string, inicio: string, fim: string): Promise<ApuracaoDiariaCS[]> {
  const [linhas] = await poolMonitoramento.query(
    'SELECT dia, total_notas AS totalNotas, valor_bruto AS valorBruto FROM busca_cs_diaria WHERE contas = ? AND dia >= ? AND dia < ?',
    [contas, inicio, fim],
  )
  return (linhas as ApuracaoDiariaCS[]).map(linha => ({ ...linha, totalNotas: Number(linha.totalNotas), valorBruto: Number(linha.valorBruto) }))
}

export async function salvarApuracaoCS(contas: string, apuracao: ApuracaoDiariaCS): Promise<void> {
  await poolMonitoramento.query(
    `INSERT INTO busca_cs_diaria (contas, dia, total_notas, valor_bruto) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_notas = VALUES(total_notas), valor_bruto = VALUES(valor_bruto)`,
    [contas, apuracao.dia, apuracao.totalNotas, apuracao.valorBruto],
  )
}
