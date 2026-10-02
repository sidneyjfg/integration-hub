import assert from 'node:assert/strict'
import path from 'node:path'

import { applyTraycommerceTestEnv } from '../helpers/traycommerce-env'
import { clearModules } from '../helpers/module-loader'
import {
  MYSQL_TESTE,
  desligarMySQL,
  dockerDisponivel,
  rodarMigrationsTraycommerce,
  subirMySQL
} from '../helpers/mysql-container'

type DbModule = typeof import('../../src/core/db')
type RepositoryModule = typeof import('../../src/integrations/traycommerce/repositories/pedidos.repository')

const repositoryModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/repositories/pedidos.repository.ts'
)
const dbModulePath = path.resolve(__dirname, '../../src/core/db.ts')
const coreEnvModulePath = path.resolve(__dirname, '../../src/core/env.schema.ts')
const envModulePath = path.resolve(
  __dirname,
  '../../src/integrations/traycommerce/env.schema.ts'
)

/** Janela da API (YYYYMMDD) -> o que o MySQL deve selecionar. */
const JANELA = { from: '20261001', to: '20261002' }

/**
 * Repositories com o pool de verdade, apontando para o container. Sem mock:
 * o motivo do teste existir.
 */
function carregarSemMock() {
  applyTraycommerceTestEnv({
    DB_HOST_MONITORAMENTO: MYSQL_TESTE.host,
    DB_PORT_MONITORAMENTO: String(MYSQL_TESTE.port),
    DB_USER_MONITORAMENTO: MYSQL_TESTE.user,
    DB_PASS_MONITORAMENTO: MYSQL_TESTE.password,
    STORENOS: '1'
  })
  clearModules([repositoryModulePath, dbModulePath, coreEnvModulePath, envModulePath])

  const db = require(dbModulePath) as DbModule
  const repository = require(repositoryModulePath) as RepositoryModule

  return { poolMonitoramento: db.poolMonitoramento, poolMain: db.poolMain, ...repository }
}

export = async function runCompararPedidosTraycommerceMysqlTest(): Promise<void> {
  if (!dockerDisponivel()) {
    console.log(
      '    (pulado: docker indisponível, então o teste do MySQL real não roda)'
    )
    return
  }

  subirMySQL()

  try {
    // Rodar duas vezes tem que ser inócuo: é o que acontece em todo deploy e
    // o que o log do AWS mostrou ("ignorado (coluna já existe)").
    const primeira = await rodarMigrationsTraycommerce()
    const segunda = await rodarMigrationsTraycommerce()

    assert.ok(
      !primeira.some(m => m.includes('ignorado')),
      'a primeira rodada em base nova não tem coluna repetida'
    )
    assert.ok(
      segunda.some(m => m.includes('ignorado')),
      'a segunda rodada bate na coluna repetida e tem que ser tolerada'
    )

    const { poolMonitoramento, poolMain } = carregarSemMock()

    try {
      await casoJanelaStorenoEOrdem(poolMonitoramento, poolMain)
      await casoInsertGravaNaColunaCerta(poolMonitoramento)
    } finally {
      await poolMonitoramento.end()
      await poolMain.end()
    }
  } finally {
    desligarMySQL()
  }
}

/**
 * O caso que quebrou em produção. A comparação usava
 * `CONCAT('20261001', ' 00:00:00')`, que o MySQL rejeita com
 * ER_WRONG_VALUE 1525 porque a data não tem traço. Aqui a mesma query roda
 * de verdade e o recorte por janela é conferido pelos dados, não por regex.
 */
async function casoJanelaStorenoEOrdem(
  poolMonitoramento: DbModule['poolMonitoramento'],
  poolMain: DbModule['poolMain']
): Promise<void> {
  const naJanela = [
    ['9001', '2026-10-01 10:00:00', '1', '1234.56'],
    ['9002', '2026-10-01 15:00:00', '14', '10.00'],
    ['9003', '2026-10-02 09:00:00', '49', '20.50'],
    ['9004', '2026-10-02 23:59:59', '1', '30.00']
  ]

  const foraDaJanela = [
    ['8001', '2026-09-30 23:59:59', '1', '1.00'], // um segundo antes
    ['8002', '2026-10-03 00:00:00', '1', '2.00'], // limite exclusivo
    ['8003', '2026-08-01 12:00:00', '1', '3.00'] // acumulado antigo
  ]

  for (const [ordnoweb, date, status, total] of [...naJanela, ...foraDaJanela]) {
    await poolMonitoramento.query(
      `INSERT INTO temp_orders_traycommerce
         (ordnoweb, ordnochannel, status, status_name, nfe_key, total, date)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      [ordnoweb, '', status, 'STATUS', total, date]
    )
  }

  // 9002 integrado de verdade; 9003 integrado, mas na loja 2.
  await poolMain.query('INSERT INTO eordchannelp (ordnoweb, storeno) VALUES (?, ?)', [
    '9002',
    1
  ])
  await poolMain.query('INSERT INTO eordchannelp (ordnoweb, storeno) VALUES (?, ?)', [
    '9003',
    2
  ])

  const { buscarPedidosNaoIntegradosTraycommerce } = carregarSemMock()
  const linhas = await buscarPedidosNaoIntegradosTraycommerce(JANELA)

  assert.deepEqual(
    linhas.map(l => l.ordnoweb),
    ['9001', '9002', '9003', '9004'],
    'só a janela, e na ordem da mais antiga para a mais nova'
  )

  assert.deepEqual(
    linhas.map(l => l.nao_integrado),
    [1, 0, 1, 1],
    '9002 integrado; 9003 está no eordchannelp mas na loja 2, e STORENOS é 1'
  )

  assert.equal(linhas.length, 4)
  assert.equal(
    linhas.filter(l => l.nao_integrado === 1).length,
    3,
    'os três números do alerta saem da mesma fonte'
  )

  // O mysql2 devolve DECIMAL como string. O mock disso era a minha crença
  // sobre o driver; aqui o driver é o de verdade.
  assert.equal(linhas[0].total, 1234.56)
  assert.equal(typeof linhas[0].total, 'number')
  assert.equal(linhas[1].total, 10)

  assert.equal(linhas[0].nfe_key, null)
  assert.equal(linhas[0].status_name, 'STATUS')
}

/**
 * O mock do `salvar-pedidos` assertava a coluna e o parametro separados, sem
 * amarrar os dois: se o INSERT trocasse a ordem das colunas, o teste passaria
 * e a base gravaria lixo. Aqui o INSERT é executado no schema real e a
 * comparação funciona de leitor.
 */
async function casoInsertGravaNaColunaCerta(
  poolMonitoramento: DbModule['poolMonitoramento']
): Promise<void> {
  const { salvarPedidosTempTraycommerce } = carregarSemMock()

  await salvarPedidosTempTraycommerce([
    {
      id: 9500,
      date: '2026-10-01',
      external_code: null,
      total: '750.25',
      OrderStatus: { id: '14', status: 'PAGO' },
      OrderInvoice: []
    } as never
  ])

  const [linhas] = await poolMonitoramento.query(
    `SELECT ordnoweb, ordnochannel, status, status_name, total, date
       FROM temp_orders_traycommerce WHERE ordnoweb = '9500'`
  )

  assert.equal(linhas.length, 1)

  const linha = linhas[0]

  assert.equal(linha.ordnoweb, '9500', 'id numérico virou string')
  assert.equal(linha.ordnochannel, '', 'external_code null virou string vazia (NOT NULL)')
  assert.equal(linha.status, '14', 'status é o id, não o texto')
  assert.equal(linha.status_name, 'PAGO', 'o texto do status foi para a coluna certa')
  assert.equal(linha.total, '750.25', 'o valor foi para a coluna total, não para a data')
  assert.ok(linha.date instanceof Date, 'a data gravou como DATETIME')
  assert.equal(linha.date.getDate(), 1, 'e no dia certo, sem escorregar de fuso')
}