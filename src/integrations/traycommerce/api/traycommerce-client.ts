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
const BASE_DELAY_MS = 1000
const JITTER_MS = 500
// A API aceita mais, mas corta o que vem acima de 50; 50 evita mandar inutil.
const LIMITE_POR_PAGINA = 50

// 408 e 5xx sao transitórios, igual ao retry do nerus-sync-hub
const STATUS_RETRYABLES = new Set([408, 429, 500, 502, 503, 504])

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
 * 🔁 Busca uma página com retry e backoff.
 * A TrayCommerce responde 429 quando o limite de chamadas estoura, mas
 * 5xx e 408 também são transitórios, então entram no mesmo retry.
 */
async function buscarPaginaComRetry(
  urlFinal: string,
  pagina: number
) {
  let tentativas = 0

  while (true) {
    try {
      const response: AxiosResponse<TraycommerceOrdersApiResponse> =
        await axios.get(urlFinal, {
          headers: { Accept: 'application/json' },
          timeout: TIMEOUT_MS
        })

      return response.data
    } catch (erro: any) {
      const status = erro.response?.status

      if (!STATUS_RETRYABLES.has(status)) {
        console.error(
          `[TRAYCOMMERCE][SYNC] Erro na página ${pagina} (HTTP ${status})`,
          erro.message
        )
        throw erro
      }

      tentativas++

      if (tentativas > MAX_TENTATIVAS) {
        throw new Error(
          `Rate limit persistente na TrayCommerce (HTTP ${status}) após ${MAX_TENTATIVAS} tentativas`
        )
      }

      // Mesma curva do nerus-sync-hub: 1s, 2s, 4s... com um jitter aleatório.
      const backoff =
        BASE_DELAY_MS * Math.pow(2, tentativas - 1) +
        Math.floor(Math.random() * JITTER_MS)

      console.log(
        `[TRAYCOMMERCE][SYNC] HTTP ${status} transitório. Tentativa ${tentativas}/${MAX_TENTATIVAS}. Aguardando ${backoff}ms`
      )

      await sleep(backoff)
    }
  }
}

export type BuscarPedidosTraycommerceResumo = {
  totalPedidos: number
  ignorados: number
  statusIgnorados: string[]
  /** Janela realmente consultada na API, em YYYYMMDD. A comparação no ERP
   *  precisa do mesmo recorte, senao a contagem mistura pedidos de dias
   *  diferentes e o alerta sai com "4 de 2". */
  from: string
  to: string
}

let ultimoResumoBuscaPedidos: BuscarPedidosTraycommerceResumo = {
  totalPedidos: 0,
  ignorados: 0,
  statusIgnorados: Array.from(STATUS_MONITORADOS),
  from: '',
  to: ''
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

  const base = traycommerceConfig.TRAYCOMMERCE_URL.replace(/\/+$/, '')

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

      // O access_token vai na query: a API ignora o header Authorization e
      // devolve 401 "Invalid or expired token" quando so ele é enviado.
      const urlFinal =
        `${base}/orders?access_token=${token}` +
        `&limit=${LIMITE_POR_PAGINA}&page=${pagina}&date=${from},${to}`

      console.log('[TRAYCOMMERCE][SYNC] Buscando página', { pagina, from, to })

      requisicoes++

      const dados = await buscarPaginaComRetry(urlFinal, pagina)
      const lote = dados?.Orders || []

      console.log('[TRAYCOMMERCE][SYNC] Página recebida', {
        pagina,
        registros: lote.length,
        total: dados?.paging?.total,
        limitEfetivo: dados?.paging?.limit
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
      statusIgnorados: Array.from(STATUS_MONITORADOS),
      from,
      to
    }

    return pedidos
  } catch (erro) {
    console.error('[TRAYCOMMERCE][SYNC] Erro ao buscar pedidos', erro)
    throw erro
  }
}
