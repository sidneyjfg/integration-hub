// src/core/hub-executor.ts
import type { CoreEnv } from './env.schema'

export async function executarCronPorHub(
  hub: string,
  coreConfig: CoreEnv,
  tipo: 'pedidos' | 'produtos' | 'notas' | 'sftp'
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hubCron = require(`../integrations/${hub}/cron`)

    console.log(
      `[CRON] Hub "${hub}" carregado. Funções disponíveis:`,
      Object.keys(hubCron)
    )
    
    if (tipo === 'pedidos' && hubCron.executarCronPedidos) {
      await hubCron.executarCronPedidos(coreConfig)
    }

    if (tipo === 'produtos' && hubCron.executarCronProdutos) {
      await hubCron.executarCronProdutos(coreConfig)
    }

    if (tipo === 'notas' && hubCron.executarCronNotas) {
      await hubCron.executarCronNotas(coreConfig)
    }
    if (tipo === 'sftp' && hubCron.executarCronNotas) {
      await hubCron.executarCronSFTP(coreConfig)
    }
  } catch (err) {
    console.error(`[CRON] Erro ao executar cron do hub ${hub}:`, err)
  }
}
