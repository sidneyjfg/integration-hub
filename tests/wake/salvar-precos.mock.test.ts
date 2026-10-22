import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/wake/repositories/precos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/repositories/precos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarPrecosWakeMockTest(): Promise<void> {
  await casoSalvaPrecos()
  await casoListaVazia()
  await casoEnviaEmLotes()
  await casoRemoveNaoAtualizados()
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
    produto_id: id,
    id_pai_externo: null,
    id_vinculo_externo: `NERUS-${id}`,
    sku: `SKU-${id}`,
    nome: `Produto ${id}`,
    preco_custo: 10,
    preco_de: 100,
    preco_por: 90,
    fator_multiplicador_preco: 1,
    valido: 1
  }
}

async function casoSalvaPrecos(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []

  const repositorio = carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 2 }]
  })

  const afetadas = await repositorio.salvarPrecosWake([
    criarLinha(101),
    criarLinha(102)
  ])

  assert.equal(afetadas, 2)
  assert.equal(chamadas.length, 1)
  assert.match(
    chamadas[0].sql,
    /INSERT INTO monitoramento\.temp_wake_price/,
    'a tabela precisa ser a propria do hub'
  )
  assert.match(chamadas[0].sql, /ON DUPLICATE KEY UPDATE/)
  assert.match(chamadas[0].sql, /id_vinculo_externo/)

  const values = chamadas[0].params[0] as unknown[][]

  assert.equal(values.length, 2)
  assert.deepEqual(values[0], [
    101,
    101,
    null,
    'NERUS-101',
    'SKU-101',
    'Produto 101',
    10,
    100,
    90,
    1,
    1
  ])
}

async function casoListaVazia(): Promise<void> {
  let chamou = false

  const repositorio = carregarRepositorio(async () => {
    chamou = true
    return [{ affectedRows: 0 }]
  })

  const afetadas = await repositorio.salvarPrecosWake([])

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

  const afetadas = await repositorio.salvarPrecosWake(linhas)

  assert.equal(chamadas.length, 2)
  assert.equal((chamadas[0].params[0] as unknown[][]).length, 500)
  assert.equal((chamadas[1].params[0] as unknown[][]).length, 1)
  assert.equal(afetadas, 2)
}

/** A limpeza usa o `updated_at` anterior ao inicio do ciclo. */
async function casoRemoveNaoAtualizados(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []
  const desde = new Date('2026-10-22T12:00:00.000Z')

  const repositorio = carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 3 }]
  })

  const removidas =
    await repositorio.removerPrecosNaoAtualizadosWake(desde)

  assert.equal(removidas, 3)
  assert.equal(chamadas.length, 1)
  assert.match(
    chamadas[0].sql,
    /DELETE FROM monitoramento\.temp_wake_price/
  )
  assert.match(chamadas[0].sql, /updated_at < \?/)
  assert.deepEqual(chamadas[0].params, [desde])
}
