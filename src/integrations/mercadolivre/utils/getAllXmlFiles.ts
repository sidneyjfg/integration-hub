import { promises as fs } from 'fs'
import fsSync from 'fs'
import path from 'path'

/**
 * Percorre recursivamente um diretório e retorna
 * todos os arquivos XML encontrados.
 */
export default async function getAllXmlFiles(dir: string): Promise<string[]> {
  let xmlFiles: string[] = []

  if (!fsSync.existsSync(dir)) {
    return xmlFiles
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      xmlFiles = xmlFiles.concat(await getAllXmlFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.xml')) {
      xmlFiles.push(fullPath)
    }
  }

  return xmlFiles
}
