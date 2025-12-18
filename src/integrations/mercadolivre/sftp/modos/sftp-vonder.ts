import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import { sendFilesViaSFTP } from '../../utils'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota
} from '../../utils'

import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'

/**
 * 🔵 Fluxo SFTP VONDER
 * - Usa ledgerSimples (local e persistente)
 * - Classifica arquivos em IN / IN_EVENTOS / CTE
 * - NÃO confia no SFTP (arquivos são consumidos)
 */
export async function executarSftpVonder(
  files: string[]
): Promise<ResultadoEnvio> {

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

  // -----------------------------
  // 2️⃣ Ledger (ANTES de enviar)
  // -----------------------------
  const novos = filtrados.filter(
    f => !ledgerSimples.jaEnviado(path.basename(f))
  )

  if (!novos.length) {
    console.log('[VONDER][SFTP] Nenhum arquivo novo após ledger')
    return { arquivos: [], total: 0 }
  }

  // -----------------------------
  // 3️⃣ Classificação VONDER
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

  const paraIN = novos.filter(
    f => !isEventoNFe(f) && !isCTe(f)
  )

  const paraEVENTOS = novos.filter(isEventoNFe)
  const paraCTE = novos.filter(isCTe)

  // -----------------------------
  // 4️⃣ Envio por bucket
  // -----------------------------
  const join = (dir: string) =>
    path.posix.join(MERCADOLIVRE_SFTP_DIR!, dir)

  let enviados = 0

  if (paraIN.length) {
    await sendFilesViaSFTP(paraIN, join('IN'))
    enviados += paraIN.length
  }

  if (paraEVENTOS.length) {
    await sendFilesViaSFTP(paraEVENTOS, join('IN_EVENTOS'))
    enviados += paraEVENTOS.length
  }

  if (paraCTE.length) {
    await sendFilesViaSFTP(paraCTE, join('CTE'))
    enviados += paraCTE.length
  }

  // -----------------------------
  // 5️⃣ Registrar no ledger (APÓS sucesso)
  // -----------------------------
  ledgerSimples.registrar(
    novos.map(f => path.basename(f))
  )

  console.log('[VONDER][SFTP] Envio concluído', {
    IN: paraIN.length,
    EVENTOS: paraEVENTOS.length,
    CTE: paraCTE.length,
    TOTAL: enviados
  })

  return {
    arquivos: novos.map(f => path.basename(f)),
    total: enviados
  }
}
