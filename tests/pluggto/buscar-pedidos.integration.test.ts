import assert from 'node:assert/strict'
import path from 'node:path'

import { applyPluggtoTestEnv } from '../helpers/pluggto-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import { createPluggtoAxiosMock } from '../helpers/pluggto-fixtures'

type BuscarPedidosModule = typeof import('../../src/integrations/pluggto/api/buscar-pedidos-pluggto')

const buscarPedidosModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/api/buscar-pedidos-pluggto.ts'
)
const authModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/api/auth.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/env.schema.ts'
)
const axiosModulePath = require.resolve('axios')

export = async function runBuscarPedidosPluggtoIntegrationTest(): Promise<void> {
  applyPluggtoTestEnv({
    PLUGGTO_NO_LOOK_STATUS_TYPES: 'canceled, approved'
  })

  clearModules([buscarPedidosModulePath, authModulePath, envModulePath])

  const axiosMock = createPluggtoAxiosMock()

  const { buscarPedidosPluggto } = requireWithMocks<BuscarPedidosModule>(
    buscarPedidosModulePath,
    {
      [axiosModulePath]: axiosMock
    }
  )

  const pedidos = await buscarPedidosPluggto()

  assert.equal(pedidos.length, 2)
  assert.deepEqual(
    pedidos.map(p => ({ ordnoweb: p.ordnoweb, status: p.status })),
    [
      { ordnoweb: 'mongo-PLG-1001', status: 'delivered' },
      { ordnoweb: 'mongo-PLG-1004', status: 'invoiced' }
    ]
  )
}
