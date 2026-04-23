import axios from 'axios'

function createPluggtoOrderApi(params: {
  id: string
  originalId: string
  status: 'delivered' | 'canceled' | 'approved' | 'invoiced'
  subStatus: string
  created: string
  modified: string
  approvedDate: string
  total: number
  subtotal: number
  shipping: number
  totalPaid: number
  paymentType: string
  paymentMethod: string
  paymentInstallments: string
  nfeKey: string
  nfeNumber: string
  nfeSerie: string
  nfeDate: string
  accountCode: string
}) {
  return {
    Order: {
      tags: {
        has_track: 1,
        has_invoice_xml: 1,
        has_invoice_pdf: 1,
        has_invoice_key: 1,
        has_invoice_number: 1,
        has_invoice_label: null,
        has_payment_form: null,
        has_track_url: null,
        has_label: null,
        has_category: null
      },
      commission: {
        comment: 'gold_special',
        fixed: 0,
        tax: 31.56,
        total_charged: 10.22
      },
      other_ids: [
        {
          client_id: 'db88c2ffe78f0992c1d7d7371f58ca47',
          code: Number(params.originalId),
          id: `other-${params.id}-1`
        },
        {
          client_id: '5998dbbd87a669f7a2b05c93faeb1143',
          code: Number(params.nfeNumber),
          id: `other-${params.id}-2`
        }
      ],
      status_history: [],
      substatus_history: [],
      log_history: [],
      log_permanent: [],
      payments: [
        {
          payment_type: params.paymentType,
          payment_installments: params.paymentInstallments,
          payment_method: params.paymentMethod,
          payment_total: params.totalPaid,
          external: null,
          payment_card_brand: null,
          payment_additional_info: null,
          payment_quota: null,
          payment_interest: null,
          payment_authorization_code: null,
          payment_acquirer_id: null,
          id: `payment-${params.id}`
        }
      ],
      items: [
        {
          commission: {
            fixed: 0,
            tax: 31.56,
            comment: 'gold_special',
            total_charged: 10.22
          },
          variation: {
            attributes: [],
            sku: `SKU-${params.id}`,
            external: `MLB-${params.id}`,
            name: `Produto ${params.id}`,
            id: null,
            ean: null,
            photo_url: null
          },
          attributes: [],
          sku: params.id,
          name: `Produto ${params.id}`,
          price: params.total,
          quantity: 1,
          total: params.total,
          original_sku: params.id,
          photo_url: `https://s3-sa-east-1.amazonaws.com/pluggto/${params.id}.jpg`,
          category: 'Casa, Móveis e Decoração',
          id: null,
          location: null,
          discount: null,
          tax: null,
          external: null,
          supplier_id: null,
          stock_code: null,
          place_code: null,
          price_code: null,
          shipping_cost: null,
          category_standard: null
        }
      ],
      shipments: [
        {
          label_info: {
            plp: null,
            logotipo: null,
            sender_name: null,
            sender_address: null,
            sender_city: null,
            sender_state: null,
            sender_zipcode: null
          },
          quotation_id: null,
          label_type: 'fulfillment',
          issues: [],
          shipping_items: [],
          documents: [
            {
              url: `https://s3-sa-east-1.amazonaws.com/pluggto-documents/${params.id}.xml`,
              type: 'invoice',
              external: null,
              id: `doc-xml-${params.id}`
            },
            {
              url: `https://s3-sa-east-1.amazonaws.com/pluggto-documents/${params.id}.pdf`,
              type: 'invoice_pdf',
              external: null,
              id: `doc-pdf-${params.id}`
            }
          ],
          freight: [],
          shipping_company: 'Fulfillment',
          shipping_method: 'fulfillment',
          external: null,
          estimate_delivery_date: '2025-04-29T03:00:00.000Z',
          track_code: `TRACK-${params.id}`,
          nfe_date: params.nfeDate,
          nfe_key: params.nfeKey,
          nfe_number: params.nfeNumber,
          nfe_serie: params.nfeSerie,
          date_delivered: '2025-05-08T06:57:07.000Z',
          error_message: null,
          quote: null,
          shipping_method_id: null,
          description: null,
          track_url: null,
          status: null,
          buffering_date: null,
          comment: null,
          date_shipped: null,
          date_cancelled: null,
          expected_collection_date: null,
          nfe_link: null,
          cfops: null,
          printed: null,
          id: `shipment-${params.id}`
        }
      ],
      sub_status: params.subStatus,
      status: params.status,
      channel: 'MercadoLivre',
      channel_account: 'LOJA MEBUKI',
      receiver_name: 'Carlos',
      receiver_lastname: 'Alberto Da Silva',
      currency: 'BRL',
      receiver_address: 'ascendido José Barbosa',
      receiver_address_number: '66',
      receiver_address_complement: 'centro',
      receiver_city: 'Itariri',
      receiver_state: 'São Paulo',
      receiver_country: 'Brasil',
      receiver_zipcode: '11760000',
      payment_intermediary: '03.007.331/0001-41',
      sale_intermediary: '03.007.331/0001-41',
      intermediary_seller_id: '1074689620',
      payer_name: 'carlos alberto',
      payer_lastname: 'silva',
      payer_address: 'ascendido José Barbosa',
      payer_address_number: '66',
      payer_address_complement: 'centro',
      payer_additional_info: 'centro',
      payer_city: 'Itariri',
      payer_state: 'São Paulo',
      payer_country: 'Brasil',
      payer_zipcode: '11760000',
      payer_email: `${params.originalId}@mercadolibre.com`,
      receiver_email: `${params.originalId}@mercadolibre.com`,
      payer_cpf: '27673589800',
      payer_tax_id: '27673589800',
      delivery_type: 'fulfillment',
      delivery_description: 'fulfillment',
      payer_neighborhood: 'bela vista',
      receiver_neighborhood: 'bela vista',
      expected_delivery_date: '2025-04-29T03:00:00.000Z',
      created: params.created,
      modified: params.modified,
      total_paid: params.totalPaid,
      total: params.total,
      shipping: params.shipping,
      subtotal: params.subtotal,
      external: Number(params.accountCode),
      original_id: params.originalId,
      seller_shipment_cost: 0,
      auto_reserve: true,
      payer_phone: '111111111',
      payer_phone_area: '11',
      receiver_phone: '111111111',
      receiver_phone_area: '11',
      user_id: '8203',
      created_by: 'db88c2ffe78f0992c1d7d7371f58ca47',
      ack: true,
      modified_by: 'db88c2ffe78f0992c1d7d7371f58ca47',
      approved_date: params.approvedDate,
      timestamp: 1746687427,
      expected_send_date: '2025-04-29T12:30:39.000Z',
      order_id: Number(params.originalId),
      user_client_id: null,
      input_service: null,
      tax: null,
      discount: null,
      discount_description: null,
      channel_account_id: null,
      receiver_address_reference: null,
      receiver_additional_info: null,
      receiver_phone2_area: null,
      receiver_phone2: null,
      receiver_cpf: null,
      receiver_schedule_date: null,
      receiver_schedule_period: null,
      payer_fullname: null,
      payer_gender: null,
      payer_address_reference: null,
      payer_phone2_area: null,
      payer_phone2: null,
      payer_schedule_date: null,
      payer_schedule_period: null,
      payer_cnpj: null,
      payer_razao_social: null,
      payer_ie: null,
      payer_im: null,
      payer_document: null,
      payer_company_name: null,
      payer_billing_info_id: null,
      deleted: null,
      comission: null,
      invoicing_accepted: null,
      invoicing_accepted_date: null,
      shipping_accepted: null,
      shipping_accepted_date: null,
      delivery_accepted: null,
      delivery_accepted_date: null,
      invoicing_informed: null,
      invoicing_informed_date: null,
      shipping_informed: null,
      shipping_informed_date: null,
      delivery_informed: null,
      delivery_informed_date: null,
      sla_ship: null,
      sla_delivery: null,
      label_printed: null,
      id: `mongo-${params.id}`
    }
  }
}

export function createPluggtoOrdersApiPayload() {
  return {
    total: 4,
    showing: 4,
    limit: 100,
    result: [
      createPluggtoOrderApi({
        id: 'PLG-1001',
        originalId: '2000011434004146',
        status: 'delivered',
        subStatus: 'waiting_expedition',
        created: '2025-04-27T12:30:39.691Z',
        modified: '2025-05-08T06:57:07.299Z',
        approvedDate: '2025-04-27T12:30:39.691Z',
        total: 32.38,
        subtotal: 32.38,
        shipping: 0,
        totalPaid: 32.38,
        paymentType: 'voucher',
        paymentMethod: 'pix',
        paymentInstallments: '1',
        nfeKey: '35250446884672000108550040002284651152736890',
        nfeNumber: '228465',
        nfeSerie: '4',
        nfeDate: '2025-04-28T05:07:48.000Z',
        accountCode: '135324'
      }),
      createPluggtoOrderApi({
        id: 'PLG-1002',
        originalId: '2000011434004147',
        status: 'canceled',
        subStatus: 'canceled',
        created: '2025-04-27T13:30:39.691Z',
        modified: '2025-05-08T07:57:07.299Z',
        approvedDate: '2025-04-27T13:30:39.691Z',
        total: 42.38,
        subtotal: 42.38,
        shipping: 0,
        totalPaid: 42.38,
        paymentType: 'voucher',
        paymentMethod: 'account_money',
        paymentInstallments: '1',
        nfeKey: '35250446884672000108550040002284651152736891',
        nfeNumber: '228466',
        nfeSerie: '4',
        nfeDate: '2025-04-28T06:07:48.000Z',
        accountCode: '135325'
      }),
      createPluggtoOrderApi({
        id: 'PLG-1003',
        originalId: '2000011434004148',
        status: 'approved',
        subStatus: 'ready_to_ship',
        created: '2025-04-27T14:30:39.691Z',
        modified: '2025-05-08T08:57:07.299Z',
        approvedDate: '2025-04-27T14:30:39.691Z',
        total: 52.38,
        subtotal: 52.38,
        shipping: 0,
        totalPaid: 52.38,
        paymentType: 'credit_card',
        paymentMethod: 'visa',
        paymentInstallments: '2',
        nfeKey: '35250446884672000108550040002284651152736892',
        nfeNumber: '228467',
        nfeSerie: '4',
        nfeDate: '2025-04-28T07:07:48.000Z',
        accountCode: '135326'
      }),
      createPluggtoOrderApi({
        id: 'PLG-1004',
        originalId: '2000011434004149',
        status: 'invoiced',
        subStatus: 'invoice_emitted',
        created: '2025-04-27T15:30:39.691Z',
        modified: '2025-05-08T09:57:07.299Z',
        approvedDate: '2025-04-27T15:30:39.691Z',
        total: 62.38,
        subtotal: 62.38,
        shipping: 0,
        totalPaid: 62.38,
        paymentType: 'boleto',
        paymentMethod: 'boleto',
        paymentInstallments: '1',
        nfeKey: '35250446884672000108550040002284651152736893',
        nfeNumber: '228468',
        nfeSerie: '4',
        nfeDate: '2025-04-28T08:07:48.000Z',
        accountCode: '135327'
      })
    ]
  }
}

export function createPluggtoAxiosMock(options?: {
  notifications?: Array<{ url: string; body: any }>
  ordersPayload?: ReturnType<typeof createPluggtoOrdersApiPayload>
}) {
  const notifications = options?.notifications ?? []
  const ordersPayload = options?.ordersPayload ?? createPluggtoOrdersApiPayload()

  return {
    get: async (url: string, config?: { params?: { next?: string } }) => {
      if (url.includes('/orders')) {
        if (config?.params?.next) {
          return {
            status: 200,
            data: { result: [] }
          }
        }

        return {
          status: 200,
          data: ordersPayload
        }
      }

      throw new Error(`GET não mockado para URL: ${url}`)
    },
    post: async (url: string, body: any) => {
      if (url.includes('/oauth/token')) {
        return {
          status: 200,
          data: {
            access_token: 'token-pluggto',
            expires_in: 3600
          }
        }
      }

      notifications.push({ url, body })

      return axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
  }
}
