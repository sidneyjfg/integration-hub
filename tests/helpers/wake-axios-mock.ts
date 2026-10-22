export type PedidoWakeFixture = {
  pedidoId: string
  situacaoPedidoId?: number
  valorTotalPedido?: number | string | null
  data?: string
  marketPlacePedidoId?: string | null
  identificador?: string | null
}

export type PaginaPedidosWake = {
  pedidos: PedidoWakeFixture[]
  total?: number
  incluirTotal?: boolean
}

export function criarPaginaPedidosWake(opts: {
  pedidos: PedidoWakeFixture[]
  total?: number
  incluirTotal?: boolean
}): PaginaPedidosWake {
  return { ...opts }
}

export type ProdutoWakeFixture = {
  produtoVarianteId: number | string
  produtoId?: number | string | null
  idPaiExterno?: string | null
  idVinculoExterno?: string | null
  sku?: string | null
  nome?: string | null
  precoCusto?: number | string | null
  precoDe?: number | string | null
  precoPor?: number | string | null
  fatorMultiplicadorPreco?: number | string | null
  valido?: boolean | null
  estoque?: Array<{
    estoqueFisico?: number | string | null
    estoqueReservado?: number | string | null
    centroDistribuicaoId?: number | string | null
  }> | null
}

export type PaginaProdutosWake = {
  produtos: ProdutoWakeFixture[]
  total?: number
  temProximaPagina?: boolean
  ultimoProdutoVarianteId?: string | number | null
  /** Quando false, omite o header `x-tem-proxima-pagina`. */
  incluirTemProxima?: boolean
}

export function criarPaginaProdutosWake(opts: {
  produtos: ProdutoWakeFixture[]
  total?: number
  temProximaPagina?: boolean
  ultimoProdutoVarianteId?: string | number | null
  incluirTemProxima?: boolean
}): PaginaProdutosWake {
  return { ...opts }
}

/**
 * Mock do axios para a Wake, com pagina por pagina.
 *
 * Registra cada GET em /pedidos e sabe simular timeout em tentativas
 * especificas - e o timeout e o que interessa, porque ele chega sem
 * `response`, ou seja, sem status HTTP.
 */
export function createWakeAxiosMock(options?: {
  paginas?: PaginaPedidosWake[]
  situacoes?: unknown[]
  paginasProdutos?: PaginaProdutosWake[]
  /** Página -> tentativas (1-based) que devem estourar timeout. */
  timeoutsPorPagina?: Record<number, number[]>
  /** Erros HTTP por página: { pagina: status }. */
  httpPorPagina?: Record<number, number>
  /** Erros HTTP por página do catálogo: { pagina: status }. */
  httpPorProdutoPagina?: Record<number, number>
}) {
  const paginas = options?.paginas ?? []
  const paginasProdutos = options?.paginasProdutos ?? []
  const timeoutsPorPagina = options?.timeoutsPorPagina ?? {}
  const httpPorPagina = options?.httpPorPagina ?? {}
  const httpPorProdutoPagina = options?.httpPorProdutoPagina ?? {}

  const requisicoes: Array<{
    tipo: 'pedidos' | 'situacoes' | 'produtos'
    pagina: number
    tentativa: number
    url: string
    headers: Record<string, unknown> | undefined
    cursor?: string | null
  }> = []
  const tentativasPorPagina = new Map<number, number>()

  function erroAxios(mensagem: string, extra: Record<string, unknown>) {
    const erro = new Error(mensagem) as Error & Record<string, unknown>
    erro.isAxiosError = true
    Object.assign(erro, extra)
    return erro
  }

  return {
    requisicoes,

    get: async (url: string, config?: { headers?: Record<string, unknown> }) => {
      const parsed = new URL(url)

      if (parsed.pathname.replace(/\/+$/, '').endsWith('/situacoesPedido')) {
        requisicoes.push({
          tipo: 'situacoes',
          pagina: 0,
          tentativa: 1,
          url,
          headers: config?.headers
        })

        return {
          status: 200,
          data: options?.situacoes ?? [],
          headers: {}
        }
      }

      if (parsed.pathname.replace(/\/+$/, '').endsWith('/produtos')) {
        const cursor = parsed.searchParams.get('produtoVarianteIdDe')
        let indice = 0

        // A pagina seguinte e a que vem depois da pagina cujo ultimo id
        // bate com o cursor enviado.
        if (cursor !== null) {
          const anterior = paginasProdutos.findIndex(
            p => String(p.ultimoProdutoVarianteId ?? '') === cursor
          )
          indice = anterior + 1
        }

        requisicoes.push({
          tipo: 'produtos',
          pagina: indice + 1,
          tentativa: 1,
          url,
          headers: config?.headers,
          cursor
        })

        const status = httpPorProdutoPagina[indice + 1]
        if (status !== undefined) {
          throw erroAxios(`Request failed with status code ${status}`, {
            code: 'ERR_BAD_REQUEST',
            response: { status }
          })
        }

        const resposta = paginasProdutos[indice]

        if (!resposta) {
          return {
            status: 200,
            data: [],
            headers: { 'x-tem-proxima-pagina': 'false' }
          }
        }

        const headers: Record<string, string> = {}

        if (resposta.incluirTemProxima !== false) {
          headers['x-tem-proxima-pagina'] = String(
            resposta.temProximaPagina ?? indice < paginasProdutos.length - 1
          )
        }

        if (
          resposta.ultimoProdutoVarianteId !== undefined &&
          resposta.ultimoProdutoVarianteId !== null
        ) {
          headers['x-ultimo-produto-variante-id'] = String(
            resposta.ultimoProdutoVarianteId
          )
        }

        if (resposta.total !== undefined) {
          headers['x-total-count'] = String(resposta.total)
        }

        return { status: 200, data: resposta.produtos, headers }
      }

      const pagina = Number(parsed.searchParams.get('pagina') ?? '1')
      const tentativa = (tentativasPorPagina.get(pagina) ?? 0) + 1
      tentativasPorPagina.set(pagina, tentativa)

      requisicoes.push({
        tipo: 'pedidos',
        pagina,
        tentativa,
        url,
        headers: config?.headers
      })

      if ((timeoutsPorPagina[pagina] ?? []).includes(tentativa)) {
        throw erroAxios('timeout of 15000ms exceeded', {
          code: 'ECONNABORTED'
        })
      }

      const status = httpPorPagina[pagina]
      if (status !== undefined) {
        throw erroAxios(`Request failed with status code ${status}`, {
          code: 'ERR_BAD_REQUEST',
          response: { status }
        })
      }

      const resposta = paginas[pagina - 1]

      if (!resposta) {
        return { status: 200, data: [], headers: { 'x-total-count': '0' } }
      }

      const headers =
        resposta.incluirTotal === false
          ? {}
          : { 'x-total-count': String(resposta.total ?? resposta.pedidos.length) }

      return {
        status: 200,
        data: resposta.pedidos,
        headers
      }
    },

    post: async () => ({ status: 200, data: {} })
  }
}

/** Substitui o sleep real do backoff por um timer de 0ms. */
export function semEsperaReal<T>(fn: () => Promise<T>): Promise<T> {
  const real = global.setTimeout
  global.setTimeout = ((callback: () => void) =>
    real(callback, 0)) as typeof global.setTimeout

  return fn().finally(() => {
    global.setTimeout = real
  })
}
