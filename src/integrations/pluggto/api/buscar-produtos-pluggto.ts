import axios, { AxiosResponse } from 'axios'
import { getAccessToken } from './auth'
import { pluggtoConfig } from '../env.schema'
import { PluggtoApiResponse, PluggtoProductApi, PluggtoProductBody } from '../../../shared/types'

export async function buscarProdutosPluggto(): Promise<PluggtoProductBody[]> {
  const token = await getAccessToken()
  if (!token) return []

  let next: string | null = null
  const produtos: PluggtoProductBody[] = []

  do {
    const response: AxiosResponse<PluggtoApiResponse<PluggtoProductApi>> =
      await axios.get(`${pluggtoConfig.PLUGGTO_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100, next: next || undefined },
      })

    const lote = response.data.result

    for (const item of lote) {
      produtos.push({
        idNerus: item.Product.sku,
        idPluggto: item.Product.id,
        ean: item.Product.ean,
        name: item.Product.name,
        price: item.Product.price,
        pricePromotion: item.Product.special_price,
        stock: item.Product.quantity,
      })
    }

    next = lote.length ? lote[lote.length - 1].Product.id : null
  } while (next)

  return produtos
}
