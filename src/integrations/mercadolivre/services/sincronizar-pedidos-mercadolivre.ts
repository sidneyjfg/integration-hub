import axios from 'axios'
import { getCachedAccessToken, refreshAccessToken } from '../api/auth'
import { buscarCredenciaisMercadoLivre } from '../repositories/mercadolivre-notas.repository'
import { mercadolivreConfig } from '../env.schema'
import {
  notifyGoogleChat,
  notifyGoogleChatWarning,
} from '../notifications/google-chat'
import {
  buscarPedidosMercadoLivreNaoIntegrados,
  PedidoMonitorado,
  registrarErroPedidos,
  salvarCheckpointPedidos,
  salvarPedidoMonitorado,
} from '../repositories/pedidos.repository'
import { reenviarPedidosPendentesNotasMercadoLivre } from './reenviar-pedidos-notas-mercadolivre'
import { userIdDoPedidoMercadoLivre } from '../utils/reenvio-rotas'

const espera = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const diaMs = 24 * 60 * 60 * 1000

type RespostaPedidos = { results?: PedidoMonitorado[]; paging?: { total?: number } }

async function requisitar<T>(url: string, params: Record<string, unknown>, credencial: any, tokens: Map<string, string>): Promise<T> {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const token = tokens.get(credencial.clienteId) ?? getCachedAccessToken(credencial.clienteId) ?? credencial.accessToken
      const resposta = await axios.get<T>(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-format-new': 'true' },
        params,
        timeout: 30000,
      })
      return resposta.data
    } catch (error: any) {
      const status = error?.response?.status
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
      if (status === 429 || status >= 500 || ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.code)) {
        await espera([3000, 8000, 15000, 30000][tentativa - 1])
        continue
      }
      throw error
    }
  }
  throw new Error(`Falha persistente na API do Mercado Livre: ${url}`)
}

async function consultarTipoLogistico(shippingId: string | null, credencial: any, tokens: Map<string, string>): Promise<string | null> {
  if (!shippingId) return null
  const shipment = await requisitar<{ logistic?: { type?: string }; logistic_type?: string }>(
    `https://api.mercadolibre.com/shipments/${encodeURIComponent(shippingId)}`, {}, credencial, tokens,
  )
  return shipment.logistic?.type ?? shipment.logistic_type ?? null
}

async function sincronizarConta(credencial: any): Promise<{ pedidos: number; cursor: string; paginas: number; totalApi: number }> {
  const agora = new Date()
  const dias = mercadolivreConfig.MERCADOLIVRE_ORDERS_TO_FETCH
  const inicio = new Date(agora.getTime() - dias * diaMs)
  const tokens = new Map<string, string>()
  let offset = 0
  let total = 0
  let paginas = 0
  let totalApi = 0
  let avisouSemUserId = false

  console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Iniciando conta', {
    clienteId: credencial.clienteId,
    dias,
    de: inicio.toISOString(),
    ate: agora.toISOString(),
  })

  while (true) {
    const pagina = await requisitar<RespostaPedidos>('https://api.mercadolibre.com/orders/search', {
      seller: credencial.clienteId,
      'order.date_created.from': inicio.toISOString(),
      'order.date_created.to': agora.toISOString(),
      limit: 50,
      offset,
      sort: 'date_asc',
    }, credencial, tokens)
    if (!Array.isArray(pagina.results) || !Number.isFinite(Number(pagina.paging?.total))) {
      throw new Error(`Resposta inválida de pedidos para a conta ${credencial.clienteId}`)
    }

    paginas++
    totalApi = Number(pagina.paging?.total)
    console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Página recebida', {
      clienteId: credencial.clienteId,
      pagina: paginas,
      offset,
      recebidos: pagina.results.length,
      totalApi,
    })

    for (const pedido of pagina.results) {
      const userIdPedido = userIdDoPedidoMercadoLivre(pedido.seller?.id, credencial.clienteId)
      if (!userIdPedido.veioDoPedido && !avisouSemUserId) {
        avisouSemUserId = true
        console.warn('[MERCADOLIVRE][PEDIDOS][SYNC] Pedido sem userId; usando a credencial', {
          pedido: pedido.id,
          clienteId: credencial.clienteId,
        })
      }
      const tipo = await consultarTipoLogistico(pedido.shipping?.id == null ? null : String(pedido.shipping.id), credencial, tokens)
      await salvarPedidoMonitorado(userIdPedido.userId, pedido, tipo)
      total++
    }
    offset += pagina.results.length
    if (offset >= totalApi || pagina.results.length === 0) break
    await espera(1200)
  }

  return { pedidos: total, cursor: agora.toISOString(), paginas, totalApi }
}

export async function sincronizarPedidosMercadoLivre(): Promise<void> {
  const credenciais = await buscarCredenciaisMercadoLivre()
  const contas = credenciais.map(c => String(c.clienteId))
  console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Início monitoramento multi-loja', {
    lojas: contas.length,
    clienteIds: contas,
    dias: mercadolivreConfig.MERCADOLIVRE_ORDERS_TO_FETCH,
  })

  let falhas = 0
  let sucessos = 0
  let pedidosTotal = 0

  for (const [indice, credencial] of credenciais.entries()) {
    console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Processando loja', {
      indice: indice + 1,
      de: credenciais.length,
      clienteId: credencial.clienteId,
    })
    try {
      const resultado = await sincronizarConta(credencial)
      await salvarCheckpointPedidos(credencial.clienteId, resultado.cursor, null)
      sucessos++
      pedidosTotal += resultado.pedidos
      console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Conta sincronizada', {
        clienteId: credencial.clienteId,
        pedidos: resultado.pedidos,
        paginas: resultado.paginas,
        totalApi: resultado.totalApi,
        cursor: resultado.cursor,
      })
    } catch (error: any) {
      falhas++
      const detalhe = String(error?.response?.data?.message ?? error?.message ?? error).slice(0, 4000)
      await registrarErroPedidos(credencial.clienteId, detalhe, new Date(Date.now() - mercadolivreConfig.MERCADOLIVRE_ORDERS_TO_FETCH * diaMs).toISOString())
      console.error('[MERCADOLIVRE][PEDIDOS][SYNC] Falha; checkpoint preservado para retomada', {
        clienteId: credencial.clienteId,
        erro: detalhe,
      })
    }
  }

  const naoIntegrados = await buscarPedidosMercadoLivreNaoIntegrados()
  const porLoja = Object.fromEntries(
    [...new Map(naoIntegrados.map(p => [p.cliente_id, 0])).keys()].map(clienteId => [
      clienteId,
      naoIntegrados.filter(p => p.cliente_id === clienteId).length,
    ]),
  )
  console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Comparação com Nérus (eordchannelp.ordnoChannel)', {
    naoIntegrados: naoIntegrados.length,
    porLoja,
    exemplos: naoIntegrados.slice(0, 10).map(p => ({
      clienteId: p.cliente_id,
      pedido: p.pedido_id,
      status: p.status,
      data: p.data_criacao,
    })),
  })

  let reenviadosTotal = 0
  let falhasReenvio = 0
  let reenvioExecutado = false

  if (naoIntegrados.length === 0) {
    console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Todos os pedidos monitorados estão no Nérus')
    await notifyGoogleChat(
      `✅ Todos os pedidos do Mercado Livre monitorados constam no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME}).`,
    )
  } else {
    const porCliente = new Map<string, string[]>()
    for (const pedido of naoIntegrados) {
      const lista = porCliente.get(pedido.cliente_id) ?? []
      lista.push(pedido.pedido_id)
      porCliente.set(pedido.cliente_id, lista)
    }

    for (const [clienteId, pedidos] of porCliente) {
      const conta = credenciais.find(c => String(c.clienteId) === clienteId)
      if (!conta) {
        console.error('[MERCADOLIVRE][PEDIDOS][SYNC] Sem credencial para reenvio', {
          clienteId,
          pedidos: pedidos.length,
        })
        falhasReenvio += pedidos.length
        continue
      }

      const reenvio = await reenviarPedidosPendentesNotasMercadoLivre(pedidos, conta)
      if (reenvio.executado) reenvioExecutado = true
      reenviadosTotal += reenvio.reenviados.length
      falhasReenvio += reenvio.falhas.length
    }

    const resumoReenvio = reenvioExecutado
      ? ` Reenviados: ${reenviadosTotal}; falhas no reenvio: ${falhasReenvio}.`
      : ' Reenvio desativado: configure MERCADOLIVRE_NOTIFICATION_URL ou MERCADOLIVRE_NOTIFICATION_ROUTES.'

    const resumoLojas = Object.entries(porLoja)
      .map(([clienteId, total]) => `${clienteId}=${total}`)
      .join(', ')

    await notifyGoogleChatWarning(
      `⚠️ ${naoIntegrados.length} pedido(s) do Mercado Livre não integrados no Nérus (Cliente: ${mercadolivreConfig.CLIENT_NAME}). Por loja: ${resumoLojas}.${resumoReenvio}`,
    )
  }

  console.log('[MERCADOLIVRE][PEDIDOS][SYNC] Monitoramento multi-loja finalizado', {
    lojas: contas.length,
    sucessos,
    falhas,
    pedidosTotal,
    naoIntegrados: naoIntegrados.length,
    reenviados: reenviadosTotal,
    falhasReenvio,
    reenvioExecutado,
  })

  if (falhas) throw new Error(`Monitoramento de pedidos ML falhou em ${falhas} conta(s); erros registrados no checkpoint`)
}
