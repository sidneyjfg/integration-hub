import { createHash } from 'node:crypto'
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

type DadosCheckpointBuscaCS = CheckpointBuscaCS & { contas: string; mes: string }

function identificadorCheckpointBuscaCS(contas: string, mes: string): string {
  return createHash('sha256').update(`${contas}:${mes}`).digest('hex')
}

function diaParaDataHora(dia: string): string {
  return `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)} 00:00:00`
}

function lerDadosCheckpoint(valor: unknown): DadosCheckpointBuscaCS | null {
  if (typeof valor !== 'string' || !valor) return null
  try {
    const dados = JSON.parse(valor) as DadosCheckpointBuscaCS
    if (
      typeof dados.contas !== 'string' ||
      typeof dados.mes !== 'string' ||
      !/^\d{8}$/.test(dados.retomarDia) ||
      !/^\d{8}$/.test(dados.blocoInicio) ||
      !/^\d{8}$/.test(dados.blocoFim)
    ) return null
    return dados
  } catch {
    return null
  }
}

async function buscarCheckpointUnificado(contas: string, mes: string): Promise<CheckpointBuscaCS | null> {
  const chave = identificadorCheckpointBuscaCS(contas, mes)
  const [linhas] = await poolMonitoramento.execute(
    `SELECT dados_checkpoint AS dadosCheckpoint
       FROM tmp_checkpoint
      WHERE origem = 'mercadolivre' AND processo = 'busca_cs' AND cliente_id = ?`,
    [chave],
  )
  const dados = lerDadosCheckpoint((linhas as any[])[0]?.dadosCheckpoint)
  return dados && dados.contas === contas && dados.mes === mes ? dados : null
}

async function tabelaLegadaBuscaCSExiste(): Promise<boolean> {
  const [linhas] = await poolMonitoramento.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'busca_cs_checkpoint' LIMIT 1`,
  )
  return (linhas as any[]).length > 0
}

async function buscarCheckpointLegadoBuscaCS(contas: string, mes: string): Promise<CheckpointBuscaCS | null> {
  if (!await tabelaLegadaBuscaCSExiste()) return null
  try {
    const [linhas] = await poolMonitoramento.execute(
      'SELECT retomar_dia AS retomarDia, bloco_inicio AS blocoInicio, bloco_fim AS blocoFim FROM busca_cs_checkpoint WHERE contas = ? AND mes = ?',
      [contas, mes],
    )
    return (linhas as CheckpointBuscaCS[])[0] ?? null
  } catch (error: any) {
    // Checkpoint legado ausente ou com estrutura antiga/incompatível: inicia sem retomada.
    if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') return null
    throw error
  }
}

export async function buscarCheckpointBuscaCS(contas: string, mes: string): Promise<CheckpointBuscaCS | null> {
  const existente = await buscarCheckpointUnificado(contas, mes)
  if (existente) return existente

  const legado = await buscarCheckpointLegadoBuscaCS(contas, mes)
  if (legado) await salvarCheckpointBuscaCS(contas, mes, legado)
  return legado
}

export async function salvarCheckpointBuscaCS(contas: string, mes: string, checkpoint: CheckpointBuscaCS): Promise<void> {
  const dados: DadosCheckpointBuscaCS = { contas, mes, ...checkpoint }
  await poolMonitoramento.execute(
    `INSERT INTO tmp_checkpoint
       (origem, processo, cliente_id, cursor_data, ultima_execucao, incidente_em, ultimo_erro, dados_checkpoint)
     VALUES ('mercadolivre', 'busca_cs', ?, ?, CURRENT_TIMESTAMP, NULL, NULL, ?)
     ON DUPLICATE KEY UPDATE cursor_data = VALUES(cursor_data), ultima_execucao = CURRENT_TIMESTAMP,
       incidente_em = NULL, ultimo_erro = NULL, dados_checkpoint = VALUES(dados_checkpoint)`,
    [identificadorCheckpointBuscaCS(contas, mes), diaParaDataHora(checkpoint.retomarDia), JSON.stringify(dados)],
  )
}

export async function registrarIncidenteBuscaCS(contas: string, mes: string, erro: string): Promise<void> {
  await poolMonitoramento.execute(
    `UPDATE tmp_checkpoint
        SET incidente_em = CURRENT_TIMESTAMP, ultima_execucao = CURRENT_TIMESTAMP, ultimo_erro = ?
      WHERE origem = 'mercadolivre' AND processo = 'busca_cs' AND cliente_id = ?`,
    [erro.slice(0, 4000), identificadorCheckpointBuscaCS(contas, mes)],
  )
}

export async function limparCheckpointBuscaCS(contas: string, mes: string): Promise<void> {
  await poolMonitoramento.execute(
    `DELETE FROM tmp_checkpoint
      WHERE origem = 'mercadolivre' AND processo = 'busca_cs' AND cliente_id = ?`,
    [identificadorCheckpointBuscaCS(contas, mes)],
  )
  if (!await tabelaLegadaBuscaCSExiste()) return
  try {
    await poolMonitoramento.execute('DELETE FROM busca_cs_checkpoint WHERE contas = ? AND mes = ?', [contas, mes])
  } catch (error: any) {
    if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.code !== 'ER_BAD_FIELD_ERROR') throw error
  }
}
