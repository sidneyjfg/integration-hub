import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'

const CONTAINER = 'nerus-teste-mysql'
const IMAGEM = 'mysql:8.0'
const PORTA = 3307
const SENHA = 'teste-root'
const TIMEOUT_SUBIR_MS = 90_000

export const MYSQL_TESTE = {
  host: '127.0.0.1',
  port: PORTA,
  user: 'root',
  password: SENHA,
  monitoramento: 'monitoramento',
  dados: 'dados'
}

/**
 * Os testes de repositório mockam o pool, o que não prova nada: um carimbo
 * que devolve linhas fixas passa com a query errada, invertida ou sintaticamente
 * inválida. Foi assim que a comparação chegou à produção com
 * `CONCAT('20261001', ' 00:00:00')`, que o MySQL rejeita com ER_WRONG_VALUE
 * 1525, enquanto o teste que só olhava a string da query passava.
 *
 * Este harness sobe um MySQL de verdade para o teste rodar a SQL real.
 */
function docker(args: string[]): string {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

export function dockerDisponivel(): boolean {
  try {
    docker(['info', '--format', '{{.ServerVersion}}'])
    return true
  } catch {
    return false
  }
}

function conexao(extra: Record<string, unknown> = {}) {
  return mysql.createConnection({
    host: MYSQL_TESTE.host,
    port: MYSQL_TESTE.port,
    user: MYSQL_TESTE.user,
    password: MYSQL_TESTE.password,
    connectTimeout: 3000,
    ...extra
  })
}

function dormir(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * No primeiro boot o MySQL 8 sobe um servidor temporário para inicializar o
 * datadir, aceita conexão e depois reinicia. QuemConnectar nesse meio-tempo
 * leva PROTOCOL_CONNECTION_LOST. Retry curto resolve.
 */
async function conectarComRetry(extra: Record<string, unknown> = {}) {
  let ultimoErro: unknown

  for (let tentativa = 1; tentativa <= 10; tentativa++) {
    try {
      return await conexao(extra)
    } catch (erro) {
      ultimoErro = erro
      await dormir(1000)
    }
  }

  throw new Error(`não deu para abrir conexão no MySQL de teste: ${ultimoErro}`)
}

/**
 * Espera o MySQL ficar realmente pronto, e não só responder: exige duas
 * rodadas seguidas de conexão + consulta, porque o servidor de inicialização
 * também responde `SELECT 1`.
 */
async function esperarMySQL(): Promise<void> {
  const inicio = Date.now()
  let ultimoErro: unknown
  let consecutivas = 0

  while (Date.now() - inicio < TIMEOUT_SUBIR_MS) {
    try {
      const conn = await conexao()
      await conn.query('SELECT 1')
      await conn.end()

      consecutivas++
      if (consecutivas >= 2) {
        return
      }
    } catch (erro) {
      ultimoErro = erro
      consecutivas = 0
    }

    await dormir(1000)
  }

  throw new Error(
    `MySQL de teste não ficou pronto em ${TIMEOUT_SUBIR_MS}ms: ${ultimoErro}`
  )
}

/**
 * Os dois schemas que a query da comparação atravessa: a temp em
 * `monitoramento` e o `eordchannelp` em `dados`, que é onde o ERP registra
 * que o pedido já foi integrado.
 */
async function prepararSchemas(): Promise<void> {
  const conn = await conexao()

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${MYSQL_TESTE.monitoramento}`)
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${MYSQL_TESTE.dados}`)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ${MYSQL_TESTE.dados}.eordchannelp (
        ordnoweb VARCHAR(255) NOT NULL,
        storeno INT NOT NULL,
        KEY idx_ordnoweb_storeno (ordnoweb, storeno)
      ) ENGINE=InnoDB
    `)
  } finally {
    await conn.end()
  }
}

/**
 * Roda as migrations reais de `db/traycommerce/`, resolvidas por `__dirname`
 * e não pelo CWD como o `runHubMigrations` faz - assim o teste funciona de
 * qualquer diretório. Cada arquivo tem uma statement só, igual o runner.
 */
export async function rodarMigrationsTraycommerce(): Promise<string[]> {
  const dir = path.resolve(__dirname, '../../db/traycommerce')
  const arquivos = (await fs.readdir(dir)).sort()
  const aplicados: string[] = []

  const conn = await conectarComRetry({ database: MYSQL_TESTE.monitoramento })

  try {
    for (const arquivo of arquivos) {
      const sql = await fs.readFile(path.join(dir, arquivo), 'utf8')

      try {
        await conn.query(sql)
        aplicados.push(arquivo)
      } catch (erro: any) {
        // Mesma tolerância do runHubMigrations: coluna repetida não é erro.
        if (erro?.code === 'ER_DUP_FIELDNAME' || erro?.errno === 1060) {
          aplicados.push(`${arquivo} (ignorado)`)
          continue
        }
        throw new Error(`migration ${arquivo} falhou: ${erro.message}`)
      }
    }
  } finally {
    await conn.end()
  }

  return aplicados
}

export async function subirMySQL(): Promise<void> {
  // Container de uma execução que morreu no meio, senão o `run` falha por
  // nome em uso.
  try {
    docker(['rm', '-f', CONTAINER])
  } catch {
    // Não existia.
  }

  docker([
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    `MYSQL_ROOT_PASSWORD=${SENHA}`,
    '-p',
    `${PORTA}:3306`,
    '--tmpfs',
    '/var/lib/mysql',
    IMAGEM
  ])

  await esperarMySQL()
  await prepararSchemas()
}

export function desligarMySQL(): void {
  try {
    docker(['rm', '-f', CONTAINER])
  } catch {
    // Já estava fora.
  }
}