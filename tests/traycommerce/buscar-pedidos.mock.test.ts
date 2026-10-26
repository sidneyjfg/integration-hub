import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  createTraycommerceAxiosMock,
  criarPaginaOrdem,
  semEsperaReal
} from '../helpers/traycommerce-axios-mock'

type ClienteModule = typeof import('../../src/integrations/traycommerce/api/traycommerce-client')

const clientModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/api/traycommerce-client.ts'
)
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/utils.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/env.schema.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const axiosModulePath = require.resolve('axios')

/** Janela fixa: o teste nao deve depender de que dia da semana hoje e. */
const JANELA = { from: '20261001', to: '20261002' }

/** O schema le o env no import, entao a janela e fixa antes do require. */
async function carregarCliente(axiosMock: unknown) {
  applyTraycommerceTestEnv()
  clearModules([clientModulePath, utilsModulePath, envModulePath, coreEnvModulePath])

  const utilsReais = require(utilsModulePath)

  return requireWithMocks<ClienteModule>(clientModulePath, {
    [axiosModulePath]: axiosMock,
    [utilsModulePath]: {
      ...utilsReais,
      getDateRange: () => ({ ...JANELA })
    }
  })
}

function requisicoesDeOrders(axiosMock: {
  requisicoes: Array<{ pagina: number; tentativa: number; url: string }>
}) {
  return axiosMock.requisicoes.filter(r => r.url.includes('/orders'))
}

/**
 * O client loga o erro inteiro em console.error. Nos casos onde a falha e o
 * que esta sendo testado, esse log e ruido esperado - e como ele imprime a
 * URL com o access_token, nao ha por que deixa-lo no log do teste.
 */
async function silenciandoErros(fn: () => Promise<void>): Promise<void> {
  const real = console.error
  console.error = () => {}
  try {
    await fn()
  } finally {
    console.error = real
  }
}

export = async function runBuscarPedidosTraycommerceMockTest(): Promise<void> {
  await casoParaPeloTotal()
  await casoPaginaAcimaDoLimite()
  await casoTimeoutRetenta()
  await casoTimeoutPersistente()
  await casoFiltraStatusForaDaLista()
  await casoSemPagingTotal()
}

/**
 * A parada e pelo `paging.total`, nao por pagina vazia. Sem isso o client
 * pede a pagina seguinte mesmo ja com tudo em maos, e se essa chamada
 * inutil der timeout o ciclo inteiro cai - foi o que aconteceu com a
 * primeira loja real (14 pedidos baixados e perdidos por causa da pagina 2).
 */
async function casoParaPeloTotal(): Promise<void> {
  const axiosMock = createTraycommerceAxiosMock({
    paginas: [
      criarPaginaOrdem({ pedidos: [{ id: '77' }, { id: '78' }], total: 2 })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosTraycommerce())

  const requisicoes = requisicoesDeOrders(axiosMock)

  assert.equal(
    requisicoes.length,
    1,
    'com total 2 e limite 50, para na pagina 1 e nao pede a pagina 2'
  )
  assert.equal(requisicoes[0].pagina, 1)
  assert.equal(pedidos.length, 2)

  assert.match(
    requisicoes[0].url,
    /date=20261001,20261002/,
    'a janela vai na query da API'
  )
  assert.match(
    requisicoes[0].url,
    /access_token=token-traycommerce/,
    'o access_token vai na query, nao no header'
  )

  const resumo = cliente.getUltimoResumoBuscaPedidosTraycommerce()
  assert.equal(resumo.from, JANELA.from)
  assert.equal(resumo.to, JANELA.to)
}

/** Quando o total e maior que o limite, a paginacao precisa acontecer. */
async function casoPaginaAcimaDoLimite(): Promise<void> {
  const pagina = (n: number, ids: string[]) =>
    criarPaginaOrdem({ pedidos: ids.map(id => ({ id })), total: 5, pagina: n })

  const axiosMock = createTraycommerceAxiosMock({
    paginas: [pagina(1, ['1', '2']), pagina(2, ['3', '4']), pagina(3, ['5'])]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosTraycommerce())

  assert.deepEqual(
    requisicoesDeOrders(axiosMock).map(r => r.pagina),
    [1, 2, 3]
  )
  assert.equal(pedidos.length, 5)
}

/**
 * Timeout chega sem `response`, ou seja, sem status HTTP: o
 * `STATUS_RETRYABLES.has(undefined)` reprovava na hora. Uma pagina que deu
 * timeout pode ter respondido logo em seguida.
 */
async function casoTimeoutRetenta(): Promise<void> {
  const axiosMock = createTraycommerceAxiosMock({
    paginas: [criarPaginaOrdem({ pedidos: [{ id: '77' }], total: 1 })],
    timeoutsPorPagina: { 1: [1] }
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosTraycommerce())

  assert.equal(pedidos.length, 1, 'o retry recupera o pedido da tentativa perdida')
  assert.deepEqual(
    requisicoesDeOrders(axiosMock).map(r => r.tentativa),
    [1, 2]
  )
}

/** Timeout em todas as tentativas: o erro precisa propagar. */
async function casoTimeoutPersistente(): Promise<void> {
  const axiosMock = createTraycommerceAxiosMock({
    paginas: [criarPaginaOrdem({ pedidos: [{ id: '77' }], total: 1 })],
    timeoutsPorPagina: { 1: [1, 2, 3, 4, 5, 6, 7] }
  })
  const cliente = await carregarCliente(axiosMock)

  await silenciandoErros(async () => {
    await assert.rejects(
      () => semEsperaReal(() => cliente.buscarPedidosTraycommerce()),
      /Falha transitória persistente na TrayCommerce \(código ECONNABORTED\)/
    )
  })

  // 1 tentativa inicial + MAX_TENTATIVAS retries
  assert.equal(requisicoesDeOrders(axiosMock).length, 6)
}

/** Status fora de TRAYCOMMERCE_ORDER_STATUS_TO_GET sai fora da contagem. */
async function casoFiltraStatusForaDaLista(): Promise<void> {
  const axiosMock = createTraycommerceAxiosMock({
    paginas: [
      criarPaginaOrdem({
        pedidos: [
          { id: '77', status: '1' },
          { id: '78', status: '14' },
          { id: '79', status: '999' }
        ],
        total: 3
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosTraycommerce())

  assert.deepEqual(
    pedidos.map(p => p.id),
    ['77', '78']
  )

  const resumo = cliente.getUltimoResumoBuscaPedidosTraycommerce()
  assert.equal(resumo.totalPedidos, 2)
  assert.equal(resumo.ignorados, 1)
}

/** Sem `paging.total` na resposta, a pagina vazia continua sendo o fim. */
async function casoSemPagingTotal(): Promise<void> {
  const axiosMock = createTraycommerceAxiosMock({
    paginas: [
      criarPaginaOrdem({ pedidos: [{ id: '77' }], incluirTotal: false })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosTraycommerce())

  assert.equal(pedidos.length, 1)
  assert.deepEqual(
    requisicoesDeOrders(axiosMock).map(r => r.pagina),
    [1, 2],
    'sem paging.total, o fallback da pagina vazia ainda encerra o loop'
  )
}