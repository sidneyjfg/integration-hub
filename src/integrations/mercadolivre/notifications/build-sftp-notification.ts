import { mercadolivreConfig } from '../env.schema'

type BuildNotificationParams = {
  clienteId: string
  clientName: string
  modo: string
  notas: { tipoNota: string }[]
  totalEncontradas: number
  totalEnviadas: number
  startDate: string
  endDate: string
  targetDir?: string
  resumoPorTipo?: Record<string, number>
  temFiltro?: boolean
}


export async function buildMercadoLivreSftpNotification(
  params: BuildNotificationParams
): Promise<string> {
  const {
    clienteId,
    clientName,
    modo,
    notas,
    startDate,
    endDate,
    targetDir,
    totalEncontradas,
    totalEnviadas,
    resumoPorTipo,
    temFiltro
  } = params

  const isSftp = modo.includes('SFTP')

  const sftpInfo = isSftp
    ? (
      `Servidor SFTP:\n` +
      `• Host: ${mercadolivreConfig.MERCADOLIVRE_SFTP_HOST}\n` +
      `• Porta: ${mercadolivreConfig.MERCADOLIVRE_SFTP_PORT}\n` +
      `• Usuário: ${mercadolivreConfig.MERCADOLIVRE_SFTP_USER}\n` +
      (targetDir ? `• Diretório: ${targetDir}\n` : '')
    )
    : ''

  // 🔒 LOCAL LEDGER — resumo simples (sem tipo de nota)
  // 🔒 LOCAL LEDGER
  if (modo === 'LOCAL_LEDGER') {
    // 👉 SEM filtro → resumo simples
    if (!temFiltro) {
      return (
        `📤 *Mercado Livre • LOCAL LEDGER*\n` +
        `Cliente: ${clientName} (${clienteId})\n` +
        `Período: ${startDate} → ${endDate}\n\n` +
        `📥 Total encontradas: ${totalEncontradas}\n` +
        `📤 Total enviadas (novas): ${totalEnviadas}\n`
      )
    }

    // 👉 COM filtro → detalha tipos enviados
    const counters = notas.reduce<Record<string, number>>((acc, n) => {
      acc[n.tipoNota] = (acc[n.tipoNota] || 0) + 1
      return acc
    }, {})

    const detalhes =
      Object.keys(counters).length > 0
        ? Object.entries(counters)
          .map(([tipo, total]) => `📂 ${total} arquivo(s) de ${tipo}`)
          .join('\n')
        : '⚠️ Nenhum arquivo novo enviado após filtros'

    return (
      `📤 *Mercado Livre • LOCAL LEDGER*\n` +
      `Cliente: ${clientName} (${clienteId})\n` +
      `Período: ${startDate} → ${endDate}\n\n` +
      `${detalhes}\n\n` +
      `📊 Total enviados (novos): ${totalEnviadas}\n`
    )
  }
  // 🔥 CASO ESPECIAL — VONDER
  if (modo === 'SFTP_VONDER_LEDGER' && resumoPorTipo) {
    const { IN = 0, CTE = 0, IN_EVENTOS = 0 } = resumoPorTipo

    return (
      `📤 *Mercado Livre • SFTP VONDER LEDGER*\n` +
      `Cliente: ${clientName} (${clienteId})\n` +
      `Período: ${startDate} → ${endDate}\n\n` +
      `📂 IN (NF-e): ${IN}\n` +
      `📦 CTE: ${CTE}\n` +
      `🧾 IN_EVENTOS: ${IN_EVENTOS}\n\n` +
      `📊 Total enviados: ${totalEnviadas}\n\n` +
      sftpInfo
    )
  }

  // 🧠 DEMAIS MODOS — POR NOTA
  const counters = notas.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipoNota] = (acc[n.tipoNota] || 0) + 1
    return acc
  }, {})

  const detalhes = Object.entries(counters)
    .map(([tipo, total]) => `📂 ${total} arquivo(s) de ${tipo}`)
    .join('\n')

  return (
    `📤 *Mercado Livre • ${modo.replace(/_/g, ' ')}*\n` +
    `Cliente: ${clientName} (${clienteId})\n` +
    `Período: ${startDate} → ${endDate}\n\n` +
    `${detalhes}\n\n` +
    sftpInfo
  )
}
