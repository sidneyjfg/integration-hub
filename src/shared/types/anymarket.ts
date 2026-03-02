export interface AnymarketOrderBody {
  id: string
  marketplaceId?: string
  marketPlace?: string
  status?: string
  fulfillment?: boolean
  createdAt?: string
  // novos campos
  gross?: number          // Total bruto sem frete
  discount?: number       // Valor de desconto
  total?: number          // Total final
}


export interface ResultadoComparacaoPedido {
  DATA: string;
  ID_ANYMARKET: string;
  PEDIDO: string;
  MARKETPLACE: string;
  STATUS_ANY: string;
  FULFILLMENT: string;
}

export type ContextoLogSincronizacaoPedidos =
  | { totalPedidos: number }
  | { erro: unknown }

// Product Types
export interface AnymarketProductSku {
  id: number
  title: string
  partnerId: string
  ean?: string
  price?: number
  amount?: number
  stockLocalId?: number
}

export interface AnymarketProduct {
  id: number
  title: string
  isProductActive: boolean
  skus: AnymarketProductSku[]
}

export interface AnymarketProductsResponse {
  content: AnymarketProduct[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type ContextoLogSincronizacaoProdutos =
  | { totalProdutos: number }
  | { erro: unknown }
