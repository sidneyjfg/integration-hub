import { mercadolivreConfig } from '../../env.schema'
import { filtrarPorIgnoreEndFile, filtrarPorTipoNota, moveFilesLocal } from '../../utils'


import path from 'path'
import { ResultadoEnvio } from '../../../../shared/types'

export async function executarLocalSimples(
  files: string[]
): Promise<ResultadoEnvio> {

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

  if (!filtrados.length) {
    return { arquivos: [], total: 0 }
  }

  await moveFilesLocal(filtrados, MERCADOLIVRE_SFTP_DIR)

  return {
    arquivos: filtrados.map(f => path.basename(f)),
    total: filtrados.length
  }
}

