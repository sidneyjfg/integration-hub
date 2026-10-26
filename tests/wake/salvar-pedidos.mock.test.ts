import assert from 'node:assert/strict'
import path from 'node:path'

import { applyWakeTestEnv } from '../helpers/wake-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/wake/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/wake/repositories/pedidos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarPedidosWakeMockTest(): Promise<void> {
  await casoSalvaPedidos()
  await casoListaVazia()
  await casoPedidoSemId()
}

function carregarRepositorio(
  execute: (sql: string, params: unknown[]) => Promise<unknown>
) {
  applyWakeTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  return requireWithMocks<RepositoryModule>(repositoryModulePath, {
    [coreDbModulePath]: {
      poolMonitoramento: { execute }
    }
  })
}

async function casoSalvaPedidos(): Promise<void> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = []

  const repositorio = carregarRepositorio(async (sql, params) => {
    chamadas.push({ sql, params })
    return [{ affectedRows: 1 }]
  })

  const data = new Date('2026-10-01T18:53:24.846Z')

  await repositorio.salvarPedidosTempWake([
    {
      ordnoweb: '123',
      ordnochannel: 'ML-1',
      status: '9',
      status_name: 'Pedido Enviado',
      total: 99.9,
      date: data
    },
    {
      ordnoweb: '124',
      ordnochannel: '',
      status: '1',
      status_name: null,
      total: null,
      date: data
    }
  ])

  assert.equal(chamadas.length, 2)
  assert.match(
    chamadas[0].sql,
    /INSERT INTO monitoramento\.temp_orders_wake/,
    'a tabela precisa ser a propria do hub'
  )
  assert.match(chamadas[0].sql, /ON DUPLICATE KEY UPDATE/)
  assert.doesNotMatch(
    chamadas[0].sql,
    /nfe_key/,
    'a Wake nao monitora nota fiscal'
  )

  assert.deepEqual(chamadas[0].params, [
    '123',
    'ML-1',
    '9',
    'Pedido Enviado',
    99.9,
    data
  ])

  assert.deepEqual(chamadas[1].params, [
    '124',
    '',
    '1',
    null,
    null,
    data
  ])

  // a data nao pode ser reescrita no update: so entra no INSERT
  assert.doesNotMatch(chamadas[0].sql, /date\s*=\s*VALUES\(date\)/)
}

async function casoListaVazia(): Promise<void> {
  let chamou = false

  const repositorio = carregarRepositorio(async () => {
    chamou = true
    return [{ affectedRows: 0 }]
  })

  await repositorio.salvarPedidosTempWake([])

  assert.equal(chamou, false, 'lista vazia nao pode executar SQL')
}

async function casoPedidoSemId(): Promise<void> {
  const chamadas: unknown[] = []

  const repositorio = carregarRepositorio(async (_sql, params) => {
    chamadas.push(params)
    return [{ affectedRows: 1 }]
  })

  await repositorio.salvarPedidosTempWake([
    {
      ordnoweb: '',
      ordnochannel: '',
      status: '',
      status_name: null,
      total: null,
      date: new Date()
    }
  ])

  assert.equal(
    chamadas.length,
    0,
    'pedido sem ordnoweb precisa ser ignorado, nao gravado'
  )
}
