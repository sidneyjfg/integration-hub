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
    } catch (err) {
      console.error(
        `[MIGRATION ERROR] ${hub}/${file}`,
        err
      )
      throw err // 👈 FAIL FAST (correto)
    }
  }
}
