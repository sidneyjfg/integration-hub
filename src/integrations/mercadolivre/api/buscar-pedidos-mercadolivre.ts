import axios from 'axios'
import { getCachedAccessToken, refreshAccessToken } from './auth'
import {
  buscarCredenciaisMercadoLivre,
  buscarPedidosSemValorPedido,
  salvarValorPedido,
  MercadoLivreCredential,
} from '../repositories/mercadolivre-notas.repository'

type PedidoMercadoLivre = {
  id: string
  date_created?: string | null
  total_amount?: number | string | null
  order_items?: Array<{
    item?: { id?: string | null } | null
  }>
}

type RespostaBuscaPedidosMercadoLivre = {
  results?: PedidoMercadoLivre[]
  paging?: { total?: number; offset?: number; limit?: number }
}

type ResultadoBuscaPedidos = {
  encontrados: number
  atualizados: number
  naoEncontrados: number
  erros: number
  diasAlterados: string[]
}

export type ResumoValoresPedidosMercadoLivre = {
  valorBruto: number
  pedidosConsultados: number
  anunciosEncontrados: string[]
}

export type ResumoDiarioValoresPedidosMercadoLivre = {
  valoresPorDia: Record<string, number>
  pedidosConsultados: number
  anunciosEncontrados: string[]
}

const espera = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function dataMercadoLivre(data: string, hora: string): string {
  if (!/^\d{8}$/.test(data)) throw new Error(`Data inválida para consulta do Mercado Livre: ${data}`)
  return `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}T${hora}-04:00`
}

async function buscarPedidosDoPeriodo(
  inicio: string,
  fim: string,
  credencial: MercadoLivreCredential,
  tokens: Map<string, string>,
): Promise<PedidoMercadoLivre[]> {
  const pedidos: PedidoMercadoLivre[] = []
  let offset = 0

  while (true) {
    let paginaConcluida = false
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      console.log('[MERCADOLIVRE][PEDIDOS][API] Consultando página', {
        sellerId: credencial.clienteId,
        inicio,
        fim,
        offset,
        limit: 50,
        tentativa,
      })
      try {
        const token =
          tokens.get(credencial.clienteId) ??
          getCachedAccessToken(credencial.clienteId) ??
          credencial.accessToken
        const resposta = await axios.get<RespostaBuscaPedidosMercadoLivre>(
          'https://api.mercadolibre.com/orders/search',
          {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            params: {
              seller: credencial.clienteId,
              'order.date_created.from': dataMercadoLivre(inicio, '00:00:00.000'),
              'order.date_created.to': dataMercadoLivre(fim, '00:00:00.000'),
              limit: 50,
              offset,
              sort: 'date_asc',
            },
          },
        )

        const pagina = resposta.data.results ?? []
        console.log('[MERCADOLIVRE][PEDIDOS][API] Página recebida', {
          sellerId: credencial.clienteId,
          offset,
          registros: pagina.length,
          total: resposta.data.paging?.total ?? null,
          status: resposta.status,
        })
        pedidos.push(...pagina)
        const total = Number(resposta.data.paging?.total ?? 0)
        if (pagina.length === 0 || offset + pagina.length >= total) return pedidos
        offset += pagina.length
        // O endpoint de pedidos aplica rate limit por vendedor. Mesmo com
        // resposta 200, aguardar entre páginas evita bloquear a próxima.
        await espera(1200)
        paginaConcluida = true
        break
      } catch (error: any) {
        const status = error?.response?.status
        const retryAfter = error?.response?.headers?.['retry-after'] ?? null
        console.error('[MERCADOLIVRE][PEDIDOS][API] Falha na consulta', {
          sellerId: credencial.clienteId,
          inicio,
          fim,
          offset,
          limit: 50,
          tentativa,
          status: status ?? null,
          retryAfter,
          resposta: error?.response?.data ?? null,
          erro: error?.message ?? String(error),
        })
        if (status === 429) {
          const esperaProgressiva = [5000, 15000, 30000, 60000][tentativa - 1]
          const esperaMs = retryAfter
            ? Math.max(Number(retryAfter) * 1000, esperaProgressiva)
            : esperaProgressiva
          console.warn('[MERCADOLIVRE][PEDIDOS][API] Limite 429; aguardando antes de tentar novamente', {
            sellerId: credencial.clienteId,
            offset,
            tentativa,
            esperaMs,
          })
          await espera(esperaMs)
          continue
        }
        if (status === 401 && !tokens.has(credencial.clienteId)) {
          const novoToken = await refreshAccessToken({
            clientId: credencial.clientId,
            clientSecret: credencial.clientSecret,
            refreshToken: credencial.refreshToken,
            clienteId: credencial.clienteId,
          })
          tokens.set(credencial.clienteId, novoToken)
          continue
        }
        throw error
      }
    }

    if (paginaConcluida) continue

    console.error('[MERCADOLIVRE][PEDIDOS][API] 429 persistente após tentativas', {
      sellerId: credencial.clienteId,
      inicio,
      fim,
      offset,
      tentativas: 4,
    })
    throw new Error(`429 persistente ao buscar pedidos do período para ${credencial.clienteId}`)
  }
}

function proximoDia(data: string): string {
  const valor = new Date(Date.UTC(
    Number(data.slice(0, 4)),
    Number(data.slice(4, 6)) - 1,
    Number(data.slice(6, 8)) + 1,
  ))
  return `${valor.getUTCFullYear()}${String(valor.getUTCMonth() + 1).padStart(2, '0')}${String(valor.getUTCDate()).padStart(2, '0')}`
}

function buscarDatas(inicio: string, fim: string): string[] {
  const datas: string[] = []
  for (let data = inicio; data < fim; data = proximoDia(data)) datas.push(data)
  return datas
}

async function buscarPedidosUnicosDoPeriodo(
  inicio: string,
  fim: string,
): Promise<{ pedidos: Map<string, PedidoMercadoLivre>; anuncios: Set<string> }> {
  const credenciais = await buscarCredenciaisMercadoLivre()
  const tokens = new Map<string, string>()
  const pedidos = new Map<string, PedidoMercadoLivre>()
  const anuncios = new Set<string>()

  for (const credencial of credenciais) {
    const pedidosDaConta = await buscarPedidosDoPeriodo(inicio, fim, credencial, tokens)
    for (const pedido of pedidosDaConta) {
      pedidos.set(String(pedido.id), pedido)
      for (const orderItem of pedido.order_items ?? []) {
        if (orderItem.item?.id) anuncios.add(orderItem.item.id)
      }
    }
  }

  return { pedidos, anuncios }
}

export async function buscarResumoDiarioValoresPedidosMercadoLivre(
  inicio: string,
  fim: string,
): Promise<ResumoDiarioValoresPedidosMercadoLivre> {
  const { pedidos, anuncios } = await buscarPedidosUnicosDoPeriodo(inicio, fim)
  const valoresPorDia: Record<string, number> = {}
  let acumulado = 0

  for (const data of buscarDatas(inicio, fim)) {
    for (const pedido of pedidos.values()) {
      if (String(pedido.date_created ?? '').slice(0, 10).replace(/-/g, '') === data) {
        const valor = Number(pedido.total_amount ?? 0)
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error(`total_amount inválido para o pedido ${pedido.id}`)
        }
        acumulado += valor
      }
    }
    valoresPorDia[data] = Number(acumulado.toFixed(2))
  }

  return {
    valoresPorDia,
    pedidosConsultados: pedidos.size,
    anunciosEncontrados: [...anuncios].sort(),
  }
}

export async function buscarResumoValoresPedidosMercadoLivre(
  inicio: string,
  fim: string,
): Promise<ResumoValoresPedidosMercadoLivre> {
  const { pedidos: pedidosPorId, anuncios } = await buscarPedidosUnicosDoPeriodo(inicio, fim)

  const valorBruto = [...pedidosPorId.values()].reduce((total, pedido) => {
    const valor = Number(pedido.total_amount ?? 0)
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`total_amount inválido para o pedido ${pedido.id}`)
    }
    return total + valor
  }, 0)

  return {
    valorBruto: Number(valorBruto.toFixed(2)),
    pedidosConsultados: pedidosPorId.size,
    anunciosEncontrados: [...anuncios].sort(),
  }
}

async function consultarPedido(
  pedido: string,
  credencial: MercadoLivreCredential,
  tokens: Map<string, string>,
): Promise<PedidoMercadoLivre | null> {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const token =
        tokens.get(credencial.clienteId) ??
        getCachedAccessToken(credencial.clienteId) ??
        credencial.accessToken
      const resposta = await axios.get<PedidoMercadoLivre>(
        `https://api.mercadolibre.com/orders/${encodeURIComponent(pedido)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      )
      return resposta.data
    } catch (error: any) {
      const status = error?.response?.status

      if (status === 404) return null

      if (status === 429) {
        await espera(tentativa * 3000)
        continue
      }

      if (status === 401 && !tokens.has(credencial.clienteId)) {
        const novoToken = await refreshAccessToken({
          clientId: credencial.clientId,
          clientSecret: credencial.clientSecret,
          refreshToken: credencial.refreshToken,
          clienteId: credencial.clienteId,
        })
        tokens.set(credencial.clienteId, novoToken)
        continue
      }

      throw error
    }
  }

  throw new Error(`429 persistente ao consultar o pedido ${pedido}`)
}

export async function buscarValoresPedidosMercadoLivre(
  inicio: string,
  fim: string,
  serie?: string,
): Promise<ResultadoBuscaPedidos> {
  const pedidos = await buscarPedidosSemValorPedido(inicio, fim, serie)
  const credenciais = await buscarCredenciaisMercadoLivre()
  const tokens = new Map<string, string>()
  const resultado: ResultadoBuscaPedidos = {
    encontrados: 0,
    atualizados: 0,
    naoEncontrados: 0,
    erros: 0,
    diasAlterados: [],
  }

  for (const item of pedidos) {
    const pedido = item.pedido
    let encontrado = false

    const credenciaisDoPedido = item.clienteId
      ? credenciais.filter(credencial => credencial.clienteId === item.clienteId)
      : credenciais

    if (item.clienteId && credenciaisDoPedido.length === 0) {
      resultado.erros++
      resultado.naoEncontrados++
      console.error('[MERCADOLIVRE][PEDIDOS] Credencial não encontrada para a conta da nota', {
        pedido,
        clienteId: item.clienteId,
      })
      continue
    }

    for (const credencial of credenciaisDoPedido) {
      try {
        const dados = await consultarPedido(pedido, credencial, tokens)
        if (!dados) continue

        const valor = Number(dados.total_amount ?? 0)
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error(`total_amount inválido para o pedido ${pedido}`)
        }

        resultado.encontrados++
        resultado.atualizados += await salvarValorPedido(
          pedido,
          Number(valor.toFixed(2)),
          { serie: item.serie, clienteId: item.clienteId },
        )
        if (item.emissao) resultado.diasAlterados.push(item.emissao)
        encontrado = true
        break
      } catch (error: any) {
        resultado.erros++
        console.error('[MERCADOLIVRE][PEDIDOS] Erro ao consultar pedido', {
          pedido,
          clienteId: credencial.clienteId,
          erro: error?.message ?? error,
        })
      }
    }

    if (!encontrado) resultado.naoEncontrados++
    await espera(250)
  }

  console.log('[MERCADOLIVRE][PEDIDOS] Enriquecimento finalizado', {
    inicio,
    fim,
    serie: serie ?? null,
    pedidos: pedidos.length,
    ...resultado,
  })

  return resultado
}
