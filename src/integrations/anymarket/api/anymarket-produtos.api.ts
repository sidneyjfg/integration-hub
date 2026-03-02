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
  const { limit = 100, offset = 0, categoryId, externalId, sku } = params

  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  })

  if (categoryId) queryParams.append('categoryId', categoryId)
  if (externalId) queryParams.append('externalId', externalId)
  if (sku) queryParams.append('sku', sku)

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
