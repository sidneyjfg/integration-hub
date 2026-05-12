import assert from 'node:assert/strict'
import path from 'node:path'

import { clearModules, requireWithMocks } from '../helpers/module-loader'

type ServiceModule = typeof import('../../src/integrations/mercadolivre/services/sincronizar-etiqueta-mercadolivre')

const serviceModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/services/sincronizar-etiqueta-mercadolivre.ts'
)
const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/repositories/mercadolivre-notas.repository.ts'
)

export = async function runSincronizarEtiquetaIntegrationTest(): Promise<void> {
  clearModules([
    serviceModulePath,
    repositoryModulePath
  ])

  let atualizarNfcacheCalls = 0

  const { sincronizarEtiquetaMercadoLivre } = requireWithMocks<ServiceModule>(
    serviceModulePath,
    {
      [repositoryModulePath]: {
        atualizarNfcacheEtiquetaDiaAtual: async () => {
          atualizarNfcacheCalls++
          return 2
        }
      }
    }
  )

  await sincronizarEtiquetaMercadoLivre()

  assert.equal(atualizarNfcacheCalls, 1)
}
