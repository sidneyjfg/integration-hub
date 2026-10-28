import assert from 'node:assert/strict'
import path from 'node:path'

import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  destinoReenvioPedido,
  parseRotasReenvioMercadoLivre,
  userIdDoPedidoMercadoLivre,
} from '../../src/integrations/mercadolivre/utils/reenvio-rotas'

type ReenviarModule = typeof import('../../src/integrations/mercadolivre/services/reenviar-pedidos-notas-mercadolivre')

const reenviarPath = path.resolve(__dirname, '../../src/integrations/mercadolivre/services/reenviar-pedidos-notas-mercadolivre.ts')
const envPath = path.resolve(__dirname, '../../src/integrations/mercadolivre/env.schema.ts')
const rotasPath = path.resolve(__dirname, '../../src/integrations/mercadolivre/utils/reenvio-rotas.ts')
const notasPath = path.resolve(__dirname, '../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository.ts')
const pedidosPath = path.resolve(__dirname, '../../src/integrations/mercadolivre/repositories/pedidos.repository.ts')
const axiosPath = require.resolve('axios')

const URL_GLOBAL = 'http://global.example/receive-notification'
const URL_LOJA = 'http://loja.example/receive-notification'

const conta = {
  clienteId: '111',
  clientId: '222',
  clientSecret: 'segredo',
  accessToken: 'access',
  refreshToken: 'refresh',
  storeno: 1,
}

function restaurarEnv(routesAntes: string | undefined, urlAntes: string | undefined): void {
  if (routesAntes === undefined) delete process.env.MERCADOLIVRE_NOTIFICATION_ROUTES
  else process.env.MERCADOLIVRE_NOTIFICATION_ROUTES = routesAntes
  if (urlAntes === undefined) delete process.env.MERCADOLIVRE_NOTIFICATION_URL
  else process.env.MERCADOLIVRE_NOTIFICATION_URL = urlAntes
  clearModules([reenviarPath, envPath, rotasPath])
}

async function carregarReenvio(env: Record<string, string>, consultas: {
  userIds: Map<string, string>
  credenciais: Array<typeof conta>
}) {
  applyMercadoLivreTestEnv(env)
  if (!Object.prototype.hasOwnProperty.call(env, 'MERCADOLIVRE_NOTIFICATION_ROUTES')) {
    delete process.env.MERCADOLIVRE_NOTIFICATION_ROUTES
  }
  clearModules([reenviarPath, envPath, rotasPath])

  const posts: Array<{ url: string; body: { user_id: number; application_id: number; resource: string } }> = []
  let consultasUserId = 0
  let consultasCredenciais = 0

  const modulo = requireWithMocks<ReenviarModule>(reenviarPath, {
    [axiosPath]: {
      post: async (url: string, body: { user_id: number; application_id: number; resource: string }) => {
        posts.push({ url, body })
        return { status: 200 }
      },
    },
    [notasPath]: {
      buscarCredenciaisMercadoLivre: async () => {
        consultasCredenciais++
        return consultas.credenciais
      },
      buscarLojasPorUserIdMercadoLivre: async () => {
        const lojas = new Map<string, string | number | null>()
        for (const credencial of consultas.credenciais) {
          lojas.set(credencial.clienteId, credencial.storeno ?? null)
        }
        return lojas
      },
    },
    [pedidosPath]: {
      buscarUserIdsPorPedidos: async () => {
        consultasUserId++
        return consultas.userIds
      },
    },
  })

  return { modulo, posts, consultas: () => ({ userId: consultasUserId, credenciais: consultasCredenciais }) }
}

export = async function runReenvioRotasTest(): Promise<void> {
  const routesAntes = process.env.MERCADOLIVRE_NOTIFICATION_ROUTES
  const urlAntes = process.env.MERCADOLIVRE_NOTIFICATION_URL
  const erro = console.error
  const aviso = console.warn
  console.error = () => {}
  console.warn = () => {}

  try {
    assert.deepEqual(parseRotasReenvioMercadoLivre(''), [])
    assert.deepEqual(parseRotasReenvioMercadoLivre(undefined), [])
    assert.equal(userIdDoPedidoMercadoLivre(undefined, '111').userId, '111')
    assert.equal(userIdDoPedidoMercadoLivre(undefined, '111').veioDoPedido, false)
    assert.deepEqual(userIdDoPedidoMercadoLivre(333, '111'), { userId: '333', veioDoPedido: true })
    assert.throws(() => parseRotasReenvioMercadoLivre('111|nao-e-url'), /URL inválida/)
    assert.throws(() => parseRotasReenvioMercadoLivre(`${'111'}|${URL_GLOBAL};111|${URL_LOJA}`), /repetido/)

    const atual = destinoReenvioPedido({
      rotas: [],
      urlGlobal: URL_GLOBAL,
      conta,
      userIdPedido: '333',
      credencialDoPedido: { clienteId: '333', clientId: '444', storeno: 2 },
    })
    assert.deepEqual(atual, {
      tipo: 'atual',
      url: URL_GLOBAL,
      userId: '111',
      applicationId: '222',
    })

    const semRotas = await carregarReenvio(
      { MERCADOLIVRE_NOTIFICATION_URL: URL_GLOBAL },
      { userIds: new Map([['20001', '333']]), credenciais: [] },
    )
    const resultadoAtual = await semRotas.modulo.reenviarPedidosPendentesNotasMercadoLivre(['20001'], conta)
    assert.equal(resultadoAtual.executado, true)
    assert.deepEqual(resultadoAtual.reenviados, ['20001'])
    assert.equal(semRotas.posts.length, 1)
    assert.equal(semRotas.posts[0].url, URL_GLOBAL)
    assert.equal(semRotas.posts[0].body.user_id, 111)
    assert.equal(semRotas.posts[0].body.application_id, 222)
    assert.equal(semRotas.posts[0].body.resource, '/orders/20001')
    assert.deepEqual(semRotas.consultas(), { userId: 0, credenciais: 0 })

    const comRotas = await carregarReenvio(
      {
        MERCADOLIVRE_NOTIFICATION_URL: URL_GLOBAL,
        MERCADOLIVRE_NOTIFICATION_ROUTES: `333|${URL_LOJA}`,
      },
      {
        userIds: new Map([['20001', '333'], ['20002', '999']]),
        credenciais: [
          { ...conta, clienteId: '333', clientId: '444', storeno: 2 },
          { ...conta, clienteId: '999', clientId: '555', storeno: 3 },
        ],
      },
    )
    const resultadoRotas = await comRotas.modulo.reenviarPedidosPendentesNotasMercadoLivre(
      ['20001', '20002', '20003'],
      conta,
    )
    assert.equal(resultadoRotas.executado, true)
    assert.deepEqual(resultadoRotas.falhas, [])
    assert.equal(comRotas.posts.length, 3)
    const porPedido = new Map(comRotas.posts.map(post => [post.body.resource, post]))
    assert.equal(porPedido.get('/orders/20001')?.url, URL_LOJA)
    assert.equal(porPedido.get('/orders/20001')?.body.user_id, 333)
    assert.equal(porPedido.get('/orders/20001')?.body.application_id, 444)
    assert.equal(porPedido.get('/orders/20002')?.url, URL_GLOBAL)
    assert.equal(porPedido.get('/orders/20002')?.body.user_id, 999)
    assert.equal(porPedido.get('/orders/20002')?.body.application_id, 555)
    assert.equal(porPedido.get('/orders/20003')?.url, URL_GLOBAL)
    assert.equal(porPedido.get('/orders/20003')?.body.user_id, 111)
    assert.equal(porPedido.get('/orders/20003')?.body.application_id, 222)
    assert.deepEqual(comRotas.consultas(), { userId: 1, credenciais: 1 })
  } finally {
    console.error = erro
    console.warn = aviso
    restaurarEnv(routesAntes, urlAntes)
  }
}
