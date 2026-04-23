import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'

import { applyPluggtoTestEnv } from '../helpers/pluggto-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import { createPluggtoAxiosMock } from '../helpers/pluggto-fixtures'

type ServiceModule = typeof import('../../src/integrations/pluggto/services/sincronizar-pedidos-pluggto')

const serviceModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/services/sincronizar-pedidos-pluggto.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')
const envModulePath = path.resolve(__dirname, '../../src/integrations/pluggto/env.schema.ts')
const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/repositories/pedidos.repository.ts'
)
const buscarPedidosModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/api/buscar-pedidos-pluggto.ts'
)
const authModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/api/auth.ts'
)
const googleChatModulePath = path.resolve(
  __dirname,
  '../../src/integrations/pluggto/notifications/google-chat.ts'
)
const axiosModulePath = require.resolve('axios')

export = async function runSincronizarPedidosStatusIgnoradosTest(): Promise<void> {
  const notifications: Array<{ url: string; body: any }> = []
  const server = http.createServer((req, res) => {
    req.on('data', () => {})
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', error => {
      if (error) reject(error)
      else resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Nao foi possivel iniciar o servidor local do Google Chat.')
  }

  applyPluggtoTestEnv({
    GOOGLE_CHAT_WEBHOOK_URL: `http://127.0.0.1:${address.port}/webhook`,
    PLUGGTO_NO_LOOK_STATUS_TYPES: 'delivered, canceled, approved, invoiced'
  })

  clearModules([
    serviceModulePath,
    coreEnvModulePath,
    coreDbModulePath,
    envModulePath,
    repositoryModulePath,
    buscarPedidosModulePath,
    authModulePath,
    googleChatModulePath
  ])

  const executions: Array<{ sql: string; params: unknown[] }> = []
  const axiosMock = createPluggtoAxiosMock({ notifications })

  const dbMock = {
    poolMonitoramento: {
      execute: async (sql: string, params: unknown[]) => {
        executions.push({ sql, params })
        return [{ affectedRows: 1 }]
      },
      query: async () => [[]]
    }
  }

  const { sincronizarPedidosPluggto } = requireWithMocks<ServiceModule>(
    serviceModulePath,
    {
      [coreDbModulePath]: dbMock,
      [axiosModulePath]: axiosMock
    }
  )

  try {
    await sincronizarPedidosPluggto()

    assert.equal(executions.length, 0)
    assert.equal(notifications.length, 1)
    assert.match(notifications[0].body.text, /Nenhum pedido encontrado na Pluggto/)
    assert.match(
      notifications[0].body.text,
      /Filtro PLUGGTO_NO_LOOK_STATUS_TYPES: delivered, canceled, approved, invoiced/
    )
    assert.match(notifications[0].body.text, /Pedidos ignorados pelo filtro: 4/)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}
