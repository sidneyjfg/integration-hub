import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  createWakeAxiosMock,
  criarPaginaProdutosWake,
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

async function carregarCliente(axiosMock: unknown) {
  applyWakeTestEnv()
  clearModules([clientModulePath, utilsModulePath, envModulePath, coreEnvModulePath])

  return requireWithMocks<ClienteModule>(clientModulePath, {
    [axiosModulePath]: axiosMock
  })
}

function requisicoesDeProdutos(
  axiosMock: ReturnType<typeof createWakeAxiosMock>
) {
  return axiosMock.requisicoes.filter(r => r.tipo === 'produtos')
}

async function silenciandoErros(fn: () => Promise<void>): Promise<void> {
  const real = console.error
  console.error = () => {}
  try {
    await fn()
  } finally {
    console.error = real
  }
}

export = async function runBuscarProdutosWakeMockTest(): Promise<void> {
  await casoCatalogoPorCursor()
  await casoSemProximaPagina()
  await casoCursorAusente()
  await casoHeaderTemProximaAusente()
  await casoTotalMaiorQueRecebido()
  await casoErroPropaga()
}

/**
 * O catalogo e percorrido pelo cursor devolvido no header, nunca por
 * `pagina` (depreciado em 21/09/2026). O `camposAdicionais=Estoque` entra
 * na mesma varredura que o preco.
 */
async function casoCatalogoPorCursor(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [
      criarPaginaProdutosWake({
        produtos: [
          {
            produtoVarianteId: 100,
            produtoId: 10,
            idPaiExterno: 'PAI-1',
            sku: 'SKU-100',
            precoDe: 100,
            precoPor: 90,
            valido: true
          },
          {
            produtoVarianteId: 200,
            produtoId: 20,
            sku: 'SKU-200',
            precoCusto: '50',
            precoDe: '200',
            precoPor: '180',
            fatorMultiplicadorPreco: 1.5,
            valido: false
          }
        ],
        temProximaPagina: true,
        ultimoProdutoVarianteId: 200,
        total: 5
      }),
      criarPaginaProdutosWake({
        produtos: [
          { produtoVarianteId: 300, sku: 'SKU-300' },
          { produtoVarianteId: 400, sku: 'SKU-400' }
        ],
        temProximaPagina: true,
        ultimoProdutoVarianteId: 400
      }),
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 500, sku: 'SKU-500' }],
        temProximaPagina: false,
        ultimoProdutoVarianteId: 500
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const { produtos, completa } = await semEsperaReal(() =>
    cliente.buscarProdutosWake()
  )

  assert.equal(produtos.length, 5)
  assert.equal(completa, true)

  const requisicoes = requisicoesDeProdutos(axiosMock)

  assert.equal(requisicoes.length, 3)
  assert.deepEqual(
    requisicoes.map(r => r.cursor),
    [null, '200', '400'],
    'a primeira pagina nao leva cursor e as demais levam o ultimo id'
  )

  for (const requisicao of requisicoes) {
    const url = new URL(requisicao.url)

    assert.equal(url.pathname, '/produtos')
    assert.equal(url.searchParams.get('quantidadeRegistros'), '50')
    assert.equal(url.searchParams.get('camposAdicionais'), 'Estoque')
    assert.equal(
      url.searchParams.get('pagina'),
      null,
      'a paginacao por pagina esta depreciada'
    )
    assert.equal(
      requisicao.headers?.Authorization,
      'token-wake-de-teste',
      'o token da loja vai no header Authorization'
    )
  }
}

/** `x-tem-proxima-pagina: false` encerra sem pedir outra pagina. */
async function casoSemProximaPagina(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
        temProximaPagina: false,
        ultimoProdutoVarianteId: 1
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const { produtos, completa } = await semEsperaReal(() =>
    cliente.buscarProdutosWake()
  )

  assert.equal(produtos.length, 1)
  assert.equal(completa, true)
  assert.equal(requisicoesDeProdutos(axiosMock).length, 1)
}

/** Sem cursor, insistir repetiria a mesma pagina para sempre. */
async function casoCursorAusente(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
        temProximaPagina: true,
        ultimoProdutoVarianteId: null
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const { produtos, completa } = await semEsperaReal(() =>
    cliente.buscarProdutosWake()
  )

  assert.equal(produtos.length, 1)
  assert.equal(
    completa,
    false,
    'sem cursor novo, a varredura fica marcada como incompleta'
  )
  assert.equal(
    requisicoesDeProdutos(axiosMock).length,
    1,
    'sem cursor novo, encerra em vez de repetir a pagina'
  )
}

/** Header ausente: o cursor ainda permite seguir para a proxima pagina. */
async function casoHeaderTemProximaAusente(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
        incluirTemProxima: false,
        ultimoProdutoVarianteId: 1
      }),
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 2, sku: 'SKU-2' }],
        temProximaPagina: false,
        ultimoProdutoVarianteId: 2
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const { produtos, completa } = await semEsperaReal(() =>
    cliente.buscarProdutosWake()
  )

  assert.equal(produtos.length, 2)
  assert.equal(completa, true)
  assert.deepEqual(
    requisicoesDeProdutos(axiosMock).map(r => r.cursor),
    [null, '1']
  )
}

/** Total maior que o recebido indica varredura parcial, mesmo sem erro. */
async function casoTotalMaiorQueRecebido(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [
      criarPaginaProdutosWake({
        produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
        temProximaPagina: false,
        ultimoProdutoVarianteId: 1,
        total: 5
      })
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const { produtos, completa } = await semEsperaReal(() =>
    cliente.buscarProdutosWake()
  )

  assert.equal(produtos.length, 1)
  assert.equal(completa, false)
  assert.equal(requisicoesDeProdutos(axiosMock).length, 1)
}

/** Erro real (401) nao e transitorio e precisa propagar. */
async function casoErroPropaga(): Promise<void> {
  const axiosMock = createWakeAxiosMock({
    paginasProdutos: [criarPaginaProdutosWake({ produtos: [] })],
    httpPorProdutoPagina: { 1: 401 }
  })
  const cliente = await carregarCliente(axiosMock)

  await silenciandoErros(async () => {
    await assert.rejects(
      () => cliente.buscarProdutosWake(),
      /status code 401/
    )
  })

  assert.equal(requisicoesDeProdutos(axiosMock).length, 1)
}
