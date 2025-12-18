import axios, { AxiosResponse } from 'axios'
import { getAccessToken } from './auth'
import { pluggtoConfig } from '../env.schema'
import {
  PluggtoApiResponse,
  PluggtoProductApi,
  PluggtoProductBody,
} from '../../../shared/types'

export async function buscarProdutosPluggto(): Promise<PluggtoProductBody[]> {
  let token = await getAccessToken()
  if (!token) return []

  let next: string | null = null
  const produtos: PluggtoProductBody[] = []
  let retryAuth = false

  do {
    try {
      const response: AxiosResponse<PluggtoApiResponse<PluggtoProductApi>> =
        await axios.get(`${pluggtoConfig.PLUGGTO_URL}/products`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100, next: next || undefined },
          timeout: 15000,
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

    } catch (error: any) {
      const status = error?.response?.status

      // 🔄 Token inválido/expirado → renova e tenta 1x
      if ((status === 401 || status === 403) && !retryAuth) {
        console.warn('[PLUGGTO] Token inválido, renovando...')
        retryAuth = true
        token = await getAccessToken(true)
        if (!token) return []
        continue
      }

      console.error('[PLUGGTO] Erro ao buscar produtos')

      if (error.response) {
        console.error('Status:', error.response.status)
        console.error('Body:', error.response.data)
      } else {
        console.error(error.message)
      }

      break
    }
  } while (next)

  return produtos
}
