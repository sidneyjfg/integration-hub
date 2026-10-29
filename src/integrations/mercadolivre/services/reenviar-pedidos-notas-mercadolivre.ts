import axios from 'axios'
import { randomUUID } from 'node:crypto'
import { MercadoLivreCredential, buscarCredenciaisMercadoLivre, buscarLojasPorUserIdMercadoLivre } from '../repositories/mercadolivre-notas.repository'
import { buscarUserIdsPorPedidos } from '../repositories/pedidos.repository'
import { mercadolivreConfig } from '../env.schema'
import { destinoReenvioPedido, DestinoReenvioMercadoLivre } from '../utils/reenvio-rotas'

const TAMANHO_LOTE = 5

export interface ResultadoReenvioPedidosNotas {
  executado: boolean
  reenviados: string[]
  falhas: string[]
}

type GrupoReenvio = {
  url: string
  userId: number
  applicationId: number
  clienteId: string
  pedidos: string[]
}

/** Reenvia ao Nérus notificações de pedidos pendentes associados às notas. */
export async function reenviarPedidosPendentesNotasMercadoLivre(
  pedidos: string[],
  conta: MercadoLivreCredential,
): Promise<ResultadoReenvioPedidosNotas> {
  if (mercadolivreConfig.MERCADOLIVRE_NOTIFICATION_ROUTES.length === 0) {
    return reenviarNaUrlUnica(pedidos, conta)
  }

  try {
    return await reenviarPorRotas(pedidos, conta)
  } catch (erro) {
    console.error('[MERCADOLIVRE][REENVIO] Falha ao resolver rotas; usando a URL única', {
      erro: erro instanceof Error ? erro.message : String(erro),
    })
    return reenviarNaUrlUnica(pedidos, conta)
  }
}

async function reenviarNaUrlUnica(
  pedidos: string[],
  conta: MercadoLivreCredential,
): Promise<ResultadoReenvioPedidosNotas> {
  const url = mercadolivreConfig.MERCADOLIVRE_NOTIFICATION_URL
  if (!url) {
    console.warn('[MERCADOLIVRE][REENVIO] Reenvio desativado (MERCADOLIVRE_NOTIFICATION_URL ausente)')
    return { executado: false, reenviados: [], falhas: [] }
  }

  const unicos = [...new Set(pedidos)]
  const userId = Number(conta.clienteId)
  const applicationId = Number(conta.clientId)

  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(applicationId)) {
    console.error('[MERCADOLIVRE][REENVIO] Conta sem user_id ou application_id válido', {
      clienteId: conta.clienteId,
    })
    return { executado: true, reenviados: [], falhas: unicos }
  }

  console.log('[MERCADOLIVRE][REENVIO] Iniciando reenvio de pedidos pendentes', {
    clienteId: conta.clienteId,
    total: unicos.length,
  })

  const resultado = await postarPedidos(unicos, url, userId, applicationId, conta.clienteId)

  console.log('[MERCADOLIVRE][REENVIO] Reenvio finalizado', {
    clienteId: conta.clienteId,
    reenviados: resultado.reenviados.length,
    falhas: resultado.falhas.length,
  })

  return { executado: true, reenviados: resultado.reenviados, falhas: resultado.falhas }
}

async function reenviarPorRotas(
  pedidos: string[],
  conta: MercadoLivreCredential,
): Promise<ResultadoReenvioPedidosNotas> {
  const unicos = [...new Set(pedidos)]
  const userIds = await buscarUserIdsPorPedidos(unicos)
  const credenciais = await buscarCredenciaisMercadoLivre()
  try {
    const lojas = await buscarLojasPorUserIdMercadoLivre()
    for (const credencial of credenciais) {
      const loja = lojas.get(String(credencial.clienteId))
      if (loja != null && String(loja).trim() !== '') credencial.storeno = loja
    }
  } catch (erro) {
    console.warn('[MERCADOLIVRE][REENVIO] Loja da userfull indisponível; rota segue pelo userId', {
      erro: erro instanceof Error ? erro.message : String(erro),
    })
  }
  const porUserId = new Map<string, MercadoLivreCredential>()
  for (const credencial of credenciais) {
    if (!porUserId.has(String(credencial.clienteId))) porUserId.set(String(credencial.clienteId), credencial)
  }

  const reenviados: string[] = []
  const falhas: string[] = []
  const semUrl: string[] = []
  const grupos = new Map<string, GrupoReenvio>()
  const avisos = new Set<string>()
  let algumDestino = false

  for (const pedido of unicos) {
    const userIdPedido = userIds.get(pedido) ?? null
    const credencialDoPedido = userIdPedido ? porUserId.get(userIdPedido) ?? null : null
    const destino = destinoReenvioPedido({
      rotas: mercadolivreConfig.MERCADOLIVRE_NOTIFICATION_ROUTES,
      urlGlobal: mercadolivreConfig.MERCADOLIVRE_NOTIFICATION_URL,
      conta,
      userIdPedido,
      credencialDoPedido,
    })

    if (destino.tipo === 'desligado') {
      semUrl.push(pedido)
      avisarUmaVez(avisos, destino.motivo, () => {
        console.warn('[MERCADOLIVRE][REENVIO] Pedido sem URL de reenvio', { motivo: destino.motivo })
      })
      continue
    }

    if (destino.tipo === 'global') {
      avisarUmaVez(avisos, `${destino.motivo}:${destino.userId}`, () => {
        console.warn('[MERCADOLIVRE][REENVIO] Pedido sem rota específica; usando a URL global', {
          userId: userIdPedido ?? destino.userId,
          motivo: destino.motivo,
        })
      })
    }

    if (destino.tipo === 'rota') {
      avisarUmaVez(avisos, `rota:${destino.userId}`, () => {
        console.log('[MERCADOLIVRE][REENVIO] Pedidos vinculados à rota do userId', {
          userId: destino.userId,
          loja: destino.loja,
        })
      })
    }

    const ids = idsDoDestino(destino)
    if (!ids) {
      console.error('[MERCADOLIVRE][REENVIO] Conta sem user_id ou application_id válido', {
        pedido,
        userId: destino.userId,
      })
      falhas.push(pedido)
      continue
    }

    algumDestino = true
    const chave = `${destino.url}\n${ids.userId}\n${ids.applicationId}`
    const grupo = grupos.get(chave) ?? {
      url: destino.url,
      userId: ids.userId,
      applicationId: ids.applicationId,
      clienteId: destino.userId,
      pedidos: [],
    }
    grupo.pedidos.push(pedido)
    grupos.set(chave, grupo)
  }

  if (!algumDestino && falhas.length === 0) {
    console.warn('[MERCADOLIVRE][REENVIO] Reenvio desativado (sem URL global e sem rota aplicável)')
    return { executado: false, reenviados: [], falhas: [] }
  }
  falhas.push(...semUrl)

  for (const grupo of grupos.values()) {
    const resultado = await postarPedidos(grupo.pedidos, grupo.url, grupo.userId, grupo.applicationId, grupo.clienteId)
    reenviados.push(...resultado.reenviados)
    falhas.push(...resultado.falhas)
  }

  console.log('[MERCADOLIVRE][REENVIO] Reenvio finalizado', {
    clienteId: conta.clienteId,
    reenviados: reenviados.length,
    falhas: falhas.length,
  })

  return { executado: true, reenviados, falhas }
}

function idsDoDestino(destino: Exclude<DestinoReenvioMercadoLivre, { tipo: 'desligado' }>): { userId: number; applicationId: number } | null {
  if (destino.userId == null || destino.applicationId == null) return null
  const userIdTexto = String(destino.userId).trim()
  const applicationIdTexto = String(destino.applicationId).trim()
  if (!/^\d+$/.test(userIdTexto) || !/^\d+$/.test(applicationIdTexto)) return null
  const userId = Number(userIdTexto)
  const applicationId = Number(applicationIdTexto)
  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(applicationId)) return null
  return { userId, applicationId }
}

function avisarUmaVez(avisos: Set<string>, chave: string, avisar: () => void): void {
  if (avisos.has(chave)) return
  avisos.add(chave)
  avisar()
}

async function postarPedidos(
  pedidos: string[],
  url: string,
  userId: number,
  applicationId: number,
  clienteId: string,
): Promise<{ reenviados: string[]; falhas: string[] }> {
  const reenviados: string[] = []
  const falhas: string[] = []
  const sent = new Date().toISOString()

  for (let inicio = 0; inicio < pedidos.length; inicio += TAMANHO_LOTE) {
    const lote = pedidos.slice(inicio, inicio + TAMANHO_LOTE)
    const resultados = await Promise.all(lote.map(async pedido => {
      const recebido = new Date().toISOString()
      try {
        await axios.post(url, {
          _id: randomUUID(),
          topic: 'orders_v2',
          resource: `/orders/${pedido}`,
          user_id: userId,
          application_id: applicationId,
          sent,
          attempts: 1,
          received: recebido,
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        })
        return { pedido, sucesso: true }
      } catch (erro: any) {
        console.error('[MERCADOLIVRE][REENVIO] Falha ao reenviar pedido', {
          pedido,
          clienteId,
          status: erro?.response?.status,
          erro: erro?.response?.data ?? erro?.message,
        })
        return { pedido, sucesso: false }
      }
    }))

    for (const resultado of resultados) {
      ;(resultado.sucesso ? reenviados : falhas).push(resultado.pedido)
    }
  }

  return { reenviados, falhas }
}
