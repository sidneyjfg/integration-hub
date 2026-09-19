import axios from 'axios'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { parseStringPromise } from 'xml2js'

import { mercadolivreConfig } from '../env.schema'
import {
  calculateDate,
  deleteFiles,
  extractAllFiles,
  extractOrderDataFromXML,
  getNotasWorkspace
} from '../utils'

import { MercadoLivreNotaBody } from '../../../shared/types'
import { cacheAccessToken, refreshAccessToken } from './auth'

type BuscarNotasParams = {
  clienteId: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  endOverride?: number
  sftpMode?: boolean
}

type BuscarNotasResult = {
  notas: MercadoLivreNotaBody[]
  startDate: string
  endDate: string
}

const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

const MAX_ZIP_DOWNLOAD_ATTEMPTS = 3

function isRetryableZipError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /bad archive|arquivo zip inv[aá]lido|zip vazio|incompleto|archive read error|unexpected end/i.test(
    message
  )
}

async function baixarEExtrairZip(
  url: string,
  headers: { Authorization: string },
  zipPath: string,
  outputDir: string,
  xmlDir: string,
  clienteId: string,
  includeOtherErp: boolean
): Promise<string[]> {
  let ultimoErro: unknown

  for (let tentativa = 1; tentativa <= MAX_ZIP_DOWNLOAD_ATTEMPTS; tentativa++) {
    const temporaryZipPath = `${zipPath}.${process.pid}.${Date.now()}.${tentativa}.part`

    try {
      console.log('[MERCADOLIVRE][DOWNLOAD] Iniciando ZIP', {
        clienteId,
        tentativa,
        totalTentativas: MAX_ZIP_DOWNLOAD_ATTEMPTS
      })

      const response = await axios.get(url, {
        headers,
        responseType: 'stream'
      })

      console.log('[MERCADOLIVRE][DOWNLOAD] Status', {
        clienteId,
        tentativa,
        status: response.status,
        contentType: response.headers?.['content-type'],
        contentLength: response.headers?.['content-length']
      })

      await pipeline(response.data, fs.createWriteStream(temporaryZipPath))

      const zipStats = await fs.promises.stat(temporaryZipPath)
      if (zipStats.size < 4) {
        throw new Error(`ZIP vazio ou incompleto (${zipStats.size} bytes)`)
      }

      // O nome final só passa a existir depois que o download terminou.
      await fs.promises.rename(temporaryZipPath, zipPath)

      console.log('[MERCADOLIVRE][ZIP] Download finalizado', {
        clienteId,
        zipPath,
        bytes: zipStats.size,
        tentativa
      })

      return await extractAllFiles(zipPath, outputDir, includeOtherErp)
    } catch (error) {
      ultimoErro = error

      await fs.promises.rm(temporaryZipPath, { force: true }).catch(() => {})

      if (!isRetryableZipError(error) || tentativa === MAX_ZIP_DOWNLOAD_ATTEMPTS) {
        throw error
      }

      console.warn('[MERCADOLIVRE][ZIP] Arquivo inválido; repetindo download', {
        clienteId,
        tentativa,
        erro: error instanceof Error ? error.message : String(error)
      })

      // Remove o ZIP e eventuais XMLs extraídos parcialmente antes da tentativa seguinte.
      await deleteFiles(zipPath, xmlDir)
      await delay(1000 * tentativa)
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error('Não foi possível baixar o ZIP do Mercado Livre')
}

export async function buscarNotasMercadoLivre(
  params: BuscarNotasParams
): Promise<BuscarNotasResult> {

  const {
    clienteId,
    clientId,
    clientSecret,
    accessToken,
    refreshToken,
    sftpMode = false
  } = params


  console.log('[MERCADOLIVRE][BUSCA] Iniciando busca', {
    clienteId,
    sftpMode
  })

  const {
    MERCADOLIVRE_DAYS_TO_FETCH,
    MERCADOLIVRE_END_TO_FETCH,
    MERCADOLIVRE_IMPORTA_EMITIDAS_OUTROS_ERP
  } = mercadolivreConfig

  const startDate = calculateDate(MERCADOLIVRE_DAYS_TO_FETCH)
  const endDate = calculateDate(
    params.endOverride ?? MERCADOLIVRE_END_TO_FETCH
  )

  const url =
    `https://api.mercadolibre.com/users/${clienteId}` +
    `/invoices/sites/MLB/batch_request/period/stream` +
    `?start=${startDate}&end=${endDate}` +
    `&sale=all&return=all&full=all&others=all` +
    `&file_types=xml`

  console.log('[MERCADOLIVRE][BUSCA] URL', { url })

  const headers = {
    Authorization: `Bearer ${accessToken}`
  }

  cacheAccessToken(clienteId, accessToken)

  const { baseDir: outputDir, xmlDir } = getNotasWorkspace(sftpMode)
  const zipPath = `${outputDir}/notas_${clienteId}.zip`

  try {
    await deleteFiles(zipPath, xmlDir)
    await fs.promises.mkdir(outputDir, { recursive: true })

    const extractedFiles = await baixarEExtrairZip(
      url,
      headers,
      zipPath,
      outputDir,
      xmlDir,
      clienteId,
      MERCADOLIVRE_IMPORTA_EMITIDAS_OUTROS_ERP
    )

    console.log('[MERCADOLIVRE][ZIP] Extração concluída', {
      clienteId,
      totalArquivos: extractedFiles.length
    })

    // 🔧 ordenar para processar EVENTOS por último
    extractedFiles.sort((a, b) => {

      const aEvento = a.includes('procEventoNFe')
      const bEvento = b.includes('procEventoNFe')

      if (aEvento && !bEvento) return 1
      if (!aEvento && bEvento) return -1

      return 0
    })

    const notas: MercadoLivreNotaBody[] = []
    let totalXmlProcessados = 0
    let totalXmlIgnorados = 0

    for (const file of extractedFiles) {
      if (!file.endsWith('.xml')) continue

      // 🚫 ignora CT-e quando NÃO for SFTP
      if (!sftpMode && file.includes('CT_e')) {
        console.log('[MERCADOLIVRE][IGNORADO][CTE]', {
          file,
          motivo: 'Busca normal (sftpMode=false)'
        })
        totalXmlIgnorados++
        continue
      }

      totalXmlProcessados++

      const xmlData = await fs.promises.readFile(file, 'utf8')
      const trimmed = xmlData.trim()

      // 🚫 não é XML (JSON / HTML / vazio)
      if (!trimmed.startsWith('<')) {
        console.warn('[MERCADOLIVRE][XML INVALIDO]', {
          file,
          preview: trimmed.slice(0, 200)
        })
        totalXmlIgnorados++
        continue
      }

      let parsed: any
      try {
        parsed = await parseStringPromise(trimmed)
      } catch (err: any) {
        console.warn('[MERCADOLIVRE][XML MALFORMADO]', {
          file,
          erro: err.message
        })
        totalXmlIgnorados++
        continue
      }

      const dados = extractOrderDataFromXML(parsed, file)

      if (!dados || dados.length === 0) {
        totalXmlIgnorados++
        continue
      }

      notas.push(...dados)
    }

    console.log('[MERCADOLIVRE][RESUMO BUSCA]', {
      clienteId,
      startDate,
      endDate,
      modo: sftpMode ? 'SFTP' : 'NORMAL',
      totalXmlProcessados,
      totalXmlIgnorados,
      totalNotas: notas.length
    })

    return {
      notas,
      startDate,
      endDate
    }

  } catch (error: any) {
    const status = error?.response?.status

    console.error('[MERCADOLIVRE][BUSCA][ERRO]', {
      clienteId,
      status,
      message: error.message
    })

    // 🔁 429 → retry
    if (status === 429) {
      console.warn('[MERCADOLIVRE][RATE LIMIT] 429 recebido. Aguardando 3 minutos...', {
        clienteId
      })

      await delay(3 * 60 * 1000)
      return buscarNotasMercadoLivre(params)
    }

    // 🔐 401 → refresh token
    if (status === 401) {
      console.log('[MERCADOLIVRE][AUTH] Token expirado, tentando refresh', {
        clienteId
      })

      const newAccessToken = await refreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
        clienteId
      })

      return buscarNotasMercadoLivre({
        ...params,
        accessToken: newAccessToken
      })
    }

    console.log('[MERCADOLIVRE][BUSCA] Retornando lista vazia por erro não tratável', {
      clienteId
    })

    return {
      notas: [],
      startDate,
      endDate
    }
  }
}
