import assert from 'node:assert/strict'
import path from 'node:path'

import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type ServiceModule = typeof import('../../src/integrations/mercadolivre/services/sincronizar-notas-mercadolivre')

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
const coreEnvModulePath = path.resolve(
  __dirname,
  '../../src/core/env.schema.ts'
)

export = async function runSincronizarNotasSemMaxRetryIntegrationTest(): Promise<void> {
  applyMercadoLivreTestEnv({
    GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/test/messages?key=test&token=test'
  })

  clearModules([
    serviceModulePath,
    envModulePath,
    repositoryModulePath,
    buscarNotasModulePath,
    googleChatModulePath,
    coreEnvModulePath
  ])

  let getRetryCountCalls = 0
  let zerarRetryCountCalls = 0

  const { sincronizarNotasMercadoLivre } = requireWithMocks<ServiceModule>(
    serviceModulePath,
    {
      [repositoryModulePath]: {
        verificarECriarTabelaTmpNotas: async () => undefined,
        buscarCredenciaisMercadoLivre: async () => [
          {
            clienteId: 'MLB-123',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            accessToken: 'token',
            refreshToken: 'refresh-token'
          }
        ],
        salvarNotasTmpMercadoLivre: async () => [],
        buscarNotasNaoIntegradasNerusPorChaves: async () => [
          {
            CHAVE_NFE: '35222222222222222222222222222222222222222222',
            NFE: '1001',
            SERIE: '1',
            EMISSAO: '20260410'
          }
        ],
        atualizarNfcacheEtiquetaDiaAtual: async () => {
          throw new Error('atualizarNfcacheEtiquetaDiaAtual nao deve ser chamado sem USA_ETIQUETA')
        },
        getRetryCountFfpreprocnf: async () => {
          getRetryCountCalls++
          throw new Error('getRetryCountFfpreprocnf nao deve ser chamado sem MERCADOLIVRE_MAX_RETRY_COUNT')
        },
        zerarRetryCountFfpreprocnf: async () => {
          zerarRetryCountCalls++
          throw new Error('zerarRetryCountFfpreprocnf nao deve ser chamado sem MERCADOLIVRE_MAX_RETRY_COUNT')
        }
      },
      [buscarNotasModulePath]: {
        buscarNotasMercadoLivre: async () => ({
          notas: [
            {
              chave: '35222222222222222222222222222222222222222222',
              tipoNota: 'remessa'
            }
          ]
        })
      },
      [googleChatModulePath]: {
        notifyGoogleChat: async () => undefined
      }
    }
  )

  await sincronizarNotasMercadoLivre()

  assert.equal(getRetryCountCalls, 0)
  assert.equal(zerarRetryCountCalls, 0)
}
