import assert from 'node:assert/strict'
import path from 'node:path'

import { applyMercadoLivreTestEnv } from '../helpers/mercadolivre-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'
import {
  getMercadoLivreXmlFixturePaths,
  createMercadoLivreAxiosMock
} from '../helpers/mercadolivre-fixtures'

type BuscarNotasModule = typeof import('../../src/integrations/mercadolivre/api/buscar-notas-mercadolivre')
type UtilsModule = typeof import('../../src/integrations/mercadolivre/utils')

const buscarNotasModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/api/buscar-notas-mercadolivre.ts'
)
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/env.schema.ts'
)
const utilsModulePath = path.resolve(
  __dirname,
  '../../src/integrations/mercadolivre/utils/index.ts'
)
const axiosModulePath = require.resolve('axios')

export = async function runBuscarNotasIntegrationTest(): Promise<void> {
  applyMercadoLivreTestEnv()
  clearModules([buscarNotasModulePath, envModulePath, utilsModulePath])

  const realUtils = require(utilsModulePath) as UtilsModule
  const axiosMock = createMercadoLivreAxiosMock()

  const { buscarNotasMercadoLivre } = requireWithMocks<BuscarNotasModule>(
    buscarNotasModulePath,
    {
      [axiosModulePath]: axiosMock,
      [utilsModulePath]: {
        ...realUtils,
        extractAllFiles: async () => getMercadoLivreXmlFixturePaths()
      }
    }
  )

  const result = await buscarNotasMercadoLivre({
    clienteId: 'MLB-123',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    accessToken: 'token',
    refreshToken: 'refresh-token'
  })

  assert.equal(result.notas.length, 3)
  assert.deepEqual(
    result.notas.map(nota => ({
      NFe: nota.NFe,
      serie: nota.serie,
      chave: nota.chave,
      emissao: nota.emissao,
      tipoNota: nota.tipoNota,
      tipo_logistico: nota.tipo_logistico
    })),
    [
      {
        NFe: '1001',
        serie: '1',
        chave: '35111111111111111111111111111111111111111111',
        emissao: '20260410',
        tipoNota: 'venda',
        tipo_logistico: 'Cross Docking'
      },
      {
        NFe: '1002',
        serie: '2',
        chave: '35222222222222222222222222222222222222222222',
        emissao: '20260411',
        tipoNota: 'retorno',
        tipo_logistico: 'Fulfillment'
      },
      {
        NFe: '1003',
        serie: '3',
        chave: '35333333333333333333333333333333333333333333',
        emissao: '20260412',
        tipoNota: 'remessa',
        tipo_logistico: 'Fulfillment'
      }
    ]
  )
}
