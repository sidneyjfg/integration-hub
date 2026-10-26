export interface WakeOrderApi {
  /** Numero do pedido na Wake. */
  pedidoId: number | string
  /** Id da situacao atual do pedido. */
  situacaoPedidoId?: number | string | null
  /** Data do pedido em ISO 8601. */
  data?: string | null
  /** Valor total do pedido. */
  valorTotalPedido?: number | string | null
  /** Numero do pedido no marketplace, quando houver. */
  marketPlacePedidoId?: string | null
  /** Identificador do pedido na loja, quando houver. */
  identificador?: string | null
}

export interface WakeOrderStatusApi {
  situacaoPedidoId: number | string
  nome?: string | null
  descricao?: string | null
}

/** Linha normalizada do pedido para a tabela de monitoramento. */
export interface WakeOrderBody {
  ordnoweb: string
  ordnochannel: string
  status: string
  status_name: string | null
  total: number | null
  date: Date
}

/** Janela realmente consultada na API, usada no resumo da notificacao. */
export interface WakeBuscaPedidosResumo {
  from: string
  to: string
  total: number
}

export interface WakeProductStockApi {
  estoqueFisico?: number | string | null
  estoqueReservado?: number | string | null
  centroDistribuicaoId?: number | string | null
}

export interface WakeProductApi {
  /** Id da variante; e a chave da paginacao por cursor. */
  produtoVarianteId: number | string
  produtoId?: number | string | null
  /** Id do produto pai no canal externo, quando houver. */
  idPaiExterno?: string | null
  /** Id da variante no canal externo; e o `prdno` do Nérus. */
  idVinculoExterno?: string | null
  /** SKU/EAN mantido como referencia; o cruzamento usa o `prdno`. */
  sku?: string | null
  nome?: string | null
  precoCusto?: number | string | null
  precoDe?: number | string | null
  precoPor?: number | string | null
  fatorMultiplicadorPreco?: number | string | null
  valido?: boolean | null
  /** Vem preenchido com `camposAdicionais=Estoque`. */
  estoque?: WakeProductStockApi[] | null
}

/** Linha normalizada do catalogo para a tabela de preco. */
export interface WakePriceBody {
  produto_variante_id: number
  produto_id: number | null
  id_pai_externo: string | null
  /** `prdno` do Nérus, usado pelo ERP para cruzar a linha. */
  id_vinculo_externo: string
  sku: string
  nome: string | null
  preco_custo: number | null
  preco_de: number | null
  preco_por: number | null
  fator_multiplicador_preco: number | null
  /** 0/1: o ERP filtra os validos no SQL. */
  valido: number
}

/** Linha normalizada do catalogo para a tabela de estoque. */
export interface WakeStockBody {
  produto_variante_id: number
  id_pai_externo: string | null
  /** `prdno` do Nérus, usado pelo ERP para cruzar a linha. */
  id_vinculo_externo: string
  sku: string
  nome: string | null
  /** Soma dos centros de distribuicao; null quando a API nao mandou o array. */
  estoque_fisico: number | null
  estoque_reservado: number | null
}

/** Resultado da varredura do catalogo, com o indicador de paginacao completa. */
export interface WakeBuscaProdutosResultado {
  produtos: WakeProductApi[]
  completa: boolean
}
