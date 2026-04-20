import assert from 'node:assert/strict'
import path from 'node:path'

import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  getMercadoLivreXmlFixturePaths,
  createMercadoLivreAxiosMock
} from '../helpers/mercadolivre-fixtures'

type BuscarNotasModule = typeof import('../../src/integrations/mercadolivre/api/buscar-notas-mercadolivre')
type RepositoryModule = typeof import('../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository')
type UtilsModule = typeof import('../../src/integrations/mercadolivre/utils')

const buscarNotasModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/api/buscar-notas-mercadolivre.ts'
)
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
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/utils/index.ts'
)
const axiosModulePath = require.resolve('axios')

async function carregarNotasBaixadasDoMeli() {
  clearModules([buscarNotasModulePath, envModulePath, utilsModulePath])

  const realUtils = require(utilsModulePath) as UtilsModule
  const axiosMock = createMercadoLivreAxiosMock()

  const { buscarNotasMercadoLivre } = requireWithMocks<BuscarNotasModule>(
    buscarNotasModulePath,
    {
      [axiosModulePath]: axiosMock,
      [utilsModulePath]: {
        ...realUtils,
        extractAllFiles: async () => getMercadoLivreXmlFixturePaths()
      }
    }
  )

  const result = await buscarNotasMercadoLivre({
    clienteId: 'MLB-123',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    accessToken: 'token',
    refreshToken: 'refresh-token'
  })

  return result.notas
}

export = async function runSalvarNotasIntegrationTest(): Promise<void> {
  applyMercadoLivreTestEnv()

  const notasBaixadas = await carregarNotasBaixadasDoMeli()
  const executados: Array<{ sql: string; params: unknown[] }> = []

  const dbMock = {
    poolMain: {
      query: async () => [[]]
    },
    poolMonitoramento: {
      query: async () => [[]],
      execute: async (sql: string, params: unknown[]) => {
        executados.push({ sql, params })
        return [{ affectedRows: 1 }]
      }
    }
  }

  clearModules([
    repositoryModulePath,
    envModulePath,
    coreEnvModulePath,
    coreDbModulePath,
    utilsModulePath
  ])

  const { salvarNotasTmpMercadoLivre } = requireWithMocks<RepositoryModule>(
    repositoryModulePath,
    {
      [coreDbModulePath]: dbMock
    }
  )

  const inseridas = await salvarNotasTmpMercadoLivre(notasBaixadas)

  assert.equal(inseridas.length, 2)
  assert.equal(executados.length, 2)
  assert.equal(inseridas[0].NFe, '1002')
  assert.equal(inseridas[1].NFe, '1003')
  assert.match(executados[0].sql, /INSERT INTO monitoramento\.tmp_notas/)
  assert.equal(executados[0].params[2], '1002')
  assert.equal(executados[1].params[2], '1003')
}
