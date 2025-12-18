import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import { mercadolivreConfig } from '../env.schema'

export default async function sendFilesViaSFTP(
  file: string,
  remoteDir: string,
  tentativas = 3
): Promise<void> {

  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo não existe: ${file}`)
  }

  const remoteRoot = remoteDir.replace(/\\/g, '/')
  const remotePath = path.posix.join(remoteRoot, path.basename(file))

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const sftp = new SftpClient()

    try {
      const config: any = {
        host: mercadolivreConfig.MERCADOLIVRE_SFTP_HOST,
        port: Number(mercadolivreConfig.MERCADOLIVRE_SFTP_PORT || 22),
        username: mercadolivreConfig.MERCADOLIVRE_SFTP_USER,
        readyTimeout: 60000
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

      await sftp.connect(config)

      console.log('[SFTP] Enviando', remotePath)
      await sftp.fastPut(file, remotePath)

      await sftp.end()
      return

    } catch (err: any) {
      await sftp.end().catch(() => {})

      if (tentativa === tentativas) {
        throw err
      }

      console.warn(
        `[SFTP] Falha tentativa ${tentativa}, retry em 2s`,
        err?.code
      )

      await new Promise(r => setTimeout(r, 2000))
    }
  }
}
