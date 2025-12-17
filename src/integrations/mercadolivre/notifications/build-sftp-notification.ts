import { countNotesByTipoNota } from '../utils/count-note-types'

type BuildNotificationParams = {
  clienteId: string
  modo: string
  files: string[]
  startDate: string
  endDate: string
  targetDir?: string
  ignoreEnd?: string
  ignoreTipo?: string
}

type TipoCounter = Record<string, number>

/**
 * 📣 Decide automaticamente QUAL notificação enviar
 */
export async function buildMercadoLivreSftpNotification(
  params: BuildNotificationParams
): Promise<string> {
  const {
    clienteId,
    modo,
    files,
    startDate,
    endDate,
    targetDir,
    ignoreEnd,
    ignoreTipo
  } = params

  // =====================================================
  // 🧠 REGRA 1 — LEDGER → mensagem simples
  // =====================================================
  if (modo.includes('LEDGER')) {
    return (
      `📤 *Mercado Livre • SFTP Ledger*\n` +
      `Cliente: ${clienteId}\n` +
      `Período: ${startDate} → ${endDate}\n` +
      `Novos arquivos enviados: ${files.length}\n` +
      (targetDir ? `Destino: ${targetDir}` : '')
    )
  }

  // =====================================================
  // 🧠 REGRA 2 — NÃO HÁ FILTROS → mensagem simples
  // =====================================================
  const hasIgnoreTipo = Boolean(ignoreTipo?.trim())
  const hasIgnoreEnd = Boolean(ignoreEnd?.trim())

  if (!hasIgnoreTipo && !hasIgnoreEnd) {
    return (
      `📤 *Mercado Livre • SFTP*\n` +
      `Cliente: ${clienteId}\n` +
      `Período: ${startDate} → ${endDate}\n` +
      `Arquivos enviados: ${files.length}\n` +
      (targetDir ? `Destino: ${targetDir}` : '')
    )
  }

  // =====================================================
  // 🧠 REGRA 3 — HÁ FILTRO → AGRUPA POR TIPO DE NOTA
  // =====================================================
  const counters = await countNotesByTipoNota(files)

  const detalhes = Object.entries(counters)
    .map(([tipo, total]) => `📂 ${total} arquivo(s) de ${tipo}`)
    .join('\n')

  return (
    `📤 *Mercado Livre • SFTP*\n` +
    `Cliente: ${clienteId}\n` +
    `Período: ${startDate} → ${endDate}\n\n` +
    `${detalhes}\n\n` +
    (targetDir ? `Destino: ${targetDir}` : '')
  )
}
