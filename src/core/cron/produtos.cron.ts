// src/core/cron/produtos.cron.ts
import { getActiveHubs } from '../utils'
import { executarCronPorHub } from '../hub-executor'
import { coreConfig } from '../env.schema'

const HUBS_COM_PRODUTOS = ['anymarket', 'pluggto', 'traycorp']

export async function runProdutosCron() {
  const active = getActiveHubs()

  for (const hub of active) {
    if (!HUBS_COM_PRODUTOS.includes(hub)) continue

    await executarCronPorHub(hub, coreConfig, 'produtos')
  }
}
