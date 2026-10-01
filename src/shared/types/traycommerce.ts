export interface TraycommerceOrderBody {
  ordnoweb: string
  ordnochannel?: string | null

  // status
  status: string
  status_name?: string | null

  // nota fiscal
  nfe_key?: string | null

  // valores
  total?: number | null

  // datas
  date: string
}

/** Pedido da janela consultada, como devolvido pela comparação com o ERP. */
export type PedidoNaoIntegradoTraycommerce = {
  ordnoweb: string
  ordnochannel: string | null
  status: string
  status_name: string | null
  date: string
  total: number | null
  nfe_key: string | null
  /** 1 quando o pedido não foi encontrado no eordchannelp. O mysql2
   *  devolve `(e.ordnoweb IS NULL)` como 0/1. */
  nao_integrado: number
}

export interface TraycommerceOrderStatusApi {
  id: number | string
  status?: string | null
  display_name?: string | null
}

export interface TraycommerceOrderApi {
  /** Vem como string na API ("77"). */
  id: number | string
  /** Data do pedido em YYYY-MM-DD, sem hora. */
  date?: string | null
  /** Referência do canal; vazia quando a loja não escreve nesse campo. */
  external_code?: string | null
  sending_code?: string | null
  session_id?: string | null
  /** Vem como string na API ("1000.00"). */
  total?: number | string | null
  OrderStatus?: TraycommerceOrderStatusApi | null
  /** Vem como array vazio quando o pedido ainda não tem nota. */
  OrderInvoice?: unknown
}

export interface TraycommerceOrdersApiResponse {
  Orders?: Array<{ Order: TraycommerceOrderApi }>
  paging?: {
    total?: number
    pages?: number
    page?: number
    limit?: number
  }
}
