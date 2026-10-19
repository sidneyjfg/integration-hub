import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import { semEsperaReal } from '../helpers/traycommerce-axios-mock'
import { PedidoNaoIntegradoTraycommerce } from '../../src/shared/types/traycommerce'

type ReenviarModule = typeof import('../../src/integrations/traycommerce/services/reenviar-pedidos-traycommerce')

const reenviarModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/services/reenviar-pedidos-traycommerce.ts'
)
const enviarModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/services/enviar-pedido-nerus-traycommerce.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/env.schema.ts'
)

const URL_HUB =
  'http://mueller.nerus.com.br:3010/api/v1/order/receive-notification'

function pedido(ordnoweb: string): PedidoNaoIntegradoTraycommerce {
  return {
    ordnoweb,
    ordnochannel: '',
    status: '1',
    status_name: 'A ENVIAR',
    date: '10/05/2022 00:00:00',
    total: null,
    nfe_key: null,
    nao_integrado: 1
  }
}

async function silenciandoErros<T>(fn: () => Promise<T>): Promise<T> {
  const real = console.error
  console.error = () => {}
  try {
    return await fn()
  } finally {
    console.error = real
  }
}

interface Cenario {
  env: Record<string, string>
  deveFalhar: (ordnoweb: string, tentativa: number) => boolean
}

async function carregarReenvio(cenario: Cenario) {
  applyTraycommerceTestEnv(cenario.env)
  clearModules([reenviarModulePath, enviarModulePath, envModulePath])

  const chamadas: string[] = []
  const tentativas = new Map<string, number>()

  const enviarMock = {
    enviarPedidoNerusTraycommerce: async (ordnoweb: string) => {
      chamadas.push(ordnoweb)
      const tentativa = (tentativas.get(ordnoweb) ?? 0) + 1
      tentativas.set(ordnoweb, tentativa)

      if (cenario.deveFalhar(ordnoweb, tentativa)) {
        throw new Error(`falha simulada em ${ordnoweb}`)
      }
    }
  }

  const modulo = requireWithMocks<ReenviarModule>(reenviarModulePath, {
    [enviarModulePath]: enviarMock
  })

  return { modulo, chamadas }
}

export = async function runReenviarPedidosTraycommerceMockTest(): Promise<void> {
  await casoReenvioDesativado()
  await casoReenvioComSucesso()
  await casoFalhaRecuperadaNaSegundaPassada()
  await casoFalhaPersistente()
}

/** Sem NERUS_NOTIFICATION_URL o reenvio fica desligado e nada é enviado. */
async function casoReenvioDesativado(): Promise<void> {
  delete process.env.NERUS_NOTIFICATION_URL

  const { modulo, chamadas } = await carregarReenvio({
    env: {},
    deveFalhar: () => false
  })

  const resultado = await modulo.reenviarPedidosTraycommerce([
    pedido('77'),
    pedido('78')
  ])

  assert.equal(resultado.executado, false)
  assert.deepEqual(resultado.reenviados, [])
  assert.deepEqual(resultado.falhas, [])
  assert.equal(chamadas.length, 0, 'sem URL, nenhum pedido é enviado')
}

async function casoReenvioComSucesso(): Promise<void> {
  const { modulo, chamadas } = await carregarReenvio({
    env: { NERUS_NOTIFICATION_URL: URL_HUB },
    deveFalhar: () => false
  })

  const resultado = await semEsperaReal(() =>
    modulo.reenviarPedidosTraycommerce([pedido('77'), pedido('78')])
  )

  assert.equal(resultado.executado, true)
  assert.deepEqual(resultado.reenviados.slice().sort(), ['77', '78'])
  assert.deepEqual(resultado.falhas, [])
  assert.equal(chamadas.length, 2, 'sem falha, não há segunda passada')
}

/** Falha transitória na 1ª passada é recuperada no reenvio seguinte. */
async function casoFalhaRecuperadaNaSegundaPassada(): Promise<void> {
  const { modulo, chamadas } = await carregarReenvio({
    env: { NERUS_NOTIFICATION_URL: URL_HUB },
    deveFalhar: (ordnoweb, tentativa) => ordnoweb === '99' && tentativa === 1
  })

  const resultado = await silenciandoErros(() =>
    semEsperaReal(() => modulo.reenviarPedidosTraycommerce([pedido('99')]))
  )

  assert.equal(resultado.executado, true)
  assert.deepEqual(resultado.reenviados, ['99'])
  assert.deepEqual(resultado.falhas, [])
  assert.equal(chamadas.length, 2, 'reenvia na segunda passada')
}

/** Falha que persiste nas duas passadas entra em falhas. */
async function casoFalhaPersistente(): Promise<void> {
  const { modulo, chamadas } = await carregarReenvio({
    env: { NERUS_NOTIFICATION_URL: URL_HUB },
    deveFalhar: ordnoweb => ordnoweb === '99'
  })

  const resultado = await silenciandoErros(() =>
    semEsperaReal(() => modulo.reenviarPedidosTraycommerce([pedido('99')]))
  )

  assert.equal(resultado.executado, true)
  assert.deepEqual(resultado.reenviados, [])
  assert.deepEqual(resultado.falhas, ['99'])
  assert.equal(chamadas.length, 2, 'tenta de novo na segunda passada')
}
