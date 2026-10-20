import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/traycommerce/repositories/produtos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/repositories/produtos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarEstoqueTraycommerceMockTest(): Promise<void> {
  await casoUpsertEmLote()
  await casoListaVazia()
}

async function carregarRepositorio(query: (
  sql: string,
  params: unknown[]
) => Promise<unknown>) {
  applyTraycommerceTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  return requireWithMocks<RepositoryModule>(repositoryModulePath, {
    [coreDbModulePath]: {
      poolMonitoramento: { query }
    }
  })
}

async function casoUpsertEmLote(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []

  const repositorio = await carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 2 }]
  })

  const afetadas = await repositorio.salvarEstoqueTraycommerce([
    {
      id_tray: 10,
      reference: 'SKU-10',
      name: 'Produto 10',
      stock: 5,
      is_variant: false
    },
    {
      id_tray: 11,
      reference: 'SKU-11',
      name: null,
      stock: null,
      is_variant: true
    }
  ])

  assert.equal(afetadas, 2)
  assert.equal(chamadas.length, 1, 'o lote inteiro precisa ir em um INSERT só')

  const { sql, params } = chamadas[0]

  assert.match(
    sql,
    /INSERT INTO monitoramento\.temp_traycommerce_stock/,
    'a tabela é própria do hub, não `temp_products`'
  )
  assert.match(sql, /VALUES \?/)
  assert.match(sql, /ON DUPLICATE KEY UPDATE/)
  assert.match(sql, /updated_at = CURRENT_TIMESTAMP/)
  assert.doesNotMatch(sql, /price/, 'estoque não grava preço')

  const valores = params[0] as unknown[][]

  assert.deepEqual(valores, [
    [10, 'SKU-10', 'Produto 10', 5, 0],
    [11, 'SKU-11', null, null, 1]
  ])
}

async function casoListaVazia(): Promise<void> {
  let chamou = false

  const repositorio = await carregarRepositorio(async () => {
    chamou = true
    return [{ affectedRows: 0 }]
  })

  const afetadas = await repositorio.salvarEstoqueTraycommerce([])

  assert.equal(afetadas, 0)
  assert.equal(chamou, false, 'lista vazia não pode executar SQL')
}
