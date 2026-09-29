import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/traycommerce/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/repositories/pedidos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSincronizarPedidosNaoIntegradosTraycommerceIntegrationTest(): Promise<void> {
  applyTraycommerceTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  const queries: string[] = []

  const naoIntegrados = [
    {
      ordnoweb: '77',
      ordnochannel: '',
      status: '1',
      status_name: 'A ENVIAR',
      date: '10/05/2022 00:00:00',
      total: 1000,
      nfe_key: null
    }
  ]

  const dbMock = {
    poolMonitoramento: {
      query: async (sql: string) => {
        queries.push(sql)
        return [naoIntegrados]
      }
    }
  }

  const { buscarPedidosNaoIntegradosTraycommerce } =
    requireWithMocks<RepositoryModule>(repositoryModulePath, {
      [coreDbModulePath]: dbMock
    })

  const resultado = await buscarPedidosNaoIntegradosTraycommerce()

  assert.equal(queries.length, 1)
  const sql = queries[0]

  assert.equal(resultado.length, 1)
  assert.equal(resultado[0].ordnoweb, '77')
  assert.equal(resultado[0].status_name, 'A ENVIAR')
  assert.equal(resultado[0].total, 1000)

  // linkage pelo eordchannelp, como no Pluggto
  assert.match(sql, /temp_orders_traycommerce t/)
  assert.match(sql, /LEFT JOIN dados\.eordchannelp e/)
  assert.match(sql, /ON t\.ordnoweb = e\.ordnoweb/)
  assert.match(sql, /WHERE e\.ordnoweb IS NULL/)

  // loja de site proprio nao acompanha cancelado: eord nao entra na consulta
  // (o \b evita casar com eordchannelp, que continua sendo a ligacao correta)
  assert.doesNotMatch(
    sql,
    /\.eord\b(?!channelp)/i,
    'nao deve join em eord: eordchannelp nao tem status de cancelamento'
  )
  assert.doesNotMatch(
    sql,
    /status\s+(NOT\s+)?IN\s*\(\s*4/i,
    'nao deve filtrar status de cancelamento (4/5)'
  )
  assert.doesNotMatch(sql, /r\.status/, 'nao deve usar apelido de status inexistente')

  // a comparacao e por loja: o ERP tem uma entrada por storeno
  assert.match(sql, /e\.storeno IN \('1','2'\)/, 'precisa filtrar pelo STORENOS')
}
