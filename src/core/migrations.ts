import fs from 'fs/promises'
import path from 'path'
import { poolMonitoramento } from './db'

export async function runHubMigrations(hub: string) {
  const dir = path.resolve('db', hub)

  let files: string[]

  try {
    files = (await fs.readdir(dir)).sort()
  } catch {
    console.warn(`[MIGRATION] Nenhum script encontrado para hub ${hub}`)
    return
  }

  for (const file of files) {
    const fullPath = path.join(dir, file)

    try {
      const sql = await fs.readFile(fullPath, 'utf8')
      await poolMonitoramento.query(sql)

      console.log(`[MIGRATION] ${hub}/${file} aplicado`)
    } catch (err: any) {
      // ✅ Ignora coluna já existente
      if (
        err?.code === 'ER_DUP_FIELDNAME' ||
        err?.errno === 1060
      ) {
        console.warn(
          `[MIGRATION] ${hub}/${file} ignorado (coluna já existe)`
        )
        continue
      }

      // ❌ Qualquer outro erro é crítico
      console.error(
        `[MIGRATION ERROR] ${hub}/${file}`,
        err
      )
      throw err
    }
  }
}
