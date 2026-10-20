import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

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

type ProdutoFixture = {
  id: number | string
  reference?: string | null
  name?: string | null
  stock?: number | string | null
}

type PaginaProdutos = {
  Products?: Array<{ Product: ProdutoFixture }>
  paging?: { total?: number }
}

type PaginaVariantes = {
  Variants?: Array<{ Variant: ProdutoFixture }>
  paging?: { total?: number }
}

type RespostaMock = PaginaProdutos | PaginaVariantes | { status: number }

function erroAxios(mensagem: string, status: number) {
  const erro = new Error(mensagem) as Error & Record<string, unknown>
  erro.isAxiosError = true
  erro.code = 'ERR_BAD_REQUEST'
  erro.response = { status }
  return erro
}

function criarPaginaProdutos(
  itens: ProdutoFixture[],
  total?: number
): PaginaProdutos {
  return {
    Products: itens.map(Product => ({ Product })),
    paging: { total: total ?? itens.length }
  }
}

function criarPaginaVariantes(
  itens: ProdutoFixture[],
  total?: number
): PaginaVariantes {
  return {
    Variants: itens.map(Variant => ({ Variant })),
    paging: { total: total ?? itens.length }
  }
}

/**
 * Mock do axios que separa `/products` de `/products/variants`, porque o
 * estoque da TrayCommerce é a soma dos dois catálogos.
 */
function criarAxiosMock(options: {
  products?: RespostaMock[]
  variants?: RespostaMock[]
  token?: string
}) {
  const products = options.products ?? []
  const variants = options.variants ?? []
  const requisicoes: Array<{
    tipo: 'products' | 'variants'
    pagina: number
    url: string
  }> = []

  return {
    requisicoes,

    get: async (url: string) => {
      const parsed = new URL(url)
      const tipo = parsed.pathname.includes('/products/variants')
        ? 'variants'
        : 'products'
      const pagina = Number(parsed.searchParams.get('page') ?? '1')

      requisicoes.push({ tipo, pagina, url })

      const paginas = tipo === 'variants' ? variants : products
      const resposta = paginas[pagina - 1]

      if (!resposta) {
        return {
          status: 200,
          data: tipo === 'variants' ? { Variants: [] } : { Products: [] }
        }
      }

      if ('status' in resposta) {
        throw erroAxios(
          `Request failed with status code ${resposta.status}`,
          resposta.status
        )
      }

      return { status: 200, data: resposta }
    },

    post: async () => ({
      status: 200,
      data: { access_token: options.token ?? 'token-traycommerce' }
    })
  }
}

async function carregarCliente(axiosMock: unknown) {
  applyTraycommerceTestEnv()
  clearModules([clientModulePath, utilsModulePath, envModulePath, coreEnvModulePath])

  return requireWithMocks<ClienteModule>(clientModulePath, {
    [axiosModulePath]: axiosMock
  })
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

export = async function runBuscarProdutosTraycommerceMockTest(): Promise<void> {
  await casoProdutosSemVariantes()
  await casoProdutosComVariantes()
  await casoPaginacaoDoCatalogo()
  await casoNormalizaCampos()
  await casoErroEmProductsPropaga()
}

/** Loja sem grade: /products/variants responde 404 e não derruba o ciclo. */
async function casoProdutosSemVariantes(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [
      criarPaginaProdutos([
        { id: 10, reference: 'SKU-10', name: 'Produto 10', stock: '5' },
        { id: 11, reference: 'SKU-11', name: 'Produto 11', stock: 0 }
      ])
    ],
    variants: [{ status: 404 }]
  })
  const cliente = await carregarCliente(axiosMock)

  const estoque = await cliente.buscarProdutosTraycommerce()

  assert.deepEqual(
    estoque.map(p => p.reference),
    ['SKU-10', 'SKU-11']
  )
  assert.ok(
    estoque.every(p => p.is_variant === false),
    'produto pai não pode ser marcado como variante'
  )
  assert.ok(
    axiosMock.requisicoes.some(r => r.tipo === 'variants'),
    'deve tentar /products/variants mesmo sem grade'
  )
}

/** Produto pai + grades: os dois catálogos entram com is_variant correto. */
async function casoProdutosComVariantes(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [
      criarPaginaProdutos([
        { id: 20, reference: 'PAI-20', name: 'Camiseta', stock: 7 }
      ])
    ],
    variants: [
      criarPaginaVariantes([
        { id: 201, reference: 'PAI-20-P', name: 'Camiseta P', stock: 2 },
        { id: 202, reference: 'PAI-20-M', name: 'Camiseta M', stock: 5 }
      ])
    ]
  })
  const cliente = await carregarCliente(axiosMock)

  const estoque = await cliente.buscarProdutosTraycommerce()

  assert.equal(estoque.length, 3)
  assert.deepEqual(
    estoque.map(p => [p.reference, p.is_variant]),
    [
      ['PAI-20', false],
      ['PAI-20-P', true],
      ['PAI-20-M', true]
    ]
  )
}

/** A parada é pelo `paging.total`, página a página. */
async function casoPaginacaoDoCatalogo(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [
      criarPaginaProdutos([{ id: 1, reference: 'SKU-1' }], 3),
      criarPaginaProdutos([{ id: 2, reference: 'SKU-2' }], 3),
      criarPaginaProdutos([{ id: 3, reference: 'SKU-3' }], 3)
    ],
    variants: []
  })
  const cliente = await carregarCliente(axiosMock)

  const estoque = await cliente.buscarProdutosTraycommerce()

  assert.deepEqual(
    axiosMock.requisicoes
      .filter(r => r.tipo === 'products')
      .map(r => r.pagina),
    [1, 2, 3]
  )
  assert.equal(estoque.length, 3)
}

/** `stock` vem string; vazio vira null e nunca NaN. */
async function casoNormalizaCampos(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [
      criarPaginaProdutos([
        { id: '30', reference: 'SKU-30', stock: '12' },
        { id: 31, reference: 'SKU-31', stock: '' },
        { id: 32, reference: 'SKU-32', name: null }
      ])
    ],
    variants: []
  })
  const cliente = await carregarCliente(axiosMock)

  const estoque = await cliente.buscarProdutosTraycommerce()

  const [p30, p31, p32] = estoque

  assert.equal(p30.id_tray, 30, 'id string precisa virar number')
  assert.equal(p30.stock, 12, 'stock string precisa virar number')
  assert.equal(p31.stock, null, 'stock vazio precisa ser null, nunca 0')
  assert.equal(p32.name, null)
}

/** Falha real em /products (não 404 de grade) tem que propagar. */
async function casoErroEmProductsPropaga(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [{ status: 401 }],
    variants: []
  })
  const cliente = await carregarCliente(axiosMock)

  await silenciandoErros(async () => {
    await assert.rejects(
      () => cliente.buscarProdutosTraycommerce(),
      /status code 401/
    )
  })
}
