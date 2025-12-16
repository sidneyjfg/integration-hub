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
}

export async function buscarNotasMercadoLivre(
  params: BuscarNotasParams
): Promise<MercadoLivreNotaBody[]> {

  const { clienteId, accessToken, refreshToken } = params

  console.log('[MERCADOLIVRE][BUSCA] Iniciando busca', { clienteId })

  const {
    MERCADOLIVRE_DAYS_TO_FETCH,
    MERCADOLIVRE_END_TO_FETCH
  } = mercadolivreConfig

  const startDate = calculateDate(MERCADOLIVRE_DAYS_TO_FETCH)
  const endDate = calculateDate(
    params.endOverride ?? mercadolivreConfig.MERCADOLIVRE_END_TO_FETCH
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

      totalXmlProcessados++

      const xmlData = await fs.promises.readFile(file, 'utf8')
      const parsed = await parseStringPromise(xmlData)

      const dados = extractOrderDataFromXML(parsed, file)

      if (!dados || dados.length === 0) {
        totalXmlIgnorados++
        continue
      }

      notas.push(...dados)
    }

    console.log('[MERCADOLIVRE][RESUMO BUSCA]', {
      clienteId,
      totalXmlProcessados,
      totalXmlIgnorados,
      totalNotas: notas.length
    })

    console.log('[MERCADOLIVRE][BUSCA] Retornando notas', {
      clienteId,
      totalNotas: notas.length
    })

    return notas

  } catch (error: any) {
    console.error('[MERCADOLIVRE][BUSCA][ERRO]', {
      clienteId,
      status: error?.response?.status,
      message: error.message
    })

    if (error?.response?.status === 401) {
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
        clienteId,
        accessToken: newAccessToken,
        refreshToken
      })
    }

    console.log('[MERCADOLIVRE][BUSCA] Retornando lista vazia por erro', {
      clienteId
    })

    return []
  }
}
