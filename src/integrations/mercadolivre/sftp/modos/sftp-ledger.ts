import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import { filtrarPorIgnoreEndFile, filtrarPorTipoNota } from '../../utils'
import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'
import { sendFilesViaSFTP } from '../../utils/send-files-sftp'

export async function executarSftpLedger(
  files: string[]
): Promise<ResultadoEnvio> {
  console.log('[SFTP][LEDGER] Iniciando envio via SFTP com ledger')
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
  console.log(novos.length, 'arquivo(s) novos para enviar via SFTP');
  if (!novos.length) {
    return { arquivos: [], total: 0 }
  }

  const enviados = await sendFilesViaSFTP(novos, MERCADOLIVRE_SFTP_DIR!)

  ledgerSimples.registrar(enviados)

  return {
    arquivos: enviados,        // ✅ SOMENTE os realmente enviados
    total: enviados.length
  }
}
