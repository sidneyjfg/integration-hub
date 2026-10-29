import { z } from 'zod'

export type RotaReenvioMercadoLivre = {
  userId: string
  url: string
}

export type ContaReenvioMercadoLivre = {
  clienteId: string
  clientId: string
  storeno?: string | number | null
}

export type DestinoReenvioMercadoLivre =
  | { tipo: 'atual'; url: string; userId: string; applicationId: string }
  | { tipo: 'rota'; url: string; userId: string; applicationId: string; loja: string | null }
  | { tipo: 'global'; url: string; userId: string; applicationId: string; motivo: 'sem-user-id' | 'sem-userfull' | 'sem-rota' }
  | { tipo: 'desligado'; motivo: string }

const urlReenvio = z.string().url()

/** Lê `userId|url` separado por `;`. Vazio devolve lista vazia. */
export function parseRotasReenvioMercadoLivre(valor: unknown): RotaReenvioMercadoLivre[] {
  if (valor == null) return []
  if (typeof valor !== 'string') {
    throw new Error('MERCADOLIVRE_NOTIFICATION_ROUTES deve ser texto no formato userId|url')
  }

  const texto = valor.trim()
  if (!texto) return []

  const rotas: RotaReenvioMercadoLivre[] = []
  const vistos = new Set<string>()

  for (const parte of texto.split(';')) {
    const item = parte.trim()
    if (!item) continue

    const separador = item.indexOf('|')
    if (separador <= 0 || separador === item.length - 1) {
      throw new Error(`MERCADOLIVRE_NOTIFICATION_ROUTES inválida: "${item}". Use userId|url`)
    }

    const userId = item.slice(0, separador).trim()
    const url = item.slice(separador + 1).trim()
    if (!userId) {
      throw new Error(`MERCADOLIVRE_NOTIFICATION_ROUTES inválida: "${item}". Use userId|url`)
    }

    const urlOk = urlReenvio.safeParse(url)
    if (!urlOk.success) {
      throw new Error(`MERCADOLIVRE_NOTIFICATION_ROUTES com URL inválida para o userId ${userId}`)
    }
    if (vistos.has(userId)) {
      throw new Error(`MERCADOLIVRE_NOTIFICATION_ROUTES com userId repetido: ${userId}`)
    }

    vistos.add(userId)
    rotas.push({ userId, url: urlOk.data })
  }

  return rotas
}

/** userId do pedido. Sem `seller.id`, fica o userId da credencial que consultou. */
export function userIdDoPedidoMercadoLivre(
  sellerId: unknown,
  userIdCredencial: string,
): { userId: string; veioDoPedido: boolean } {
  if (sellerId == null) return { userId: userIdCredencial, veioDoPedido: false }

  const texto = String(sellerId).trim()
  if (!texto) return { userId: userIdCredencial, veioDoPedido: false }

  return { userId: texto, veioDoPedido: true }
}

/**
 * Sem rotas, o destino é o reenvio atual: URL global e ids da conta do laço.
 * Com rotas, a URL específica só vale quando a userfull tem o userId do pedido.
 */
export function destinoReenvioPedido(params: {
  rotas: RotaReenvioMercadoLivre[]
  urlGlobal?: string
  conta: ContaReenvioMercadoLivre
  userIdPedido?: string | null
  credencialDoPedido?: ContaReenvioMercadoLivre | null
}): DestinoReenvioMercadoLivre {
  if (params.rotas.length === 0) {
    if (!params.urlGlobal) return { tipo: 'desligado', motivo: 'url-global-ausente' }
    return {
      tipo: 'atual',
      url: params.urlGlobal,
      userId: params.conta.clienteId,
      applicationId: params.conta.clientId,
    }
  }

  const userIdPedido = params.userIdPedido?.trim() ?? ''
  if (!userIdPedido || !params.credencialDoPedido) {
    if (!params.urlGlobal) {
      return { tipo: 'desligado', motivo: userIdPedido ? 'sem-userfull' : 'sem-user-id' }
    }
    return {
      tipo: 'global',
      url: params.urlGlobal,
      userId: params.conta.clienteId,
      applicationId: params.conta.clientId,
      motivo: userIdPedido ? 'sem-userfull' : 'sem-user-id',
    }
  }

  const loja = params.credencialDoPedido.storeno == null || String(params.credencialDoPedido.storeno).trim() === ''
    ? null
    : String(params.credencialDoPedido.storeno)
  const rota = params.rotas.find(item => item.userId === userIdPedido)

  if (!rota) {
    if (!params.urlGlobal) return { tipo: 'desligado', motivo: 'sem-rota' }
    return {
      tipo: 'global',
      url: params.urlGlobal,
      userId: params.credencialDoPedido.clienteId,
      applicationId: params.credencialDoPedido.clientId,
      motivo: 'sem-rota',
    }
  }

  return {
    tipo: 'rota',
    url: rota.url,
    userId: params.credencialDoPedido.clienteId,
    applicationId: params.credencialDoPedido.clientId,
    loja,
  }
}
