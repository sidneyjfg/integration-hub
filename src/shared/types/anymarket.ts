export interface AnymarketOrderBody {
  id: string
  marketplaceId?: string
  marketPlace?: string
  status?: string
  fulfillment?: boolean
  createdAt?: string
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
