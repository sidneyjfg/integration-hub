import mysql from 'mysql2/promise'

const baseConfig = {
  host: process.env.DB_HOST_MONITORAMENTO,
  port: Number(process.env.DB_PORT_MONITORAMENTO ?? 3306),
  user: process.env.DB_USER_MONITORAMENTO,
  password: process.env.DB_PASS_MONITORAMENTO,
  waitForConnections: true,
  connectionLimit: 10
}

export const poolMain = mysql.createPool({
  ...baseConfig,
  database: process.env.DB_NAME_DADOS
})

export const poolMonitoramento = mysql.createPool({
  ...baseConfig,
  database: process.env.DB_NAME_MONITORAMENTO
})

/**
 * Horario do banco, usado na limpeza por `updated_at`. Ler do banco evita
 * depender do relogio/fuso do container, que pode diferir do MySQL.
 */
export async function agoraMonitoramento(): Promise<Date> {
  const [linhas] = await poolMonitoramento.query('SELECT NOW() AS agora')
  const agora = (linhas as Array<{ agora: Date }>)[0]?.agora

  if (!agora) {
    throw new Error('Não foi possível obter o horário do banco de monitoramento')
  }

  return agora
}
