import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type NotificationsModule = typeof import('../../src/integrations/traycommerce/notifications/google-chat')

const notificationsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/notifications/google-chat.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')

export = async function runBuildPedidosNotificationTraycommerceTest(): Promise<void> {
  applyTraycommerceTestEnv()
  clearModules([notificationsModulePath, coreEnvModulePath])

  const { formatarLinhaPedido } = requireWithMocks<NotificationsModule>(
    notificationsModulePath,
    {}
  )

  const linha = formatarLinhaPedido({
    ordnoweb: '77',
    status: '1',
    status_name: 'A ENVIAR',
    date: '10/05/2022 00:00:00',
    total: 1000,
    ordnochannel: ''
  })

  // o relatorio precisa do texto do status, nao so do id
  assert.match(linha, /Status: A ENVIAR \(1\)/)
  assert.match(linha, /Pedido: 77/)
  assert.match(linha, /Total: 1000/)
  // canal vazio nao pode virar "undefined" nem "null"
  assert.match(linha, /Canal: —/)

  // sem status_name, cai no id; sem total, mostra o travessao
  const linhaPobre = formatarLinhaPedido({
    ordnoweb: '78',
    status: '14',
    date: '10/05/2022 00:00:00',
    total: null
  })

  assert.match(linhaPobre, /Status: 14/)
  assert.doesNotMatch(linhaPobre, /undefined|null/)
  assert.match(linhaPobre, /Total: —/)
}
