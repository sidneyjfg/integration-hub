import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import { createTraycommerceOrders } from '../helpers/traycommerce-fixtures'

type RepositoryModule = typeof import('../../src/integrations/traycommerce/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/repositories/pedidos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runSalvarPedidosTraycommerceIntegrationTest(): Promise<void> {
  applyTraycommerceTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  const pedidos = createTraycommerceOrders()
  const executions: Array<{ sql: string; params: unknown[] }> = []

  const dbMock = {
    poolMonitoramento: {
      execute: async (sql: string, params: unknown[]) => {
        executions.push({ sql, params })
        return [{ affectedRows: 1 }]
      }
    }
  }

  const { salvarPedidosTempTraycommerce } = requireWithMocks<RepositoryModule>(
    repositoryModulePath,
    {
      [coreDbModulePath]: dbMock
    }
  )

  await salvarPedidosTempTraycommerce(pedidos)

  assert.equal(executions.length, 3)
  assert.match(executions[0].sql, /INSERT INTO monitoramento\.temp_orders_traycommerce/)
  assert.match(executions[0].sql, /ON DUPLICATE KEY UPDATE/)

  // --- pedido 77: id e total como string, external_code vazio ---
  const p77 = executions[0].params
  assert.equal(p77[0], '77', 'ordnoweb precisa ser o id da TrayCommerce em string')
  assert.equal(p77[1], '', 'external_code vazio nao pode virar null: a coluna e NOT NULL')
  assert.equal(p77[2], '1', 'status e o id do OrderStatus')
  assert.equal(p77[3], 'A ENVIAR', 'status_name e o texto do status')
  assert.equal(p77[4], null, 'nfe_key fica null enquanto nao houver OrderInvoice')
  assert.equal(p77[5], 1000, 'total chega como string e precisa virar numero')
  assert.equal(p77[5] as number, 1000)

  // --- data: a API manda so YYYY-MM-DD, sem fuso ---
  const data77 = p77[6] as Date
  assert.ok(data77 instanceof Date, 'date precisa ser Date')
  assert.equal(data77.getFullYear(), 2022)
  assert.equal(data77.getMonth(), 4, 'maio')
  assert.equal(data77.getDate(), 10, 'o dia nao pode voltar um pela conversao de UTC')
  assert.equal(data77.getHours(), 0, 'meia-noite local')

  // --- pedido 78: external_code preenchido ---
  assert.equal(executions[1].params[0], '78')
  assert.equal(executions[1].params[1], 'VTX-12345')
  assert.equal(executions[1].params[3], 'PAGO')
  assert.equal(executions[1].params[5], 250.5)

  // --- pedido 79: id numerico, external_code null, total vazio, sem invoice ---
  const p79 = executions[2].params
  assert.equal(p79[0], '79', 'id numerico tambem precisa virar string')
  assert.equal(p79[1], '', 'external_code null vira string vazia')
  assert.equal(p79[4], null)
  assert.equal(p79[5], null, 'total vazio nao pode virar NaN')
  assert.ok(p79[5] === null, 'total vazio tem que ser null, nunca NaN')

  const data79 = p79[6] as Date
  assert.equal(data79.getDate(), 11)

  // a data nao pode ser reescrita no update: so entra no INSERT
  assert.doesNotMatch(executions[0].sql, /date\s*=\s*VALUES\(date\)/)
}
