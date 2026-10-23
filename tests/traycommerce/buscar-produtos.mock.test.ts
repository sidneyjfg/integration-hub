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
  refreshToken?: string
  falharRenovacao?: boolean
  /** Chave `${tipo}:${pagina}` -> respostas por tentativa (1-based). */
  respostasPorTentativa?: Record<string, RespostaMock[]>
}) {
  const products = options.products ?? []
  const variants = options.variants ?? []
  const requisicoes: Array<{
    tipo: 'products' | 'variants'
    pagina: number
    url: string
  }> = []
  const autenticacoes: Array<{ metodo: 'POST' | 'GET'; url?: string }> = []
  const tentativasPorPagina = new Map<string, number>()
  let renovacoes = 0

  return {
    requisicoes,
    autenticacoes,

    get: async (url: string) => {
      const parsed = new URL(url)

      if (parsed.pathname.endsWith('/auth')) {
        autenticacoes.push({ metodo: 'GET', url })

        if (options.falharRenovacao) {
          throw erroAxios('Request failed with status code 401', 401)
        }

        return {
          status: 200,
          data: {
            access_token: `token-renovado-${++renovacoes}`,
            refresh_token: options.refreshToken ?? 'refresh-token-renovado'
          }
        }
      }

      const tipo = parsed.pathname.includes('/products/variants')
        ? 'variants'
        : 'products'
      const pagina = Number(parsed.searchParams.get('page') ?? '1')
      const chave = `${tipo}:${pagina}`
      const tentativa = (tentativasPorPagina.get(chave) ?? 0) + 1

      tentativasPorPagina.set(chave, tentativa)
      requisicoes.push({ tipo, pagina, url })

      const paginas = tipo === 'variants' ? variants : products
      const resposta =
        options.respostasPorTentativa?.[chave]?.[tentativa - 1] ??
        paginas[pagina - 1]

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

    post: async (url?: string) => {
      autenticacoes.push({ metodo: 'POST', url })

      return {
        status: 200,
        data: {
          access_token: options.token ?? 'token-traycommerce',
          refresh_token: options.refreshToken ?? 'refresh-token-traycommerce'
        }
      }
    }
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
  await casoTokenExpiradoRenovaERetomaPagina()
  await casoRenovacaoFalhaMantemErro()
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

/** Token vencido no meio da paginação: renova e repete a mesma página. */
async function casoTokenExpiradoRenovaERetomaPagina(): Promise<void> {
  const pagina2 = criarPaginaProdutos([{ id: 2, reference: 'SKU-2' }], 2)
  const axiosMock = criarAxiosMock({
    products: [
      criarPaginaProdutos([{ id: 1, reference: 'SKU-1' }], 2),
      pagina2
    ],
    variants: [],
    respostasPorTentativa: {
      'products:2': [{ status: 401 }, pagina2]
    }
  })
  const cliente = await carregarCliente(axiosMock)

  const estoque = await cliente.buscarProdutosTraycommerce()

  assert.deepEqual(
    estoque.map(p => p.reference),
    ['SKU-1', 'SKU-2']
  )
  assert.deepEqual(
    axiosMock.requisicoes
      .filter(r => r.tipo === 'products')
      .map(r => r.pagina),
    [1, 2, 2],
    'a página que tomou 401 precisa ser repetida uma vez'
  )
  assert.equal(
    axiosMock.autenticacoes.filter(a => a.metodo === 'GET').length,
    1,
    'o 401 precisa disparar uma renovação via refresh_token'
  )
}

/** Se refresh e code não resolverem, o 401 continua propagando. */
async function casoRenovacaoFalhaMantemErro(): Promise<void> {
  const axiosMock = criarAxiosMock({
    products: [{ status: 401 }],
    variants: [],
    falharRenovacao: true
  })
  const cliente = await carregarCliente(axiosMock)

  await silenciandoErros(async () => {
    await assert.rejects(
      () => cliente.buscarProdutosTraycommerce(),
      /status code 401/
    )
  })

  assert.deepEqual(
    axiosMock.autenticacoes.map(a => a.metodo),
    ['POST', 'GET', 'POST'],
    'deve tentar refresh_token e cair para o code'
  )
  assert.equal(
    axiosMock.requisicoes.filter(r => r.tipo === 'products').length,
    2,
    'só pode repetir a página uma vez'
  )
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
