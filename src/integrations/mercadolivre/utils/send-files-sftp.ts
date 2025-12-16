import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'

export default async function sendFilesViaSFTP(
  files: string[],
  remoteDir: string
): Promise<void> {

  const sftp = new SftpClient()

  const config: any = {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT || 22),
    username: process.env.SFTP_USER,
    readyTimeout: 30000
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
    config.password = process.env.SFTP_PASSWORD
  }

  const remoteRoot = remoteDir.replace(/\\/g, '/')

  try {
    await sftp.connect(config)

    const exists = await sftp.exists(remoteRoot)
    if (!exists) {
      throw new Error(`Diretório SFTP inexistente: ${remoteRoot}`)
    }

    for (const file of files) {
      if (!fs.existsSync(file)) continue

      const remotePath =
        path.posix.join(remoteRoot, path.basename(file))

      const already = await sftp.exists(remotePath)
      if (already) {
        console.log('[SFTP] Já existe, ignorando', remotePath)
        continue
      }

      console.log('[SFTP] Enviando', remotePath)
      await sftp.fastPut(file, remotePath)
    }

  } finally {
    await sftp.end()
  }
}
