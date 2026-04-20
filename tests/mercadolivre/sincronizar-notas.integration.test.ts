import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'

import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  getMercadoLivreXmlFixturePaths,
  createMercadoLivreAxiosMock
} from '../helpers/mercadolivre-fixtures'

type ServiceModule = typeof import('../../src/integrations/mercadolivre/services/sincronizar-notas-mercadolivre')
type UtilsModule = typeof import('../../src/integrations/mercadolivre/utils')

const serviceModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/services/sincronizar-notas-mercadolivre.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/env.schema.ts'
)
const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository.ts'
)
const buscarNotasModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/api/buscar-notas-mercadolivre.ts'
)
const googleChatModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/notifications/google-chat.ts'
)
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/utils/index.ts'
)
const coreEnvModulePath = path.resolve(
  __dirname,
  '../../src/core/env.schema.ts'
)
const coreDbModulePath = path.resolve(
  __dirname,
  '../../src/core/db.ts'
)
const axiosModulePath = require.resolve('axios')

export = async function runSincronizarNotasIntegrationTest(): Promise<void> {
  const notifications: Array<{ url: string; body: any }> = []
  let server: http.Server | null = null
  const currentWebhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  const hasExternalWebhook =
    Boolean(currentWebhookUrl) &&
    !currentWebhookUrl!.startsWith('http://127.0.0.1:9999')

  if (!hasExternalWebhook) {
    server = http.createServer((req, res) => {
      let body = ''

      req.on('data', chunk => {
        body += chunk
      })

      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })

    await new Promise<void>((resolve, reject) => {
      server!.listen(0, '127.0.0.1', error => {
        if (error) reject(error)
        else resolve()
      })
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Não foi possível iniciar o servidor local de webhook para teste.')
    }

    applyMercadoLivreTestEnv({
      GOOGLE_CHAT_WEBHOOK_URL: `http://127.0.0.1:${address.port}/webhook`
    })
  } else {
    applyMercadoLivreTestEnv()
  }

  clearModules([
    serviceModulePath,
    envModulePath,
    repositoryModulePath,
    buscarNotasModulePath,
    googleChatModulePath,
    utilsModulePath,
    coreEnvModulePath,
    coreDbModulePath
  ])

  const notasNaoIntegradas = [
    {
      CHAVE_NFE: '35222222222222222222222222222222222222222222',
      NFE: '1001',
      SERIE: '1',
      EMISSAO: '20260410'
    },
    {
      CHAVE_NFE: '35333333333333333333333333333333333333333333',
      NFE: '1002',
      SERIE: '2',
      EMISSAO: '20260411'
    }
  ]

  const insertExecutions: Array<{ sql: string; params: unknown[] }> = []
  const axiosMock = createMercadoLivreAxiosMock({ notifications })
  const realUtils = require(utilsModulePath) as UtilsModule

  const dbMock = {
    poolMain: {
      query: async (sql: string) => {
        if (sql.includes('.userfull u')) {
          return [[
            {
              clienteId: 'MLB-123',
              clientId: 'client-id',
              clientSecret: 'client-secret',
              accessToken: 'token',
              refreshToken: 'refresh-token'
            }
          ]]
        }

        return [[]]
      }
    },
    poolMonitoramento: {
      execute: async (sql: string, params?: unknown[]) => {
        if (sql.includes('CREATE TABLE IF NOT EXISTS')) {
          return [{ affectedRows: 0 }]
        }

        if (sql.includes('INSERT INTO')) {
          insertExecutions.push({ sql, params: params ?? [] })
          return [{ affectedRows: 1 }]
        }

        return [{ affectedRows: 0 }]
      },
      query: async (sql: string, params: unknown[]) => {
        if (sql.includes('FROM monitoramento.tmp_notas t')) {
          assert.deepEqual(params, [
            '35111111111111111111111111111111111111111111',
            '35222222222222222222222222222222222222222222',
            '35333333333333333333333333333333333333333333'
          ])
          return [notasNaoIntegradas]
        }

        return [[]]
      }
    }
  }

  const { sincronizarNotasMercadoLivre } = requireWithMocks<ServiceModule>(
    serviceModulePath,
    {
      [coreDbModulePath]: dbMock,
      [axiosModulePath]: axiosMock,
      [utilsModulePath]: {
        ...realUtils,
        extractAllFiles: async () => getMercadoLivreXmlFixturePaths()
      }
    }
  )

  try {
    await sincronizarNotasMercadoLivre()

    assert.equal(insertExecutions.length, 2)
    assert.equal(notifications.length, 2)
    assert.match(
      notifications[0].body.text,
      /2 notas do Mercado Livre não integradas no Nérus/
    )
    assert.match(notifications[0].body.text, /Cliente Teste - Conta MLB-123/)

    const payloadCard = notifications[1].body
    assert.equal(payloadCard.cardsV2.length, 1)
    assert.equal(payloadCard.cardsV2[0].card.sections[0].widgets.length, 2)
    assert.equal(
      payloadCard.cardsV2[0].card.sections[0].widgets[0].decoratedText.text,
      '<b>1001 / 1</b>'
    )
    assert.equal(
      payloadCard.cardsV2[0].card.sections[0].widgets[1].decoratedText.text,
      '<b>1002 / 2</b>'
    )
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(error => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }
}
