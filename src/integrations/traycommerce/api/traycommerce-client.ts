// src/integrations/traycommerce/api/traycommerce-client.ts
import axios, { AxiosResponse } from 'axios'
import { traycommerceConfig } from '../env.schema'
import { getDateRange } from '../utils'
import {
  TraycommerceOrderApi,
  TraycommerceOrdersApiResponse
} from '../../../shared/types/traycommerce'

const RATE_LIMIT = 120
const WINDOW_MS = 60000
const TIMEOUT_MS = 15000
const MAX_TENTATIVAS = 5
const LIMITE_POR_PAGINA = 100

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 🔥 Parse único (fora da função)
const STATUS_MONITORADOS = new Set(
  (traycommerceConfig.TRAYCOMMERCE_ORDER_STATUS_TO_GET || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

/**
 * 🔑 Autentica na TrayCommerce e devolve o access token.
 * A API usa POST /auth com consumer_key, consumer_secret e code.
 */
export async function getAccessToken(): Promise<string> {
  const { TRAYCOMMERCE_URL, TRAYCOMMERCE_CONSUMER_KEY, TRAYCOMMERCE_SECRET_KEY, TRAYCOMMERCE_CODE } =
    traycommerceConfig

  try {
    const response: AxiosResponse<{ access_token?: string }> = await axios.post(
      `${TRAYCOMMERCE_URL.replace(/\/+$/, '')}/auth`,
      {
        consumer_key: TRAYCOMMERCE_CONSUMER_KEY,
        consumer_secret: TRAYCOMMERCE_SECRET_KEY,
        code: TRAYCOMMERCE_CODE
      },
      { timeout: TIMEOUT_MS }
    )

    const token = response.data?.access_token

    if (!token) {
      throw new Error('TrayCommerce não retornou access_token')
    }

    return token
  } catch (erro: any) {
    console.error('[TRAYCOMMERCE][AUTH] Erro ao obter token', erro.message)
    throw erro
  }
}

/**
 * 🔁 Busca uma página com retry e backoff (429)
 */
async function buscarPaginaComRetry(
  urlFinal: string,
  token: string,
  pagina: number
) {
  let tentativas = 0

  while (true) {
    try {
      const response: AxiosResponse<TraycommerceOrdersApiResponse> =
        await axios.get(urlFinal, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          },
          timeout: TIMEOUT_MS
        })

      return response.data
    } catch (erro: any) {
      const status = erro.response?.status

      if (status !== 429) {
        console.error(
          `[TRAYCOMMERCE][SYNC] Erro na página ${pagina}`,
          erro.message
        )
        throw erro
      }

      tentativas++

      if (tentativas > MAX_TENTATIVAS) {
        throw new Error('Rate limit persistente na TrayCommerce')
      }

      const backoff = Math.min(60, 5 * Math.pow(2, tentativas))
      console.log(
        `[TRAYCOMMERCE][SYNC] Rate limit (429). Tentativa ${tentativas}/${MAX_TENTATIVAS}. Aguardando ${backoff}s`
      )

      await sleep(backoff * 1000)
    }
  }
}

export type BuscarPedidosTraycommerceResumo = {
  totalPedidos: number
  ignorados: number
  statusIgnorados: string[]
}

let ultimoResumoBuscaPedidos: BuscarPedidosTraycommerceResumo = {
  totalPedidos: 0,
  ignorados: 0,
  statusIgnorados: Array.from(STATUS_MONITORADOS)
}

export function getUltimoResumoBuscaPedidosTraycommerce(): BuscarPedidosTraycommerceResumo {
  return ultimoResumoBuscaPedidos
}

/**
 * 🔎 Busca pedidos da TrayCommerce paginados, filtrando por data e status.
 */
export async function buscarPedidosTraycommerce(): Promise<
  TraycommerceOrderApi[]
> {
  console.log('[TRAYCOMMERCE][SYNC] Iniciando busca de pedidos')

  const token = await getAccessToken()
  const { from, to } = getDateRange()
  console.log('[TRAYCOMMERCE][SYNC] Período de busca', { from, to })

  const pedidos: TraycommerceOrderApi[] = []
  let pagina = 1
  let requisicoes = 0
  let inicioJanela = Date.now()
  let ignorados = 0

  try {
    while (true) {
      const agora = Date.now()

      if (agora - inicioJanela >= WINDOW_MS) {
        requisicoes = 0
        inicioJanela = agora
      }

      if (requisicoes >= RATE_LIMIT) {
        const espera = WINDOW_MS - (agora - inicioJanela)
        console.log(
          `[TRAYCOMMERCE][SYNC] Rate limit local atingido. Esperando ${Math.ceil(espera / 1000)}s`
        )
        await sleep(espera)
        continue
      }

      const urlFinal =
        `${traycommerceConfig.TRAYCOMMERCE_URL.replace(/\/+$/, '')}/orders` +
        `?limit=${LIMITE_POR_PAGINA}&page=${pagina}&date=${from},${to}`

      console.log('[TRAYCOMMERCE][SYNC] Buscando página', { pagina, from, to })

      requisicoes++

      const dados = await buscarPaginaComRetry(urlFinal, token, pagina)
      const lote = dados?.Orders || []

      console.log('[TRAYCOMMERCE][SYNC] Página recebida', {
        pagina,
        registros: lote.length
      })

      if (lote.length === 0) {
        console.log('[TRAYCOMMERCE][SYNC] Página vazia. Fim.')
        break
      }

      for (const item of lote) {
        const o = item.Order
        const status = String(o?.OrderStatus?.id ?? '').trim()

        if (!STATUS_MONITORADOS.has(status)) {
          ignorados++
          continue
        }

        pedidos.push(o)
      }

      pagina++
    }

    console.log('[TRAYCOMMERCE][SYNC] Busca finalizada', {
      totalPedidos: pedidos.length,
      ignorados
    })

    ultimoResumoBuscaPedidos = {
      totalPedidos: pedidos.length,
      ignorados,
      statusIgnorados: Array.from(STATUS_MONITORADOS)
    }

    return pedidos
  } catch (erro) {
    console.error('[TRAYCOMMERCE][SYNC] Erro ao buscar pedidos', erro)
    throw erro
  }
}
