import fs from 'fs'
import path from 'path'

function nomeSeguro(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

export async function disponibilizarXmls(
  arquivos: string[],
  diretorioXml: string,
  clienteId: string,
): Promise<{ copiados: number; existentes: number }> {
  const origemBase = path.resolve(diretorioXml)
  const destinoBase = path.resolve('./notas/disponibilizados', nomeSeguro(clienteId))
  let copiados = 0
  let existentes = 0

  for (const arquivo of arquivos) {
    const origem = path.resolve(arquivo)
    const relativo = path.relative(origemBase, origem)
    if (!relativo || relativo.startsWith('..' + path.sep) || path.isAbsolute(relativo)) {
      throw new Error(`XML fora do diretório de extração: ${arquivo}`)
    }

    const destino = path.resolve(destinoBase, relativo)
    const relativoDestino = path.relative(destinoBase, destino)
    if (relativoDestino.startsWith('..' + path.sep) || path.isAbsolute(relativoDestino)) {
      throw new Error(`Caminho de XML inválido: ${arquivo}`)
    }

    await fs.promises.mkdir(path.dirname(destino), { recursive: true })
    try {
      await fs.promises.access(destino)
      existentes++
    } catch {
      await fs.promises.copyFile(origem, destino)
      copiados++
    }
  }

  return { copiados, existentes }
}
