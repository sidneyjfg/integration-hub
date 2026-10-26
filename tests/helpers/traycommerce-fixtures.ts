import type { TraycommerceOrderApi } from '../../src/shared/types/traycommerce'

/**
 * Payload no formato exato devolvido por GET /orders da TrayCommerce.
 * Os valores sao os observados na loja de homologacao: `id` e `total`
 * vem como string, `external_code` vem vazio e `OrderInvoice` vem como
 * array vazio quando o pedido ainda nao tem nota.
 */
export function createTraycommerceOrdersApiPayload() {
  return {
    paging: {
      total: 3,
      pages: 1,
      page: 1,
      limit: 50
    },
    Orders: [
      {
        Order: {
          id: '77',
          date: '2022-05-10',
          external_code: '',
          total: '1000.00',
          OrderStatus: {
            id: '1',
            status: 'A ENVIAR'
          },
          OrderInvoice: []
        }
      },
      {
        Order: {
          id: '78',
          date: '2022-05-10',
          external_code: 'VTX-12345',
          total: '250.50',
          OrderStatus: {
            id: '14',
            status: 'PAGO'
          },
          OrderInvoice: []
        }
      },
      {
        // campos ausentes/empty: exercita os fallbacks
        Order: {
          id: 79,
          date: '2022-05-11',
          external_code: null,
          total: '',
          OrderStatus: {
            id: '49',
            status: 'A ENVIAR'
          }
        }
      }
    ]
  }
}

/** Mesmo recorte que o cliente faz: devolve os `Order`, nao os wrappers. */
export function createTraycommerceOrders(): TraycommerceOrderApi[] {
  return createTraycommerceOrdersApiPayload().Orders.map(item => item.Order)
}
