// src/core/cron/pedidos.cron.ts
import { getActiveHubs } from '../utils'
import { executarCronPorHub } from '../hub-executor'
import { coreConfig } from '../env.schema'

const HUBS_COM_PEDIDOS = ['anymarket', 'pluggto', 'traycorp', 'traycommerce', 'wake', 'mercadolivre']

export async function runPedidosCron() {
  const active = getActiveHubs()
  const hubSelecionado = active.find(hub => HUBS_COM_PEDIDOS.includes(hub))

  if (!hubSelecionado) {
    console.warn('[CRON][PEDIDOS] Nenhum hub ativo oferece monitoramento de pedidos')
    return
  }

  console.log('[CRON][PEDIDOS] Hub selecionado pela ordem de ACTIVE_INTEGRATIONS', { hub: hubSelecionado })
  await executarCronPorHub(hubSelecionado, coreConfig, 'pedidos')
}
