// src/integrations/wake/services/sincronizar-pedidos-wake.ts
import {
  buscarPedidosWake,
  buscarSituacoesPedidoWake,
  getUltimoResumoBuscaPedidosWake
} from '../api/wake-client'
import { salvarPedidosTempWake } from '../repositories/pedidos.repository'
import { notifyGoogleChat } from '../notifications/google-chat'
import { WakeOrderApi, WakeOrderBody } from '../../../shared/types/wake'
import { paraNumeroOuNulo, parseWakeDate } from '../utils'

export async function sincronizarPedidosWake(): Promise<void> {
  console.log('[WAKE][SYNC] Iniciando pedidos')

  // O status é informação de apoio: se a rota falhar, o pedido ainda entra
  // com status_name nulo em vez de derrubar o ciclo inteiro.
  const mapaStatus = await carregarMapaStatus()

  const pedidos = await buscarPedidosWake()
  const resumo = getUltimoResumoBuscaPedidosWake()

  if (pedidos.length === 0) {
    console.log('[WAKE][SYNC] Nenhum pedido encontrado')

    await notifyGoogleChat(
      `Nenhum pedido encontrado na Wake na janela consultada.\n` +
        `Janela: ${formatarJanela(resumo.from, resumo.to)}`
    )
    return
  }

  const linhas = pedidos
    .filter(pedido => {
      if (pedido?.pedidoId === undefined || pedido?.pedidoId === null) {
        console.warn('[WAKE][SYNC] Pedido inválido ignorado', pedido)
        return false
      }

      return true
    })
    .map(pedido => montarLinha(pedido, mapaStatus))

  await salvarPedidosTempWake(linhas)

  console.log('[WAKE][SYNC] Resumo da janela', {
    janela: `${resumo.from} a ${resumo.to}`,
    pedidos: linhas.length
  })

  await notifyGoogleChat(
    `📦 Pedidos sincronizados na Wake.\n` +
      `Janela: ${formatarJanela(resumo.from, resumo.to)}\n` +
      `Pedidos: ${linhas.length}`
  )
}

async function carregarMapaStatus(): Promise<Map<string, string | null>> {
  try {
    const situacoes = await buscarSituacoesPedidoWake()

    return new Map(
      situacoes.map(situacao => [
        String(situacao.situacaoPedidoId),
        situacao.descricao ?? situacao.nome ?? null
      ])
    )
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)

    console.warn(
      '[WAKE][SYNC] Não foi possível buscar situações de pedido; status_name ficará nulo',
      mensagem
    )

    return new Map()
  }
}

function montarLinha(
  pedido: WakeOrderApi,
  mapaStatus: Map<string, string | null>
): WakeOrderBody {
  const status = String(pedido.situacaoPedidoId ?? '')

  return {
    ordnoweb: String(pedido.pedidoId),
    // `marketPlacePedidoId` é o pedido no marketplace; nas lojas próprias
    // ele vem vazio e o `identificador` da Wake é a melhor referência.
    ordnochannel: pedido.marketPlacePedidoId ?? pedido.identificador ?? '',
    status,
    status_name: mapaStatus.get(status) ?? null,
    total: paraNumeroOuNulo(pedido.valorTotalPedido),
    date: parseWakeDate(pedido.data) ?? new Date()
  }
}

function formatarJanela(from: string, to: string) {
  const formatar = (valor: string) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
    if (!partes) return valor

    const [, ano, mes, dia] = partes

    return `${dia}/${mes}/${ano}`
  }

  return `${formatar(from)} a ${formatar(to)}`
}
