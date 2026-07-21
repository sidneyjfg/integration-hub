import StreamZip from 'node-stream-zip'
import fs from 'fs'
import path from 'path'
import getAllXmlFiles from './getAllXmlFiles'

const normalizePath = (filePath: string) =>
  filePath.replace(/\\/g, '/').toLowerCase()

export function filterIssuedXml(
  files: string[],
  includeOtherErp = false
): string[] {
  const filtered = files.filter(file => {
    const normalized = normalizePath(file)
    const isMercadoLivre =
      normalized.includes('/emitidas_mercado_livre/xml/') ||
      normalized.includes('emitidas_mercado_livre/xml/')
    const isOtherErp =
      normalized.includes('/emitidas_outros_erp/xml/') ||
      normalized.includes('emitidas_outros_erp/xml/')

    return isMercadoLivre || (includeOtherErp && isOtherErp)
  })

  if (filtered.length > 0) return filtered

  // Mantem o fallback para ZIPs sem a estrutura conhecida, mas nunca importa
  // emitidas_outros_erp enquanto a opcao estiver desabilitada.
  return includeOtherErp
    ? files
    : files.filter(file =>
        !normalizePath(file).includes('emitidas_outros_erp/xml/')
      )
}

async function waitForStableFile(
  filePath: string,
  stableMs = 800
): Promise<void> {
  let lastSize = -1
  let stableTime = 0

  while (stableTime < stableMs) {
    if (!fs.existsSync(filePath)) {
      await new Promise(res => setTimeout(res, 200))
      continue
    }

    const size = fs.statSync(filePath).size

    if (size === lastSize && size > 0) stableTime += 200
    else {
      stableTime = 0
      lastSize = size
    }

    await new Promise(res => setTimeout(res, 200))
  }
}

function isValidZip(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const header = Buffer.alloc(4)
    fs.readSync(fd, header, 0, 4, 0)
    fs.closeSync(fd)
    return header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  } catch {
    return false
  }
}

export default async function extractAllFiles(
  zipPath: string,
  outputDir: string,
  includeOtherErp = false
): Promise<string[]> {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP não encontrado: ${zipPath}`)
  }

  await waitForStableFile(zipPath)

  if (!isValidZip(zipPath)) {
    throw new Error('Arquivo ZIP inválido')
  }

  const zip = new StreamZip.async({ file: zipPath })

  try {
    await zip.extract(null, outputDir)
    const files = filterIssuedXml(
      await getAllXmlFiles(outputDir),
      includeOtherErp
    )

    const logPath = path.join(outputDir, 'extraction_log.txt')
    await fs.promises.writeFile(logPath, files.join('\n'))

    return files
  } finally {
    await zip.close().catch(() => {})
  }
}
