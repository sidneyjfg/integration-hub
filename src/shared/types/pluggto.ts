export interface PluggtoOrderBody {
  ordnoweb: string
  ordnochannel: string
  nfe_key?: string
  date: string
  status: string
}

export interface PluggtoProductBody {
  idNerus: string
  idPluggto: string
  ean?: string
  name: string
  price: number
  pricePromotion?: number
  stock?: number
}

export interface PluggtoOrderApi {
  Order: {
    id: string
    original_id?: string
    status: string
    created: string
    shipments?: Array<{
      nfe_key?: string
    }>
  }
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
