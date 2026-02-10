import fs from 'fs/promises'
import { parseStringPromise } from 'xml2js'

export default async function filtrarPorTipoNota(
  files: string[],
  ignoreEnv?: string
): Promise<string[]> {
  if (!ignoreEnv?.trim()) return files

  const ignores = ignoreEnv
    .split(',')
    .map(v => v.trim().toUpperCase())
    .filter(Boolean)

  if (!ignores.length) return files

  const result: string[] = []

  for (const file of files) {
    try {
      const xml = await fs.readFile(file, 'utf8')
      const parsed = await parseStringPromise(xml)

      const natOp =
        parsed?.nfeProc?.NFe?.[0]?.infNFe?.[0]?.ide?.[0]?.natOp?.[0] ||
        parsed?.NFe?.infNFe?.[0]?.ide?.[0]?.natOp?.[0]

      if (!natOp) {
        result.push(file)
        continue
      }

      const tipo = String(natOp).toUpperCase()

      // 🚨 EXCEÇÃO: "Retorno de mercadoria não entregue" é devolução
      if (tipo.includes('RETORNO DE MERCADORIA NAO ENTREGUE')) {
        result.push(file)
        continue
      }

      if (ignores.some(ignore => tipo.includes(ignore))) {
        continue
      }

      result.push(file)
    } catch {
      // Falha de leitura/parsing → não bloqueia
      result.push(file)
    }
  }

  return result
}
