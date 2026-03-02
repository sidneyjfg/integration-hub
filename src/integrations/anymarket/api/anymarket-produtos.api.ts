import type { AnymarketProductsResponse } from '../../../shared/types/anymarket'
import { anymarketConfig } from '../env.schema'

export interface BuscarProdutosParams {
  limit?: number
  offset?: number
  categoryId?: string
  externalId?: string
  sku?: string
}

/**
 * Busca uma página específica de produtos
 */
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

  const url = `${anymarketConfig.ANYMARKET_URL}/v2/products?${queryParams.toString()}`

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

  return response.json() as Promise<AnymarketProductsResponse>
}

/**
 * Busca TODOS os produtos percorrendo automaticamente as páginas via "next"
 */
export async function buscarTodosProdutosAnymarket(): Promise<
  AnymarketProductsResponse['content']
> {
  const limit = 100

  let url = `${anymarketConfig.ANYMARKET_URL}/v2/products?limit=${limit}&offset=0`

  const todosProdutos: AnymarketProductsResponse['content'] = []

  let safetyCounter = 0

  while (url && safetyCounter < 1000) {
    safetyCounter++

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

    const data =
      (await response.json()) as AnymarketProductsResponse

    todosProdutos.push(...data.content)

    const nextLink = data.links?.find(link => link.rel === 'next')

    url = nextLink?.href ?? ''
  }

  return todosProdutos
}