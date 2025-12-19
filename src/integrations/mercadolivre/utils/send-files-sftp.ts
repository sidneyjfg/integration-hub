import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import { mercadolivreConfig } from '../env.schema'

export async function sendFilesViaSFTP(
  files: string[],
  remoteDir: string,
  tentativas = 3
): Promise<string[]> {

  const enviados: string[] = []
  let index = 0

  while (index < files.length) {
    let tentativa = 1

    while (tentativa <= tentativas) {
      const sftp = new SftpClient()

      try {
        const config: any = {
          host: mercadolivreConfig.MERCADOLIVRE_SFTP_HOST,
          port: Number(mercadolivreConfig.MERCADOLIVRE_SFTP_PORT || 22),
          username: mercadolivreConfig.MERCADOLIVRE_SFTP_USER,
          password: mercadolivreConfig.MERCADOLIVRE_SFTP_PASSWORD,
          readyTimeout: 180000,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3
        }

        await sftp.connect(config)

        // continua do último arquivo não enviado
        for (; index < files.length; index++) {
          const file = files[index]

          if (!fs.existsSync(file)) {
            console.warn('[SFTP][BATCH] Arquivo não encontrado, pulando', file)
            continue
          }

          const remotePath = path.posix.join(
            remoteDir.replace(/\\/g, '/'),
            path.basename(file)
          )

          console.log('[SFTP][BATCH] Enviando', remotePath)
          await sftp.fastPut(file, remotePath)

          enviados.push(path.basename(file))

          // throttle conservador
          await new Promise(r => setTimeout(r, 600))
        }

        await sftp.end()
        return enviados // ✅ todos enviados

      } catch (err) {
        await sftp.end().catch(() => {})

        console.warn(
          `[SFTP][BATCH] Erro na conexão (tentativa ${tentativa}/${tentativas}), retomando...`,
          (err as any)?.code
        )

        tentativa++

        if (tentativa > tentativas) {
          throw new Error(
            `[SFTP][BATCH] Falha definitiva ao enviar arquivos. Enviados até agora: ${enviados.length}/${files.length}`
          )
        }

        // backoff real
        await new Promise(r => setTimeout(r, 5000))
      }
    }
  }

  return enviados
}
