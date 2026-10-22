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
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/utils.ts'
)

export = async function runSincronizarProdutosWakeMockTest(): Promise<void> {
  await casoNormalizaEPersiste()
  await casoSemProdutos()
  await casoSoInvalidos()
  await casoVarreduraIncompletaNaoLimpa()
  await casoErroDoPrecoPropaga()
  await casoErroDoEstoquePropaga()
}

function carregarServico(options: {
  produtos: unknown[]
  completa?: boolean
  salvarPrecos?: (linhas: unknown[]) => Promise<number>
  salvarEstoque?: (linhas: unknown[]) => Promise<number>
  removerPrecos?: (desde: Date) => Promise<number>
  removerEstoque?: (desde: Date) => Promise<number>
}) {
  const estado = { buscas: 0, agoras: 0 }
  const inicio = new Date('2026-10-22T12:00:00.000Z')
  const salvosPrecos: unknown[][] = []
  const salvosEstoque: unknown[][] = []
  const limpezasPrecos: Date[] = []
  const limpezasEstoque: Date[] = []
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
    coreDbModulePath,
    utilsModulePath
  ])

  const servico = requireWithMocks<ServicoModule>(serviceModulePath, {
    [clientModulePath]: {
      buscarProdutosWake: async () => {
        estado.buscas++
        return {
          produtos: options.produtos,
          completa: options.completa ?? true
        }
      }
    },
    [coreDbModulePath]: {
      agoraMonitoramento: async () => {
        estado.agoras++
        return inicio
      }
    },
    [precosRepoModulePath]: {
      salvarPrecosWake: async (linhas: unknown[]) => {
        salvosPrecos.push(linhas)
        return options.salvarPrecos
          ? options.salvarPrecos(linhas)
          : linhas.length
      },
      removerPrecosNaoAtualizadosWake: async (desde: Date) => {
        limpezasPrecos.push(desde)
        return options.removerPrecos ? options.removerPrecos(desde) : 0
      }
    },
    [estoqueRepoModulePath]: {
      salvarEstoqueWake: async (linhas: unknown[]) => {
        salvosEstoque.push(linhas)
        return options.salvarEstoque
          ? options.salvarEstoque(linhas)
          : linhas.length
      },
      removerEstoqueNaoAtualizadosWake: async (desde: Date) => {
        limpezasEstoque.push(desde)
        return options.removerEstoque ? options.removerEstoque(desde) : 0
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

  return {
    servico,
    estado,
    inicio,
    salvosPrecos,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks,
    avisos
  }
}

/**
 * A normalizacao fica no servico: preco vazio vira null (nunca 0), preco 0
 * continua 0, e variante sem id nao vira linha sem chave. O estoque e a soma
 * dos centros de distribuicao; array vazio e zero, array ausente e null.
 *
 * Tambem cobre o filtro novo: `valido = false`, variante sem chave e produto
 * sem `id_vinculo_externo` (o `prdno` do Nérus) nao entram.
 */
async function casoNormalizaEPersiste(): Promise<void> {
  const {
    servico,
    estado,
    inicio,
    salvosPrecos,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks,
    avisos
  } = carregarServico({
    produtos: [
      {
        produtoVarianteId: '101',
        produtoId: '10',
        idPaiExterno: ' PAI-1 ',
        idVinculoExterno: ' 1528 ',
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
        idVinculoExterno: '102',
        valido: false
      },
      {
        produtoVarianteId: 0,
        idVinculoExterno: '103',
        sku: 'INVALIDO'
      },
      {
        produtoVarianteId: 'abc',
        idVinculoExterno: '104',
        sku: 'INVALIDO-2'
      },
      {
        produtoVarianteId: '105',
        idPaiExterno: 'PAI-105',
        sku: 'SEM-NERUS'
      },
      {
        produtoVarianteId: '106',
        idVinculoExterno: '106',
        sku: 'SKU-106',
        precoPor: 0,
        estoque: []
      }
    ]
  })

  await servico.sincronizarProdutosWake()

  assert.equal(estado.buscas, 1, 'uma unica varredura serve preco e estoque')
  assert.equal(estado.agoras, 1, 'o horario do banco e lido uma vez')
  assert.equal(salvosPrecos.length, 1)
  assert.equal(salvosEstoque.length, 1)
  assert.equal(limpezasPrecos.length, 1)
  assert.equal(limpezasEstoque.length, 1)
  assert.equal(limpezasPrecos[0], inicio)
  assert.equal(limpezasEstoque[0], inicio)

  const precos = salvosPrecos[0] as Array<Record<string, unknown>>
  const estoques = salvosEstoque[0] as Array<Record<string, unknown>>

  assert.equal(precos.length, 2, 'invalidos e sem chave sao descartados')
  assert.equal(estoques.length, 2)

  assert.deepEqual(precos[0], {
    produto_variante_id: 101,
    produto_id: 10,
    id_pai_externo: 'PAI-1',
    id_vinculo_externo: '1528',
    sku: 'SKU-101',
    nome: 'Produto 101',
    preco_custo: 10.5,
    preco_de: 100,
    preco_por: null,
    fator_multiplicador_preco: 1.2,
    valido: 1
  })

  assert.deepEqual(precos[1], {
    produto_variante_id: 106,
    produto_id: null,
    id_pai_externo: null,
    id_vinculo_externo: '106',
    sku: 'SKU-106',
    nome: null,
    preco_custo: null,
    preco_de: null,
    preco_por: 0,
    fator_multiplicador_preco: null,
    valido: 1
  })

  assert.deepEqual(estoques[0], {
    produto_variante_id: 101,
    id_pai_externo: 'PAI-1',
    id_vinculo_externo: '1528',
    sku: 'SKU-101',
    nome: 'Produto 101',
    estoque_fisico: 8,
    estoque_reservado: 1
  })

  assert.deepEqual(estoques[1], {
    produto_variante_id: 106,
    id_pai_externo: null,
    id_vinculo_externo: '106',
    sku: 'SKU-106',
    nome: null,
    estoque_fisico: 0,
    estoque_reservado: 0
  })

  assert.equal(oks.length, 1)
  assert.equal(avisos.length, 0)
}

async function casoSemProdutos(): Promise<void> {
  const {
    servico,
    estado,
    salvosPrecos,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks,
    avisos
  } = carregarServico({ produtos: [] })

  await servico.sincronizarProdutosWake()

  assert.equal(estado.buscas, 1)
  assert.equal(estado.agoras, 0, 'catalogo vazio nao dispara consulta de horario')
  assert.equal(salvosPrecos.length, 0)
  assert.equal(salvosEstoque.length, 0)
  assert.equal(limpezasPrecos.length, 0)
  assert.equal(limpezasEstoque.length, 0)
  assert.equal(oks.length, 0)
  assert.equal(avisos.length, 1)
}

async function casoSoInvalidos(): Promise<void> {
  const {
    servico,
    estado,
    inicio,
    salvosPrecos,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks,
    avisos
  } = carregarServico({
    produtos: [
      { produtoVarianteId: 1, idVinculoExterno: '1', valido: false },
      { produtoVarianteId: 2, valido: true }
    ]
  })

  await servico.sincronizarProdutosWake()

  assert.equal(estado.agoras, 1)
  assert.equal(salvosPrecos.length, 0, 'sem produto valido nao ha o que gravar')
  assert.equal(salvosEstoque.length, 0)
  assert.deepEqual(limpezasPrecos, [inicio], 'invalidos antigos sao removidos')
  assert.deepEqual(limpezasEstoque, [inicio])
  assert.equal(oks.length, 0)
  assert.equal(avisos.length, 1)
}

/** Se a paginacao parou no meio, grava o que veio mas nao limpa nada. */
async function casoVarreduraIncompletaNaoLimpa(): Promise<void> {
  const {
    servico,
    estado,
    salvosPrecos,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks,
    avisos
  } = carregarServico({
    completa: false,
    produtos: [
      { produtoVarianteId: 1, idVinculoExterno: '1', sku: 'SKU-1' }
    ]
  })

  await servico.sincronizarProdutosWake()

  assert.equal(estado.agoras, 0)
  assert.equal(salvosPrecos.length, 1)
  assert.equal(salvosEstoque.length, 1)
  assert.equal(limpezasPrecos.length, 0)
  assert.equal(limpezasEstoque.length, 0)
  assert.equal(oks.length, 1)
  assert.equal(avisos.length, 0)
}

async function casoErroDoPrecoPropaga(): Promise<void> {
  const {
    servico,
    estado,
    salvosEstoque,
    limpezasPrecos,
    limpezasEstoque,
    oks
  } = carregarServico({
    produtos: [
      { produtoVarianteId: 1, idVinculoExterno: '1', sku: 'SKU-1' }
    ],
    salvarPrecos: async () => {
      throw new Error('preco fora')
    }
  })

  await assert.rejects(() => servico.sincronizarProdutosWake(), /preco fora/)
  assert.equal(estado.agoras, 1)
  assert.equal(salvosEstoque.length, 0, 'estoque nem tenta salvar sem o preco')
  assert.equal(limpezasPrecos.length, 0)
  assert.equal(limpezasEstoque.length, 0)
  assert.equal(oks.length, 0)
}

async function casoErroDoEstoquePropaga(): Promise<void> {
  const {
    servico,
    estado,
    salvosPrecos,
    limpezasPrecos,
    limpezasEstoque,
    oks
  } = carregarServico({
    produtos: [
      { produtoVarianteId: 1, idVinculoExterno: '1', sku: 'SKU-1' }
    ],
    salvarEstoque: async () => {
      throw new Error('estoque fora')
    }
  })

  await assert.rejects(() => servico.sincronizarProdutosWake(), /estoque fora/)
  assert.equal(estado.agoras, 1)
  assert.equal(salvosPrecos.length, 1, 'o preco ja tinha sido salvo')
  assert.equal(limpezasPrecos.length, 0)
  assert.equal(limpezasEstoque.length, 0)
  assert.equal(oks.length, 0)
}
