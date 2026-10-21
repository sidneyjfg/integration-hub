import cron from 'node-cron'
import { runPedidosCron } from './pedidos.cron'
import { runProdutosCron } from './produtos.cron'
import { runBuscaCSCron, runEtiquetaCron, runNotasMLCron } from './notas-ml.cron'
import { runNotasMLSFTPCron } from './notas-ml-sftp.cron'
import { CoreEnv } from '../env.schema'
import { enfileirarCron } from '../../shared/cron-queue'

const HUBS_COM_PEDIDOS = ['anymarket', 'pluggto', 'traycorp', 'traycommerce', 'wake', 'mercadolivre']
const HUBS_COM_PRODUTOS = ['anymarket', 'pluggto', 'traycorp', 'traycommerce', 'wake']

function registrarResumoAgendamentos(coreConfig: CoreEnv): void {
  const ativos = coreConfig.ACTIVE_INTEGRATIONS.split(',').map(hub => hub.trim()).filter(Boolean)
  const pedidosAtivos = ativos.filter(hub => HUBS_COM_PEDIDOS.includes(hub))
  const hubPedidosSelecionado = pedidosAtivos[0]
  const produtosAtivos = ativos.filter(hub => HUBS_COM_PRODUTOS.includes(hub))
  const monitoramentoMLAtivo = ['1', 'true', 'yes', 'y'].includes(
    String(process.env.MERCADOLIVRE_ORDERS_MONITORING_ENABLED ?? '').trim().toLowerCase(),
  )
  const diasPedidosML = Number(process.env.MERCADOLIVRE_ORDERS_TO_FETCH || 7)
  const mostrar = (nome: string, expressao: string | undefined, hubs: string[]) => {
    console.log(`[STARTUP][CRON] ${nome}: ${expressao || 'desativado'}; hubs: ${expressao ? hubs.join(' → ') || 'nenhum hub ativo compatível' : 'nenhum'}`)
  }

  console.log(`[STARTUP][CONFIG] ACTIVE_INTEGRATIONS: ${ativos.join(', ') || 'nenhuma'}`)
  mostrar('Monitoramento de pedidos (CRON_PEDIDOS)', coreConfig.CRON_PEDIDOS, hubPedidosSelecionado ? [hubPedidosSelecionado] : [])
  if (coreConfig.CRON_PEDIDOS && pedidosAtivos.length > 1) {
    console.log(`[STARTUP][CRON] Pedidos: selecionado somente ${hubPedidosSelecionado}; demais hubs ignorados neste cron (${pedidosAtivos.slice(1).join(', ')}). A ordem de ACTIVE_INTEGRATIONS define qual roda.`)
  }
  if (coreConfig.CRON_PEDIDOS && hubPedidosSelecionado === 'mercadolivre') {
    console.log(
      `[STARTUP][CRON] Mercado Livre: ${monitoramentoMLAtivo ? `monitoramento ativo, janela de ${diasPedidosML} dia(s)` : 'monitoramento desativado; defina MERCADOLIVRE_ORDERS_MONITORING_ENABLED=true para ativar'}`,
    )
  } else if (coreConfig.CRON_PEDIDOS && pedidosAtivos.includes('mercadolivre') && hubPedidosSelecionado !== 'mercadolivre') {
    console.log(`[STARTUP][CRON] Mercado Livre não será usado para pedidos porque ${hubPedidosSelecionado} aparece antes. Para selecionar o Mercado Livre, coloque mercadolivre antes dele em ACTIVE_INTEGRATIONS.`)
  }
  mostrar('Produtos (CRON_PRODUTOS)', coreConfig.CRON_PRODUTOS, produtosAtivos)
  mostrar('Monitoramento normal de notas do Mercado Livre (CRON_NOTAS_ML)', coreConfig.CRON_NOTAS_ML, ativos.includes('mercadolivre') ? ['mercadolivre'] : [])
  mostrar('SFTP de notas do Mercado Livre (CRON_NOTAS_SFTP)', coreConfig.CRON_NOTAS_SFTP, ativos.includes('mercadolivre') ? ['mercadolivre'] : [])
  mostrar('Etiqueta (USA_ETIQUETA)', coreConfig.USA_ETIQUETA, ativos.includes('mercadolivre') ? ['mercadolivre'] : [])
  mostrar('Busca CS (ATIVA_BUSCA_CS)', coreConfig.ATIVA_BUSCA_CS, ativos.includes('mercadolivre') ? ['mercadolivre'] : [])
}

export function registerCrons(coreConfig: CoreEnv) {
  registrarResumoAgendamentos(coreConfig)

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
      enfileirarCron('busca CS', runBuscaCSCron),
      { timezone: 'America/Sao_Paulo' }
    )
  }
}
