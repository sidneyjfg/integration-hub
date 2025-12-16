import path from 'path'
import fs from 'fs'

/**
 * Deleta ZIP e diretório XML (com retry defensivo)
 */
export default async function deleteFiles(
  zipPath: string,
  xmlDirectory: string
): Promise<void> {
  try {
    if (fs.existsSync(xmlDirectory)) {
      const files = await fs.promises.readdir(xmlDirectory)

      for (const file of files) {
        const filePath = path.join(xmlDirectory, file)
        try {
          await fs.promises.unlink(filePath)
          console.log(`[DELETE] Arquivo XML deletado: ${filePath}`)
        } catch (err: any) {
          console.error(
            `[ERROR] Falha ao deletar arquivo ${filePath}:`,
            err.message
          )
        }
      }

      try {
        await fs.promises.rm(xmlDirectory, { recursive: true, force: true })
        console.log(`[CLEANUP] Diretório de XML deletado: ${xmlDirectory}`)
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          await new Promise(res => setTimeout(res, 1000))
          await fs.promises.rm(xmlDirectory, { recursive: true, force: true })
        } else {
          throw err
        }
      }
    }

    if (fs.existsSync(zipPath)) {
      await fs.promises.unlink(zipPath)
      console.log(`[DELETE] Arquivo ZIP deletado: ${zipPath}`)
    }
  } catch (err: any) {
    console.error('[ERROR] Falha ao deletar arquivos:', err.message)
  }
}
