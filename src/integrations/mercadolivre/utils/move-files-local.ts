import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { mercadolivreConfig } from '../env.schema'

function getUidGid() {
  const uid = mercadolivreConfig.MERCADOLIVRE_SFTP_UID
  const gid = mercadolivreConfig.MERCADOLIVRE_SFTP_GID

  if (!uid || !gid) return null
  if (isNaN(Number(uid)) || isNaN(Number(gid))) return null

  return {
    uid: Number(uid),
    gid: Number(gid)
  }
}

/**
 * 📂 Move arquivos localmente
 * - Cria diretório
 * - Copia arquivo
 * - Remove original
 * - Aplica chown se SFTP_UID/GID estiverem definidos
 */
export default async function moveFilesLocal(
  files: string[],
  targetDir: string
): Promise<void> {

  const ownership = getUidGid()

  // garante diretório
  await fs.mkdir(targetDir, { recursive: true })

  // aplica ownership no diretório (se configurado)
  if (ownership && fsSync.existsSync(targetDir)) {
    try {
      await fs.chown(targetDir, ownership.uid, ownership.gid)
    } catch (err) {
      console.warn(
        '[LOCAL][CHOWN] Falha ao aplicar ownership no diretório',
        targetDir,
        err
      )
    }
  }

  for (const file of files) {
    try {
      const fileName = path.basename(file)
      const destPath = path.join(targetDir, fileName)

      await fs.access(file)
      await fs.copyFile(file, destPath)
      await fs.unlink(file)

      // aplica ownership no arquivo copiado
      if (ownership && fsSync.existsSync(destPath)) {
        try {
          await fs.chown(destPath, ownership.uid, ownership.gid)
        } catch (err) {
          console.warn(
            '[LOCAL][CHOWN] Falha ao aplicar ownership no arquivo',
            destPath,
            err
          )
        }
      }

      console.log('[LOCAL] Arquivo movido:', destPath)

    } catch (err: any) {
      console.error(
        '[LOCAL] Erro ao mover arquivo',
        file,
        err?.message || err
      )
    }
  }
}
