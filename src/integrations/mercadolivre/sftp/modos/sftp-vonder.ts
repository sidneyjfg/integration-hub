import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import { sendFilesViaSFTP } from '../../utils'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota
} from '../../utils'

/**
 * 🔵 Fluxo SFTP VONDER (fixo)
 * - Bucket IN / IN_EVENTOS / CTE
 * - Sem ledger
 */
export async function executarSftpVonder(
  files: string[]
): Promise<number> {

  const {
    MERCADOLIVRE_SFTP_DIR,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  } = mercadolivreConfig

  // -----------------------------
  // 1️⃣ Filtros globais
  // -----------------------------
  let filtrados = filtrarPorIgnoreEndFile(
    files,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE
  )

  filtrados = await filtrarPorTipoNota(
    filtrados,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  )

  if (!filtrados.length) {
    console.log('[VONDER][SFTP] Nenhum arquivo após filtros')
    return 0
  }

  // -----------------------------
  // 2️⃣ Classificação VONDER
  // -----------------------------
  const isEventoNFe = (file: string) => {
    const n = file.toLowerCase()
    if (n.includes('cte') || n.includes('ct-e')) return false
    if (n.includes('procevento')) return true
    if (n.includes('evento') && !n.includes('procnfe')) return true
    if (n.includes('inutnfe')) return true
    return false
  }

  const isCTe = (file: string) => {
    const n = file.toLowerCase()
    return n.includes('cte') || n.includes('ct-e') || n.includes('proccte')
  }

  const paraIN = filtrados.filter(
    f => !isEventoNFe(f) && !isCTe(f)
  )

  const paraEVENTOS = filtrados.filter(isEventoNFe)
  const paraCTE = filtrados.filter(isCTe)

  // -----------------------------
  // 3️⃣ Envio por bucket
  // -----------------------------
  const join = (dir: string) =>
    path.posix.join(MERCADOLIVRE_SFTP_DIR!, dir)

  if (paraIN.length) {
    await sendFilesViaSFTP(paraIN, join('IN'))
  }

  if (paraEVENTOS.length) {
    await sendFilesViaSFTP(paraEVENTOS, join('IN_EVENTOS'))
  }

  if (paraCTE.length) {
    await sendFilesViaSFTP(paraCTE, join('CTE'))
  }

  const totalEnviado =
    paraIN.length + paraEVENTOS.length + paraCTE.length

  console.log('[VONDER][SFTP] Envio concluído', {
    IN: paraIN.length,
    EVENTOS: paraEVENTOS.length,
    CTE: paraCTE.length,
    TOTAL: totalEnviado
  })

  return totalEnviado
}
