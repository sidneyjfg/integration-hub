import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota,
  moveFilesLocal
} from '../../utils'

import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'

export async function executarLocalLedger(
  files: string[]
): Promise<ResultadoEnvio> {
  console.log('[LOCAL][LEDGER] Iniciando envio local com ledger')
  const {
    MERCADOLIVRE_SFTP_DIR,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  } = mercadolivreConfig

  let filtrados = filtrarPorIgnoreEndFile(
    files,
    MERCADOLIVRE_SFTP_IGNORE_END_FILE
  )

  filtrados = await filtrarPorTipoNota(
    filtrados,
    MERCADOLIVRE_SFTP_IGNORE_TIPO_NOTA
  )

  const novos = filtrados.filter(
    f => !ledgerSimples.jaEnviado(path.basename(f))
  )

  if (!novos.length) {
    console.log('[LOCAL][LEDGER] Nenhum arquivo novo para mover')
    return { arquivos: [], total: 0 }
  }

  await moveFilesLocal(novos, MERCADOLIVRE_SFTP_DIR)

  ledgerSimples.registrar(novos.map(f => path.basename(f)))

  console.log('[LOCAL][LEDGER] Arquivos movidos', { total: novos.length })

  return {
    arquivos: novos.map(f => path.basename(f)),
    total: novos.length
  }
}
