import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import {
  filtrarPorIgnoreEndFile,
  filtrarPorTipoNota,
  sendFilesViaSFTP
} from '../../utils'
import { ledgerSimples } from '../ledger-simples'
import { ResultadoEnvio } from '../../../../shared/types'


function resolverDiretorioVonder(file: string): string {
  const lower = file.toLowerCase()

  if (
    lower.includes('evento') ||
    lower.includes('procevento') ||
    lower.includes('inutnfe')
  ) {
    return 'IN_EVENTOS'
  }

  if (
    lower.includes('cte') ||
    lower.includes('ct-e') ||
    lower.includes('proccte')
  ) {
    return 'CTE'
  }

  return 'IN'
}

async function enviarArquivoVonder(
  file: string,
  targetRoot: string
): Promise<string | null> {

  const nome = path.basename(file)

  if (ledgerSimples.jaEnviado(nome)) {
    return null
  }

  const dir = resolverDiretorioVonder(file)
  const destino = path.posix.join(targetRoot, dir)

  await sendFilesViaSFTP(file, destino)

  // ✅ Ledger somente após sucesso real
  ledgerSimples.registrar([nome])

  return nome
}

export async function executarSftpVonder(
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

  const enviados: string[] = []

  for (const file of filtrados) {
    try {
      const enviado = await enviarArquivoVonder(
        file,
        MERCADOLIVRE_SFTP_DIR!
      )

      if (enviado) {
        enviados.push(enviado)
        await new Promise(r => setTimeout(r, 500)) // throttle seguro
      }
    } catch (err) {
      console.error('[VONDER][SFTP] Falha ao enviar arquivo', {
        file,
        err
      })
      // ⚠️ Não registra ledger, permitindo retry
    }
  }

  return {
    arquivos: enviados,
    total: enviados.length
  }
}

