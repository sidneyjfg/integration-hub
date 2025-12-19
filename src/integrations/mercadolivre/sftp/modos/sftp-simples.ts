import { mercadolivreConfig } from '../../env.schema'
import { filtrarPorIgnoreEndFile, filtrarPorTipoNota } from '../../utils'
import { sendFilesViaSFTP } from '../../utils/send-files-sftp'

export async function executarSftpSimples(
  files: string[]
): Promise<void> {
  console.log('[SFTP][SIMPLES] Iniciando envio via SFTP simples')
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

  if (!filtrados.length) return

  await sendFilesViaSFTP(filtrados, MERCADOLIVRE_SFTP_DIR!)
}
