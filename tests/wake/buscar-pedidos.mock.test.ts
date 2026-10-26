import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  createWakeAxiosMock,
  criarPaginaPedidosWake,
  semEsperaReal
} from '../helpers/wake-axios-mock'

type ClienteModule = typeof import('../../src/integrations/wake/api/wake-client')

const clientModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/api/wake-client.ts'
)
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/utils.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/env.schema.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const axiosModulePath = require.resolve('axios')

/** Janela fixa: o teste nao deve depender de que dia da semana hoje e. */
const JANELA = { from: '2026-10-01 00:00:00', to: '2026-10-02 23:59:59' }

async function carregarCliente(axiosMock: unknown) {
  applyWakeTestEnv()
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

function requisicoesDePedidos(
  axiosMock: ReturnType<typeof createWakeAxiosMock>
) {
  return axiosMock.requisicoes.filter(r => r.tipo === 'pedidos')
}

/**
 * O client loga o erro inteiro em console.error. Nos casos onde a falha e o
 * que esta sendo testado, esse log e ruido esperado - e como ele imprime a
 * URL com o token, nao ha por que deixa-lo no log do teste.
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

export = async function runBuscarPedidosWakeMockTest(): Promise<void> {
  await casoParaPeloTotal()
  await casoPaginaAcimaDoLimite()
  await casoTimeoutRetenta()
  await casoTimeoutPersistente()
  await casoSemTotal()
  await casoSituacoes()
}

/**
 * A parada e pelo `x-total-count`, nao por pagina vazia. Sem isso o client
 * pede a pagina seguinte mesmo ja com tudo em maos, e se essa chamada
 * inutil der timeout o ciclo inteiro cai.
 */
async function casoParaPeloTotal(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginas: [
      criarPaginaPedidosWake({
        pedidos: [
          {
            pedidoId: '77',
            situacaoPedidoId: 1,
            valorTotalPedido: 100,
            data: '2026-10-01T18:53:24.846Z'
          },
          {
            pedidoId: '78',
            situacaoPedidoId: 9,
            valorTotalPedido: '250.50',
            data: '2026-10-02T10:00:00.000Z'
          }
        ],
        total: 2
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosWake())

  const requisicoes = requisicoesDePedidos(axiosMock)

  assert.equal(
    requisicoes.length,
    1,
    'com total 2 e limite 50, para na pagina 1 e nao pede a pagina 2'
  )
  assert.equal(pedidos.length, 2)

  const url = new URL(requisicoes[0].url)

  assert.equal(url.pathname, '/pedidos')
  assert.equal(url.searchParams.get('dataInicial'), JANELA.from)
  assert.equal(url.searchParams.get('dataFinal'), JANELA.to)
  assert.equal(url.searchParams.get('pagina'), '1')
  assert.equal(url.searchParams.get('quantidadeRegistros'), '50')
  assert.equal(
    url.searchParams.get('situacoesPedido'),
    null,
    'a busca nao filtra status: o usuario filtra no SQL'
  )
  assert.equal(
    requisicoes[0].headers?.Authorization,
    'token-wake-de-teste',
    'o token da loja vai no header Authorization'
  )

  const resumo = cliente.getUltimoResumoBuscaPedidosWake()

  assert.deepEqual(resumo, {
    from: JANELA.from,
    to: JANELA.to,
    total: 2
  })
}

/** Quando o total e maior que o limite, a paginacao precisa acontecer. */
async function casoPaginaAcimaDoLimite(): Promise<void> {
  const pagina = (n: number, ids: string[]) =>
    criarPaginaPedidosWake({
      pedidos: ids.map(id => ({ pedidoId: id })),
      total: 5
    })

  const axiosMock = createWakeAxiosMock({
    paginas: [pagina(1, ['1', '2']), pagina(2, ['3', '4']), pagina(3, ['5'])]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosWake())

  assert.deepEqual(
    requisicoesDePedidos(axiosMock).map(r => r.pagina),
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
  const axiosMock = createWakeAxiosMock({
    paginas: [
      criarPaginaPedidosWake({ pedidos: [{ pedidoId: '77' }], total: 1 })
    ],
    timeoutsPorPagina: { 1: [1] }
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosWake())

  assert.equal(pedidos.length, 1, 'o retry recupera o pedido da tentativa perdida')
  assert.deepEqual(
    requisicoesDePedidos(axiosMock).map(r => r.tentativa),
    [1, 2]
  )
}

/** Timeout em todas as tentativas: o erro precisa propagar. */
async function casoTimeoutPersistente(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginas: [
      criarPaginaPedidosWake({ pedidos: [{ pedidoId: '77' }], total: 1 })
    ],
    timeoutsPorPagina: { 1: [1, 2, 3, 4, 5, 6, 7] }
  })
  const cliente = await carregarCliente(axiosMock)

  await silenciandoErros(async () => {
    await assert.rejects(
      () => semEsperaReal(() => cliente.buscarPedidosWake()),
      /Falha transitória persistente na Wake \(código ECONNABORTED\)/
    )
  })

  // 1 tentativa inicial + MAX_TENTATIVAS retries
  assert.equal(requisicoesDePedidos(axiosMock).length, 6)
}

/** Sem `x-total-count` na resposta, a pagina vazia continua sendo o fim. */
async function casoSemTotal(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginas: [
      criarPaginaPedidosWake({
        pedidos: [{ pedidoId: '77' }],
        incluirTotal: false
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const pedidos = await semEsperaReal(() => cliente.buscarPedidosWake())

  assert.equal(pedidos.length, 1)
  assert.deepEqual(
    requisicoesDePedidos(axiosMock).map(r => r.pagina),
    [1, 2],
    'sem x-total-count, o fallback da pagina vazia ainda encerra o loop'
  )
}

/** /situacoesPedido e uma chamada unica, sem paginacao. */
async function casoSituacoes(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    situacoes: [
      { situacaoPedidoId: 1, nome: 'Pago', descricao: 'Pago' },
      {
        situacaoPedidoId: 9,
        nome: 'Pedido Enviado',
        descricao: 'Pedido Enviado'
      }
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const situacoes = await semEsperaReal(() =>
    cliente.buscarSituacoesPedidoWake()
  )

  assert.equal(situacoes.length, 2)

  const requisicao = axiosMock.requisicoes.find(r => r.tipo === 'situacoes')

  assert.ok(requisicao, 'deve chamar /situacoesPedido')
  assert.equal(new URL(requisicao!.url).pathname, '/situacoesPedido')
  assert.equal(requisicao!.headers?.Authorization, 'token-wake-de-teste')
}
