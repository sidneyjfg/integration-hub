import assert from 'node:assert/strict'
import path from 'node:path'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

export = async function run(): Promise<void> {
  const raiz = path.resolve(__dirname, '../../src/integrations/mercadolivre')
  const modulo = path.join(raiz, 'api/buscar-pedidos-mercadolivre.ts')
  clearModules([modulo])
  const consultas: any[] = []
  let excederViaErro = false
  let excederSempre = false
  let falhasTransitorias = 0
  const api = requireWithMocks<typeof import('../../src/integrations/mercadolivre/api/buscar-pedidos-mercadolivre')>(modulo, {
    [require.resolve('axios')]: {
      get: async (url: string, config: any) => {
        if (url.includes('/shipments/')) return { data: { logistic: { type: 'fulfillment' } } }
        const params = config.params
        consultas.push(params)
        if (falhasTransitorias > 0) {
          falhasTransitorias--
          throw { response: { status: 503 } }
        }
        assert.ok(params.offset < 10000)
        const de = Date.parse(params['order.date_closed.from'])
        const ate = Date.parse(params['order.date_closed.to'])
        if (excederSempre || ate - de > 43200000) {
          if (excederViaErro) throw { response: { status: 400, data: { error: 'limit.maximum_exceeded' } } }
          return { status: 200, data: { paging: { total: 13754 }, results: [] } }
        }
        const pedido = (instante: number, valor: number) => ({ id: String(instante), date_closed: new Date(instante).toISOString(), total_amount: valor, shipping: { id: String(instante) } })
        return { status: 200, data: { paging: { total: 2 }, results: [pedido(de, 10), pedido(ate, 10)] } }
      },
    },
    [path.join(raiz, 'api/auth.ts')]: { getCachedAccessToken: () => 'token-ficticio' },
    [path.join(raiz, 'repositories/mercadolivre-notas.repository.ts')]: {
      buscarCredenciaisMercadoLivre: async () => [{ clienteId: 'conta-teste' }],
    },
  })
  const resumo = await api.buscarResumoDiarioValoresPedidosMercadoLivre('20261001', '20261002')
  assert.equal(resumo.pedidosConsultados, 2, 'Fronteiras não devem duplicar pedidos nem incluir o dia seguinte')
  assert.equal(resumo.valoresPorDia['20261001'], 20)
  assert.equal(consultas.length, 3, 'Divide antes de percorrer milhares de páginas')
  excederViaErro = true
  consultas.length = 0
  assert.equal((await api.buscarResumoDiarioValoresPedidosMercadoLivre('20261001', '20261002')).pedidosConsultados, 2)
  assert.equal(consultas.length, 3)
  const temporizadorOriginal = global.setTimeout
  global.setTimeout = ((callback: () => void) => { callback(); return 0 }) as any
  try {
    falhasTransitorias = 1
    assert.equal((await api.buscarResumoDiarioValoresPedidosMercadoLivre('20261001', '20261002')).pedidosConsultados, 2)
    assert.equal(falhasTransitorias, 0, 'Falha 503 deve ser repetida')
  } finally {
    global.setTimeout = temporizadorOriginal
  }
  excederSempre = true
  await assert.rejects(api.buscarResumoDiarioValoresPedidosMercadoLivre('20261001', '20261002'), /Mais de 10000 pedidos em uma hora/)
  clearModules([modulo])
}
