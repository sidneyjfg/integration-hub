export interface TraycommerceOrderBody {
  ordnoweb: string
  ordnochannel?: string | null

  // status
  status: string

  // nota fiscal
  nfe_key?: string | null

  // datas
  date: string
}

/** Pedido pendente de integração, como devolvido pela comparação com o ERP. */
export type PedidoNaoIntegradoTraycommerce = {
  ordnoweb: string
  ordnochannel: string | null
  status: string
  date: string
  nfe_key: string | null
}

export interface TraycommerceOrderStatusApi {
  id: number | string
  name?: string
}

export interface TraycommerceOrderApi {
  id: number | string
  reference?: string | null
  OrderStatus?: TraycommerceOrderStatusApi | null
  creation_date?: string | null
}

export interface TraycommerceOrdersApiResponse {
  Orders?: Array<{ Order: TraycommerceOrderApi }>
  paging?: {
    total?: number
    pages?: number
  }
}
