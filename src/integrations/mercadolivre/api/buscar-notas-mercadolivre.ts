import axios from 'axios'
import fs from 'fs'
import { parseStringPromise } from 'xml2js'

import { mercadolivreConfig } from '../env.schema'
import {
  calculateDate,
  deleteFiles,
  extractAllFiles,
  extractOrderDataFromXML
} from '../utils'

import { MercadoLivreNotaBody } from '../../../shared/types'
import { refreshAccessToken } from './auth'

type BuscarNotasParams = {
  clienteId: string
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


export async function buscarNotasMercadoLivre(
  params: BuscarNotasParams
): Promise<BuscarNotasResult> {

  const {
    clienteId,
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
    MERCADOLIVRE_END_TO_FETCH
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
    `&file_types=xml&simple_folder=true`

  console.log('[MERCADOLIVRE][BUSCA] URL', { url })

  const headers = {
    Authorization: `Bearer ${accessToken}`
  }

  const outputDir = './notas'
  const zipPath = `${outputDir}/notas_${clienteId}.zip`

  try {
    await deleteFiles(zipPath, `${outputDir}/xml`)
    await fs.promises.mkdir(outputDir, { recursive: true })

    console.log('[MERCADOLIVRE][DOWNLOAD] Iniciando ZIP', { clienteId })

    const response = await axios.get(url, {
      headers,
      responseType: 'stream'
    })

    console.log('[MERCADOLIVRE][DOWNLOAD] Status', {
      clienteId,
      status: response.status
    })

    const zipFile = fs.createWriteStream(zipPath)
    response.data.pipe(zipFile)

    await new Promise<void>((resolve, reject) => {
      zipFile.on('finish', resolve)
      zipFile.on('error', reject)
    })

    console.log('[MERCADOLIVRE][ZIP] Download finalizado', { zipPath })

    const extractedFiles = await extractAllFiles(zipPath, outputDir)

    console.log('[MERCADOLIVRE][ZIP] Extração concluída', {
      clienteId,
      totalArquivos: extractedFiles.length
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
        clientId: mercadolivreConfig.MERCADOLIVRE_CLIENT_ID,
        clientSecret: mercadolivreConfig.MERCADOLIVRE_CLIENT_SECRET,
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
