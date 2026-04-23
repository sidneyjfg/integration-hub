import assert from 'node:assert/strict'
import path from 'node:path'

import { applyPluggtoTestEnv } from '../helpers/pluggto-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import { createPluggtoOrdersApiPayload } from '../helpers/pluggto-fixtures'

type RepositoryModule = typeof import('../../src/integrations/pluggto/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/repositories/pedidos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarPedidosPluggtoIntegrationTest(): Promise<void> {
  applyPluggtoTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  const payload = createPluggtoOrdersApiPayload()
  const pedidos = payload.result.map(item => ({
    ordnoweb: item.Order.id,
    ordnochannel: item.Order.original_id ?? null,
    status: item.Order.status,
    nfe_key: item.Order.shipments?.[0]?.nfe_key ?? null,
    nfe_number: item.Order.shipments?.[0]?.nfe_number ?? null,
    nfe_serie: item.Order.shipments?.[0]?.nfe_serie ?? null,
    nfe_date: item.Order.shipments?.[0]?.nfe_date ?? null,
    total: item.Order.total ?? 0,
    subtotal: item.Order.subtotal ?? null,
    shipping: item.Order.shipping ?? null,
    discount: item.Order.discount ?? null,
    tax: item.Order.tax ?? null,
    total_paid: item.Order.total_paid ?? null,
    payment_type: item.Order.payments?.[0]?.payment_type ?? null,
    payment_method: item.Order.payments?.[0]?.payment_method ?? null,
    payment_installments: item.Order.payments?.[0]?.payment_installments
      ? Number(item.Order.payments?.[0]?.payment_installments)
      : null,
    channel: item.Order.channel,
    channel_account: item.Order.channel_account ?? null,
    delivery_type: item.Order.delivery_type ?? null,
    created_at: item.Order.created,
    approved_at: item.Order.approved_date ?? null,
    modified_at: item.Order.modified ?? null
  }))

  const executions: Array<{ sql: string; params: unknown[] }> = []

  const dbMock = {
    poolMonitoramento: {
      execute: async (sql: string, params: unknown[]) => {
        executions.push({ sql, params })
        return [{ affectedRows: 1 }]
      }
    }
  }

  const { salvarPedidosTempPluggto } = requireWithMocks<RepositoryModule>(
    repositoryModulePath,
    {
      [coreDbModulePath]: dbMock
    }
  )

  await salvarPedidosTempPluggto(pedidos)

  assert.equal(executions.length, 4)
  assert.match(executions[0].sql, /INSERT INTO monitoramento\.temp_orders/)
  assert.equal(executions[0].params[0], 'mongo-PLG-1001')
  assert.equal(executions[1].params[0], 'mongo-PLG-1002')
  assert.equal(executions[2].params[0], 'mongo-PLG-1003')
  assert.equal(executions[3].params[0], 'mongo-PLG-1004')
}
