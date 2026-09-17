import axios from 'axios'
import { refreshAccessToken } from './auth'
import {
  buscarCredenciaisMercadoLivre,
  buscarPedidosSemValorPedido,
  salvarValorPedido,
  MercadoLivreCredential,
} from '../repositories/mercadolivre-notas.repository'

type PedidoMercadoLivre = {
  id: string
  total_amount?: number | string | null
}

type ResultadoBuscaPedidos = {
  encontrados: number
  atualizados: number
  naoEncontrados: number
  erros: number
  diasAlterados: string[]
}

const espera = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function consultarPedido(
  pedido: string,
  credencial: MercadoLivreCredential,
  tokens: Map<string, string>,
): Promise<PedidoMercadoLivre | null> {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const token = tokens.get(credencial.clienteId) ?? credencial.accessToken
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
): Promise<ResultadoBuscaPedidos> {
  const pedidos = await buscarPedidosSemValorPedido(inicio, fim)
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

    for (const credencial of credenciais) {
      try {
        const dados = await consultarPedido(pedido, credencial, tokens)
        if (!dados) continue

        const valor = Number(dados.total_amount ?? 0)
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error(`total_amount inválido para o pedido ${pedido}`)
        }

        resultado.encontrados++
        resultado.atualizados += await salvarValorPedido(pedido, Number(valor.toFixed(2)))
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
    pedidos: pedidos.length,
    ...resultado,
  })

  return resultado
}
