import fs from 'fs/promises'
import path from 'path'
import { poolMonitoramento } from './db'

export async function runHubMigrations(hub: string) {
  const dir = path.resolve('db', hub)

  try {
    const files = await fs.readdir(dir)

    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), 'utf8')
      await poolMonitoramento.query(sql)
    }
  } catch {
    // hub sem scripts → ignora
  }
}
