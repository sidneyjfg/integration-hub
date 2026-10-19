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

export type CheckpointBuscaCS = { retomarDia: string; blocoInicio: string; blocoFim: string }

export async function buscarCheckpointBuscaCS(contas: string, mes: string): Promise<CheckpointBuscaCS | null> {
  const [linhas] = await poolMonitoramento.query(
    'SELECT retomar_dia AS retomarDia, bloco_inicio AS blocoInicio, bloco_fim AS blocoFim FROM busca_cs_checkpoint WHERE contas = ? AND mes = ?',
    [contas, mes],
  )
  return (linhas as CheckpointBuscaCS[])[0] ?? null
}

export async function salvarCheckpointBuscaCS(contas: string, mes: string, checkpoint: CheckpointBuscaCS): Promise<void> {
  await poolMonitoramento.query(
    `INSERT INTO busca_cs_checkpoint (contas, mes, retomar_dia, bloco_inicio, bloco_fim) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE retomar_dia = VALUES(retomar_dia), bloco_inicio = VALUES(bloco_inicio), bloco_fim = VALUES(bloco_fim)`,
    [contas, mes, checkpoint.retomarDia, checkpoint.blocoInicio, checkpoint.blocoFim],
  )
}

export async function limparCheckpointBuscaCS(contas: string, mes: string): Promise<void> {
  await poolMonitoramento.query('DELETE FROM busca_cs_checkpoint WHERE contas = ? AND mes = ?', [contas, mes])
}
