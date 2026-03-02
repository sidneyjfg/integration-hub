import type { AnymarketProductsResponse } from '../../../shared/types/anymarket'
import { anymarketConfig } from '../env.schema'

export interface BuscarProdutosParams {
  limit?: number
  offset?: number
  categoryId?: string
  externalId?: string
  sku?: string
}

export async function buscarProdutosAnymarket(
  params: BuscarProdutosParams = {}
): Promise<AnymarketProductsResponse> {
  const { limit = 100, offset = 0 } = params

  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  })

  const url = `${anymarketConfig.ANYMARKET_URL}/products?${queryParams.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      gumgaToken: anymarketConfig.ANYMARKET_GUMGATOKEN
    }
  })

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar produtos do Anymarket: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return data as AnymarketProductsResponse
}
