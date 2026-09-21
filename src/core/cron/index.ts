import cron from 'node-cron'
import { runPedidosCron } from './pedidos.cron'
import { runProdutosCron } from './produtos.cron'
import { runBuscaCSCron, runEtiquetaCron, runNotasMLCron } from './notas-ml.cron'
import { runNotasMLSFTPCron } from './notas-ml-sftp.cron'
import { CoreEnv } from '../env.schema'
import { enfileirarCron } from '../../shared/cron-queue'

export function registerCrons(coreConfig: CoreEnv) {
  if (coreConfig.CRON_PEDIDOS) {
    cron.schedule(coreConfig.CRON_PEDIDOS, () =>
      enfileirarCron('pedidos', runPedidosCron)
    )
  }

  if (coreConfig.CRON_PRODUTOS) {
    cron.schedule(coreConfig.CRON_PRODUTOS, () =>
      enfileirarCron('produtos', runProdutosCron)
    )
  }

  if (coreConfig.CRON_NOTAS_ML) {
    cron.schedule(coreConfig.CRON_NOTAS_ML, () =>
      enfileirarCron('notas ML', runNotasMLCron)
    )
  }

  if (coreConfig.CRON_NOTAS_SFTP) {
    cron.schedule(coreConfig.CRON_NOTAS_SFTP, () =>
      enfileirarCron('notas ML SFTP', runNotasMLSFTPCron)
    )
  }

  if (coreConfig.USA_ETIQUETA) {
    cron.schedule(coreConfig.USA_ETIQUETA, () =>
      enfileirarCron('etiqueta', runEtiquetaCron)
    )
  }

  if (coreConfig.ATIVA_BUSCA_CS) {
    if (!cron.validate(coreConfig.ATIVA_BUSCA_CS)) {
      throw new Error('ATIVA_BUSCA_CS deve conter uma expressão cron válida ou ficar vazia para desativar')
    }

    cron.schedule(coreConfig.ATIVA_BUSCA_CS, () =>
      enfileirarCron('busca CS', runBuscaCSCron)
    )
  }
}
