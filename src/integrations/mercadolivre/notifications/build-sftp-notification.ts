import { mercadolivreConfig } from '../env.schema'

type BuildNotificationParams = {
  clienteId: string
  modo: string
  notas: { tipoNota: string }[]
  startDate: string
  endDate: string
  targetDir?: string
}

/**
 * 📣 Monta a notificação do SFTP Mercado Livre
 * Baseada EXCLUSIVAMENTE nas notas realmente enviadas
 */
export async function buildMercadoLivreSftpNotification(
  params: BuildNotificationParams
): Promise<string> {
  const { clienteId, modo, notas, startDate, endDate, targetDir } = params

  const isSftp = modo.includes('SFTP')

  // 🔐 Dados do SFTP (somente se envio remoto)
  const sftpInfo = isSftp
    ? (
        `Servidor SFTP:\n` +
        `• Host: ${mercadolivreConfig.MERCADOLIVRE_SFTP_HOST}\n` +
        `• Porta: ${mercadolivreConfig.MERCADOLIVRE_SFTP_PORT}\n` +
        `• Usuário: ${mercadolivreConfig.MERCADOLIVRE_SFTP_USER}\n` +
        (targetDir ? `• Diretório: ${targetDir}\n` : '')
      )
    : ''

  // 🧠 LEDGER → mensagem resumida
  if (modo.includes('LEDGER')) {
    return (
      `📤 *Mercado Livre • ${modo.replace(/_/g, ' ')}*\n` +
      `Cliente: ${clienteId}\n` +
      `Período: ${startDate} → ${endDate}\n` +
      `Arquivos enviados: ${notas.length}\n\n` +
      sftpInfo
    )
  }

  // 🧠 AGRUPAMENTO POR TIPO DE NOTA
  const counters = notas.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipoNota] = (acc[n.tipoNota] || 0) + 1
    return acc
  }, {})

  const detalhes = Object.entries(counters)
    .map(([tipo, total]) => `📂 ${total} arquivo(s) de ${tipo}`)
    .join('\n')

  return (
    `📤 *Mercado Livre • ${modo.replace(/_/g, ' ')}*\n` +
    `Cliente: ${clienteId}\n` +
    `Período: ${startDate} → ${endDate}\n\n` +
    `${detalhes}\n\n` +
    sftpInfo
  )
}
