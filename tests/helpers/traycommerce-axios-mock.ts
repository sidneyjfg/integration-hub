export type PaginaOrdem = {
  paging?: {
    total?: number
    pages?: number
    page?: number
    limit?: number
  }
  Orders?: unknown[]
}

/** Cria um payload de /orders no formato que a API devolve. */
export function criarPaginaOrdem(opts: {
  pedidos: Array<{ id: string; status?: string; statusNome?: string }>
  total?: number
  limite?: number
  pagina?: number
  incluirTotal?: boolean
}): PaginaOrdem {
  const limite = opts.limite ?? 50

  return {
    paging: opts.incluirTotal !== false
      ? {
          total: opts.total ?? opts.pedidos.length,
          pages: Math.ceil((opts.total ?? opts.pedidos.length) / limite),
          page: opts.pagina ?? 1,
          limit: limite
        }
      : undefined,
    Orders: opts.pedidos.map(p => ({
      Order: {
        id: p.id,
        date: '2026-10-01',
        external_code: '',
        total: '100.00',
        OrderStatus: {
          id: p.status ?? '1',
          status: p.statusNome ?? 'A ENVIAR'
        },
        OrderInvoice: []
      }
    }))
  }
}

/**
 * Mock do axios para a TrayCommerce, com pagina por pagina.
 *
 * Registra cada GET em /orders e sabe simular timeout em tentativas
 * especificas - e o timeout e o que interessa, porque ele chega sem
 * `response`, ou seja, sem status HTTP.
 */
export function createTraycommerceAxiosMock(options?: {
  paginas?: PaginaOrdem[]
  /** Página -> tentativas (1-based) que devem estourar timeout. */
  timeoutsPorPagina?: Record<number, number[]>
  /** Erros HTTP por página: { pagina: status }. */
  httpPorPagina?: Record<number, number>
  token?: string
}) {
  const paginas = options?.paginas ?? []
  const timeoutsPorPagina = options?.timeoutsPorPagina ?? {}
  const httpPorPagina = options?.httpPorPagina ?? {}

  const requisicoes: Array<{ pagina: number; tentativa: number; url: string }> = []
  const tentativasPorPagina = new Map<number, number>()

  function erroAxios(mensagem: string, extra: Record<string, unknown>) {
    const erro = new Error(mensagem) as Error & Record<string, unknown>
    erro.isAxiosError = true
    Object.assign(erro, extra)
    return erro
  }

  return {
    requisicoes,

    get: async (url: string) => {
      const params = new URL(url).searchParams
      const pagina = Number(params.get('page') ?? '1')
      const tentativa = (tentativasPorPagina.get(pagina) ?? 0) + 1
      tentativasPorPagina.set(pagina, tentativa)
      requisicoes.push({ pagina, tentativa, url })

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

      return { status: 200, data: paginas[pagina - 1] ?? { Orders: [] } }
    },

    post: async () => ({
      status: 200,
      data: { access_token: options?.token ?? 'token-traycommerce' }
    })
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