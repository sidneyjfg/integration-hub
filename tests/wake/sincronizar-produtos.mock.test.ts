import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type ServicoModule = typeof import('../../src/integrations/wake/services/sincronizar-produtos-wake')

const serviceModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/services/sincronizar-produtos-wake.ts'
)
const clientModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/api/wake-client.ts'
)
const precosRepoModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/repositories/precos.repository.ts'
)
const estoqueRepoModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/repositories/estoque.repository.ts'
)
const notificationsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/notifications/google-chat.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/env.schema.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/utils.ts'
)

export = async function runSincronizarProdutosWakeMockTest(): Promise<void> {
  await casoNormalizaEPersiste()
  await casoSemProdutos()
  await casoSoInvalidos()
  await casoErroDoPrecoPropaga()
  await casoErroDoEstoquePropaga()
}

function carregarServico(options: {
  produtos: unknown[]
  salvarPrecos?: (linhas: unknown[]) => Promise<number>
  salvarEstoque?: (linhas: unknown[]) => Promise<number>
}) {
  const estado = { buscas: 0 }
  const salvosPrecos: unknown[][] = []
  const salvosEstoque: unknown[][] = []
  const oks: string[] = []
  const avisos: string[] = []

  applyWakeTestEnv()
  clearModules([
    serviceModulePath,
    clientModulePath,
    precosRepoModulePath,
    estoqueRepoModulePath,
    notificationsModulePath,
    envModulePath,
    coreEnvModulePath,
    utilsModulePath
  ])

  const servico = requireWithMocks<ServicoModule>(serviceModulePath, {
    [clientModulePath]: {
      buscarProdutosWake: async () => {
        estado.buscas++
        return options.produtos
      }
    },
    [precosRepoModulePath]: {
      salvarPrecosWake: async (linhas: unknown[]) => {
        salvosPrecos.push(linhas)
        return options.salvarPrecos
          ? options.salvarPrecos(linhas)
          : linhas.length
      }
    },
    [estoqueRepoModulePath]: {
      salvarEstoqueWake: async (linhas: unknown[]) => {
        salvosEstoque.push(linhas)
        return options.salvarEstoque
          ? options.salvarEstoque(linhas)
          : linhas.length
      }
    },
    [notificationsModulePath]: {
      notifyGoogleChat: async (mensagem: string) => {
        oks.push(mensagem)
      },
      notifyGoogleChatWarning: async (mensagem: string) => {
        avisos.push(mensagem)
      }
    }
  })

  return { servico, estado, salvosPrecos, salvosEstoque, oks, avisos }
}

/**
 * A normalizacao fica no servico: preco vazio vira null (nunca 0), preco 0
 * continua 0, e variante sem id nao vira linha sem chave. O estoque e a soma
 * dos centros de distribuicao; array vazio e zero, array ausente e null.
 */
async function casoNormalizaEPersiste(): Promise<void> {
  const { servico, estado, salvosPrecos, salvosEstoque, oks, avisos } =
    carregarServico({
      produtos: [
        {
          produtoVarianteId: '101',
          produtoId: '10',
          idPaiExterno: ' PAI-1 ',
          sku: ' SKU-101 ',
          nome: ' Produto 101 ',
          precoCusto: '10.5',
          precoDe: '100',
          precoPor: '',
          fatorMultiplicadorPreco: '1.2',
          valido: true,
          estoque: [
            {
              estoqueFisico: '5',
              estoqueReservado: '1',
              centroDistribuicaoId: 1
            },
            {
              estoqueFisico: 3,
              estoqueReservado: 0,
              centroDistribuicaoId: 2
            }
          ]
        },
        {
          produtoVarianteId: 102,
          valido: false
        },
        {
          produtoVarianteId: 0,
          sku: 'INVALIDO'
        },
        {
          produtoVarianteId: 'abc',
          sku: 'INVALIDO-2'
        },
        {
          produtoVarianteId: '103',
          sku: 'SKU-103',
          precoPor: 0,
          estoque: []
        }
      ]
    })

  await servico.sincronizarProdutosWake()

  assert.equal(estado.buscas, 1, 'uma unica varredura serve preco e estoque')
  assert.equal(salvosPrecos.length, 1)
  assert.equal(salvosEstoque.length, 1)

  const precos = salvosPrecos[0] as Array<Record<string, unknown>>
  const estoques = salvosEstoque[0] as Array<Record<string, unknown>>

  assert.equal(precos.length, 3, 'variante sem id e descartada')
  assert.equal(estoques.length, 3)

  assert.deepEqual(precos[0], {
    produto_variante_id: 101,
    produto_id: 10,
    id_pai_externo: 'PAI-1',
    sku: 'SKU-101',
    nome: 'Produto 101',
    preco_custo: 10.5,
    preco_de: 100,
    preco_por: null,
    fator_multiplicador_preco: 1.2,
    valido: 1
  })

  assert.deepEqual(precos[1], {
    produto_variante_id: 102,
    produto_id: null,
    id_pai_externo: null,
    sku: '',
    nome: null,
    preco_custo: null,
    preco_de: null,
    preco_por: null,
    fator_multiplicador_preco: null,
    valido: 0
  })

  assert.equal(precos[2].produto_variante_id, 103)
  assert.equal(precos[2].preco_por, 0, 'preco zero e valido, nao null')

  assert.deepEqual(estoques[0], {
    produto_variante_id: 101,
    sku: 'SKU-101',
    nome: 'Produto 101',
    estoque_fisico: 8,
    estoque_reservado: 1
  })

  assert.deepEqual(estoques[1], {
    produto_variante_id: 102,
    sku: '',
    nome: null,
    estoque_fisico: null,
    estoque_reservado: null
  })

  assert.deepEqual(estoques[2], {
    produto_variante_id: 103,
    sku: 'SKU-103',
    nome: null,
    estoque_fisico: 0,
    estoque_reservado: 0
  })

  assert.equal(oks.length, 1)
  assert.equal(avisos.length, 0)
}

async function casoSemProdutos(): Promise<void> {
  const { servico, salvosPrecos, salvosEstoque, oks, avisos } =
    carregarServico({ produtos: [] })

  await servico.sincronizarProdutosWake()

  assert.equal(salvosPrecos.length, 0)
  assert.equal(salvosEstoque.length, 0)
  assert.equal(oks.length, 0)
  assert.equal(avisos.length, 1)
}

async function casoSoInvalidos(): Promise<void> {
  const { servico, salvosPrecos, salvosEstoque, oks, avisos } =
    carregarServico({
      produtos: [{ produtoVarianteId: 0 }]
    })

  await servico.sincronizarProdutosWake()

  assert.equal(salvosPrecos.length, 0, 'sem chave valida nao ha o que gravar')
  assert.equal(salvosEstoque.length, 0)
  assert.equal(oks.length, 0)
  assert.equal(avisos.length, 1)
}

async function casoErroDoPrecoPropaga(): Promise<void> {
  const { servico, salvosEstoque, oks } = carregarServico({
    produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
    salvarPrecos: async () => {
      throw new Error('preco fora')
    }
  })

  await assert.rejects(() => servico.sincronizarProdutosWake(), /preco fora/)
  assert.equal(salvosEstoque.length, 0, 'estoque nem tenta salvar sem o preco')
  assert.equal(oks.length, 0)
}

async function casoErroDoEstoquePropaga(): Promise<void> {
  const { servico, salvosPrecos, oks } = carregarServico({
    produtos: [{ produtoVarianteId: 1, sku: 'SKU-1' }],
    salvarEstoque: async () => {
      throw new Error('estoque fora')
    }
  })

  await assert.rejects(() => servico.sincronizarProdutosWake(), /estoque fora/)
  assert.equal(salvosPrecos.length, 1, 'o preco ja tinha sido salvo')
  assert.equal(oks.length, 0)
}
