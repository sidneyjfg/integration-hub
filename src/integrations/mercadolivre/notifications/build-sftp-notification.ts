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

  // 🧠 LEDGER → mensagem simples
  if (modo.includes('LEDGER')) {
    return (
      `📤 *Mercado Livre • SFTP Ledger*\n` +
      `Cliente: ${clienteId}\n` +
      `Período: ${startDate} → ${endDate}\n` +
      `Arquivos enviados: ${notas.length}\n` +
      (targetDir ? `Destino: ${targetDir}` : '')
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
    `📤 *Mercado Livre • SFTP*\n` +
    `Cliente: ${clienteId}\n` +
    `Período: ${startDate} → ${endDate}\n\n` +
    `${detalhes}\n\n` +
    (targetDir ? `Destino: ${targetDir}` : '')
  )
}
