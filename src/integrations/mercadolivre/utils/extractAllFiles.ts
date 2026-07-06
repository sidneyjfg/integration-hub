import StreamZip from 'node-stream-zip'
import fs from 'fs'
import path from 'path'
import getAllXmlFiles from './getAllXmlFiles'

const normalizePath = (filePath: string) =>
  filePath.replace(/\\/g, '/').toLowerCase()

function filterMercadoLivreIssuedXml(files: string[]): string[] {
  const filtered = files.filter(file => {
    const normalized = normalizePath(file)

    return (
      normalized.includes('/emitidas_mercado_livre/xml/') ||
      normalized.includes('emitidas_mercado_livre/xml/')
    )
  })

  return filtered.length > 0 ? filtered : files
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
  outputDir: string
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
    const files = filterMercadoLivreIssuedXml(
      await getAllXmlFiles(outputDir)
    )

    const logPath = path.join(outputDir, 'extraction_log.txt')
    await fs.promises.writeFile(logPath, files.join('\n'))

    return files
  } finally {
    await zip.close().catch(() => {})
  }
}
