import fs from 'fs/promises'
import { parseStringPromise } from 'xml2js'

function normalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function countNotesByTipoNota(
  files: string[]
): Promise<Record<string, number>> {

  const counters: Record<string, number> = {}

  for (const file of files) {
    try {
      const xml = await fs.readFile(file, 'utf8')
      const parsed = await parseStringPromise(xml)

      const natOp =
        parsed?.nfeProc?.NFe?.[0]?.infNFe?.[0]?.ide?.[0]?.natOp?.[0] ??
        parsed?.NFe?.infNFe?.[0]?.ide?.[0]?.natOp?.[0]

      const tipo = natOp
        ? normalize(natOp)
        : 'outros'

      counters[tipo] = (counters[tipo] || 0) + 1

    } catch {
      counters['outros'] = (counters['outros'] || 0) + 1
    }
  }

  return counters
}
