import path from 'path'
import { mercadolivreConfig } from '../../env.schema'
import SftpClient from 'ssh2-sftp-client'
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

async function enviarArquivoVonderComClient(
  sftp: SftpClient,
  file: string,
  targetRoot: string
): Promise<string | null> {

  const nome = path.basename(file)

  if (ledgerSimples.jaEnviado(nome)) {
    return null
  }

  const dir = resolverDiretorioVonder(file)
  const destino = path.posix.join(targetRoot, dir, nome)

  console.log('[VONDER][SFTP] Enviando', destino)
  await sftp.fastPut(file, destino)

  ledgerSimples.registrar([nome])
  return nome
}


export async function executarSftpVonder(
  files: string[]
): Promise<ResultadoEnvio> {
  console.log('[VONDER][SFTP] Iniciando envio de', files.length, 'arquivos')
  const sftp = new SftpClient()
  const enviados: string[] = []

  try {
    await sftp.connect({
      host: mercadolivreConfig.MERCADOLIVRE_SFTP_HOST,
      port: Number(mercadolivreConfig.MERCADOLIVRE_SFTP_PORT || 22),
      username: mercadolivreConfig.MERCADOLIVRE_SFTP_USER,
      password: mercadolivreConfig.MERCADOLIVRE_SFTP_PASSWORD,
      readyTimeout: 120000,
      keepaliveInterval: 10000
    })

    for (const file of files) {
      try {
        const enviado = await enviarArquivoVonderComClient(
          sftp,
          file,
          mercadolivreConfig.MERCADOLIVRE_SFTP_DIR!
        )

        if (enviado) {
          enviados.push(enviado)
          await new Promise(r => setTimeout(r, 300))
        }
      } catch (err) {
        console.error('[VONDER][SFTP] Erro no arquivo', { file, err })
      }
    }

  } finally {
    await sftp.end().catch(() => {})
  }

  return {
    arquivos: enviados,
    total: enviados.length
  }
}
