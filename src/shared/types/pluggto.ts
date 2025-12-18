export interface PluggtoOrderBody {
  ordnoweb: string
  ordnochannel?: string | null

  // status
  status: string

  // nota fiscal
  nfe_key?: string | null
  nfe_number?: string | null
  nfe_serie?: string | null
  nfe_date?: string | null

  // valores
  total: number
  subtotal?: number | null
  shipping?: number | null
  discount?: number | null
  tax?: number | null
  total_paid?: number | null

  // pagamento
  payment_type?: string | null
  payment_method?: string | null
  payment_installments?: number | null

  // metadados
  channel: string
  channel_account?: string | null
  delivery_type?: string | null

  // datas
  created_at: string
  approved_at?: string | null
  modified_at?: string | null
}
export type PedidoNaoIntegradoPluggto = {
  ordnoweb: string
  status: string
  date: string
  total_paid?: number | null
}
export interface PluggtoOrderApi {
  Order: {
    id: string
    original_id?: string

    status: string
    sub_status?: string

    channel: string
    channel_account?: string

    created: string
    modified?: string
    approved_date?: string

    total: number
    subtotal?: number
    shipping?: number
    discount?: number
    tax?: number
    total_paid?: number

    delivery_type?: string

    payments?: Array<{
      payment_type?: string
      payment_method?: string
      payment_installments?: string
      payment_total?: number
    }>

    shipments?: Array<{
      nfe_key?: string
      nfe_number?: string
      nfe_serie?: string
      nfe_date?: string
    }>
  }
}


export interface PluggtoProductBody {
  idNerus: string
  idPluggto: string
  ean?: string
  name: string
  price: number
  pricePromotion?: number | null
  stock?: number
}



export interface PluggtoProductApi {
  Product: {
    id: string
    sku: string
    ean?: string
    name: string
    price: number
    special_price?: number
    quantity?: number
  }
}

export interface PluggtoApiResponse<T> {
  result: T[]
}
