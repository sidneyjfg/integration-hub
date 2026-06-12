import assert from 'node:assert/strict'
import path from 'node:path'

import calculateDate from '../../src/integrations/mercadolivre/utils/calculateDate'
import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/env.schema.ts'
)
const coreEnvModulePath = path.resolve(
  __dirname,
  '../../src/core/env.schema.ts'
)
const coreDbModulePath = path.resolve(
  __dirname,
  '../../src/core/db.ts'
)

function loadRepository(overrides: Record<string, string> = {}) {
  applyMercadoLivreTestEnv(overrides)

  clearModules([
    repositoryModulePath,
    envModulePath,
    coreEnvModulePath,
    coreDbModulePath
  ])

  const queries: Array<{ sql: string; params: unknown[] }> = []
  const dbMock = {
    poolMain: {
      query: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params: params ?? [] })

        if (sql.includes('SELECT xano, ordno, storeno, date')) {
          return [[]]
        }

        return [{ affectedRows: 2 }]
      }
    },
    poolMonitoramento: {}
  }

  const repository = requireWithMocks<RepositoryModule>(
    repositoryModulePath,
    {
      [coreDbModulePath]: dbMock
    }
  )

  return {
    repository,
    queries
  }
}

export = async function runAtualizarNfcacheEtiquetaIntegrationTest(): Promise<void> {
  const hoje = calculateDate(0)

  const defaultLoad = loadRepository()
  const defaultAffectedRows =
    await defaultLoad.repository.atualizarNfcacheEtiquetaDiaAtual()

  assert.equal(defaultAffectedRows, 2)
  assert.equal(defaultLoad.queries.length, 2)
  assert.match(defaultLoad.queries[0].sql, /AND date = \?/)
  assert.deepEqual(defaultLoad.queries[0].params, [hoje])
  assert.match(defaultLoad.queries[1].sql, /AND date = \?/)
  assert.deepEqual(defaultLoad.queries[1].params, [hoje])

  const dataInicialNerus = calculateDate(2)

  const rangeLoad = loadRepository({
    ETIQUE_DAYS_TO_FETCH: '3'
  })
  const rangeAffectedRows =
    await rangeLoad.repository.atualizarNfcacheEtiquetaDiaAtual()

  assert.equal(rangeAffectedRows, 2)
  assert.equal(rangeLoad.queries.length, 2)
  assert.match(rangeLoad.queries[0].sql, /AND date BETWEEN \? AND \?/)
  assert.deepEqual(rangeLoad.queries[0].params, [
    dataInicialNerus,
    hoje
  ])
  assert.match(rangeLoad.queries[1].sql, /AND date BETWEEN \? AND \?/)
  assert.deepEqual(rangeLoad.queries[1].params, [
    dataInicialNerus,
    hoje
  ])
}
