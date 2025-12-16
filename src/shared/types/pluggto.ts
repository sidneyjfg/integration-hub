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
