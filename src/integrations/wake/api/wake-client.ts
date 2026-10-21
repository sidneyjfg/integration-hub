// src/integrations/wake/api/wake-client.ts
import axios, { AxiosResponse } from 'axios'
import { wakeConfig } from '../env.schema'
import { getDateRange } from '../utils'
import {
  WakeBuscaPedidosResumo,
  WakeOrderApi,
  WakeOrderStatusApi,
  WakeProductApi
} from '../../../shared/types/wake'

const RATE_LIMIT = 120
const WINDOW_MS = 60000
const TIMEOUT_MS = 15000
const MAX_TENTATIVAS = 5
const BASE_DELAY_MS = 1000
const JITTER_MS = 500
// A API aceita mais, mas corta o que vem acima de 50; 50 evita mandar inutil.
const LIMITE_POR_PAGINA = 50
const LIMITE_REGISTROS_PEDIDOS = 10000
const LIMITE_PRODUTOS_POR_PAGINA = 50

// 408 e 5xx sao transitórios, igual ao retry do nerus-sync-hub
const STATUS_RETRYABLES = new Set([408, 429, 500, 502, 503, 504])

// Falha de rede nao tem status HTTP: o `erro.response` fica undefined e o
// erro.code traz o motivo. Sem esta lista o timeout reprova na hora, porque
// nao casa com nenhum status - e uma pagina que deu timeout pode ter
// respondido logo em seguida.
const CODIGOS_RETRYABLES = new Set([
  'ECONNABORTED', // timeout do axios
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN' // DNS instável
])

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// O limite da Wake é 120 req/min; o controle é local e compartilhado entre
// pedidos e situações para o ciclo inteiro não estourar a janela.
let requisicoesJanela = 0
let inicioJanela = Date.now()

async function aguardarRateLimit() {
  while (true) {
    const agora = Date.now()

    if (agora - inicioJanela >= WINDOW_MS) {
      requisicoesJanela = 0
      inicioJanela = agora
    }

    if (requisicoesJanela < RATE_LIMIT) {
      requisicoesJanela++
      return
    }

    const espera = WINDOW_MS - (agora - inicioJanela)

    console.log(
      `[WAKE][SYNC] Rate limit local atingido. Esperando ${Math.ceil(espera / 1000)}s`
    )

    await sleep(espera)
  }
}

/**
 * 🔁 Busca uma URL com retry e backoff.
 * Devolve a resposta inteira porque os headers (`x-total-count`,
 * `x-tem-proxima-pagina`) também são usados na paginação.
 */
async function buscarComRetry<T>(
  urlFinal: string,
  opcoes: { prefixo?: string; logarErro?: boolean } = {}
): Promise<AxiosResponse<T>> {
  const prefixo = opcoes.prefixo ?? '[WAKE][SYNC]'
  const logarErro = opcoes.logarErro ?? true
  let tentativas = 0

  while (true) {
    try {
      await aguardarRateLimit()

      const response: AxiosResponse<T> = await axios.get<T>(urlFinal, {
        headers: {
          Accept: 'application/json',
          Authorization: `${wakeConfig.WAKE_TOKEN}`
        },
        timeout: TIMEOUT_MS
      })

      return response
    } catch (erro: any) {
      const status = erro.response?.status
      const codigo = erro.code
      const transitorio =
        STATUS_RETRYABLES.has(status) || CODIGOS_RETRYABLES.has(codigo)

      if (!transitorio) {
        if (logarErro) {
          console.error(
            `${prefixo} Erro na requisição (HTTP ${status})`,
            erro.message
          )
        }
        throw erro
      }

      tentativas++

      const motivo =
        status !== undefined ? `HTTP ${status}` : `código ${codigo ?? 'desconhecido'}`

      if (tentativas > MAX_TENTATIVAS) {
        throw new Error(
          `Falha transitória persistente na Wake (${motivo}) após ${MAX_TENTATIVAS} tentativas`
        )
      }

      // Mesma curva do nerus-sync-hub: 1s, 2s, 4s... com um jitter aleatório.
      const backoff =
        BASE_DELAY_MS * Math.pow(2, tentativas - 1) +
        Math.floor(Math.random() * JITTER_MS)

      console.log(
        `${prefixo} ${motivo} transitório. Tentativa ${tentativas}/${MAX_TENTATIVAS}. Aguardando ${backoff}ms`
      )

      await sleep(backoff)
    }
  }
}

/** O header chega como string; `Number('')` é 0 e não undefined. */
function extrairTotal(header: unknown): number | undefined {
  if (header === undefined || header === null || header === '') {
    return undefined
  }

  const total = Number(header)

  return Number.isFinite(total) ? total : undefined
}

/** Booleano que a API manda como header textual (`true`/`false`). */
function headerVerdadeiro(header: unknown): boolean {
  return String(header ?? '').toLowerCase() === 'true'
}

let ultimoResumo: WakeBuscaPedidosResumo = {
  from: '',
  to: '',
  total: 0
}

export function getUltimoResumoBuscaPedidosWake(): WakeBuscaPedidosResumo {
  return ultimoResumo
}

/**
 * 🔎 Busca todos os pedidos da janela, sem filtro de situação.
 * O usuário filtra os status depois, no SQL do ERP.
 */
export async function buscarPedidosWake(): Promise<WakeOrderApi[]> {
  console.log('[WAKE][SYNC] Iniciando busca de pedidos')

  const { from, to } = getDateRange()
  console.log('[WAKE][SYNC] Período de busca', { from, to })

  const base = wakeConfig.WAKE_URL.replace(/\/+$/, '')
  const pedidos: WakeOrderApi[] = []
  let pagina = 1
  let recebidos = 0
  let total: number | undefined

  try {
    while (true) {
      const url =
        `${base}/pedidos?dataInicial=${encodeURIComponent(from)}` +
        `&dataFinal=${encodeURIComponent(to)}` +
        `&pagina=${pagina}&quantidadeRegistros=${LIMITE_POR_PAGINA}`

      console.log('[WAKE][SYNC] Buscando página', { pagina, from, to })

      const response = await buscarComRetry<WakeOrderApi[]>(url, {
        prefixo: '[WAKE][SYNC]'
      })
      const lote = Array.isArray(response.data) ? response.data : []

      total = extrairTotal(response.headers['x-total-count'])

      console.log('[WAKE][SYNC] Página recebida', {
        pagina,
        registros: lote.length,
        total
      })

      if (lote.length === 0) break

      pedidos.push(...lote)
      recebidos += lote.length

      // A decisão de parar vem depois do processamento do lote: parar antes
      // descartaria justamente a última página, que é a que costuma fechar a
      // janela. A resposta já diz quantos pedidos existem, então pedir a
      // página seguinte depois que `total` saiu é requisição inútil - e se
      // ela dá timeout, derruba o ciclo mesmo com o resto em mãos.
      if (typeof total === 'number' && recebidos >= total) break

      pagina++
    }

    if (typeof total === 'number' && total >= LIMITE_REGISTROS_PEDIDOS) {
      console.warn(
        '[WAKE][SYNC] A janela atingiu o limite de 10.000 registros da API; ' +
          'pedidos podem ter ficado de fora',
        { total }
      )
    }

    ultimoResumo = { from, to, total: pedidos.length }

    console.log('[WAKE][SYNC] Busca finalizada', { totalPedidos: pedidos.length })

    return pedidos
  } catch (erro) {
    console.error('[WAKE][SYNC] Erro ao buscar pedidos', erro)
    throw erro
  }
}

/**
 * 📦 Percorre o catalogo inteiro via cursor.
 * A paginacao por `pagina` esta depreciada desde 21/09/2026: o cursor e o
 * `X-Ultimo-Produto-Variante-Id` devolvido no header da pagina anterior.
 * `camposAdicionais=Estoque` traz o `estoque[]` na mesma varredura, para o
 * monitoramento de estoque nao precisar de uma segunda passada.
 */
export async function buscarProdutosWake(): Promise<WakeProductApi[]> {
  console.log('[WAKE][PRODUTOS] Iniciando busca de produtos')

  const base = wakeConfig.WAKE_URL.replace(/\/+$/, '')
  const produtos: WakeProductApi[] = []
  let cursor: string | null = null
  let pagina = 0

  try {
    while (true) {
      pagina++

      const params = new URLSearchParams({
        quantidadeRegistros: String(LIMITE_PRODUTOS_POR_PAGINA),
        camposAdicionais: 'Estoque'
      })

      // A primeira requisicao nao leva cursor; as demais, o ultimo id da
      // pagina anterior.
      if (cursor) params.set('produtoVarianteIdDe', cursor)

      const url = `${base}/produtos?${params.toString()}`

      console.log('[WAKE][PRODUTOS] Buscando página', {
        pagina,
        cursor: cursor ?? 'inicial'
      })

      const response = await buscarComRetry<WakeProductApi[]>(url, {
        prefixo: '[WAKE][PRODUTOS]'
      })
      const lote = Array.isArray(response.data) ? response.data : []

      const temProximaHeader = response.headers['x-tem-proxima-pagina']
      const temProximaAusente =
        temProximaHeader === undefined ||
        temProximaHeader === null ||
        String(temProximaHeader).trim() === ''
      const proximoCursor = String(
        response.headers['x-ultimo-produto-variante-id'] ?? ''
      ).trim()

      console.log('[WAKE][PRODUTOS] Página recebida', {
        pagina,
        registros: lote.length,
        temProxima: temProximaHeader,
        total: extrairTotal(response.headers['x-total-count'])
      })

      produtos.push(...lote)

      // Quando o header nao vem, so da para continuar se houver cursor;
      // sem ele, insistir repetiria a mesma pagina para sempre.
      const temProxima = temProximaAusente
        ? lote.length > 0 && Boolean(proximoCursor)
        : headerVerdadeiro(temProximaHeader)

      if (!temProxima) break

      if (!proximoCursor || proximoCursor === cursor) {
        console.warn(
          '[WAKE][PRODUTOS] Paginação sem cursor novo; encerrando busca',
          { pagina, registros: lote.length }
        )
        break
      }

      cursor = proximoCursor
    }

    console.log('[WAKE][PRODUTOS] Busca finalizada', {
      totalProdutos: produtos.length
    })

    return produtos
  } catch (erro) {
    console.error('[WAKE][PRODUTOS] Erro ao buscar produtos', erro)
    throw erro
  }
}

/** Mapa id → descrição usado para gravar `status_name` legível. */
export async function buscarSituacoesPedidoWake(): Promise<
  WakeOrderStatusApi[]
> {
  console.log('[WAKE][SYNC] Buscando situações de pedido')

  const base = wakeConfig.WAKE_URL.replace(/\/+$/, '')

  try {
    const response = await buscarComRetry<WakeOrderStatusApi[]>(
      `${base}/situacoesPedido`,
      { prefixo: '[WAKE][SYNC]' }
    )

    const situacoes = Array.isArray(response.data) ? response.data : []

    console.log('[WAKE][SYNC] Situações recebidas', {
      total: situacoes.length
    })

    return situacoes
  } catch (erro) {
    console.error('[WAKE][SYNC] Erro ao buscar situações de pedido', erro)
    throw erro
  }
}
