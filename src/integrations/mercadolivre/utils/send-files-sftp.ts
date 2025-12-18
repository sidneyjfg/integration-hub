import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import { mercadolivreConfig } from '../env.schema'

export async function sendFilesViaSFTP(
  files: string[],
  remoteDir: string
): Promise<void> {

  if (!files.length) return

  const sftp = new SftpClient()

  const config: any = {
    host: mercadolivreConfig.MERCADOLIVRE_SFTP_HOST,
    port: Number(mercadolivreConfig.MERCADOLIVRE_SFTP_PORT || 22),
    username: mercadolivreConfig.MERCADOLIVRE_SFTP_USER,
    readyTimeout: 120000
  }

  if (process.env.SFTP_PRIVATE_KEY_B64) {
    config.privateKey = Buffer.from(
      process.env.SFTP_PRIVATE_KEY_B64,
      'base64'
    )
    if (process.env.SFTP_PASSPHRASE) {
      config.passphrase = process.env.SFTP_PASSPHRASE
    }
  } else {
    config.password = mercadolivreConfig.MERCADOLIVRE_SFTP_PASSWORD
  }

  try {
    await sftp.connect(config)

    for (const file of files) {
      if (!fs.existsSync(file)) {
        console.warn('[SFTP][BATCH] Arquivo não encontrado, ignorando', file)
        continue
      }

      const remotePath = path.posix.join(
        remoteDir.replace(/\\/g, '/'),
        path.basename(file)
      )

      console.log('[SFTP][BATCH] Enviando', remotePath)
      await sftp.fastPut(file, remotePath)

      // ⏳ throttle leve para não sobrecarregar o servidor
      await new Promise(r => setTimeout(r, 600))
    }

  } finally {
    await sftp.end().catch(() => {})
  }
}
