import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules, requireWithMocks } from '../helpers/module-loader'

type RepositoryModule = typeof import('../../src/integrations/traycommerce/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/repositories/pedidos.repository.ts'
)
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const coreDbModulePath = path.resolve(__dirname, '../../src/core/db.ts')

export = async function runCompararPedidosTraycommerceMockTest(): Promise<void> {
  applyTraycommerceTestEnv()
  clearModules([repositoryModulePath, coreEnvModulePath, coreDbModulePath])

  const queries: string[] = []
  const consultas: Array<{ sql: string; params: unknown[] }> = []

  const naoIntegrados = [
    {
      ordnoweb: '77',
      ordnochannel: '',
      status: '1',
      status_name: 'A ENVIAR',
      date: '10/05/2022 00:00:00',
      total: '42.90',
      nfe_key: null,
      nao_integrado: 1
    }
  ]

  const dbMock = {
    poolMonitoramento: {
      query: async (sql: string, params: unknown[]) => {
        queries.push(sql)
        consultas.push({ sql, params })
        return [naoIntegrados]
      }
    }
  }

  const { buscarPedidosNaoIntegradosTraycommerce } =
    requireWithMocks<RepositoryModule>(repositoryModulePath, {
      [coreDbModulePath]: dbMock
    })

  const resultado = await buscarPedidosNaoIntegradosTraycommerce({
    from: '20220510',
    to: '20220511'
  })

  assert.equal(queries.length, 1)
  const sql = queries[0]

  assert.equal(resultado.length, 1)
  assert.equal(resultado[0].ordnoweb, '77')
  assert.equal(resultado[0].status_name, 'A ENVIAR')
  assert.equal(resultado[0].nao_integrado, 1)
  // o mysql2 devolve DECIMAL como string; sem converter o card mostra
  // 42.90 vindo de number e qualquer conta com total vira concatenacao
  assert.equal(resultado[0].total, 42.9)
  assert.equal(typeof resultado[0].total, 'number')

  // linkage pelo eordchannelp, como no Pluggto
  assert.match(sql, /temp_orders_traycommerce t/)
  assert.match(sql, /LEFT JOIN dados\.eordchannelp e/)
  assert.match(sql, /ON t\.ordnoweb = e\.ordnoweb/)

  // A consulta traz a janela inteira com a flag, em vez de filtrar so os
  // nao integrados no WHERE: e assim que os tres numeros do alerta saem
  // da mesma fonte e nunca ficam inconsistentes entre si.
  assert.doesNotMatch(
    sql,
    /WHERE[^]*?e\.ordnoweb IS NULL/,
    'o filtro de nao integrado virou flag, nao WHERE'
  )

  // loja de site proprio nao acompanha cancelado: eord nao entra na consulta
  // (o \b evita casar com eordchannelp, que continua sendo a ligacao correta)
  assert.doesNotMatch(
    sql,
    /\.eord\b(?!channelp)/i,
    'nao deve join em eord: eordchannelp nao tem status de cancelamento'
  )
  assert.doesNotMatch(
    sql,
    /status\s+(NOT\s+)?IN\s*\(\s*4/i,
    'nao deve filtrar status de cancelamento (4/5)'
  )
  assert.doesNotMatch(sql, /r\.status/, 'nao deve usar apelido de status inexistente')

  // a comparacao e por loja: o ERP tem uma entrada por storeno
  assert.match(sql, /e\.storeno IN \('1','2'\)/, 'precisa filtrar pelo STORENOS')

  // a janela e obrigatoria: sem ela a tabela acumulada mistura dias e o
  // alerta sai com "4 de 2". O que vai ao banco e o datetime ja formatado,
  // porque a API fala YYYYMMDD e o MySQL fala YYYY-MM-DD: mandar o formato
  // da API direto estoura ER_WRONG_VALUE 1525 em qualquer base real.
  assert.match(sql, /t\.date >= \?/)
  assert.match(sql, /t\.date < \?/)
  assert.doesNotMatch(
    sql,
    /CONCAT|DATE_ADD|INTERVAL/,
    'a conversao de data fica em JS, nao no SQL'
  )
  assert.deepEqual(consultas[0].params, [
    '2022-05-10 00:00:00',
    '2022-05-12 00:00:00'
  ])
  assert.match(sql, /ORDER BY t\.date ASC/, 'os mais antigos primeiro')

  // o repositorio precisa devolver a flag para o service contar
  assert.match(sql, /\(e\.ordnoweb IS NULL\) AS nao_integrado/)
}
