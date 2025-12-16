// src/core/cron/notas-ml.cron.ts
import { getActiveHubs } from '../utils'
import { executarCronPorHub } from '../hub-executor'
import { coreConfig } from '../env.schema'

export async function runNotasMLCron() {
  const active = getActiveHubs()

  if (!active.includes('mercadolivre')) return

  await executarCronPorHub('mercadolivre', coreConfig, 'notas')
}
