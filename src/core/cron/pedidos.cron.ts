// src/core/cron/pedidos.cron.ts
import { getActiveHubs } from '../utils'
import { executarCronPorHub } from '../hub-executor'
import { coreConfig } from '../env.schema'

const HUBS_COM_PEDIDOS = ['anymarket', 'pluggto', 'traycorp']

export async function runPedidosCron() {
  const active = getActiveHubs()

  for (const hub of active) {
    if (!HUBS_COM_PEDIDOS.includes(hub)) continue

    await executarCronPorHub(hub, coreConfig, 'pedidos')
  }
}
