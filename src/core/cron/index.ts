import cron from 'node-cron'
import { runPedidosCron } from './pedidos.cron'
import { runProdutosCron } from './produtos.cron'
import { runNotasMLCron } from './notas-ml.cron'
import { runNotasMLSFTPCron } from './notas-ml-sftp.cron'
import { CoreEnv } from '../env.schema'

export function registerCrons(coreConfig: CoreEnv) {
  if (coreConfig.CRON_PEDIDOS) {
    cron.schedule(coreConfig.CRON_PEDIDOS, runPedidosCron)
  }

  if (coreConfig.CRON_PRODUTOS) {
    cron.schedule(coreConfig.CRON_PRODUTOS, runProdutosCron)
  }

  if (coreConfig.CRON_NOTAS_ML) {
    cron.schedule(coreConfig.CRON_NOTAS_ML, runNotasMLCron)
  }

  if(coreConfig.CRON_NOTAS_SFTP){
    cron.schedule(coreConfig.CRON_NOTAS_SFTP, runNotasMLSFTPCron)
  }
}
