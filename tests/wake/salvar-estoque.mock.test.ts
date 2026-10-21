import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/wake/repositories/estoque.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/repositories/estoque.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarEstoqueWakeMockTest(): Promise<void> {
  await casoSalvaEstoque()
  await casoListaVazia()
  await casoEnviaEmLotes()
}

function carregarRepositorio(
  query: (sql: string, params: unknown[]) => Promise<unknown>
) {
  applyWakeTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  return requireWithMocks<RepositoryModule>(repositoryModulePath, {
    [coreDbModulePath]: {
      poolMonitoramento: { query }
    }
  })
}

function criarLinha(id: number) {
  return {
    produto_variante_id: id,
    sku: `SKU-${id}`,
    nome: `Produto ${id}`,
    estoque_fisico: 10,
    estoque_reservado: 2
  }
}

async function casoSalvaEstoque(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []

  const repositorio = carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 2 }]
  })

  const afetadas = await repositorio.salvarEstoqueWake([
    criarLinha(101),
    criarLinha(102)
  ])

  assert.equal(afetadas, 2)
  assert.equal(chamadas.length, 1)
  assert.match(
    chamadas[0].sql,
    /INSERT INTO monitoramento\.temp_wake_stock/,
    'a tabela precisa ser a propria do hub'
  )
  assert.match(chamadas[0].sql, /ON DUPLICATE KEY UPDATE/)

  const values = chamadas[0].params[0] as unknown[][]

  assert.equal(values.length, 2)
  assert.deepEqual(values[0], [101, 'SKU-101', 'Produto 101', 10, 2])
}

async function casoListaVazia(): Promise<void> {
  let chamou = false

  const repositorio = carregarRepositorio(async () => {
    chamou = true
    return [{ affectedRows: 0 }]
  })

  const afetadas = await repositorio.salvarEstoqueWake([])

  assert.equal(afetadas, 0)
  assert.equal(chamou, false, 'lista vazia nao pode executar SQL')
}

/** O catalogo passa de 16 mil variantes: um INSERT unico vira pacote enorme. */
async function casoEnviaEmLotes(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []

  const repositorio = carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 1 }]
  })

  const linhas = Array.from({ length: 501 }, (_, i) => criarLinha(i + 1))

  const afetadas = await repositorio.salvarEstoqueWake(linhas)

  assert.equal(chamadas.length, 2)
  assert.equal((chamadas[0].params[0] as unknown[][]).length, 500)
  assert.equal((chamadas[1].params[0] as unknown[][]).length, 1)
  assert.equal(afetadas, 2)
}
